import { describe, it, expect } from 'vitest';
import { calculateMemberStatus, toMillis, InactivityMemberData, InactivityGroupData } from './inactivity-utils.js';

describe('Inactivity Utils', () => {
    describe('toMillis', () => {
        it('should return 0 for null or undefined', () => {
            expect(toMillis(null)).toBe(0);
            expect(toMillis(undefined)).toBe(0);
        });

        it('should handle Date objects', () => {
            const date = new Date('2024-01-01T12:00:00Z');
            expect(toMillis(date)).toBe(date.getTime());
        });

        it('should handle numbers (milliseconds)', () => {
            expect(toMillis(1704110400000)).toBe(1704110400000);
        });

        it('should handle ISO strings', () => {
            const iso = '2024-01-01T12:00:00.000Z';
            expect(toMillis(iso)).toBe(new Date(iso).getTime());
        });

        it('should return 0 for invalid date strings', () => {
            expect(toMillis('not-a-date')).toBe(0);
        });

        it('should handle Firestore-style objects with toMillis()', () => {
            const mockTimestamp = {
                toMillis: () => 123456789
            };
            expect(toMillis(mockTimestamp)).toBe(123456789);
        });

        it('should handle Firestore-style objects with seconds or _seconds', () => {
            expect(toMillis({ seconds: 1704110400 })).toBe(1704110400000);
            expect(toMillis({ _seconds: 1704110400 })).toBe(1704110400000);
        });

        it('should return 0 for unsupported object types', () => {
            expect(toMillis({})).toBe(0);
            expect(toMillis({ someOtherField: 123 })).toBe(0);
        });
    });

    const NOW = new Date('2024-01-10T00:00:00Z');

    describe('calculateMemberStatus', () => {
        it('should return needs_initialization if all timestamps are missing', () => {
            const memberData: InactivityMemberData = {};
            const result = calculateMemberStatus('u1', memberData, {} as InactivityGroupData, NOW);
            expect(result.status).toBe('needs_initialization');
        });

        it('should mark a member active if they joined within the threshold', () => {
            const memberData: InactivityMemberData = {
                joinedAt: new Date('2024-01-08T00:00:00Z') // 2 days ago
            };
            const result = calculateMemberStatus('u1', memberData, {} as InactivityGroupData, NOW);
            expect(result.status).toBe('active');
            expect(result.diffMs).toBe(2 * 24 * 60 * 60 * 1000);
        });

        it('should mark a member inactive if they joined long ago and have no other activity', () => {
            const memberData: InactivityMemberData = {
                joinedAt: new Date('2024-01-01T00:00:00Z') // 9 days ago
            };
            const result = calculateMemberStatus('u1', memberData, {} as InactivityGroupData, NOW);
            expect(result.status).toBe('inactive');
            expect(result.diffMs).toBe(9 * 24 * 60 * 60 * 1000);
        });

        it('should pick the LATEST activity from multiple timestamps (Math.max check)', () => {
            const memberData: InactivityMemberData = {
                joinedAt: new Date('2024-01-01T00:00:00Z'),
                lastReadAt: new Date('2024-01-05T00:00:00Z'),
                lastNoteAt: new Date('2024-01-09T00:00:00Z') // 1 day ago (LATEST)
            };
            const result = calculateMemberStatus('u1', memberData, {} as InactivityGroupData, NOW);
            expect(result.status).toBe('active');
            expect(result.lastActiveTime).toBe(new Date('2024-01-09T00:00:00Z').getTime());
        });

        it('should mark a member active via reading even if they are old', () => {
            const memberData: InactivityMemberData = {
                joinedAt: new Date('2024-01-01T00:00:00Z'), // 9 days ago
                lastReadAt: new Date('2024-01-09T00:00:00Z') // 1 day ago
            };
            const result = calculateMemberStatus('u1', memberData, {} as InactivityGroupData, NOW);
            expect(result.status).toBe('active');
            expect(result.lastActiveTime).toBe(new Date('2024-01-09T00:00:00Z').getTime());
        });

        it('should respect custom kick thresholds from member data', () => {
            const memberData: InactivityMemberData = {
                joinedAt: new Date('2024-01-01T00:00:00Z'),
                lastActiveAt: new Date('2024-01-06T00:00:00Z'), // 4 days ago
                kickThreshold: 7 // 7 days threshold instead of 3
            };
            const result = calculateMemberStatus('u1', memberData, {} as InactivityGroupData, NOW);
            expect(result.status).toBe('active');
        });

        it('should respect custom kick thresholds from group data', () => {
            const memberData: InactivityMemberData = {
                joinedAt: new Date('2024-01-01T00:00:00Z'),
                lastActiveAt: new Date('2024-01-06T00:00:00Z') // 4 days ago
            };
            const groupData: InactivityGroupData = {
                memberKickThresholds: { 'u1': 7 }
            };
            const result = calculateMemberStatus('u1', memberData, groupData, NOW);
            expect(result.status).toBe('active');
        });

        it('should prioritize more recent activity from group-level overrides (Math.max check)', () => {
            const memberData: InactivityMemberData = {
                joinedAt: new Date('2024-01-01T00:00:00Z'),
                lastNoteAt: new Date('2024-01-05T00:00:00Z') // 5 days ago
            };
            const groupData: InactivityGroupData = {
                memberLastActive: { 'u1': new Date('2024-01-09T00:00:00Z') } // 1 day ago
            };
            const result = calculateMemberStatus('u1', memberData, groupData, NOW);
            expect(result.status).toBe('active');
            expect(result.lastActiveTime).toBe(new Date('2024-01-09T00:00:00Z').getTime());
        });

        it('should handle boundary case: exactly on the threshold', () => {
            const thresholdDays = 3;
            const lastActive = new Date(NOW.getTime() - thresholdDays * 24 * 60 * 60 * 1000);
            const memberData: InactivityMemberData = { joinedAt: lastActive };
            
            const result = calculateMemberStatus('u1', memberData, {} as InactivityGroupData, NOW);
            // In current logic: diffMs > thresholdMs is inactive. 
            // If diffMs == thresholdMs, it is NOT greater, so it should be active.
            expect(result.status).toBe('active');
        });

        it('should handle boundary case: 1ms over the threshold', () => {
            const thresholdDays = 3;
            const lastActive = new Date(NOW.getTime() - (thresholdDays * 24 * 60 * 60 * 1000 + 1));
            const memberData: InactivityMemberData = { joinedAt: lastActive };
            
            const result = calculateMemberStatus('u1', memberData, {} as InactivityGroupData, NOW);
            expect(result.status).toBe('inactive');
        });
    });
});
