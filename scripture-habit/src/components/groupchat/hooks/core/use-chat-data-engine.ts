import { useReducer, useEffect, useRef, Dispatch } from 'react';
import { collection, query, orderBy, onSnapshot, doc, limit, loadBundle, Unsubscribe } from 'firebase/firestore';
import * as Sentry from "@sentry/react";
import { Message, GroupData, MembersMap, UserProfileBrief } from '../../../../types/chat';
import { db } from '../../../../firebase';
import { UserData } from '../../../../types/user';
import { groupConverter, messageConverter, groupMemberConverter } from '../../../../utils/firestore-converters';
import { UserProfileBriefSchema, GroupSchema } from '../../../../types/schemas';
import apiClient from '../../../../utils/api-client';
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

/**
 * Sub-hook for Message Stream (Bundle hydration & Real-time messages)
 */
const useMessageStreamSync = (groupId: string | null, userData: UserData | null, dispatch: Dispatch<ChatAction>) => {
  const unsubMessagesRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!groupId) return;

    let isCancelled = false;
    console.log('[useMessageStreamSync] Effect triggered', { groupId, uid: userData?.uid });

    const startListener = () => {
      if (isCancelled) return;
      console.log('[useMessageStreamSync] Starting real-time listener', { groupId });
      
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

        console.log('[useMessageStreamSync] Snapshot received', { 
          groupId, 
          new: newIncoming.length, 
          modified: updatedMessages.length, 
          removed: removedIds.length 
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
        try {
          console.log('[useMessageStreamSync] Fetching bundle...', { groupId });
          const bundlePromise = (async () => {
            try {
              const bundleResponse = await apiClient.get(`/api/bundle/${groupId}`, { 
                responseType: 'arraybuffer',
                timeout: 6000 
              });
              if (bundleResponse.data && !isCancelled) {
                console.log('[useMessageStreamSync] Bundle received, loading...', { size: bundleResponse.data.byteLength });
                await loadBundle(db, bundleResponse.data);
                console.log('[useMessageStreamSync] Bundle loaded');
              }
            } catch (err) {
              console.warn("[useMessageStreamSync] Bundle boost failed:", err);
            }
          })();

          await Promise.race([
            bundlePromise,
            new Promise(resolve => setTimeout(resolve, 800))
          ]);
        } catch (err) {
          console.warn("[useMessageStreamSync] Race error:", err);
        }
      }
      
      if (!isCancelled) startListener();
    };

    initializeMessageStream();

    return () => {
      console.log('[useMessageStreamSync] Cleaning up effect', { groupId });
      isCancelled = true;
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
  
  useEffect(() => {
    if (groupId) {
      dispatch({ type: 'RESET', groupId });
    }
  }, [groupId]);

  // Sync Subscriptions
  useGroupMetadataSync(groupId, dispatch, t);
  useGroupMembersSync(groupId, state.status, state.groupData?.members, state.messages, state.membersMap, dispatch);
  useMessageStreamSync(groupId, userData, dispatch);

  return { state, dispatch };
};
