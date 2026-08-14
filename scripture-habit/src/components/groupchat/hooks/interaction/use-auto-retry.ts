import { useEffect, useRef, Dispatch } from 'react';
import { Message } from '../../../../types/chat';
import { ChatAction } from '../core/chat-reducer';
import { getPendingMessages } from '../../../../utils/offline-chat-queue';

interface UseAutoRetryProps {
  groupId: string | null;
  messages: Message[];
  messagesLoaded: boolean;
  dispatch: Dispatch<ChatAction>;
  handleRetryMessage: (message: Message) => Promise<boolean>;
}

/**
 * useAutoRetry
 * 1. Restores offline pending messages from localStorage upon initial chat load.
 * 2. Automatically retries failed messages when network connectivity is restored (online event).
 */
export const useAutoRetry = ({
  groupId,
  messages,
  messagesLoaded,
  dispatch,
  handleRetryMessage
}: UseAutoRetryProps) => {
  const isRetryingRef = useRef(false);
  const hydratedGroupRef = useRef<string | null>(null);

  // 1. Hydrate pending messages from offline queue when chat first loads
  useEffect(() => {
    if (!groupId || !messagesLoaded) return;

    // Only hydrate once per group session
    if (hydratedGroupRef.current === groupId) return;
    hydratedGroupRef.current = groupId;

    const pending = getPendingMessages(groupId);
    if (pending.length === 0) return;

    // Filter out messages that already exist in the message list
    const existingIds = new Set(messages.map((m) => m.optimisticId || m.id));
    const missingPending = pending.filter((m) => !existingIds.has(m.optimisticId || m.id));

    if (missingPending.length > 0) {
      dispatch({
        type: 'ADD_NEW_MESSAGES',
        newMessages: missingPending
      });
    }
  }, [groupId, messagesLoaded, messages, dispatch]);

  // Reset hydrated ref when groupId changes
  useEffect(() => {
    hydratedGroupRef.current = null;
  }, [groupId]);

  // 2. Automatically retry pending/failed messages when network comes back online
  useEffect(() => {
    if (!groupId || typeof window === 'undefined') return;

    const triggerAutoRetry = async () => {
      if (isRetryingRef.current) return;

      const failedMessages = messages.filter((m) => m.isFailed);
      if (failedMessages.length === 0) return;

      isRetryingRef.current = true;
      try {
        // Sequentially retry each failed message
        for (const failedMsg of failedMessages) {
          await handleRetryMessage(failedMsg);
        }
      } catch (err) {
        console.error('[useAutoRetry] Error during auto-retry:', err);
      } finally {
        isRetryingRef.current = false;
      }
    };

    window.addEventListener('online', triggerAutoRetry);

    return () => {
      window.removeEventListener('online', triggerAutoRetry);
    };
  }, [groupId, messages, handleRetryMessage]);
};
