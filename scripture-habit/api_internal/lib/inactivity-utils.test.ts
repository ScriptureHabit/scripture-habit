import { describe, it, expect } from 'vitest';
import { calculateMemberStatus, toMillis } from './inactivity-utils.js';

describe('Inactivity Utils', () => {
    const NOW = new Date('2026-04-11T12:00:00Z');
    const dayMs = 24 * 60 * 60 * 1000;

    describe('toMillis', () => {
        it('should handle Firestore-like timestamp objects', () => {
            expect(toMillis({ seconds: 1000, nanoseconds: 0 })).toBe(1000000);
            expect(toMillis({ _seconds: 1000, _nanoseconds: 0 })).toBe(1000000);
        });
        it('should handle Dates', () => {
            const d = new Date();
            expect(toMillis(d)).toBe(d.getTime());
        });
    });

    describe('calculateMemberStatus', () => {
        it('should mark a recently posting member as active', () => {
            const memberData = {
                joinedAt: new Date(NOW.getTime() - 10 * dayMs),
                lastNoteAt: new Date(NOW.getTime() - 1 * dayMs), // Posted 1 day ago
            };
            const result = calculateMemberStatus('u1', memberData, {}, NOW);
            expect(result.status).toBe('active');
            expect(result.isNewMember).toBe(false);
        });

        it('should mark a new member as active via reading (grace period)', () => {
            const memberData = {
                joinedAt: new Date(NOW.getTime() - 2 * dayMs), // Joined 2 days ago
                lastReadAt: new Date(NOW.getTime() - 1 * dayMs), // Read 1 day ago
            };
            // Threshold is 3 days by default. 
            // Without reading, last activity would be JoinedAt (2 days ago). 
            // With reading, last activity is 1 day ago.
            const result = calculateMemberStatus('u1', memberData, {}, NOW);
            expect(result.status).toBe('active');
            expect(result.isNewMember).toBe(true);
            expect(result.reason).toContain('Active via Reading grace period');
        });

        it('should mark an old member as inactive if they only read beyond grace period', () => {
            const memberData = {
                joinedAt: new Date(NOW.getTime() - 10 * dayMs), // Joined 10 days ago (past 3 day grace)
                lastReadAt: new Date(NOW.getTime() - 1 * dayMs), // Read 1 day ago
                lastNoteAt: new Date(NOW.getTime() - 5 * dayMs), // Posted 5 days ago (past 3 day threshold)
            };
            // Threshold 3 days
            const result = calculateMemberStatus('u1', memberData, {}, NOW);
            expect(result.status).toBe('inactive');
            expect(result.isNewMember).toBe(false);
            expect(result.reason).toContain('Inactive for 5.0 days');
        });

        it('should respect custom member thresholds from memberData', () => {
            const memberData = {
                joinedAt: new Date(NOW.getTime() - 10 * dayMs),
                lastNoteAt: new Date(NOW.getTime() - 5 * dayMs), 
                kickThreshold: 7, // Custom 7 day threshold
            };
            const result = calculateMemberStatus('u1', memberData, {}, NOW);
            expect(result.status).toBe('active'); // 5 < 7
        });

        it('should respect custom member thresholds from groupData', () => {
            const memberData = {
                joinedAt: new Date(NOW.getTime() - 10 * dayMs),
                lastNoteAt: new Date(NOW.getTime() - 5 * dayMs), 
            };
            const groupData = {
                memberKickThresholds: { u1: 7 }
            };
            const result = calculateMemberStatus('u1', memberData, groupData, NOW);
            expect(result.status).toBe('active');
        });

        it('should return needs_initialization if no activity found', () => {
            const result = calculateMemberStatus('u1', {}, {}, NOW);
            expect(result.status).toBe('needs_initialization');
        });

        it('should handle group-level last active overrides', () => {
            const memberData = {
                joinedAt: new Date(NOW.getTime() - 10 * dayMs),
                lastNoteAt: new Date(NOW.getTime() - 10 * dayMs), 
            };
            const groupData = {
                memberLastActive: { u1: new Date(NOW.getTime() - 1 * dayMs) }
            };
            const result = calculateMemberStatus('u1', memberData, groupData, NOW);
            expect(result.status).toBe('active');
        });

        describe('Boundary Conditions', () => {
            it('should be active exactly at the grace period limit', () => {
                const memberData = {
                    joinedAt: new Date(NOW.getTime() - 3 * dayMs), // Exactly 3 days ago
                    lastReadAt: new Date(NOW.getTime() - 1 * dayMs),
                };
                const result = calculateMemberStatus('u1', memberData, {}, NOW);
                // Grace period is 3 days. 3.0 days ago is NOT < 3.0 days ago.
                expect(result.isNewMember).toBe(false);
                // Even if not a new member, being exactly at the threshold (3 days) means status is still 'active'.
                // Status is 'inactive' only if diff > threshold.
                expect(result.status).toBe('active');
            });

            it('should be active slightly before the grace period limit', () => {
                const memberData = {
                    joinedAt: new Date(NOW.getTime() - (3 * dayMs - 1000)), // 3 days minus 1 second
                    lastReadAt: new Date(NOW.getTime() - 1000),
                };
                const result = calculateMemberStatus('u1', memberData, {}, NOW);
                expect(result.isNewMember).toBe(true);
                expect(result.status).toBe('active');
            });

            it('should be active exactly at the kick threshold limit', () => {
                const memberData = {
                    joinedAt: new Date(NOW.getTime() - 10 * dayMs),
                    lastNoteAt: new Date(NOW.getTime() - 3 * dayMs), // Exactly 3 days ago
                };
                const result = calculateMemberStatus('u1', memberData, {}, NOW);
                // Code: diffMs > thresholdMs ? 'inactive' : 'active'
                // If diff is exactly threshold, it is 'active'.
                expect(result.status).toBe('active');
            });

            it('should be inactive slightly after the kick threshold limit', () => {
                const memberData = {
                    joinedAt: new Date(NOW.getTime() - 10 * dayMs),
                    lastNoteAt: new Date(NOW.getTime() - (3 * dayMs + 1000)), // 3 days and 1 second ago
                };
                const result = calculateMemberStatus('u1', memberData, {}, NOW);
                expect(result.status).toBe('inactive');
            });
        });

        describe('Priority and Precedence', () => {
            it('should prefer lastPostAt over lastNoteAt if it is newer', () => {
                const memberData = {
                    joinedAt: new Date(NOW.getTime() - 10 * dayMs),
                    lastNoteAt: new Date(NOW.getTime() - 5 * dayMs),
                    lastPostAt: new Date(NOW.getTime() - 1 * dayMs), // Post is newer
                };
                const result = calculateMemberStatus('u1', memberData, {}, NOW);
                expect(result.lastActiveTime).toBe(memberData.lastPostAt.getTime());
                expect(result.status).toBe('active');
            });

            it('should prioritize member thresholds over group thresholds', () => {
                const memberData = {
                    joinedAt: new Date(NOW.getTime() - 10 * dayMs),
                    lastNoteAt: new Date(NOW.getTime() - 5 * dayMs), 
                    kickThreshold: 7, // User wants 7 days
                };
                const groupData = {
                    memberKickThresholds: { u1: 2 } // Group wants 2 days
                };
                const result = calculateMemberStatus('u1', memberData, groupData, NOW);
                expect(result.status).toBe('active'); // 5 < 7
                expect(result.thresholdMs).toBe(7 * dayMs);
            });
        });

        describe('Edge Cases', () => {
            it('should handle joinedAt as the sole activity source', () => {
                const memberData = {
                    joinedAt: new Date(NOW.getTime() - 1 * dayMs), // Joined 1 day ago, no reading/posting
                };
                const result = calculateMemberStatus('u1', memberData, {}, NOW);
                expect(result.status).toBe('active'); // Still within 3 day threshold
                expect(result.lastActiveTime).toBe(memberData.joinedAt.getTime());
            });

            it('should handle missing groupData partially', () => {
                const memberData = {
                    joinedAt: new Date(NOW.getTime() - 1 * dayMs),
                };
                // @ts-ignore - testing runtime robustness
                const result = calculateMemberStatus('u1', memberData, null, NOW);
                expect(result.status).toBe('active');
            });
        });
    });
});
