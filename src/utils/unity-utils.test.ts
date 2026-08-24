import { describe, it, expect } from 'vitest';
import { getUnityParticipation } from './unity-utils';
import { Group, Message } from '../types/chat';

describe('Unity Utils - getUnityParticipation', () => {
  const mockGroup: Group = {
    id: 'test-group',
    name: 'Test Group',
    members: ['user1', 'user2', 'user3'],
    memberJoinedAt: {
      'user1': '2024-04-10T00:00:00Z', // Old member
      'user2': '2024-04-10T00:00:00Z', // Old member
      'user3': '2024-04-18T12:00:00Z', // Joined today (reference date below)
    },
    timeZone: 'Asia/Tokyo',
    dailyActivity: {
      date: '2024-04-18',
      activeMembers: ['user1']
    }
  } as unknown as Group;

  // Reference date: 2024-04-18 15:00 Japan Time
  const referenceDate = new Date('2024-04-18T06:00:00Z'); 

  it('should correctly identify eligible members (excluding those who joined today and haven\'t posted)', () => {
    const result = getUnityParticipation(mockGroup, [], referenceDate);
    
    // user1, user2 are eligible. user3 joined today so is NOT eligible unless they post.
    expect(result.eligibleMembers).toContain('user1');
    expect(result.eligibleMembers).toContain('user2');
    expect(result.eligibleMembers).not.toContain('user3');
    expect(result.eligibleMembers.length).toBe(2);
  });

  it('should include new members in eligibility if they HAVE posted', () => {
    const groupWithNewPoster = {
      ...mockGroup,
      dailyActivity: {
        date: '2024-04-18',
        activeMembers: ['user1', 'user3']
      }
    };
    const result = getUnityParticipation(groupWithNewPoster as unknown as Group, [], referenceDate);
    
    expect(result.eligibleMembers).toContain('user3');
    expect(result.eligibleMembers.length).toBe(3);
    expect(result.percentage).toBe(67); // 2/3 = 66.6 -> 67
  });

  it('should handle real-time note messages correctly', () => {
    const messages: Message[] = [
      { senderId: 'user2', isNote: true, createdAt: '2024-04-18T00:05:00Z' } as unknown as Message // Posted today in Japan
    ];
    
    const result = getUnityParticipation(mockGroup, messages, referenceDate);
    
    expect(result.postedMembers).toContain('user1'); // From Source A
    expect(result.postedMembers).toContain('user2'); // From Source B
    expect(result.percentage).toBe(100); // 2/2 = 100%
  });

  it('should NOT count regular chat messages towards unity percentage', () => {
    const chatMessages: Message[] = [
      { senderId: 'user2', isNote: false, text: 'Hello everyone!', createdAt: '2024-04-18T00:05:00Z' } as unknown as Message,
      { senderId: 'user3', text: 'Good morning!', createdAt: '2024-04-18T00:06:00Z' } as unknown as Message
    ];

    const result = getUnityParticipation(mockGroup, chatMessages, referenceDate);

    // Only user1 (from Source A dailyActivity) should be in postedMembers
    expect(result.postedMembers).toContain('user1');
    expect(result.postedMembers).not.toContain('user2');
    expect(result.postedMembers).not.toContain('user3');
    expect(result.percentage).toBe(50); // 1/2 = 50%
  });

  it('should count legacy note messages with isEntry or originalNoteId', () => {
    const legacyEntryMessages: Message[] = [
      { senderId: 'user2', isEntry: true, text: 'Old note', createdAt: '2024-04-18T00:05:00Z' } as unknown as Message
    ];

    const result = getUnityParticipation(mockGroup, legacyEntryMessages, referenceDate);
    expect(result.postedMembers).toContain('user2');
    expect(result.percentage).toBe(100);
  });

  it('should calculate 50% unity percentage when AI partner bot posts a daily note in 2-member AI group', () => {
    const aiGroup: Group = {
      id: 'ai-group',
      name: 'AI Partner Group',
      isAiGroup: true,
      aiCompanionUid: 'ai-partner-bot',
      members: ['user1', 'ai-partner-bot'],
      memberJoinedAt: {
        'user1': '2024-04-10T00:00:00Z',
        'ai-partner-bot': '2024-04-10T00:00:00Z'
      },
      timeZone: 'Asia/Tokyo'
    } as unknown as Group;

    const aiNoteMessages: Message[] = [
      {
        senderId: 'ai-partner-bot',
        isNote: true,
        text: 'カテゴリ: 旧約聖書\n章: エステル記 8:1-17\nComment: Test',
        createdAt: '2024-04-18T00:05:00Z'
      } as unknown as Message
    ];

    const result = getUnityParticipation(aiGroup, aiNoteMessages, referenceDate);

    expect(result.postedMembers).toContain('ai-partner-bot');
    expect(result.postedMembers).not.toContain('user1');
    expect(result.percentage).toBe(50); // 1/2 = 50%
  });

  it('should return 0% if no one is eligible', () => {
    const emptyGroup = { ...mockGroup, members: [] };
    const result = getUnityParticipation(emptyGroup as unknown as Group, [], referenceDate);
    expect(result.percentage).toBe(0);
  });
  
  it('should handle date normalization issues (hidden characters)', () => {
    const groupWithWeirdDate = {
      ...mockGroup,
      dailyActivity: {
        date: '2024-04-18\n', // Hidden newline
        activeMembers: ['user1']
      }
    };
    const result = getUnityParticipation(groupWithWeirdDate as unknown as Group, [], referenceDate);
    expect(result.postedMembers).toContain('user1'); // Should still match due to normalization
  });

  describe('Edge Cases - Timezones and Date Mismatches', () => {
    it('should return 0% if the client date is ahead of the group activity date (Midnight Mismatch)', () => {
      // Group is in Tokyo, activity is from April 17th
      const group: Group = {
        ...mockGroup,
        timeZone: 'Asia/Tokyo',
        dailyActivity: {
          date: '2024-04-17',
          activeMembers: ['user1']
        }
      } as unknown as Group;

      // Client is also in Tokyo, but it's now April 18th (Reference date)
      const clientDate = new Date('2024-04-18T00:05:00+09:00'); // Just after midnight on the 18th
      
      const result = getUnityParticipation(group, [], clientDate);
      
      // Should be 0% because the activity date (17th) doesn't match client's "today" (18th)
      expect(result.percentage).toBe(0);
      expect(result.postedMembers.length).toBe(0);
    });

    it('should return 0% if the client has a missing timezone and falls back to UTC (Timezone Mismatch)', () => {
      // Group is in Tokyo, activity is '2024-04-18' (JST)
      // Reference date is 2024-04-18 05:00 JST -> which is 2024-04-17 20:00 UTC
      const referenceDateJST = new Date('2024-04-17T20:00:00Z'); 

      const groupWithNoTZ: Group = {
        ...mockGroup,
        timeZone: undefined, // Missing TZ -> Defaults to UTC
        dailyActivity: {
          date: '2024-04-18', // Saved by backend which knows it's Tokyo
          activeMembers: ['user1']
        }
      } as unknown as Group;

      const result = getUnityParticipation(groupWithNoTZ, [], referenceDateJST);
      
      // In UTC, the date is still April 17th. 
      // So it doesn't match the activity's '2024-04-18'.
      expect(result.percentage).toBe(0);
    });
  });
});
