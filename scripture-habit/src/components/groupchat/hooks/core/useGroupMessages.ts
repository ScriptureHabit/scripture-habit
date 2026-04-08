import { useMemo } from 'react';
import { useChatDataEngine } from './useChatDataEngine';
import { useChatSyncController } from './useChatSyncController';
import { useChatVisualEffects } from '../view/useChatVisualEffects';
import { UserData } from '../../../../types/user';

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
  isViewActive: boolean = false
) => {
  // 1. Core Data Engine (Pure subscriptions)
  const { state, dispatch } = useChatDataEngine(groupId, userData, t);

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
  const loadMoreOlderMessages = async (
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
  };

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
