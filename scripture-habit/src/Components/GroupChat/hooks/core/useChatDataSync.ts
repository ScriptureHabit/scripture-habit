import { useReducer, useEffect, useRef, useCallback, Dispatch } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDocs, limit, startAfter, where, documentId, loadBundle, Unsubscribe, FirestoreError } from 'firebase/firestore';
import * as Sentry from "@sentry/react";
import { Message, GroupData, MembersMap, UserProfileBrief } from '../../../../types/chat';
import { db } from '../../../../firebase';
import { UserData } from '../../../../types/user';
import { groupConverter, messageConverter, userConverter, groupMemberConverter } from '../../../../Utils/firestoreConverters';
import { UserProfileBriefSchema, GroupSchema } from '../../../../types/schemas';

import apiClient from '../../../../Utils/apiClient';
import { chatReducer, initialState, ChatAction, ChatStatus } from './chatReducer';

/**
 * Sub-hook for syncing Group Metadata
 */
const useGroupMetadataSync = (groupId: string | null, dispatch: Dispatch<ChatAction>, t: (key: string) => string) => {
  useEffect(() => {
    if (!groupId) return;

    const groupRef = doc(db, 'groups', groupId).withConverter(groupConverter);

    const unsubscribe = onSnapshot(groupRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        dispatch({ 
          type: 'UPDATE_GROUP', 
          groupData: GroupSchema.parse({ ...data, _groupId: groupId }) as GroupData 
        });
      } else {
        dispatch({ type: 'SET_NOT_FOUND' });
      }
    }, (err) => {
      if (err.code === 'permission-denied') return;
      const isQuota = err.code === 'resource-exhausted' || err.message.toLowerCase().includes('quota exceeded');
      dispatch({ type: 'SET_ERROR', message: isQuota ? t('systemErrors.quotaExceededMessage') : err.message });
      if (!isQuota) Sentry.captureException(err);
    });

    return unsubscribe;
  }, [groupId, dispatch, t]);
};

/**
 * Sub-hook for syncing Group Members
 */
const useGroupMembersSync = (groupId: string | null, status: ChatStatus, members: string[] | undefined, membersMap: MembersMap, dispatch: Dispatch<ChatAction>) => {
  useEffect(() => {
    if (!groupId) return;

    let isCancelled = false;
    const fetchMembers = async () => {
      try {
        const membersRef = collection(db, 'groups', groupId, 'members').withConverter(groupMemberConverter);
        const snapshot = await getDocs(membersRef);
        const initialMembers: MembersMap = {};
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          initialMembers[doc.id] = UserProfileBriefSchema.parse({ ...data, id: data.uid }) as UserProfileBrief;
        });

        if (!isCancelled && Object.keys(initialMembers).length > 0) {
          dispatch({ type: 'UPDATE_MEMBERS', newMembers: initialMembers });
        }
      } catch (err) {
        if (!isCancelled && (err as FirestoreError).code !== 'permission-denied') {
          console.error("[useGroupMembersSync] Members fetch error:", err);
        }
      }
    };
    fetchMembers();

    return () => { isCancelled = true; };
  }, [groupId, dispatch]);

  useEffect(() => {
    if (!groupId || !members || status === 'loading') return;

    const fetchUnknownProfiles = async () => {
      const missingUids = members.filter(uid => !membersMap[uid]);
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
            newMembers[s.id] = UserProfileBriefSchema.parse({ id: s.id, ...data }) as UserProfileBrief;
          });
        }));

        if (Object.keys(newMembers).length > 0) {
          dispatch({ type: 'UPDATE_MEMBERS', newMembers });
        }
      } catch (err) {
        console.error("[useGroupMembersSync] Reactive profiles fetch error:", err);
      }
    };

    fetchUnknownProfiles();
  }, [groupId, members, status, dispatch, membersMap]);
};

/**
 * Sub-hook for Message Stream (Bundle hydration & Real-time messages)
 * !! UI Effects (confetti) removed for Data/UI separation !!
 */
const useMessageStreamSync = (groupId: string | null, userData: UserData | null, dispatch: Dispatch<ChatAction>) => {
  useEffect(() => {
    if (!groupId) return;

    let isCancelled = false;
    let unsubscribeMessages: Unsubscribe | null = null;

    const startListener = () => {
      if (isCancelled) return;
      
      const messagesRef = collection(db, 'groups', groupId, 'messages').withConverter(messageConverter);
      const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));

      unsubscribeMessages = onSnapshot(q, (snapshot) => {
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
      }, (err) => {
        if (isCancelled || err.code === 'permission-denied') return;
        console.error("[useMessageStreamSync] Listener error:", err);
      });
    };

    const initializeMessageStream = async () => {
      if (userData?.uid) {
        try {
          const bundleResponse = await apiClient.get(`/api/bundle/${groupId}`, { 
            responseType: 'arraybuffer',
            timeout: 3000 
          });
          if (bundleResponse.data && !isCancelled) {
            await loadBundle(db, bundleResponse.data);
          }
        } catch (err) {
          console.warn("[useMessageStreamSync] Bundle hydration failed:", err);
        }
      }
      if (!isCancelled) startListener();
    };

    initializeMessageStream();

    return () => {
      isCancelled = true;
      if (unsubscribeMessages) unsubscribeMessages();
    };
  }, [groupId, userData?.uid, dispatch]);
};

/**
 * Sub-hook for Syncing Read Status
 */
const useUserReadStateSync = (groupId: string | null, userData: UserData | null, groupData: GroupData | null, userReadCount: number | null, dispatch: Dispatch<ChatAction>) => {
  const updateReadStatus = useCallback(async (gid: string, totalCount: number) => {
    if (!userData?.uid || !gid) return;
    try {
      await apiClient.post('/api/update-read-status', { groupId: gid, readMessageCount: totalCount });
      dispatch({ type: 'SET_READ_COUNT', count: totalCount });
    } catch (err) {
      console.error("[useUserReadStateSync] Failed to sync read status:", err);
    }
  }, [userData?.uid, dispatch]);

  const lastForcedSyncGidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!groupId || !groupData || userReadCount === null) return;
    const totalMsgs = groupData.messageCount || 0;
    if (totalMsgs > userReadCount || (lastForcedSyncGidRef.current !== groupId && totalMsgs > 0)) {
      updateReadStatus(groupId, totalMsgs);
      lastForcedSyncGidRef.current = groupId;
    }
  }, [groupId, groupData?.messageCount, userReadCount, updateReadStatus]);

  useEffect(() => {
    if (!groupId || !userData?.uid) return;
    const unsubscribe = onSnapshot(doc(db, 'users', userData.uid, 'groupStates', groupId), (stateSnap) => {
      dispatch({ type: 'SET_READ_COUNT', count: stateSnap.exists() ? stateSnap.data().readMessageCount || 0 : 0 });
    });
    return unsubscribe;
  }, [groupId, userData?.uid, dispatch]);
};

/**
 * Main Data Engine: useChatDataSync
 * Purely handles Firestore subscriptions, bundle hydration, and state dispatching.
 * UI-agnostic and side-effect free (except for fetching data).
 */
export const useChatDataSync = (groupId: string | null, userData: UserData | null, t: (key: string) => string) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  
  const currentGroupIdRef = useRef<string | null>(groupId);
  const prevMessageCountRef = useRef(0);
  const latestMessageRef = useRef<Message | null>(null);

  useEffect(() => {
    if (groupId) {
      currentGroupIdRef.current = groupId;
      dispatch({ type: 'RESET', groupId });
    }
  }, [groupId]);

  // Sync Subscriptions
  useGroupMetadataSync(groupId, dispatch, t);
  useGroupMembersSync(groupId, state.status, state.groupData?.members, state.membersMap, dispatch);
  useMessageStreamSync(groupId, userData, dispatch);
  useUserReadStateSync(groupId, userData, state.groupData, state.userReadCount, dispatch);

  /**
   * Action: Pure Data Fetch (No Ref references)
   */
  const fetchOlderMessages = async () => {
    if (!groupId || state.isLoadingOlder || !state.hasMoreOlder || state.messages.length === 0) return;
    dispatch({ type: 'SET_LOADING_OLDER', isLoading: true });

    try {
      const oldestMsg = state.messages[0];
      if (!oldestMsg.createdAt) return;
      
      const q = query(
        collection(db, 'groups', groupId, 'messages').withConverter(messageConverter), 
        orderBy('createdAt', 'desc'), 
        startAfter(oldestMsg.createdAt), 
        limit(20)
      );
      const snaps = await getDocs(q);
      
      if (!snaps.empty) {
        const newOlderMsgs = snaps.docs.map(d => d.data()).reverse();
        dispatch({ type: 'ADD_OLDER_MESSAGES', olderMessages: newOlderMsgs, hasMore: true });
        return;
      }

      const bucketsRef = collection(db, 'groups', groupId, 'message_buckets');
      const bq = query(bucketsRef, orderBy('startTime', 'desc'), startAfter(oldestMsg.createdAt), limit(1));
      const bucketSnaps = await getDocs(bq);

      if (bucketSnaps.empty) {
        dispatch({ type: 'ADD_OLDER_MESSAGES', olderMessages: [], hasMore: false });
      } else {
        const bucketData = bucketSnaps.docs[0].data() as { messages: Message[] };
        dispatch({ type: 'ADD_OLDER_MESSAGES', olderMessages: [...(bucketData.messages || [])], hasMore: true });
      }
    } catch (e) {
      console.error("[useGroupMessages] Error loading older messages", e);
      dispatch({ type: 'SET_LOADING_OLDER', isLoading: false });
    }
  };

  return {
    ...state,
    loading: state.status === 'loading',
    groupNotFound: state.status === 'notFound',
    setInitialScrollDone: () => dispatch({ type: 'SET_SCROLL_DONE' }),
    fetchOlderMessages,
    currentGroupIdRef,
    prevMessageCountRef,
    latestMessageRef,
    dispatch
  };
};
