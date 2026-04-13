import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
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

        it('[Regression - Cosmos bug] Member whose joinedAt was reset to "now" by old cron should still be detected as inactive via group-level map', () => {
            // This test reproduces the exact conditions that caused Cosmos to not be removed:
            // - joinedAt (corrupted) = just NOW (reset by old serverTimestamp cron bug)
            // - All real timestamps (group-level activity maps) = 14+ days ago
            // After the guard resets joinedAt to createTime (which is 14 days old in this unit test),
            // Math.max picks 14 days ago → inactive.
            const FOURTEEN_DAYS_AGO = new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000);
            const ts14 = { toMillis: () => FOURTEEN_DAYS_AGO.getTime() };

            // Simulate guard behavior: joinedAt is reset to createTime (14 days old)
            const memberDataAfterGuard: InactivityMemberData = {
                joinedAt: FOURTEEN_DAYS_AGO,  // createTime, used after guard resets it
                lastReadAt: FOURTEEN_DAYS_AGO, // truly inactive
                lastActiveAt: FOURTEEN_DAYS_AGO
            };
            const groupData: InactivityGroupData = {
                memberLastActive: { 'cosmos': ts14 as never },
                memberLastReadAt: { 'cosmos': ts14 as never },
                pace: 7
            };

            const result = calculateMemberStatus('cosmos', memberDataAfterGuard, groupData, NOW);
            expect(result.status).toBe('inactive');
            expect(result.diffMs).toBeGreaterThanOrEqual(14 * 24 * 60 * 60 * 1000);
        });

        describe('Property-Based Tests', () => {
            it('should ALWAYS mark member inactive if ALL timestamps are mathematically older than the threshold', () => {
                fc.assert(
                    fc.property(
                        fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-01-01T00:00:00Z') }).filter(d => !Number.isNaN(d.getTime())),
                        fc.integer({ min: 1, max: 100 }), // threshold in days
                        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 5, maxLength: 5 }), // exactly 5 gaps in days greater than threshold
                        (now, thresholdDays, gaps) => {
                            const memberData: InactivityMemberData = {
                                joinedAt: new Date(now.getTime() - (thresholdDays + gaps[0]) * 24 * 60 * 60 * 1000),
                                lastNoteAt: new Date(now.getTime() - (thresholdDays + gaps[1]) * 24 * 60 * 60 * 1000),
                                lastPostAt: new Date(now.getTime() - (thresholdDays + gaps[2]) * 24 * 60 * 60 * 1000),
                                lastReadAt: new Date(now.getTime() - (thresholdDays + gaps[3]) * 24 * 60 * 60 * 1000),
                                lastActiveAt: new Date(now.getTime() - (thresholdDays + gaps[4]) * 24 * 60 * 60 * 1000),
                                kickThreshold: thresholdDays
                            };

                            const result = calculateMemberStatus('u1', memberData, {} as InactivityGroupData, now);
                            expect(result.status).toBe('inactive');
                            expect(result.thresholdMs).toBe(thresholdDays * 24 * 60 * 60 * 1000);
                        }
                    )
                );
            });

            it('should ALWAYS mark member active if ANY timestamp is newer than the threshold', () => {
                fc.assert(
                    fc.property(
                        fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-01-01T00:00:00Z') }).filter(d => !Number.isNaN(d.getTime())),
                        fc.integer({ min: 2, max: 100 }), // threshold in days
                        fc.integer({ min: 0, max: 4 }), // which timestamp to make recent
                        fc.integer({ min: 0, max: 1 }), // how many days ago it was (strictly less than min threshold)
                        (now, thresholdDays, index, recentDays) => {
                            const timestamps: Record<string, Date> = {};
                            const keys = ['joinedAt', 'lastNoteAt', 'lastPostAt', 'lastReadAt', 'lastActiveAt'];
                            
                            keys.forEach((key, i) => {
                                if (i === index) {
                                    timestamps[key] = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000);
                                } else {
                                    // Old timestamps
                                    timestamps[key] = new Date(now.getTime() - (thresholdDays + 10) * 24 * 60 * 60 * 1000);
                                }
                            });

                            const memberData: InactivityMemberData = {
                                ...timestamps,
                                kickThreshold: thresholdDays
                            };

                            const result = calculateMemberStatus('u1', memberData, {} as InactivityGroupData, now);
                            expect(result.status).toBe('active');
                        }
                    )
                );
            });
        });
    });
});
