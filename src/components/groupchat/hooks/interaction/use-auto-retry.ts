import { useEffect, useRef, Dispatch } from 'react';
import { Message } from '../../../../types/chat';
import { ChatAction } from '../core/chat-reducer';
import { getPendingMessages } from '../../../../utils/offline-chat-queue';

interface UseAutoRetryProps {
  groupId: string | null;
  userId?: string | null;
  messages: Message[];
  messagesLoaded: boolean;
  dispatch: Dispatch<ChatAction>;
  handleRetryMessage: (message: Message) => Promise<boolean>;
}

/**
 * useAutoRetry
 * 1. Restores offline pending messages from localStorage upon initial chat load (isolated per user).
 * 2. Automatically retries failed messages belonging to the current user when network connectivity is restored (online event).
 */
export const useAutoRetry = ({
  groupId,
  userId,
  messages,
  messagesLoaded,
  dispatch,
  handleRetryMessage
}: UseAutoRetryProps) => {
  const isRetryingRef = useRef(false);
  const hydratedSessionRef = useRef<string | null>(null);

  // 1. Hydrate pending messages from offline queue when chat first loads
  useEffect(() => {
    if (!groupId || !messagesLoaded || !userId) return;

    // Only hydrate once per user + group session
    const sessionKey = `${userId}_${groupId}`;
    if (hydratedSessionRef.current === sessionKey) return;
    hydratedSessionRef.current = sessionKey;

    const pending = getPendingMessages(userId, groupId);
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
  }, [groupId, userId, messagesLoaded, messages, dispatch]);

  // Reset hydrated ref when groupId or userId changes
  useEffect(() => {
    hydratedSessionRef.current = null;
  }, [groupId, userId]);

  // 2. Automatically retry pending/failed messages belonging to the current user when network comes back online
  useEffect(() => {
    if (!groupId || !userId || typeof window === 'undefined') return;

    const triggerAutoRetry = async () => {
      if (isRetryingRef.current) return;

      // Only retry failed messages created by the currently authenticated user
      const failedMessages = messages.filter((m) => m.isFailed && m.senderId === userId);
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
  }, [groupId, userId, messages, handleRetryMessage]);
};
