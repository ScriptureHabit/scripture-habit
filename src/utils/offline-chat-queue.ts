import { Message } from '../types/chat';

const QUEUE_PREFIX = 'scripture_habit_pending_msgs_';

/**
 * Get storage key for a specific user and group's pending messages.
 */
export const getQueueKey = (userId: string, groupId: string): string => {
  return `${QUEUE_PREFIX}${userId}_${groupId}`;
};

/**
 * Remove any legacy un-scoped pending message queue for a group
 * to prevent cross-account leakage.
 */
export const purgeLegacyQueue = (groupId: string): void => {
  if (typeof window === 'undefined' || !window.localStorage || !groupId) return;
  try {
    window.localStorage.removeItem(`${QUEUE_PREFIX}${groupId}`);
  } catch {
    // Ignore error
  }
};

/**
 * Retrieve all pending (failed) messages for a specific user and group from localStorage.
 */
export const getPendingMessages = (userId: string, groupId: string): Message[] => {
  if (typeof window === 'undefined' || !window.localStorage || !userId || !groupId) {
    return [];
  }

  // Purge any legacy un-scoped queue
  purgeLegacyQueue(groupId);

  try {
    const raw = window.localStorage.getItem(getQueueKey(userId, groupId));
    if (!raw) return [];
    
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => !item.senderId || item.senderId === userId)
      .map((item) => ({
        ...item,
        senderId: userId,
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
 * Save or update a failed message in the user's group offline queue.
 */
export const savePendingMessage = (userId: string, groupId: string, message: Message): void => {
  if (typeof window === 'undefined' || !window.localStorage || !userId || !groupId || !message) {
    return;
  }

  try {
    const current = getPendingMessages(userId, groupId);
    const existingIndex = current.findIndex(
      (m) => m.id === message.id || (message.optimisticId && m.optimisticId === message.optimisticId)
    );

    const messageToSave: Message = {
      ...message,
      senderId: userId,
      isOptimistic: false,
      isFailed: true,
      createdAt: message.createdAt || new Date(message.clientTimestamp || Date.now())
    };

    if (existingIndex >= 0) {
      current[existingIndex] = messageToSave;
    } else {
      current.push(messageToSave);
    }

    window.localStorage.setItem(getQueueKey(userId, groupId), JSON.stringify(current));
  } catch (error) {
    console.error('[offline-chat-queue] Error saving pending message for group:', groupId, error);
  }
};

/**
 * Remove a resolved or cancelled message from the user's group offline queue.
 */
export const removePendingMessage = (userId: string, groupId: string, messageIdOrOptimisticId: string): void => {
  if (typeof window === 'undefined' || !window.localStorage || !userId || !groupId || !messageIdOrOptimisticId) {
    return;
  }

  try {
    const current = getPendingMessages(userId, groupId);
    const filtered = current.filter(
      (m) => m.id !== messageIdOrOptimisticId && m.optimisticId !== messageIdOrOptimisticId
    );

    if (filtered.length === 0) {
      window.localStorage.removeItem(getQueueKey(userId, groupId));
    } else {
      window.localStorage.setItem(getQueueKey(userId, groupId), JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('[offline-chat-queue] Error removing pending message for group:', groupId, error);
  }
};

/**
 * Clear all pending messages for a specific user and optional group.
 */
export const clearPendingMessages = (userId: string, groupId?: string): void => {
  if (typeof window === 'undefined' || !window.localStorage || !userId) {
    return;
  }

  try {
    if (groupId) {
      window.localStorage.removeItem(getQueueKey(userId, groupId));
      purgeLegacyQueue(groupId);
    } else {
      // Clear all queues for this user
      const userPrefix = `${QUEUE_PREFIX}${userId}_`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(userPrefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    }
  } catch (error) {
    console.error('[offline-chat-queue] Error clearing pending messages:', error);
  }
};
