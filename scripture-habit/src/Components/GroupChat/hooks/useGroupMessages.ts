import { useReducer, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDoc, getDocs, limit, startAfter, startAt, DocumentSnapshot } from 'firebase/firestore';
import { safeStorage } from '../../../Utils/storage';
import apiClient from '../../../Utils/apiClient';
import confetti from 'canvas-confetti';
import * as Sentry from "@sentry/react";
import { Message, GroupData, MembersMap, UserProfileBrief } from '../../../types/chat';
import { db } from '../../../firebase';
import { FirebaseError } from 'firebase/app';
import { UserData } from '../../../types/user';
import { groupConverter, messageConverter, userConverter } from '../../../Utils/firestoreConverters';
import { parseTimestampToMillis } from '../../../Utils/timeUtils';

// 1. Define Discriminated Union for State
export type ChatStatus = 'loading' | 'active' | 'error' | 'notFound';

interface ChatState {
  status: ChatStatus;
  messages: Message[];
  groupData: GroupData | null;
  error: string | null;
  userReadCount: number | null;
  initialScrollDone: boolean;
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  membersMap: MembersMap;
}

// 2. Define Actions
export type ChatAction =
  | { type: 'RESET'; groupId: string }
  | { type: 'SET_INITIAL_STATE'; messages: Message[]; groupData: GroupData; readCount: number }
  | { type: 'UPDATE_GROUP'; groupData: GroupData }
  | { type: 'SET_NOT_FOUND' }
  | { type: 'SET_ERROR'; message: string }
  | { type: 'SET_MESSAGES'; messages: Message[] }
  | { type: 'ADD_NEW_MESSAGES'; newMessages: Message[] }
  | { type: 'SET_LOADING_OLDER'; isLoading: boolean }
  | { type: 'ADD_OLDER_MESSAGES'; olderMessages: Message[]; hasMore: boolean }
  | { type: 'SET_READ_COUNT'; count: number }
  | { type: 'SET_SCROLL_DONE' }
  | { type: 'UPDATE_MEMBERS'; newMembers: MembersMap }
  | { type: 'UPDATE_MESSAGE'; messageId: string; data: Partial<Message> }
  | { type: 'REMOVE_MESSAGE'; messageId: string };

// 3. Define Reducer
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'RESET':
      return {
        status: 'loading',
        messages: [],
        groupData: null,
        error: null,
        userReadCount: null,
        initialScrollDone: false,
        hasMoreOlder: true,
        isLoadingOlder: false,
        membersMap: {}
      };
    case 'SET_INITIAL_STATE':
      return {
        ...state,
        status: 'active',
        messages: action.messages,
        groupData: action.groupData,
        userReadCount: action.readCount
      };
    case 'UPDATE_GROUP':
      return { ...state, groupData: action.groupData };
    case 'SET_NOT_FOUND':
      return { ...state, status: 'notFound' };
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.message };
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages, status: 'active' };
    case 'ADD_NEW_MESSAGES': {
      const cleanIncoming = action.newMessages.filter(n => !state.messages.some(p => p.id === n.id));
      if (cleanIncoming.length === 0) return state;
      return { ...state, messages: [...state.messages, ...cleanIncoming] };
    }
    case 'SET_LOADING_OLDER':
      return { ...state, isLoadingOlder: action.isLoading };
    case 'ADD_OLDER_MESSAGES':
      return {
        ...state,
        messages: [...action.olderMessages, ...state.messages],
        hasMoreOlder: action.hasMore,
        isLoadingOlder: false
      };
    case 'SET_READ_COUNT':
      return { ...state, userReadCount: action.count };
    case 'SET_SCROLL_DONE':
      return { ...state, initialScrollDone: true };
    case 'UPDATE_MEMBERS':
      return { ...state, membersMap: { ...state.membersMap, ...action.newMembers } };
    case 'UPDATE_MESSAGE':
      return { ...state, messages: state.messages.map(m => m.id === action.messageId ? { ...m, ...action.data } : m) };
    case 'REMOVE_MESSAGE':
      return { ...state, messages: state.messages.filter(m => m.id !== action.messageId) };
    default:
      return state;
  }
};

const initialState: ChatState = {
  status: 'loading',
  messages: [],
  groupData: null,
  error: null,
  userReadCount: null,
  initialScrollDone: false,
  hasMoreOlder: true,
  isLoadingOlder: false,
  membersMap: {}
};

export const useGroupMessages = (groupId: string | null, userData: UserData | null, t: (key: string) => string) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  
  const currentGroupIdRef = useRef<string | null>(groupId);
  const prevMessageCountRef = useRef(0);
  const latestMessageRef = useRef<Message | null>(null);
  const userReadCountRef = useRef<number | null>(null);
  const membersMapRef = useRef<MembersMap>({});

  useEffect(() => {
    userReadCountRef.current = state.userReadCount;
    membersMapRef.current = state.membersMap;
  }, [state.userReadCount, state.membersMap]);

  // Helper for read status
  const updateReadStatus = useCallback(async (gid: string, totalCount: number) => {
    if (!userData?.uid || !gid || totalCount <= 0) return;
    try {
      await apiClient.post('/api/update-read-status', { 
        groupId: gid, 
        readMessageCount: totalCount 
      });

      dispatch({ type: 'SET_READ_COUNT', count: totalCount });
    } catch (err) {
      console.error("Failed to update read status:", err);
    }
  }, [userData?.uid]);

  // Robust Read Synchronization Effect
  useEffect(() => {
    if (!groupId || !state.groupData || state.userReadCount === null) return;
    
    const totalMsgs = state.groupData.messageCount || 0;
    if (totalMsgs > state.userReadCount) {
      updateReadStatus(groupId, totalMsgs);
    }
  }, [groupId, state.groupData?.messageCount, state.userReadCount, updateReadStatus]);

  useEffect(() => {
    if (!groupId) return;
    currentGroupIdRef.current = groupId;
    dispatch({ type: 'RESET', groupId });

    let isCancelled = false;
    let unsubscribeGroup = () => { };
    let unsubscribeNewMessages = () => { };

    const groupRef = doc(db, 'groups', groupId).withConverter(groupConverter);

    // 1. Group Data Sync
    unsubscribeGroup = onSnapshot(groupRef, (docSnap) => {
      if (isCancelled) return;
      if (docSnap.exists()) {
        const data = docSnap.data();
        dispatch({ type: 'UPDATE_GROUP', groupData: { ...data, _groupId: groupId } as GroupData });
      } else {
        dispatch({ type: 'SET_NOT_FOUND' });
      }
    }, (err) => {
      if (err.code === 'permission-denied') return;
      const isQuota = err.code === 'resource-exhausted' || err.message.toLowerCase().includes('quota exceeded');
      dispatch({ type: 'SET_ERROR', message: isQuota ? t('systemErrors.quotaExceededMessage') : err.message });
      if (!isQuota) Sentry.captureException(err);
    });

    // 2. Initial State & Sync Fetch
    const initChain = async () => {
      try {
        if (userData?.uid) {
          const stateRef = doc(db, 'users', userData.uid, 'groupStates', groupId);
          const stateSnap = await getDoc(stateRef);
          const initialReadCount = stateSnap.exists() ? (stateSnap.data().readMessageCount || 0) : 0;

          const gSnap = await getDoc(groupRef);
          let currentGroupData = null;
          if (gSnap.exists()) {
            currentGroupData = gSnap.data();
            if (currentGroupData.members) {
              // Quick fetch members
              const missingUids = currentGroupData.members.filter(uid => !membersMapRef.current[uid]);
              if (missingUids.length > 0) {
                const snapshots = await Promise.all(missingUids.map(uid => getDoc(doc(db, 'users', uid).withConverter(userConverter))));
                const newMembers: MembersMap = {};
                snapshots.forEach(s => {
                  if (s.exists()) newMembers[s.id] = { id: s.id, ...s.data() } as UserProfileBrief;
                });
                dispatch({ type: 'UPDATE_MEMBERS', newMembers });
              }
            }
          }

          // 3. Init Messages
          const messagesRef = collection(db, 'groups', groupId, 'messages').withConverter(messageConverter);
          const lastViewedMsgId = safeStorage.get(`last_viewed_msg_${groupId}_${userData.uid}`);

          let initialMsgs: Message[] = [];
          let lastDocInInitialBatch: DocumentSnapshot<Message> | null = null;
          let anchorSnapshot: DocumentSnapshot<Message> | null = null;
          
          if (lastViewedMsgId) {
            anchorSnapshot = await getDoc(doc(db, 'groups', groupId, 'messages', lastViewedMsgId).withConverter(messageConverter));
          }

          if (isCancelled) return;

          if (anchorSnapshot?.exists()) {
            const [nextSnaps, prevSnaps] = await Promise.all([
              getDocs(query(messagesRef, orderBy('createdAt', 'asc'), startAt(anchorSnapshot), limit(25))),
              getDocs(query(messagesRef, orderBy('createdAt', 'desc'), startAfter(anchorSnapshot), limit(5)))
            ]);
            initialMsgs = [...prevSnaps.docs.map(d => d.data()).reverse(), ...nextSnaps.docs.map(d => d.data())];
            if (nextSnaps.docs.length > 0) {
              lastDocInInitialBatch = nextSnaps.docs[0]; // The oldest of this batch (since we ordered asc)
            } else {
              lastDocInInitialBatch = anchorSnapshot;
            }
          } else {
            const latestSnaps = await getDocs(query(messagesRef, orderBy('createdAt', 'desc'), limit(50)));
            initialMsgs = latestSnaps.docs.map(d => d.data()).reverse();
            if (latestSnaps.docs.length > 0) {
              // latestSnaps is DESC (newest at [0]), so the last one is the oldest
              lastDocInInitialBatch = latestSnaps.docs[latestSnaps.docs.length - 1];
            }
          }

          if (isCancelled) return;
          dispatch({ type: 'SET_INITIAL_STATE', messages: initialMsgs, groupData: { ...currentGroupData, _groupId: groupId } as GroupData, readCount: initialReadCount });

          // 4. Real-time Message Listener
          const startListener = (anchor: DocumentSnapshot<Message> | null) => {
            let q = query(messagesRef, orderBy('createdAt', 'asc'));
            if (anchor) {
              q = query(messagesRef, orderBy('createdAt', 'asc'), startAt(anchor));
            }

            const unsubscribe = onSnapshot(q, (snapshot) => {
              if (isCancelled) return;
              const newIncoming: Message[] = [];
              snapshot.docChanges().forEach((change) => {
                const data = change.doc.data();
                if (change.type === "added") {
                  const messageTime = parseTimestampToMillis(data.createdAt);
                  const isRecent = messageTime && (Date.now() - messageTime) < 30000;
                  if (data.messageType === 'streakAnnouncement' && data.messageData?.userId !== userData?.uid && isRecent) {
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 10000 });
                  }
                  newIncoming.push(data);
                } else if (change.type === "modified") {
                  dispatch({ type: 'UPDATE_MESSAGE', messageId: change.doc.id, data });
                } else if (change.type === "removed") {
                  dispatch({ type: 'REMOVE_MESSAGE', messageId: change.doc.id });
                }
              });
              if (newIncoming.length > 0) dispatch({ type: 'ADD_NEW_MESSAGES', newMessages: newIncoming });
            }, (err) => {
              if (isCancelled || err.code === 'permission-denied') return;
              console.error("[useGroupMessages] Listener error:", err);
            });
            return unsubscribe;

          };

          unsubscribeNewMessages = startListener(lastDocInInitialBatch);
        }

      } catch (err: unknown) {
        if (err instanceof FirebaseError && err.code !== 'permission-denied' && !isCancelled) {
          console.error("Error in initChain:", err);
          dispatch({ type: 'SET_ERROR', message: "Failed to load chat." });
        } else if (err instanceof Error && !isCancelled) {
          console.error("Non-Firebase error in initChain:", err);
        }
      }
    };

    initChain();

    return () => {
      isCancelled = true;
      unsubscribeGroup();
      unsubscribeNewMessages();
    };
  }, [groupId, userData?.uid, updateReadStatus, t]);

  const loadMoreOlderMessages = async (containerRef: React.RefObject<HTMLDivElement | null>, previousScrollHeightRef: React.MutableRefObject<number>, previousScrollTopRef: React.MutableRefObject<number>) => {
    if (!groupId || state.isLoadingOlder || !state.hasMoreOlder || state.messages.length === 0) return;
    dispatch({ type: 'SET_LOADING_OLDER', isLoading: true });

    if (containerRef.current) {
      previousScrollHeightRef.current = containerRef.current.scrollHeight;
      previousScrollTopRef.current = containerRef.current.scrollTop;
    }

    try {
      const oldestMsg = state.messages[0];
      if (!oldestMsg.createdAt) return;
      const q = query(collection(db, 'groups', groupId, 'messages').withConverter(messageConverter), orderBy('createdAt', 'desc'), startAfter(oldestMsg.createdAt), limit(20));
      const snaps = await getDocs(q);
      if (snaps.empty) {
        dispatch({ type: 'ADD_OLDER_MESSAGES', olderMessages: [], hasMore: false });
      } else {
        const newOlderMsgs = snaps.docs.map(d => d.data()).reverse();
        dispatch({ type: 'ADD_OLDER_MESSAGES', olderMessages: newOlderMsgs, hasMore: true });
      }
    } catch (e) {
      console.error("Error loading older messages", e);
      dispatch({ type: 'SET_LOADING_OLDER', isLoading: false });
    }
  };

  return {
    ...state,
    loading: state.status === 'loading',
    groupNotFound: state.status === 'notFound',
    setMessages: (msgs: Message[]) => dispatch({ type: 'SET_MESSAGES', messages: msgs }),
    setGroupData: (data: GroupData) => dispatch({ type: 'UPDATE_GROUP', groupData: data }),
    setInitialScrollDone: () => dispatch({ type: 'SET_SCROLL_DONE' }),
    loadMoreOlderMessages,
    setMembersMap: (members: MembersMap) => dispatch({ type: 'UPDATE_MEMBERS', newMembers: members }),
    currentGroupIdRef,
    prevMessageCountRef,
    latestMessageRef,
    dispatch
  };
};
