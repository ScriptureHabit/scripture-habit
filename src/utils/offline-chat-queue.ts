import { Message } from '../types/chat';

const QUEUE_PREFIX = 'scripture_habit_pending_msgs_';

/**
 * Get storage key for a specific group's pending messages.
 */
export const getQueueKey = (groupId: string): string => {
  return `${QUEUE_PREFIX}${groupId}`;
};

/**
 * Retrieve all pending (failed) messages for a specific group from localStorage.
 */
export const getPendingMessages = (groupId: string): Message[] => {
  if (typeof window === 'undefined' || !window.localStorage || !groupId) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getQueueKey(groupId));
    if (!raw) return [];
    
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item) => ({
      ...item,
      // Ensure createdAt is parsed properly if stored as string/number
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(item.clientTimestamp || Date.now()),
      isOptimistic: false,
      isFailed: true
    }));
  } catch (error) {
    console.error('[offline-chat-queue] Error loading pending messages for group:', groupId, error);
    return [];
  }
};

/**
 * Save or update a failed message in the group's offline queue.
 */
export const savePendingMessage = (groupId: string, message: Message): void => {
  if (typeof window === 'undefined' || !window.localStorage || !groupId || !message) {
    return;
  }

  try {
    const current = getPendingMessages(groupId);
    const existingIndex = current.findIndex(
      (m) => m.id === message.id || (message.optimisticId && m.optimisticId === message.optimisticId)
    );

    const messageToSave: Message = {
      ...message,
      isOptimistic: false,
      isFailed: true,
      createdAt: message.createdAt || new Date(message.clientTimestamp || Date.now())
    };

    if (existingIndex >= 0) {
      current[existingIndex] = messageToSave;
    } else {
      current.push(messageToSave);
    }

    window.localStorage.setItem(getQueueKey(groupId), JSON.stringify(current));
  } catch (error) {
    console.error('[offline-chat-queue] Error saving pending message for group:', groupId, error);
  }
};

/**
 * Remove a resolved or cancelled message from the group's offline queue.
 */
export const removePendingMessage = (groupId: string, messageIdOrOptimisticId: string): void => {
  if (typeof window === 'undefined' || !window.localStorage || !groupId || !messageIdOrOptimisticId) {
    return;
  }

  try {
    const current = getPendingMessages(groupId);
    const filtered = current.filter(
      (m) => m.id !== messageIdOrOptimisticId && m.optimisticId !== messageIdOrOptimisticId
    );

    if (filtered.length === 0) {
      window.localStorage.removeItem(getQueueKey(groupId));
    } else {
      window.localStorage.setItem(getQueueKey(groupId), JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('[offline-chat-queue] Error removing pending message for group:', groupId, error);
  }
};

/**
 * Clear all pending messages for a specific group.
 */
export const clearPendingMessages = (groupId: string): void => {
  if (typeof window === 'undefined' || !window.localStorage || !groupId) {
    return;
  }

  try {
    window.localStorage.removeItem(getQueueKey(groupId));
  } catch (error) {
    console.error('[offline-chat-queue] Error clearing pending messages for group:', groupId, error);
  }
};
