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

const useMessageStreamSync = (groupId: string | null, userData: UserData | null, status: ChatStatus, dispatch: Dispatch<ChatAction>) => {
  const unsubMessagesRef = useRef<Unsubscribe | null>(null);
  const activeSyncGroupIdRef = useRef<string | null>(null);

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

        // Always dispatch on first load to clear loading state, or if there are messages
        if (newIncoming.length > 0 || status === 'loading') {
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

      unsubMessagesRef.current = unsubscribe;
    };

    const initializeMessageStream = async () => {
      try {
        const fetchBundle = async (retry = false) => {
          try {
            const bundleResponse = await apiClient.get(`/api/groups/bundle/${groupId}`, { 
              responseType: 'arraybuffer',
              timeout: 6000 
            });
            if (bundleResponse.data && !isCancelled) {
              await loadBundle(db, bundleResponse.data);
            }
          } catch (err: unknown) {
            const axiosError = err as { response?: { status: number } };
            if (!retry && axiosError.response?.status === 403 && !isCancelled) {
              console.warn("[useMessageStreamSync] 403 on bundle boost, retrying once in 500ms...");
              await new Promise(r => setTimeout(r, 500));
              return fetchBundle(true);
            }
            console.warn("[useMessageStreamSync] Bundle boost failed:", err);
          }
        };

        const bundlePromise = fetchBundle();

        await Promise.race([
          bundlePromise,
          new Promise(resolve => setTimeout(resolve, 1200))
        ]);
      } catch (err) {
        console.warn("[useMessageStreamSync] Race error:", err);
      }
      
      if (!isCancelled) startListener();
    };

    initializeMessageStream();

    return () => {
      isCancelled = true;
      activeSyncGroupIdRef.current = null;
      if (unsubMessagesRef.current) {
        unsubMessagesRef.current();
        unsubMessagesRef.current = null;
      }
    };
  }, [groupId, userData?.uid, status, dispatch]);
};

/**
 * useChatDataEngine
 * Pure synchronization with Firestore. UI-agnostic.
 */
export const useChatDataEngine = (groupId: string | null, userData: UserData | null, t: (key: string) => string) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  
  useEffect(() => {
    if (groupId) {
      console.log(`[useChatDataEngine] Resetting for groupId: ${groupId}`);
      dispatch({ type: 'RESET', groupId });
    }
  }, [groupId]);

  // Sync Subscriptions
  useGroupMetadataSync(groupId, dispatch, t);
  useGroupMembersSync(groupId, state.status, state.groupData?.members, state.messages, state.membersMap, dispatch);
  useMessageStreamSync(groupId, userData, state.status, dispatch);

  return { state, dispatch };
};
