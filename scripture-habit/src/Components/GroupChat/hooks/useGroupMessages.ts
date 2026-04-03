import { useReducer, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDoc, getDocs, limit, startAfter, where, documentId, loadBundle } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import * as Sentry from "@sentry/react";
import { Message, GroupData, MembersMap, UserProfileBrief } from '../../../types/chat';
import { db } from '../../../firebase';
import { UserData } from '../../../types/user';
import { groupConverter, messageConverter, userConverter, groupMemberConverter } from '../../../Utils/firestoreConverters';
import { parseTimestampToMillis } from '../../../Utils/timeUtils';
import apiClient from '../../../Utils/apiClient';

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
        groupData: action.groupData || state.groupData,
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
      // Ensure we sort by date after adding (to handle potential out-of-order listener events)
      const newMessages = [...state.messages, ...cleanIncoming].sort((a, b) => {
        const timeA = parseTimestampToMillis(a.createdAt);
        const timeB = parseTimestampToMillis(b.createdAt);
        return timeA - timeB;
      });
      return { ...state, messages: newMessages };
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

  // Helper for read status (Optimized for performance: direct Firestore write instead of API call)
  const updateReadStatus = useCallback(async (gid: string, totalCount: number) => {
    if (!userData?.uid || !gid || totalCount <= 0) return;
    try {
      const { writeBatch, doc, serverTimestamp } = await import('firebase/firestore');
      const batch = writeBatch(db);

      // 1. Update personal read count for this group
      const memberRef = doc(db, 'groups', gid, 'members', userData.uid);
      batch.set(memberRef, {
        lastReadAt: serverTimestamp(),
        readMessageCount: totalCount
      }, { merge: true });

      // 2. Update general user state for group unread counts (Dashboard)
      const groupStateRef = doc(db, 'users', userData.uid, 'groupStates', gid);
      batch.set(groupStateRef, {
        readMessageCount: totalCount,
        lastReadAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();

      dispatch({ type: 'SET_READ_COUNT', count: totalCount });
    } catch (err) {
      console.error("Failed to update read status directly:", err);
    }
  }, [userData?.uid, dispatch]);

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
    let unsubscribeMembers = () => { };

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

    // 1.5 Fetch Members once (One-time fetch to avoid N^2 snapshot explosion)
    // We fetch everyone once to get their names/avatars/statuses.
    // Real-time read receipts for everyone as they happen is omitted to save significant costs.
    const fetchMembers = async () => {
      try {
        const membersRef = collection(db, 'groups', groupId, 'members').withConverter(groupMemberConverter);
        const snapshot = await getDocs(membersRef);
        const initialMembers: MembersMap = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          initialMembers[doc.id] = { ...data, id: data.uid } as UserProfileBrief;
        });
        if (Object.keys(initialMembers).length > 0) {
          dispatch({ type: 'UPDATE_MEMBERS', newMembers: initialMembers });
        }
      } catch (err) {
        if (!isCancelled && (err as any).code !== 'permission-denied') {
          console.error("[useGroupMessages] Members fetch error:", err);
        }
      }
    };
    fetchMembers();

    // 2. Initial State & Sync Fetch
    const initChain = async () => {
      // 3. Real-time Message Listener (Fixed Window for Scale) - START IMMEDIATELY
      // Because Firestore Persistence is enabled in firebase.ts, this will return 
      // cached messages from local disk in milliseconds, providing the "Instant" feel.
      const messagesRef = collection(db, 'groups', groupId, 'messages').withConverter(messageConverter);
      
      const startListener = () => {
        if (unsubscribeNewMessages) unsubscribeNewMessages();
        const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          if (isCancelled) return;
          const newIncoming: Message[] = [];
          const updatedMessages: Message[] = [];
          const removedIds: string[] = [];

          snapshot.docChanges().forEach((change) => {
            const data = change.doc.data() as Message;
            if (change.type === "added") {
              newIncoming.push(data);
            } else if (change.type === "modified") {
              updatedMessages.push(data);
            } else if (change.type === "removed") {
              removedIds.push(change.doc.id);
            }
          });

          if (newIncoming.length > 0) {
            dispatch({ type: 'ADD_NEW_MESSAGES', newMessages: newIncoming });
          }
          updatedMessages.forEach(msg => {
            dispatch({ type: 'UPDATE_MESSAGE', messageId: msg.id, data: msg });
          });
          removedIds.forEach(id => {
            dispatch({ type: 'REMOVE_MESSAGE', messageId: id });
          });

          newIncoming.forEach(data => {
            const messageTime = parseTimestampToMillis(data.createdAt);
            const isRecent = messageTime && (Date.now() - messageTime) < 30000;
            if (data.messageType === 'streakAnnouncement' && data.messageData?.userId !== userData?.uid && isRecent) {
              confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 10000 });
            }
          });
        }, (err) => {
          if (isCancelled || err.code === 'permission-denied') return;
          console.error("[useGroupMessages] Listener error:", err);
        });
        
        unsubscribeNewMessages = unsubscribe;
      };

      startListener();
      listenerStarterRef.current = startListener;

      // Background Tasks (Optimizations)
      try {
        if (userData?.uid) {
          // A. Fetch Read Count in background
          getDoc(doc(db, 'users', userData.uid, 'groupStates', groupId)).then(stateSnap => {
            if (stateSnap.exists() && !isCancelled) {
              dispatch({ type: 'SET_READ_COUNT', count: stateSnap.data().readMessageCount || 0 });
            }
          });

          // B. Hydrate Firestore cache with a Bundle in background (Cost reduction)
          apiClient.get(`/api/bundle/${groupId}`, { 
            responseType: 'arraybuffer',
            timeout: 5000 
          }).then(bundleResponse => {
            if (bundleResponse.data && !isCancelled) {
              loadBundle(db, bundleResponse.data).then(() => {
                console.log("[useGroupMessages] Bundle hydrated in background");
              });
            }
          }).catch(err => {
            console.warn("[useGroupMessages] Background bundle hydration skipped:", err);
          });
        }
      } catch (err: unknown) {
        console.error("[useGroupMessages] Background tasks error:", err);
      }
    };

    initChain();

    return () => {
      isCancelled = true;
      unsubscribeGroup();
      if (unsubscribeNewMessages) unsubscribeNewMessages();
      unsubscribeMembers();
    };
  }, [groupId, userData?.uid, updateReadStatus, t]);

  // Reactive Profile Fetcher: Whenever groupData or membersMap changes, 
  // fetch info for any unknown users found in the group members list.
  useEffect(() => {
    const members = state.groupData?.members;
    if (!groupId || !members || state.status === 'loading') return;

    const fetchUnknownProfiles = async () => {
      const missingUids = members.filter(uid => !state.membersMap[uid]);
      if (missingUids.length === 0) return;

      const batches = [];
      for (let i = 0; i < missingUids.length; i += 30) {
        batches.push(missingUids.slice(i, i + 30));
      }

      const newMembers: MembersMap = {};
      try {
        await Promise.all(batches.map(async (batch) => {
          const q = query(collection(db, 'users').withConverter(userConverter), where(documentId(), 'in', batch));
          const snaps = await getDocs(q);
          snaps.forEach(s => {
            const data = s.data();
            newMembers[s.id] = { id: s.id, ...data } as UserProfileBrief;
          });
        }));

        if (Object.keys(newMembers).length > 0) {
          dispatch({ type: 'UPDATE_MEMBERS', newMembers });
        }
      } catch (err) {
        console.error("[useGroupMessages] Reactive profiles fetch error:", err);
      }
    };

    fetchUnknownProfiles();
  }, [groupId, state.groupData?.members, state.status]); // Keep membersMap out of deps to avoid loops, status gate ensures we have initial state.

  const listenerStarterRef = useRef<((oldest: Message | null) => void) | null>(null);

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
        
        // NO RESTART NEEDED: The listener stays on the tail of the conversation.
        // History is static once loaded via getDocs.
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
