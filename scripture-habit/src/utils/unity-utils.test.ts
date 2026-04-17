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

  it('should handle real-time messages correctly', () => {
    const messages: Message[] = [
      { senderId: 'user2', isNote: true, createdAt: '2024-04-18T00:05:00Z' } as unknown as Message // Posted today in Japan
    ];
    
    const result = getUnityParticipation(mockGroup, messages, referenceDate);
    
    expect(result.postedMembers).toContain('user1'); // From Source A
    expect(result.postedMembers).toContain('user2'); // From Source B
    expect(result.percentage).toBe(100); // 2/2 = 100%
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
});
