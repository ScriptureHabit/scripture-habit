import { describe, it, expect } from 'vitest';
import { calculateNearestKickDate } from './group-utils';
import { UserData } from '../types/user';
import { Group } from '../types/chat';

describe('Group Utils - calculateNearestKickDate', () => {
  const mockUser: UserData = {
    uid: 'u1',
    kickThreshold: 3,
    lastPostAt: '2024-05-10T10:00:00Z',
  } as UserData;

  it('should return null if no groups', () => {
    expect(calculateNearestKickDate(mockUser, [])).toBeNull();
  });

  it('should calculate kick date based on user lastPostAt and default threshold', () => {
    const groups: Group[] = [{
      id: 'g1',
      memberKickThresholds: {},
    } as unknown as Group];
    
    // 2024-05-10 + 3 days = 2024-05-13
    const result = calculateNearestKickDate(mockUser, groups);
    expect(result).toBe('2024-05-13');
  });

  it('should respect group-specific threshold for member', () => {
    const groups: Group[] = [{
      id: 'g1',
      memberKickThresholds: { 'u1': 5 },
    } as unknown as Group];
    
    // 2024-05-10 + 5 days = 2024-05-15
    const result = calculateNearestKickDate(mockUser, groups);
    expect(result).toBe('2024-05-15');
  });

  it('should respect myMemberStatus kickThreshold (highest priority)', () => {
    const groups: Group[] = [{
      id: 'g1',
      memberKickThresholds: { 'u1': 5 },
      myMemberStatus: { kickThreshold: 7 }
    } as unknown as Group];
    
    // 2024-05-10 + 7 days = 2024-05-17
    const result = calculateNearestKickDate(mockUser, groups);
    expect(result).toBe('2024-05-17');
  });

  it('should pick the EARLIEST kick date across multiple groups', () => {
    const groups: Group[] = [
      {
        id: 'g1',
        myMemberStatus: { kickThreshold: 5 } // 10th + 5 = 15th
      } as unknown as Group,
      {
        id: 'g2',
        myMemberStatus: { kickThreshold: 2 } // 10th + 2 = 12th
      } as unknown as Group
    ];
    
    const result = calculateNearestKickDate(mockUser, groups);
    expect(result).toBe('2024-05-12');
  });

  it('should consider my lastNoteAt in member status if it is newer than lastPostAt', () => {
    const userWithOldPost = { ...mockUser, lastPostAt: '2024-05-01T10:00:00Z' };
    const groups: Group[] = [{
      id: 'g1',
      myMemberStatus: { 
        kickThreshold: 3,
        lastNoteAt: '2024-05-10T10:00:00Z' // Newer activity
      }
    } as unknown as Group];
    
    // 2024-05-10 + 3 = 2024-05-13
    const result = calculateNearestKickDate(userWithOldPost, groups);
    expect(result).toBe('2024-05-13');
  });

  it('should return null if user has no activity timestamps', () => {
    const inactiveUser = { uid: 'u1' } as UserData;
    const groups: Group[] = [{ id: 'g1' } as Group];
    expect(calculateNearestKickDate(inactiveUser, groups)).toBeNull();
  });
});
