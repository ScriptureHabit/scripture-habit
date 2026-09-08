import { describe, it, expect, beforeEach } from 'vitest';
import {
  getQueueKey,
  getPendingMessages,
  savePendingMessage,
  removePendingMessage,
  clearPendingMessages
} from '../offline-chat-queue';
import { Message } from '../../types/chat';

describe('offline-chat-queue utility', () => {
  const groupId = 'test-group-100';
  const userId = 'user-alice';
  const otherUserId = 'user-bob';

  beforeEach(() => {
    localStorage.clear();
  });

  it('generates consistent user-scoped queue key', () => {
    expect(getQueueKey('user-123', 'group-abc')).toBe('scripture_habit_pending_msgs_user-123_group-abc');
  });

  it('returns empty array when no pending messages exist', () => {
    const msgs = getPendingMessages(userId, groupId);
    expect(msgs).toEqual([]);
  });

  it('saves and retrieves pending messages with isFailed: true and isOptimistic: false', () => {
    const msg: Message = {
      id: 'temp-123456',
      optimisticId: 'temp-123456',
      text: 'Pending offline message',
      senderId: userId,
      senderNickname: 'Alice',
      clientTimestamp: 1700000000000
    };

    savePendingMessage(userId, groupId, msg);

    const pending = getPendingMessages(userId, groupId);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('temp-123456');
    expect(pending[0].text).toBe('Pending offline message');
    expect(pending[0].isFailed).toBe(true);
    expect(pending[0].isOptimistic).toBe(false);
  });

  it('enforces user isolation: other user cannot see or restore pending messages', () => {
    const msg: Message = {
      id: 'temp-alice-1',
      optimisticId: 'temp-alice-1',
      text: 'Alice private offline draft',
      senderId: userId
    };

    savePendingMessage(userId, groupId, msg);

    // Bob views the same group
    const bobsPending = getPendingMessages(otherUserId, groupId);
    expect(bobsPending).toEqual([]);

    // Alice views the group and sees her message
    const alicesPending = getPendingMessages(userId, groupId);
    expect(alicesPending).toHaveLength(1);
    expect(alicesPending[0].text).toBe('Alice private offline draft');
  });

  it('purges legacy un-scoped queue keys upon access', () => {
    // Legacy key from previous insecure implementation
    const legacyKey = `scripture_habit_pending_msgs_${groupId}`;
    localStorage.setItem(legacyKey, JSON.stringify([{ id: 'legacy-1', text: 'Old leak' }]));

    const msgs = getPendingMessages(userId, groupId);
    expect(msgs).toEqual([]);
    expect(localStorage.getItem(legacyKey)).toBeNull();
  });

  it('updates an existing message in the queue without duplicating', () => {
    const msg: Message = {
      id: 'temp-123456',
      optimisticId: 'temp-123456',
      text: 'Initial text',
      senderId: userId
    };

    savePendingMessage(userId, groupId, msg);
    savePendingMessage(userId, groupId, { ...msg, text: 'Updated text' });

    const pending = getPendingMessages(userId, groupId);
    expect(pending).toHaveLength(1);
    expect(pending[0].text).toBe('Updated text');
  });

  it('removes pending message by id or optimisticId', () => {
    const msg1: Message = { id: 'temp-1', optimisticId: 'temp-1', text: 'Msg 1', senderId: userId };
    const msg2: Message = { id: 'temp-2', optimisticId: 'temp-2', text: 'Msg 2', senderId: userId };

    savePendingMessage(userId, groupId, msg1);
    savePendingMessage(userId, groupId, msg2);

    expect(getPendingMessages(userId, groupId)).toHaveLength(2);

    removePendingMessage(userId, groupId, 'temp-1');
    const remaining = getPendingMessages(userId, groupId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('temp-2');

    removePendingMessage(userId, groupId, 'temp-2');
    expect(getPendingMessages(userId, groupId)).toHaveLength(0);
    expect(localStorage.getItem(getQueueKey(userId, groupId))).toBeNull();
  });

  it('handles corrupted JSON in localStorage gracefully', () => {
    localStorage.setItem(getQueueKey(userId, groupId), 'invalid JSON {{{{');
    const msgs = getPendingMessages(userId, groupId);
    expect(msgs).toEqual([]);
  });

  it('clears all pending messages for user across groups', () => {
    savePendingMessage(userId, 'group-1', { id: 'temp-1', text: 'Msg 1', senderId: userId });
    savePendingMessage(userId, 'group-2', { id: 'temp-2', text: 'Msg 2', senderId: userId });
    savePendingMessage(otherUserId, 'group-1', { id: 'temp-3', text: 'Msg 3', senderId: otherUserId });

    expect(getPendingMessages(userId, 'group-1')).toHaveLength(1);
    expect(getPendingMessages(userId, 'group-2')).toHaveLength(1);

    clearPendingMessages(userId);
    expect(getPendingMessages(userId, 'group-1')).toHaveLength(0);
    expect(getPendingMessages(userId, 'group-2')).toHaveLength(0);

    // Other user's queue is unaffected
    expect(getPendingMessages(otherUserId, 'group-1')).toHaveLength(1);
  });
});
