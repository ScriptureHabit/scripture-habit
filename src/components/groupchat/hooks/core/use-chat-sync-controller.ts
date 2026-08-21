import { useEffect, useRef, useCallback, Dispatch, useMemo } from 'react';
import { collection, query, orderBy, getDocs, limit, startAfter, doc, onSnapshot } from 'firebase/firestore';
import { Message, GroupData } from '../../../../types/chat';
import { db, auth } from '../../../../firebase';
import { User } from 'firebase/auth';
import { UserData } from '../../../../types/user';
import { messageConverter } from '../../../../utils/firestore-converters';
import { useDashboardActions } from '../../../../components/dashboard/hooks/use-dashboard-actions';
import { ChatAction } from './chat-reducer';

/**
 * useChatSyncController
 * Logic for reacting to data changes (read sync, infinite scroll).
 */
export const useChatSyncController = (
  groupId: string | null,
  userData: UserData | null,
  _groupData: GroupData | null,
  messages: Message[],
  _userReadCount: number | null,
  dispatch: Dispatch<ChatAction>,
  isViewActive: boolean = false
) => {
  const { updateGroupReadStatus } = useDashboardActions(auth?.currentUser as User | null, userData);
  
  const currentGroupIdRef = useRef<string | null>(groupId);
  const prevMessageCountRef = useRef(0);
  const latestMessageRef = useRef<Message | null>(null);
  const loadingOlderRef = useRef(false);

  // --- READ STATUS SYNC ---

  const updateReadStatus = useCallback(async (gid: string, totalCount: number) => {
    if (!userData?.uid || !gid || !updateGroupReadStatus) return;
    try {
      dispatch({ type: 'SET_READ_COUNT', count: totalCount });
      await updateGroupReadStatus(gid, totalCount);
    } catch (err) {
      console.error("[useChatSyncController] Failed to sync read status:", err);
    }
  }, [userData?.uid, updateGroupReadStatus, dispatch]);

  // Handle active view mount and visibility changes for read sync
  useEffect(() => {
    if (!isViewActive || !groupId) return;
    
    const totalMsgs = messages.length;
    const isVisible = typeof document === 'undefined' || document.visibilityState === 'visible' || document.hasFocus();

    if (isVisible) {
      updateReadStatus(groupId, totalMsgs);
    }

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' || document.hasFocus()) {
        updateReadStatus(groupId, messages.length);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [groupId, messages.length, updateReadStatus, isViewActive]);

  // Background listener for the source-of-truth read count from Firestore
  useEffect(() => {
    if (!groupId || !userData?.uid) return;
    const unsubscribe = onSnapshot(doc(db, 'users', userData.uid, 'groupStates', groupId), (stateSnap) => {
      if (stateSnap.exists()) {
        dispatch({ type: 'SET_READ_COUNT', count: stateSnap.data().readMessageCount || 0 });
      }
    }, (err) => {
      if (err.code !== 'permission-denied') console.error("[useChatSyncController] Read count listener error:", err);
    });
    return unsubscribe;
  }, [groupId, userData?.uid, dispatch]);

  // --- INFINITE SCROLL LOGIC ---
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const fetchOlderMessages = useCallback(async () => {
    if (!groupId || loadingOlderRef.current || messagesRef.current.length === 0) return;
    
    // We use a local ref for loadingOlder to avoid closure staleness and redundant trigger
    loadingOlderRef.current = true;
    dispatch({ type: 'SET_LOADING_OLDER', isLoading: true });

    try {
      const oldestMsg = messagesRef.current[0];
      if (!oldestMsg.createdAt) {
        loadingOlderRef.current = false;
        dispatch({ type: 'SET_LOADING_OLDER', isLoading: false });
        return;
      }
      
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
        loadingOlderRef.current = false;
        return;
      }

      dispatch({ type: 'ADD_OLDER_MESSAGES', olderMessages: [], hasMore: false });
    } catch (e) {
      console.error("[useChatSyncController] Error loading older messages", e);
    } finally {
      loadingOlderRef.current = false;
      dispatch({ type: 'SET_LOADING_OLDER', isLoading: false });
    }
  }, [groupId, dispatch]);

  return useMemo(() => ({
    fetchOlderMessages,
    currentGroupIdRef,
    prevMessageCountRef,
    latestMessageRef
  }), [fetchOlderMessages]);
};
