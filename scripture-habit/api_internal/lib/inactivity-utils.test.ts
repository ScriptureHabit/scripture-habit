import { describe, it, expect } from 'vitest';
import { calculateMemberStatus, InactivityMemberData, InactivityGroupData } from './inactivity-utils.js';

describe('Inactivity Utils', () => {
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

        it('should mark a member active via reading even if they are old', () => {
            const memberData: InactivityMemberData = {
                joinedAt: new Date('2024-01-01T00:00:00Z'), // 9 days ago
                lastReadAt: new Date('2024-01-09T00:00:00Z') // 1 day ago
            };
            // In the NEW simple logic, reading counts equally for everyone.
            const result = calculateMemberStatus('u1', memberData, {} as InactivityGroupData, NOW);
            expect(result.status).toBe('active');
            expect(result.lastActiveTime).toBe(new Date('2024-01-09T00:00:00Z').getTime());
        });

        it('should mark a member inactive if their last interaction was long ago', () => {
            const memberData: InactivityMemberData = {
                joinedAt: new Date('2024-01-01T00:00:00Z'),
                lastNoteAt: new Date('2024-01-05T00:00:00Z') // 5 days ago (Threshold 3)
            };
            const result = calculateMemberStatus('u1', memberData, {} as InactivityGroupData, NOW);
            expect(result.status).toBe('inactive');
            expect(result.diffMs).toBe(5 * 24 * 60 * 60 * 1000);
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

        it('should prioritize more recent activity from group-level overrides', () => {
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
    });
});
