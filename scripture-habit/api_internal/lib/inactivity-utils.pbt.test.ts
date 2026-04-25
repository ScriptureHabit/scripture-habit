// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateMemberStatus, InactivityMemberData } from './inactivity-utils.js';

describe('InactivityUtils Property-Based Tests', () => {
    
    // Arbitrary for a valid-ish Firestore Timestamp (within a reasonable range)
    const dateArb = fc.date({ 
        min: new Date('2020-01-01T00:00:00Z'), 
        max: new Date('2030-01-01T00:00:00Z') 
    });

    it('should always return a consistent status based on the maximum timestamp found', () => {
        fc.assert(
            fc.property(
                fc.record({
                    joinedAt: fc.option(dateArb, { nil: undefined }),
                    lastNoteAt: fc.option(dateArb, { nil: undefined }),
                    lastPostAt: fc.option(dateArb, { nil: undefined }),
                    lastReadAt: fc.option(dateArb, { nil: undefined }),
                    lastActiveAt: fc.option(dateArb, { nil: undefined }),
                    kickThreshold: fc.option(fc.integer({ min: 1, max: 30 }), { nil: undefined })
                }),
                fc.record({
                    pace: fc.integer({ min: 1, max: 14 }),
                    memberLastActive: fc.dictionary(fc.string(), dateArb),
                    memberLastReadAt: fc.dictionary(fc.string(), dateArb)
                }),
                dateArb,
                (memberData, groupData, now) => {
                    const memberId = 'test-user';
                    
                    // Put the target user in the maps
                    const gData = {
                        ...groupData,
                        memberLastActive: { 'test-user': groupData.memberLastActive['test-user'] || now },
                        memberLastReadAt: { 'test-user': groupData.memberLastReadAt['test-user'] || now }
                    };

                    const result = calculateMemberStatus(memberId, memberData, gData, now);

                    // Property 1: No crash
                    expect(result).toBeDefined();

                    // Property 2: Correct Status Logic
                    const expectedThresholdMs = (memberData.kickThreshold || gData.pace || 3) * 24 * 60 * 60 * 1000;
                    expect(result.thresholdMs).toBe(expectedThresholdMs);

                    const diff = now.getTime() - result.lastActiveTime;
                    
                    if (result.status === 'needs_initialization') {
                        // This happens if joinedAt is missing but some subcollection doc or activity exists
                        expect(memberData.joinedAt).toBeUndefined();
                    } else if (diff > expectedThresholdMs) {
                        expect(result.status).toBe('inactive');
                    } else {
                        expect(result.status).toBe('active');
                    }
                }
            ),
            { numRuns: 1000 }
        );
    });

    it('should return inactive (ghost) if no timestamps are present anywhere', () => {
        const result = calculateMemberStatus('any', {}, { pace: 3 }, new Date());
        expect(result.status).toBe('inactive');
        expect(result.reason).toBe('ghost');
    });

    it('should return needs_initialization if subcollection doc exists but no joinedAt', () => {
        const result = calculateMemberStatus('any', { createTime: new Date() } as unknown as InactivityMemberData, { pace: 3 }, new Date());
        expect(result.status).toBe('needs_initialization');
    });

    it('should handle extreme future/past dates without throwing', () => {
        fc.assert(
            fc.property(fc.date(), fc.date(), (d1, d2) => {
                const res = calculateMemberStatus('u', { joinedAt: d1 }, { pace: 3 }, d2);
                expect(['active', 'inactive', 'needs_initialization']).toContain(res.status);
            })
        );
    });
});
