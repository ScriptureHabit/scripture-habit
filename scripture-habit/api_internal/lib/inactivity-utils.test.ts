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
    });
});
