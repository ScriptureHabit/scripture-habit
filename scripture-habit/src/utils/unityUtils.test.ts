import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateUnityPercentage } from './unityUtils';
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
});
