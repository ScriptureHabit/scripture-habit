import { describe, it, expect } from 'vitest';
import { enrichGroupUnity, calculateNearestKickDate } from './group-utils';
import { Group } from '../types/chat';
import { UserData } from '../types/user';

describe('Group Utils - enrichGroupUnity', () => {
  const mockGroup: Group = {
    id: 'test-group',
    members: ['u1', 'u2'],
    unityPercentage: 33, // Firestore value (backend)
    dailyActivity: {
      date: '2024-04-18',
      activeMembers: ['u1']
    },
    name: 'Test Group',
    timeZone: 'Asia/Tokyo'
  } as unknown as Group;

  const today = new Date('2024-04-18T05:00:00Z'); // 2:00 PM JST

  it('should prefer the override value when provided', () => {
    const result = enrichGroupUnity(mockGroup, [], 50, today);
    expect(result.unityPercentage).toBe(50);
  });

  it('should use calculated value when it matches the date and is > 0', () => {
    const result = enrichGroupUnity(mockGroup, [], undefined, today);
    expect(result.unityPercentage).toBe(50);
  });

  it('should return 0 when date mismatch occurs (Midnight Reset Case)', () => {
    const tomorrow = new Date('2024-04-19T05:00:00Z');
    const result = enrichGroupUnity(mockGroup, [], undefined, tomorrow);
    expect(result.unityPercentage).toBe(0);
  });

  it('should handle Firestore Timestamp in dailyActivity.date', () => {
    const timestampGroup = {
      ...mockGroup,
      unityPercentage: 75,
      dailyActivity: {
        date: { seconds: 1713416400, nanoseconds: 0, toDate: () => new Date(1713416400 * 1000) },
        activeMembers: ['u1', 'u2']
      }
    } as unknown as Group;

    const result = enrichGroupUnity(timestampGroup, [], undefined, today);
    expect(result.unityPercentage).toBe(100);
  });

  it('should fallback to Firestore value when dailyActivity.date is missing but not stale', () => {
    const noActivityGroup = {
      ...mockGroup,
      unityPercentage: 42,
      dailyActivity: undefined
    } as unknown as Group;

    const result = enrichGroupUnity(noActivityGroup, [], undefined, today);
    expect(result.unityPercentage).toBe(42);
  });

  it('should prefer higher Firestore value over lower local calculation (Metadata Lag Case)', () => {
    const laggingGroup = {
      ...mockGroup,
      unityPercentage: 100,
      dailyActivity: {
        date: '2024-04-18',
        activeMembers: ['u1']
      }
    } as unknown as Group;

    const result = enrichGroupUnity(laggingGroup, [], undefined, today);
    expect(result.unityPercentage).toBe(100);
  });
});

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
    
    const result = calculateNearestKickDate(mockUser, groups);
    expect(result).toBe('2024-05-15');
  });

  it('should respect myMemberStatus kickThreshold (highest priority)', () => {
    const groups: Group[] = [{
      id: 'g1',
      memberKickThresholds: { 'u1': 5 },
      myMemberStatus: { kickThreshold: 7 }
    } as unknown as Group];
    
    const result = calculateNearestKickDate(mockUser, groups);
    expect(result).toBe('2024-05-17');
  });

  it('should pick the EARLIEST kick date across multiple groups', () => {
    const groups: Group[] = [
      { id: 'g1', myMemberStatus: { kickThreshold: 5 } },
      { id: 'g2', myMemberStatus: { kickThreshold: 2 } }
    ] as unknown as Group[];
    
    const result = calculateNearestKickDate(mockUser, groups);
    expect(result).toBe('2024-05-12');
  });

  it('should consider my lastNoteAt in member status if it is newer than lastPostAt', () => {
    const userWithOldPost = { ...mockUser, lastPostAt: '2024-05-01T10:00:00Z' };
    const groups: Group[] = [{
      id: 'g1',
      myMemberStatus: { 
        kickThreshold: 3,
        lastNoteAt: '2024-05-10T10:00:00Z'
      }
    } as unknown as Group];
    
    const result = calculateNearestKickDate(userWithOldPost, groups);
    expect(result).toBe('2024-05-13');
  });

  it('should return null if user has no activity timestamps', () => {
    const inactiveUser = { uid: 'u1' } as UserData;
    const groups: Group[] = [{ id: 'g1' } as Group];
    expect(calculateNearestKickDate(inactiveUser, groups)).toBeNull();
  });
});
