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

  beforeEach(() => {
    localStorage.clear();
  });

  it('generates consistent queue key', () => {
    expect(getQueueKey('group-abc')).toBe('scripture_habit_pending_msgs_group-abc');
  });

  it('returns empty array when no pending messages exist', () => {
    const msgs = getPendingMessages(groupId);
    expect(msgs).toEqual([]);
  });

  it('saves and retrieves pending messages with isFailed: true and isOptimistic: false', () => {
    const msg: Message = {
      id: 'temp-123456',
      optimisticId: 'temp-123456',
      text: 'Pending offline message',
      senderId: 'user-1',
      senderNickname: 'Alice',
      clientTimestamp: 1700000000000
    };

    savePendingMessage(groupId, msg);

    const pending = getPendingMessages(groupId);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('temp-123456');
    expect(pending[0].text).toBe('Pending offline message');
    expect(pending[0].isFailed).toBe(true);
    expect(pending[0].isOptimistic).toBe(false);
  });

  it('updates an existing message in the queue without duplicating', () => {
    const msg: Message = {
      id: 'temp-123456',
      optimisticId: 'temp-123456',
      text: 'Initial text',
      senderId: 'user-1'
    };

    savePendingMessage(groupId, msg);
    savePendingMessage(groupId, { ...msg, text: 'Updated text' });

    const pending = getPendingMessages(groupId);
    expect(pending).toHaveLength(1);
    expect(pending[0].text).toBe('Updated text');
  });

  it('removes pending message by id or optimisticId', () => {
    const msg1: Message = { id: 'temp-1', optimisticId: 'temp-1', text: 'Msg 1', senderId: 'u1' };
    const msg2: Message = { id: 'temp-2', optimisticId: 'temp-2', text: 'Msg 2', senderId: 'u1' };

    savePendingMessage(groupId, msg1);
    savePendingMessage(groupId, msg2);

    expect(getPendingMessages(groupId)).toHaveLength(2);

    removePendingMessage(groupId, 'temp-1');
    const remaining = getPendingMessages(groupId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('temp-2');

    removePendingMessage(groupId, 'temp-2');
    expect(getPendingMessages(groupId)).toHaveLength(0);
    expect(localStorage.getItem(getQueueKey(groupId))).toBeNull();
  });

  it('handles corrupted JSON in localStorage gracefully', () => {
    localStorage.setItem(getQueueKey(groupId), 'invalid JSON {{{{');
    const msgs = getPendingMessages(groupId);
    expect(msgs).toEqual([]);
  });

  it('clears all pending messages for group', () => {
    savePendingMessage(groupId, { id: 'temp-1', text: 'Msg 1', senderId: 'u1' });
    expect(getPendingMessages(groupId)).toHaveLength(1);

    clearPendingMessages(groupId);
    expect(getPendingMessages(groupId)).toHaveLength(0);
  });
});
