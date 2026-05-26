import { useReducer, useEffect, useRef, Dispatch } from 'react';
import { collection, onSnapshot, doc, Unsubscribe, query, orderBy, limit, getDocs } from 'firebase/firestore';
import * as Sentry from "@sentry/react";
import { Message, GroupData, MembersMap, UserProfileBrief } from '../../../../types/chat';
import { db } from '../../../../firebase';
import { UserData } from '../../../../types/user';
import { groupConverter, groupMemberConverter, messageConverter } from '../../../../utils/firestore-converters';
import { UserProfileBriefSchema, GroupSchema } from '../../../../types/schemas';
import { parseTimestampToMillis } from '../../../../utils/time-utils';
import { chatReducer, initialState, ChatAction, ChatStatus } from './chat-reducer';

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
        try {
          const parsedGroup = GroupSchema.parse({ ...data, id: groupId, _groupId: groupId }) as GroupData;
          dispatch({ 
            type: 'UPDATE_GROUP', 
            groupData: parsedGroup
          });
        } catch (err) {
          console.error(`[useGroupMetadataSync] Schema validation failed for group ${groupId}:`, err);
          // Fallback to unvalidated data to prevent hanging
          dispatch({ 
            type: 'UPDATE_GROUP', 
            groupData: { ...data, id: groupId, _groupId: groupId } as GroupData
          });
        }
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

    return unsubscribe;
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

const useMessageStreamSync = (groupId: string | null, userData: UserData | null, currentMessages: Message[], dispatch: Dispatch<ChatAction>) => {
  const unsubMessagesRef = useRef<Unsubscribe | null>(null);
  const activeSyncGroupIdRef = useRef<string | null>(null);

  // Keep a ref of the latest currentMessages so the listener can access it without re-triggering the subscription effect
  const currentMessagesRef = useRef<Message[]>(currentMessages);
  useEffect(() => {
    currentMessagesRef.current = currentMessages;
  }, [currentMessages]);

  useEffect(() => {
    if (!groupId || !userData?.uid) return;
    
    console.log(`[useMessageStreamSync] Effect running for group: ${groupId}, user: ${userData.uid}`);
    
    // Prevent redundant syncs for the same group/user combo
    const syncKey = `${groupId}-${userData.uid}`;
    if (activeSyncGroupIdRef.current === syncKey) {
      console.log(`[useMessageStreamSync] Already syncing ${syncKey}, skipping effect body.`);
      return;
    }
    activeSyncGroupIdRef.current = syncKey;

    let isCancelled = false;

    const startListener = () => {
      if (isCancelled) return;
      
      const latestDocRef = doc(db, 'groups', groupId, 'messages_latest', 'latest');

      const unsubscribe = onSnapshot(latestDocRef, (snapshot) => {
        if (isCancelled) return;
        
        if (snapshot.exists()) {
          const data = snapshot.data();
          const incomingMessages = (data.messages || []) as Message[];
          
          // Clean up resolved optimistic messages and merge pending unresolved ones
          const resolvedOptimisticIds = new Set(
            incomingMessages.map(m => m.optimisticId).filter(Boolean) as string[]
          );
          
          const pendingOptimistic = currentMessagesRef.current.filter(m => {
            const isOptimistic = m.id.startsWith('temp-');
            const isResolved = resolvedOptimisticIds.has(m.id) || (m.optimisticId && resolvedOptimisticIds.has(m.optimisticId));
            return isOptimistic && !isResolved;
          });
          
          const finalMessages = [...incomingMessages, ...pendingOptimistic].sort((a, b) => {
            const timeA = a.clientTimestamp || parseTimestampToMillis(a.createdAt);
            const timeB = b.clientTimestamp || parseTimestampToMillis(b.createdAt);
            return timeA - timeB;
          });
          
          dispatch({ type: 'SET_MESSAGES', messages: finalMessages });
        } else {
          // Fallback: If no latest document exists yet, query the historical /messages subcollection directly
          // to prevent showing a blank screen for groups that haven't been compiled yet.
          const fallbackQuery = query(
            collection(db, 'groups', groupId, 'messages').withConverter(messageConverter),
            orderBy('createdAt', 'desc'),
            limit(25)
          );
          getDocs(fallbackQuery).then((querySnapshot) => {
            if (isCancelled) return;
            const fetchedMessages = querySnapshot.docs.map(doc => doc.data()).reverse();
            dispatch({ type: 'SET_MESSAGES', messages: fetchedMessages });
          }).catch((err) => {
            console.error("[useMessageStreamSync] Fallback query failed:", err);
            dispatch({ type: 'SET_MESSAGES', messages: [] });
          });
        }
      }, (err) => {
        if (isCancelled || err.code === 'permission-denied') return;
        console.error("[useMessageStreamSync] Listener error:", err);
      });

      unsubMessagesRef.current = unsubscribe;
    };

    startListener();

    return () => {
      isCancelled = true;
      activeSyncGroupIdRef.current = null;
      if (unsubMessagesRef.current) {
        unsubMessagesRef.current();
        unsubMessagesRef.current = null;
      }
    };
  }, [groupId, userData?.uid, dispatch]);
};

/**
 * useChatDataEngine
 * Pure synchronization with Firestore. UI-agnostic.
 */
export const useChatDataEngine = (groupId: string | null, userData: UserData | null, t: (key: string) => string) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  
  // Synchronous render-phase state reset on groupId change to eliminate race conditions
  const prevGroupIdRef = useRef<string | null>(null);
  if (groupId !== prevGroupIdRef.current) {
    prevGroupIdRef.current = groupId;
    if (groupId) {
      dispatch({ type: 'RESET', groupId });
    }
  }

  // Sync Subscriptions
  useGroupMetadataSync(groupId, dispatch, t);
  useGroupMembersSync(groupId, state.status, state.groupData?.members, state.messages, state.membersMap, dispatch);
  useMessageStreamSync(groupId, userData, state.messages, dispatch);

  return { state, dispatch };
};
