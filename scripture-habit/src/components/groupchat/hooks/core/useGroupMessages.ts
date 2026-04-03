import { useChatDataSync } from './useChatDataSync';
import { useChatVisualEffects } from '../view/useChatVisualEffects';
import { UserData } from '../../../../types/user';

/**
 * Hook Orchestrator: useGroupMessages
 * Bridges pure data sync with UI side-effects and orchestrates interaction logic.
 * 
 * Separates Data Fetching (useChatDataSync) from UI Presentation (Visual Effects, Scroll logic).
 */
export const useGroupMessages = (
  groupId: string | null, 
  userData: UserData | null, 
  t: (key: string) => string
) => {
  // 1. Core Data Sync (Pure Data Engine)
  const sync = useChatDataSync(groupId, userData, t);

  // 2. Visual Effects (Confetti for streaks, etc.)
  useChatVisualEffects(sync.messages, userData);

  // 3. UI-Bridge Actions (Scroll management bridge)
  const loadMoreOlderMessages = async (
    containerRef: React.RefObject<HTMLDivElement | null>, 
    previousScrollHeightRef: React.MutableRefObject<number>, 
    previousScrollTopRef: React.MutableRefObject<number>
  ) => {
    // Capture scroll before the data changes
    if (containerRef.current) {
      previousScrollHeightRef.current = containerRef.current.scrollHeight;
      previousScrollTopRef.current = containerRef.current.scrollTop;
    }

    // Pure data fetch
    await sync.fetchOlderMessages();
  };

  return {
    ...sync,
    loadMoreOlderMessages
  };
};
