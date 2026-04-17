
import { describe, it, expect } from 'vitest';
import { enrichGroupUnity } from './group-utils';
import { Group } from '../types/chat';

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
    const result = enrichGroupUnity(mockGroup, 50, today);
    expect(result.unityPercentage).toBe(50);
  });

  it('should use calculated value when it matches the date and is > 0', () => {
    // Calculated should be 50% (1/2 members)
    const result = enrichGroupUnity(mockGroup, undefined, today);
    expect(result.unityPercentage).toBe(50);
  });

  it('should return 0 when date mismatch occurs (Midnight Reset Case)', () => {
    // Simulate a date mismatch: client is on the 19th
    const tomorrow = new Date('2024-04-19T05:00:00Z');
    
    // calculated will be 0 because 2024-04-18 (activity) != 2024-04-19 (today)
    const result = enrichGroupUnity(mockGroup, undefined, tomorrow);
    
    // Should return 0 (reset) instead of 33 (stale Firestore value)
    expect(result.unityPercentage).toBe(0);
  });

  it('should handle Firestore Timestamp in dailyActivity.date', () => {
    const timestampGroup = {
      ...mockGroup,
      unityPercentage: 75,
      dailyActivity: {
        date: { seconds: 1713416400, nanoseconds: 0, toDate: () => new Date(1713416400 * 1000) }, // 2024-04-18
        activeMembers: ['u1', 'u2']
      }
    } as unknown as Group;

    const result = enrichGroupUnity(timestampGroup, undefined, today);
    // 2/2 members = 100%
    expect(result.unityPercentage).toBe(100);
  });

  it('should fallback to Firestore value when dailyActivity.date is missing but not stale', () => {
    const noActivityGroup = {
      ...mockGroup,
      unityPercentage: 42,
      dailyActivity: undefined
    } as unknown as Group;

    const result = enrichGroupUnity(noActivityGroup, undefined, today);
    expect(result.unityPercentage).toBe(42);
  });

  it('should return 0 if both calculated and Firestore values are missing/0', () => {
    const emptyGroup = { ...mockGroup, unityPercentage: 0, dailyActivity: undefined };
    const result = enrichGroupUnity(emptyGroup as unknown as Group, undefined, today);
    expect(result.unityPercentage).toBe(0);
  });
});
