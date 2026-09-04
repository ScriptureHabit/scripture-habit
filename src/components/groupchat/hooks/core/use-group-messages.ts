import { useMemo, useCallback } from 'react';
import { useChatDataEngine } from './use-chat-data-engine';
import { useChatSyncController } from './use-chat-sync-controller';
import { useChatVisualEffects } from '../view/use-chat-visual-effects';
import { UserData } from '../../../../types/user';
import { GroupData } from '../../../../types/chat';

/**
 * Hook Orchestrator: useGroupMessages
 * Bridges pure data sync (Data Engine) with functional logic (Sync Controller) 
 * and UI side-effects (Visual Effects).
 * 
 * This is the primary "state hub" for the chat view.
 */
export const useGroupMessages = (
  groupId: string | null, 
  userData: UserData | null, 
  t: (key: string) => string,
  isViewActive: boolean = false,
  initialGroupData?: GroupData | null
) => {
  // 1. Core Data Engine (Pure subscriptions)
  const { state, dispatch } = useChatDataEngine(groupId, userData, t, initialGroupData);

  // 2. Functional Sync Controller (Read status, infinite scroll)
  const controller = useChatSyncController(
    isViewActive ? groupId : null, 
    userData, 
    state.groupData, 
    state.messages, 
    state.userReadCount, 
    dispatch,
    isViewActive
  );

  // 3. Visual Effects (Confetti for streaks, etc.)
  useChatVisualEffects(state.messages, userData);

  // 4. UI-Bridge Actions (Scroll management bridge)
  const loadMoreOlderMessages = useCallback(async (
    containerRef: React.RefObject<HTMLDivElement | null>, 
    previousScrollHeightRef: React.MutableRefObject<number>, 
    previousScrollTopRef: React.MutableRefObject<number>
  ) => {
    // Capture scroll before the data changes to maintain position later
    if (containerRef.current) {
      previousScrollHeightRef.current = containerRef.current.scrollHeight;
      previousScrollTopRef.current = containerRef.current.scrollTop;
    }

    // Call controller logic
    await controller.fetchOlderMessages();
  }, [controller]);

  // Combine state and controller actions for a unified interface
  const combinedSync = useMemo(() => ({
    ...state,
    loading: state.status === 'loading',
    groupNotFound: state.status === 'notFound',
    setInitialScrollDone: () => dispatch({ type: 'SET_SCROLL_DONE' }),
    fetchOlderMessages: controller.fetchOlderMessages,
    currentGroupIdRef: controller.currentGroupIdRef,
    prevMessageCountRef: controller.prevMessageCountRef,
    latestMessageRef: controller.latestMessageRef,
    dispatch,
    loadMoreOlderMessages
  }), [state, controller, dispatch, loadMoreOlderMessages]);

  return combinedSync;
};
