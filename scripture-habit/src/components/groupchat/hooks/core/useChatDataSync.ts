import { useReducer, useEffect, useRef, useCallback, Dispatch } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDocs, limit, startAfter, loadBundle, Unsubscribe } from 'firebase/firestore';
import * as Sentry from "@sentry/react";
import { Message, GroupData, MembersMap, UserProfileBrief } from '../../../../types/chat';
import { db } from '../../../../firebase';
import { UserData } from '../../../../types/user';
import { groupConverter, messageConverter, groupMemberConverter } from '../../../../utils/firestoreConverters';
import { UserProfileBriefSchema, GroupSchema } from '../../../../types/schemas';

import apiClient from '../../../../utils/apiClient';
import { auth } from '../../../../firebase';
import { useDashboardActions } from '../../../../components/dashboard/hooks/useDashboardActions';
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
const useGroupMembersSync = (groupId: string | null, status: ChatStatus, members: string[] | undefined, messages: Message[], membersMap: MembersMap, dispatch: Dispatch<ChatAction>) => {
  const attemptedUidsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!groupId) return;

    // TRUTH: Real-time listener for members subcollection to capture read status changes
    const membersRef = collection(db, 'groups', groupId, 'members').withConverter(groupMemberConverter);
    
    const unsubscribe = onSnapshot(membersRef, (snapshot) => {
      const updatedMembers: MembersMap = {};
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          updatedMembers[change.doc.id] = UserProfileBriefSchema.parse({ ...data, id: data.uid }) as UserProfileBrief;
          attemptedUidsRef.current.add(change.doc.id);
        }
      });

      if (Object.keys(updatedMembers).length > 0) {
        dispatch({ type: 'UPDATE_MEMBERS', newMembers: updatedMembers });
      }
    }, (err) => {
      if (err.code !== 'permission-denied') {
        console.error("[useGroupMembersSync] Members sync error:", err);
      }
    });

    return () => unsubscribe();
  }, [groupId, dispatch]);

  useEffect(() => {
    if (!groupId || !members || status === 'loading') return;

    let isCancelled = false;
    const fetchUnknownProfiles = async () => {
      const newMembers: MembersMap = {};

      messages.forEach(msg => {
        if (msg.reactionPreviews) {
          Object.values(msg.reactionPreviews).forEach(previews => {
            if (Array.isArray(previews)) {
              previews.forEach(p => {
                if (p.uid && !membersMap[p.uid] && !attemptedUidsRef.current.has(p.uid)) {
                  newMembers[p.uid] = {
                    id: p.uid,
                    nickname: p.nickname || 'Unknown',
                    photoURL: p.photoURL || ''
                  } as UserProfileBrief;
                  attemptedUidsRef.current.add(p.uid);
                }
              });
            }
          });
        }
      });

      if (!isCancelled && Object.keys(newMembers).length > 0) {
        dispatch({ type: 'UPDATE_MEMBERS', newMembers });
      }
    };

    fetchUnknownProfiles();
    return () => { isCancelled = true; };
  }, [groupId, members, messages, status, dispatch, membersMap]);
};

/**
 * Sub-hook for Message Stream (Bundle hydration & Real-time messages)
 * !! UI Effects (confetti) removed for data/UI separation !!
 */
const useMessageStreamSync = (groupId: string | null, userData: UserData | null, dispatch: Dispatch<ChatAction>) => {
  const unsubMessagesRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!groupId) return;

    let isCancelled = false;

    const startListener = () => {
      if (isCancelled) return;
      
      const messagesRef = collection(db, 'groups', groupId, 'messages').withConverter(messageConverter);
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
      }, (err) => {
        if (isCancelled || err.code === 'permission-denied') return;
        console.error("[useMessageStreamSync] Listener error:", err);
      });

      if (isCancelled) {
        unsubscribe();
      } else {
        unsubMessagesRef.current = unsubscribe;
      }
    };

    const initializeMessageStream = async () => {
      if (userData?.uid) {
        // Boost strategy: Attempt hydration, but don't block the UI for more than 800ms.
        try {
          const bundlePromise = (async () => {
            try {
              const bundleResponse = await apiClient.get(`/api/bundle/${groupId}`, { 
                responseType: 'arraybuffer',
                timeout: 6000 
              });
              if (bundleResponse.data && !isCancelled) {
                await loadBundle(db, bundleResponse.data);
              }
            } catch (err) {
              console.warn("[useMessageStreamSync] Bundle boost failed or timed out:", err);
            }
          })();

          await Promise.race([
            bundlePromise,
            new Promise(resolve => setTimeout(resolve, 800))
          ]);
        } catch (e) {
          // Promise.race or bundle failure is non-critical
        }
      }
      
      if (!isCancelled) startListener();
    };

    initializeMessageStream();

    return () => {
      isCancelled = true;
      if (unsubMessagesRef.current) {
        unsubMessagesRef.current();
        unsubMessagesRef.current = null;
      }
    };
  }, [groupId, userData?.uid, dispatch]);
};

/**
 * Sub-hook for Syncing Read Status
 */
const useUserReadStateSync = (
  groupId: string | null, 
  userData: UserData | null, 
  groupData: GroupData | null, 
  userReadCount: number | null, 
  actualMessageCount: number,
  dispatch: Dispatch<ChatAction>
) => {
  const { syncNotificationReadStatus: syncReadStatus } = useDashboardActions(auth?.currentUser as any, userData);

  const updateReadStatus = useCallback(async (gid: string, totalCount: number) => {
    if (!userData?.uid || !gid || !syncReadStatus) return;
    try {
      await syncReadStatus(gid, totalCount);
      dispatch({ type: 'SET_READ_COUNT', count: totalCount });
    } catch (err) {
      console.error("[useUserReadStateSync] Failed to sync read status:", err);
    }
  }, [userData?.uid, syncReadStatus, dispatch]);

  const lastForcedSyncGidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!groupId || !groupData || userReadCount === null) {
        if (!groupId) console.log("[useUserReadStateSync] Skipping sync (groupId is null/inactive)");
        return;
    }
    
    // TRUTH: Use the highest of metadata count or listener count to avoid stale overwrites
    const totalMsgs = Math.max(groupData.messageCount || 0, actualMessageCount);
    
    const isWindowFocused = document.hasFocus();
    const isVisible = document.visibilityState === 'visible';

    // Remove needsHealing to prevent mass destruction of unread states
    if ((totalMsgs > (userReadCount || 0) || (lastForcedSyncGidRef.current !== groupId && totalMsgs > 0)) && isWindowFocused && isVisible) {
      console.log(`📡 [READ-SYNC] Marking as read: group=${groupId}, count=${totalMsgs}, reason=${lastForcedSyncGidRef.current !== groupId ? 'initial_load' : 'new_messages'}`);
      updateReadStatus(groupId, totalMsgs);
      lastForcedSyncGidRef.current = groupId;
    }
  }, [groupId, groupData?.messageCount, actualMessageCount, userReadCount, updateReadStatus]);

  useEffect(() => {
    if (!groupId || !userData?.uid) return;
    const unsubscribe = onSnapshot(doc(db, 'users', userData.uid, 'groupStates', groupId), (stateSnap) => {
      dispatch({ type: 'SET_READ_COUNT', count: stateSnap.exists() ? stateSnap.data().readMessageCount || 0 : 0 });
    }, (err) => {
      if (err.code !== 'permission-denied') console.error("[useChatDataSync] Read count listener error:", err);
    });
    return unsubscribe;
  }, [groupId, userData?.uid, dispatch]);
};

/**
 * Main Data Engine: useChatDataSync
 * Purely handles Firestore subscriptions, bundle hydration, and state dispatching.
 * UI-agnostic and side-effect free (except for fetching data).
 */
export const useChatDataSync = (groupId: string | null, userData: UserData | null, t: (key: string) => string, isViewActive: boolean = false) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  
  useEffect(() => {
  }, [isViewActive, groupId]);

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
  useGroupMembersSync(groupId, state.status, state.groupData?.members, state.messages, state.membersMap, dispatch);
  useMessageStreamSync(groupId, userData, dispatch);
  
  // Calculate current "truthful" message count including what we've loaded in session
  const actualMessageCount = state.messages.length;
  
  useUserReadStateSync(isViewActive ? groupId : null, userData, state.groupData, state.userReadCount, actualMessageCount, dispatch);

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
