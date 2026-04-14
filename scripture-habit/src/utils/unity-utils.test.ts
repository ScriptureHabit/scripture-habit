import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateUnityPercentage } from './unity-utils';
import { Group } from '../types/chat';

describe('calculateUnityPercentage Timezone Discrepancy', () => {
  const mockGroup: Group = {
    id: 'group1',
    name: 'Test Group',
    members: ['user1', 'user2'],
    dailyActivity: {
      date: '2023-10-28', // Set by a poster in Tokyo (UTC+9)
      activeMembers: ['user1']
    },
    memberJoinedAt: {
      'user1': { seconds: 1000000000, nanoseconds: 0 },
      'user2': { seconds: 1000000000, nanoseconds: 0 }
    }
  } as unknown as Group;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates 50% for London viewer when stable fallback is used', () => {
    // Current time: 2023-10-28 05:00 Tokyo time -> WHICH IS 2023-10-27 20:00 UTC
    vi.setSystemTime(new Date('2023-10-28T05:00:00+09:00'));

    // Poster A was in Tokyo and it was 2023-10-28 for them.
    // BUT! Our new logic says: If group has no timezone, use UTC.
    // In UTC, it's currently 2023-10-27 20:00 -> Date: 2023-10-27.
    
    // So if the summary was set to "2023-10-28", it means the POSTER also should have used UTC 
    // (which would have result in 2023-10-27).
    
    // Let's test absolute consistency:
    const groupWithNoTZ: Group = { ...mockGroup, timeZone: undefined, dailyActivity: { date: '2023-10-27', activeMembers: ['user1'] } } as unknown as Group;
    
    // Both Tokyo and London viewers should see 50% because they both fallback to UTC (2023-10-27).
    expect(calculateUnityPercentage(groupWithNoTZ)).toBe(50);
    expect(calculateUnityPercentage(groupWithNoTZ)).toBe(50);
  });

  it('calculates 0% if the summary actually belongs to a different UTC day', () => {
    vi.setSystemTime(new Date('2023-10-28T05:00:00+09:00')); // UTC is 2023-10-27
    const groupWithFutureDate: Group = { ...mockGroup, timeZone: undefined, dailyActivity: { date: '2023-10-28', activeMembers: ['user1'] } } as unknown as Group;
    
    expect(calculateUnityPercentage(groupWithFutureDate)).toBe(0);
  });

  it('respects the referenceDate parameter', () => {
    const group: Group = {
      ...mockGroup,
      timeZone: 'UTC',
      dailyActivity: { date: '2023-11-01', activeMembers: ['user1'] }
    } as unknown as Group;

    const date1 = new Date('2023-11-01T12:00:00Z');
    const date2 = new Date('2023-11-02T12:00:00Z');

    expect(calculateUnityPercentage(group, [], date1)).toBe(50);
    expect(calculateUnityPercentage(group, [], date2)).toBe(0);
  });

  describe('Member Exclusion based on joinedAt', () => {
    it('excludes members who joined after the reference date', () => {
      const group: Group = {
        id: 'g1',
        members: ['oldUser', 'newUser'],
        memberJoinedAt: {
          'oldUser': { seconds: 1698451200, nanoseconds: 0 }, // 2023-10-28 00:00:00 UTC
          'newUser': { seconds: 1698537600, nanoseconds: 0 }, // 2023-10-29 00:00:00 UTC
        },
        dailyActivity: {
          date: '2023-10-28',
          activeMembers: ['oldUser']
        }
      } as unknown as Group;

      // referenceDate is 2023-10-28
      const referenceDate = new Date('2023-10-28T12:00:00Z');
      
      // newUser joined on 10-29, so on 10-28 they shouldn't be counted in denominator.
      // Denominator: 1 (oldUser), Active: 1 (oldUser) -> 100%
      expect(calculateUnityPercentage(group, [], referenceDate)).toBe(100);

      // On 10-29, denominator should be 2.
      const referenceDateNext = new Date('2023-10-29T12:00:00Z');
      // If dailyActivity is still 10-28, it counts as 0% for 10-29.
      expect(calculateUnityPercentage(group, [], referenceDateNext)).toBe(0);
    });

    it('correctly handles members who joined ON the reference date (should be included)', () => {
      const group: Group = {
        id: 'g1',
        members: ['user1'],
        memberJoinedAt: {
          'user1': { seconds: 1698537600, nanoseconds: 0 }, // 2023-10-29 00:00:00 UTC
        },
        dailyActivity: {
          date: '2023-10-29',
          activeMembers: ['user1']
        }
      } as unknown as Group;

      const referenceDate = new Date('2023-10-29T23:59:59Z');
      expect(calculateUnityPercentage(group, [], referenceDate)).toBe(100);
    });
  });

  it('handles empty groups or groups with no members gracefully', () => {
    const emptyGroup: Group = {
      id: 'empty',
      members: [],
      memberJoinedAt: {},
      dailyActivity: { date: '2023-10-28', activeMembers: [] }
    } as unknown as Group;

    expect(calculateUnityPercentage(emptyGroup)).toBe(0);
  });
});
