// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateMemberStatus, InactivityGroupData, toMillis } from './inactivity-utils.js';

describe('InactivityUtils Property-Based Tests', () => {

    const dateArb = fc.date({
        min: new Date('2020-01-01T00:00:00Z'),
        max: new Date('2030-01-01T00:00:00Z')
    });

    it('should calculate member status correctly across arbitrary valid inputs', () => {
        fc.assert(
            fc.property(
                fc.record({
                    joinedAt: fc.option(dateArb, { nil: undefined }),
                    createTime: fc.option(dateArb, { nil: undefined }),
                    lastNoteAt: fc.option(dateArb, { nil: undefined }),
                    lastPostAt: fc.option(dateArb, { nil: undefined }),
                    lastReadAt: fc.option(dateArb, { nil: undefined }),
                    lastActiveAt: fc.option(dateArb, { nil: undefined }),
                    kickThreshold: fc.option(fc.integer({ min: 0, max: 30 }), { nil: undefined })
                }),
                fc.record({
                    pace: fc.integer({ min: 1, max: 14 }),
                    memberKickThresholds: fc.dictionary(fc.string(), fc.integer({ min: 0, max: 30 })),
                    memberJoinedAt: fc.dictionary(fc.string(), dateArb)
                }),
                dateArb,
                (memberData, groupData, now) => {
                    if (isNaN(now.getTime())) return;
                    const memberId = 'test-user';

                    const result = calculateMemberStatus(memberId, memberData, groupData as InactivityGroupData, now);

                    // Property 1: No crash
                    expect(result).toBeDefined();

                    // Property 2: Correct Threshold Precedence
                    let expectedThresholdDays = 3; // Default
                    if (memberData.kickThreshold !== undefined) {
                        expectedThresholdDays = memberData.kickThreshold;
                    } else if (groupData.memberKickThresholds[memberId] !== undefined) {
                        expectedThresholdDays = groupData.memberKickThresholds[memberId];
                    } else if (groupData.pace !== undefined) {
                        expectedThresholdDays = groupData.pace;
                    }

                    // Property 3: Never Kick (threshold === 0)
                    if (expectedThresholdDays === 0) {
                        expect(result.status).toBe('active');
                        expect(result.thresholdMs).toBe(0);
                        return;
                    }

                    const expectedThresholdMs = expectedThresholdDays * 24 * 60 * 60 * 1000;
                    expect(result.thresholdMs).toBe(expectedThresholdMs);

                    // Property 4: Status & expectedLastActive for missing joinedAt
                    if (!memberData.joinedAt) {
                        expect(result.lastActiveTime).toBe(0);
                        if (!memberData.createTime && !memberData.lastActiveAt) {
                            expect(result.status).toBe('inactive');
                            expect(result.reason).toBe('ghost');
                        } else {
                            expect(result.status).toBe('needs_initialization');
                        }
                        return;
                    }

                    // Property 5: Independent lastActiveTime Calculation when joinedAt is present
                    const timestamps = [
                        toMillis(memberData.joinedAt),
                        toMillis(memberData.lastNoteAt),
                        toMillis(memberData.lastPostAt),
                        toMillis(groupData.memberJoinedAt[memberId])
                    ];
                    const expectedLastActive = Math.max(...timestamps);
                    expect(result.lastActiveTime).toBe(expectedLastActive);

                    if (expectedLastActive === 0) {
                            expect(result.status).toBe('needs_initialization');
                    } else {
                        const diffMs = now.getTime() - expectedLastActive;
                        if (diffMs > expectedThresholdMs) {
                            expect(result.status).toBe('inactive');
                        } else {
                            expect(result.status).toBe('active');
                        }
                    }
                }
            ),
            { numRuns: 1000 }
        );
    });

    it('should handle extreme future/past dates without throwing', () => {
        fc.assert(
            fc.property(fc.date(), fc.date(), (d1, d2) => {
                if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return;
                const res = calculateMemberStatus('u', { joinedAt: d1 }, { pace: 3 }, d2);
                expect(['active', 'inactive', 'needs_initialization']).toContain(res.status);
            })
        );
    });
});
