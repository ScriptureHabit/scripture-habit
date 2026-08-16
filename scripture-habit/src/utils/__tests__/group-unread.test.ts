import { describe, it, expect } from 'vitest';
import { hasGroupUnread, hasAnyGroupUnread } from '../group-utils';
import { Group } from '../../types/chat';

describe('Group Unread Detection Logic (hasGroupUnread & hasAnyGroupUnread)', () => {
  const currentUserId = 'user-123';
  const otherUserId = 'user-456';

  const createMockGroup = (overrides: Partial<Group> = {}): Group => ({
    id: 'group-1',
    name: 'Test Group',
    members: [currentUserId, otherUserId],
    lastMessageAt: { seconds: 1000, nanoseconds: 0 },
    lastMessageByUid: otherUserId,
    memberLastReadAt: {
      [currentUserId]: { seconds: 900, nanoseconds: 0 }
    },
    memberJoinedAt: {
      [currentUserId]: { seconds: 500, nanoseconds: 0 }
    },
    ...overrides
  } as Group);

  describe('hasGroupUnread', () => {
    it('returns true when lastMessageAt is newer than user lastReadAt and sent by another user', () => {
      const group = createMockGroup({
        lastMessageAt: { seconds: 1000, nanoseconds: 0 },
        lastMessageByUid: otherUserId,
        memberLastReadAt: {
          [currentUserId]: { seconds: 900, nanoseconds: 0 }
        }
      });

      expect(hasGroupUnread(group, currentUserId)).toBe(true);
    });

    it('returns false when user has read up to or after lastMessageAt', () => {
      const group = createMockGroup({
        lastMessageAt: { seconds: 1000, nanoseconds: 0 },
        lastMessageByUid: otherUserId,
        memberLastReadAt: {
          [currentUserId]: { seconds: 1000, nanoseconds: 0 }
        }
      });

      expect(hasGroupUnread(group, currentUserId)).toBe(false);
    });

    it('returns false when the last message was sent by the current user (self-message prevention)', () => {
      const group = createMockGroup({
        lastMessageAt: { seconds: 1500, nanoseconds: 0 },
        lastMessageByUid: currentUserId, // Current user sent this message
        memberLastReadAt: {
          [currentUserId]: { seconds: 1000, nanoseconds: 0 }
        }
      });

      expect(hasGroupUnread(group, currentUserId)).toBe(false);
    });

    it('returns false when the last message is a system announcement for the current user note', () => {
      const group = createMockGroup({
        lastMessageAt: { seconds: 1500, nanoseconds: 0 },
        lastMessageByUid: 'system',
        lastNoteByUid: currentUserId, // System announced user's own note
        memberLastReadAt: {
          [currentUserId]: { seconds: 1000, nanoseconds: 0 }
        }
      });

      expect(hasGroupUnread(group, currentUserId)).toBe(false);
    });

    it('returns false when user is currently actively viewing the group chat', () => {
      const group = createMockGroup({
        lastMessageAt: { seconds: 1500, nanoseconds: 0 },
        lastMessageByUid: otherUserId,
        memberLastReadAt: {
          [currentUserId]: { seconds: 1000, nanoseconds: 0 }
        }
      });

      expect(hasGroupUnread(group, currentUserId, true)).toBe(false);
    });

    it('handles first-time group open (no memberLastReadAt) correctly based on joinedAt', () => {
      const group = createMockGroup({
        lastMessageAt: { seconds: 800, nanoseconds: 0 },
        lastMessageByUid: otherUserId,
        memberLastReadAt: {}, // No read record yet
        memberJoinedAt: {
          [currentUserId]: { seconds: 500, nanoseconds: 0 }
        }
      });

      // Message occurred after user joined -> Unread
      expect(hasGroupUnread(group, currentUserId)).toBe(true);

      const oldMessageGroup = createMockGroup({
        lastMessageAt: { seconds: 400, nanoseconds: 0 }, // Message was before user joined
        lastMessageByUid: otherUserId,
        memberLastReadAt: {},
        memberJoinedAt: {
          [currentUserId]: { seconds: 500, nanoseconds: 0 }
        }
      });

      expect(hasGroupUnread(oldMessageGroup, currentUserId)).toBe(false);
    });

    it('returns false if currentUserId or lastMessageAt is missing', () => {
      const group = createMockGroup({ lastMessageAt: undefined });
      expect(hasGroupUnread(group, currentUserId)).toBe(false);
      expect(hasGroupUnread(createMockGroup(), null)).toBe(false);
    });
  });

  describe('hasAnyGroupUnread', () => {
    it('returns true if at least one group has unread messages', () => {
      const g1 = createMockGroup({ id: 'g1', lastMessageAt: { seconds: 500, nanoseconds: 0 }, memberLastReadAt: { [currentUserId]: { seconds: 500, nanoseconds: 0 } } });
      const g2 = createMockGroup({ id: 'g2', lastMessageAt: { seconds: 1000, nanoseconds: 0 }, memberLastReadAt: { [currentUserId]: { seconds: 800, nanoseconds: 0 } } });

      expect(hasAnyGroupUnread([g1, g2], currentUserId, null, false)).toBe(true);
    });

    it('returns false if all groups are read or active', () => {
      const g1 = createMockGroup({ id: 'g1', lastMessageAt: { seconds: 500, nanoseconds: 0 }, memberLastReadAt: { [currentUserId]: { seconds: 500, nanoseconds: 0 } } });
      const g2 = createMockGroup({ id: 'g2', lastMessageAt: { seconds: 1000, nanoseconds: 0 }, memberLastReadAt: { [currentUserId]: { seconds: 800, nanoseconds: 0 } } });

      // If user is currently viewing g2 in chat view, unread is suppressed
      expect(hasAnyGroupUnread([g1, g2], currentUserId, 'g2', true)).toBe(false);
    });
  });
});
