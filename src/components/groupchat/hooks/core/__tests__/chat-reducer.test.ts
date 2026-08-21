import { describe, it, expect } from 'vitest';
import { computeUnreadAnchorId } from '../chat-reducer';
import { Message } from '../../../../../types/chat';

const createMockMsg = (id: string, senderId: string, timestamp: number): Message => ({
  id,
  senderId,
  text: `Message ${id}`,
  createdAt: { seconds: Math.floor(timestamp / 1000), nanoseconds: 0 },
  clientTimestamp: timestamp
});

describe('computeUnreadAnchorId Unit Tests', () => {
  it('returns null when userReadCount is null or 0', () => {
    const msgs = [createMockMsg('msg1', 'user1', 1000)];
    expect(computeUnreadAnchorId(msgs, null, null)).toBeNull();
    expect(computeUnreadAnchorId(msgs, 0, null)).toBeNull();
  });

  it('returns null when userReadCount is >= total messages count (all read)', () => {
    const msgs = [
      createMockMsg('msg1', 'user1', 1000),
      createMockMsg('msg2', 'user2', 2000)
    ];
    expect(computeUnreadAnchorId(msgs, 2, null)).toBeNull();
    expect(computeUnreadAnchorId(msgs, 5, null)).toBeNull();
  });

  it('returns the correct anchor message ID for unread messages', () => {
    const msgs = [
      createMockMsg('msg1', 'user1', 1000),
      createMockMsg('msg2', 'user2', 2000),
      createMockMsg('msg3', 'user3', 3000)
    ];
    // Read count is 1 => anchor is msg1 (index 0)
    expect(computeUnreadAnchorId(msgs, 1, null)).toBe('msg1');
    // Read count is 2 => anchor is msg2 (index 1)
    expect(computeUnreadAnchorId(msgs, 2, null)).toBe('msg2');
  });

  it('freezes and returns existingAnchorId if it is already set', () => {
    const msgs = [
      createMockMsg('msg1', 'user1', 1000),
      createMockMsg('msg2', 'user2', 2000),
      createMockMsg('msg3', 'user3', 3000)
    ];
    // Even if read count updates to 3 (all read), existing frozen anchor ID persists
    expect(computeUnreadAnchorId(msgs, 3, 'msg1')).toBe('msg1');
  });

  it('falls back to preceding user message when target message is a system message', () => {
    const msgs = [
      createMockMsg('msg1', 'user1', 1000),
      createMockMsg('sys1', 'system', 2000), // Target is system message
      createMockMsg('msg3', 'user3', 3000)
    ];
    // Read count is 2 => target is sys1 (index 1). Fallback should choose msg1 (index 0)
    expect(computeUnreadAnchorId(msgs, 2, null)).toBe('msg1');
  });

  it('performs defensive sorting if messages are provided in unsorted order', () => {
    const unsortedMsgs = [
      createMockMsg('msg3', 'user3', 3000),
      createMockMsg('msg1', 'user1', 1000),
      createMockMsg('msg2', 'user2', 2000)
    ];
    // Read count is 1 => after sorting (msg1, msg2, msg3), anchor is msg1
    expect(computeUnreadAnchorId(unsortedMsgs, 1, null)).toBe('msg1');
    // Read count is 2 => anchor is msg2
    expect(computeUnreadAnchorId(unsortedMsgs, 2, null)).toBe('msg2');
  });
});
