import { describe, it, expect } from 'vitest';
import { decideGroupInactivity, InactivityGroupData, InactivityMemberData, toMillis, calculateMemberStatus } from './inactivity-utils.js';

describe('inactivity-utils', () => {
    const now = new Date('2024-04-25T00:00:00Z');
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // exactly 3 days ago
    const threeDaysAnd1sAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000 + 1000)); // 3 days + 1s ago
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

    /**
     * Helper to build a member object with sensible defaults for testing.
     */
    function createMember(
        uid: string,
        dataOverrides: Partial<InactivityMemberData> = {},
        createTime?: Date
    ) {
        return {
            uid,
            data: {
                joinedAt: oneDayAgo,
                ...dataOverrides
            } as InactivityMemberData,
            ...(createTime ? { createTime } : {})
        };
    }

    describe('decideGroupInactivity', () => {

        describe('Group Deletion', () => {
            it('should recommend deleting the group if isDeleted is true', () => {
                const group: InactivityGroupData = { isDeleted: true };
                const result = decideGroupInactivity(group, []);
                expect(result.shouldDeleteGroup).toBe(true);
            });

            it('should delete the group if the owner is inactive and nobody else is active', () => {
                const group: InactivityGroupData = { ownerUserId: 'owner' };
                const members = [
                    createMember('owner', { joinedAt: threeDaysAnd1sAgo, kickThreshold: 3 }),
                    createMember('inactive_user', { joinedAt: threeDaysAnd1sAgo, kickThreshold: 3 })
                ];

                const result = decideGroupInactivity(group, members, now);

                expect(result.shouldDeleteGroup).toBe(true);
            });

            it('should delete an AI group if the human owner is inactive, even if ai-partner-bot is present/active', () => {
                const group: InactivityGroupData = { 
                    ownerUserId: 'human_owner',
                    isAiGroup: true,
                    aiCompanionUid: 'ai-partner-bot'
                };
                const members = [
                    createMember('human_owner', { joinedAt: threeDaysAnd1sAgo, kickThreshold: 3 }),
                    createMember('ai-partner-bot', { joinedAt: oneDayAgo, kickThreshold: 999 })
                ];

                const result = decideGroupInactivity(group, members, now);

                expect(result.shouldDeleteGroup).toBe(true);
                expect(result.newOwnerId).toBeUndefined();
            });

            it('should not transfer ownership to ai-partner-bot in an AI group', () => {
                const group: InactivityGroupData = { 
                    ownerUserId: 'human_owner',
                    isAiGroup: true
                };
                const members = [
                    createMember('human_owner', { joinedAt: threeDaysAnd1sAgo, kickThreshold: 3 }),
                    createMember('ai-partner-bot', { joinedAt: oneDayAgo, kickThreshold: 999 })
                ];

                const result = decideGroupInactivity(group, members, now);

                expect(result.newOwnerId).not.toBe('ai-partner-bot');
                expect(result.shouldDeleteGroup).toBe(true);
            });
        });

        describe('Member Status & Thresholds', () => {
            it('should keep active members and remove inactive ones', () => {
                const group: InactivityGroupData = { ownerUserId: 'owner' };
                const members = [
                    createMember('owner', { joinedAt: oneDayAgo }),
                    createMember('active_user', { joinedAt: oneDayAgo }),
                    createMember('inactive_user', { joinedAt: threeDaysAnd1sAgo, kickThreshold: 3 })
                ];

                const result = decideGroupInactivity(group, members, now);

                expect(result.shouldDeleteGroup).toBe(false);
                expect(result.membersToRemove).toContain('inactive_user');
                expect(result.membersToRemove).not.toContain('active_user');
                expect(result.membersToRemove).not.toContain('owner');
            });

            it('should treat member as ACTIVE if inactive duration equals threshold exactly (boundary check)', () => {
                const group: InactivityGroupData = { ownerUserId: 'owner' };
                // 3 days ago exactly -> diffMs === thresholdMs -> diffMs > thresholdMs is false -> active
                const members = [
                    createMember('owner', { joinedAt: oneDayAgo }),
                    createMember('boundary_active_user', { joinedAt: threeDaysAgo, kickThreshold: 3 })
                ];

                const result = decideGroupInactivity(group, members, now);
                expect(result.membersToRemove).not.toContain('boundary_active_user');
            });

            it('should treat member as INACTIVE if inactive duration exceeds threshold by 1ms (boundary check)', () => {
                const group: InactivityGroupData = { ownerUserId: 'owner' };
                const threeDaysAnd1msAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000 + 1));
                const members = [
                    createMember('owner', { joinedAt: oneDayAgo }),
                    createMember('boundary_inactive_user', { joinedAt: threeDaysAnd1msAgo, kickThreshold: 3 })
                ];

                const result = decideGroupInactivity(group, members, now);
                expect(result.membersToRemove).toContain('boundary_inactive_user');
            });

            it('should respect the "Never Kick" (threshold 0) setting', () => {
                const group: InactivityGroupData = { ownerUserId: 'owner' };
                const members = [
                    createMember('owner', { joinedAt: oneDayAgo }),
                    createMember('old_user', { joinedAt: threeDaysAnd1sAgo, kickThreshold: 0 })
                ];

                const result = decideGroupInactivity(group, members, now);

                expect(result.membersToRemove).not.toContain('old_user');
            });

            it('should respect custom member kick threshold in groupData', () => {
                const group: InactivityGroupData = {
                    ownerUserId: 'owner',
                    memberKickThresholds: { 'user1': 5 }
                };
                const members = [
                    createMember('owner', { joinedAt: oneDayAgo }),
                    createMember('user1', { joinedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) }) // 4 days ago
                ];

                const result = decideGroupInactivity(group, members, now);
                // With threshold 5 days, 4 days ago is still active
                expect(result.membersToRemove).not.toContain('user1');
            });

            it('should fallback to group pace if no specific member threshold is defined', () => {
                const group: InactivityGroupData = {
                    ownerUserId: 'owner',
                    pace: 5
                };
                const members = [
                    createMember('owner', { joinedAt: oneDayAgo }),
                    createMember('user1', { joinedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) }) // 4 days ago
                ];

                const result = decideGroupInactivity(group, members, now);
                expect(result.membersToRemove).not.toContain('user1');
            });

            it('should remove "Ghost" members who have no subcollection document at all', () => {
                const group: InactivityGroupData = { ownerUserId: 'owner' };
                const members = [
                    createMember('owner', { joinedAt: oneDayAgo }),
                    { uid: 'ghost_user', data: {} as InactivityMemberData } // No joinedAt, no createTime
                ];

                const result = decideGroupInactivity(group, members, now);

                expect(result.membersToRemove).toContain('ghost_user');
                expect(result.membersToInitialize).not.toContain('ghost_user');
            });
        });

        describe('Owner Transfer', () => {
            it('should transfer ownership and REMOVE the old owner if they are inactive', () => {
                const group: InactivityGroupData = { ownerUserId: 'owner' };
                const members = [
                    createMember('owner', { joinedAt: threeDaysAnd1sAgo, kickThreshold: 3 }),
                    createMember('active_user', { joinedAt: oneDayAgo })
                ];

                const result = decideGroupInactivity(group, members, now);

                expect(result.newOwnerId).toBe('active_user');
                expect(result.membersToRemove).toContain('owner'); // 旧オーナーは削除リストに入る
            });

            it('should transfer ownership to the first active member in the array when multiple active members exist', () => {
                const group: InactivityGroupData = { ownerUserId: 'owner' };
                const members = [
                    createMember('owner', { joinedAt: threeDaysAnd1sAgo, kickThreshold: 3 }),
                    createMember('active_user_1', { joinedAt: oneDayAgo }),
                    createMember('active_user_2', { joinedAt: oneDayAgo })
                ];

                const result = decideGroupInactivity(group, members, now);

                expect(result.newOwnerId).toBe('active_user_1');
                expect(result.membersToRemove).toContain('owner');
                expect(result.membersToRemove).not.toContain('active_user_1');
                expect(result.membersToRemove).not.toContain('active_user_2');
            });
        });

        describe('Data Repair & Initialization', () => {
            it('should mark members for initialization if they have a subcollection doc but no joinedAt', () => {
                const group: InactivityGroupData = { ownerUserId: 'owner' };
                const members = [
                    createMember('owner', { joinedAt: oneDayAgo }),
                    { uid: 'new_user', data: { createTime: oneDayAgo } as InactivityMemberData }
                ];

                const result = decideGroupInactivity(group, members, now);

                expect(result.membersToInitialize).toContain('new_user');
                expect(result.membersToRemove).not.toContain('new_user');
            });

            it('detects and repairs joinedAt when stored joinedAt is in the future relative to createTime (serverTimestamp bug)', () => {
                const group: InactivityGroupData = { ownerUserId: 'owner' };
                const createdTime = new Date('2024-04-20T00:00:00Z');
                const futureJoinedTime = new Date('2024-04-21T00:00:00Z'); // Future joinedAt
                const members = [
                    createMember('owner', { joinedAt: oneDayAgo }),
                    createMember('corrupted_user', { joinedAt: futureJoinedTime }, createdTime)
                ];

                const result = decideGroupInactivity(group, members, now);

                expect(result.membersToRepair).toContainEqual({
                    uid: 'corrupted_user',
                    joinedAt: createdTime.getTime()
                });
            });

            it('handles potential corruption check when otherActivityMs is empty (no corruption)', () => {
                const group: InactivityGroupData = { ownerUserId: 'owner' };
                const members = [
                    createMember('owner', { joinedAt: oneDayAgo }),
                    createMember('user1', { joinedAt: oneDayAgo }, oneDayAgo)
                ];
                const result = decideGroupInactivity(group, members, now);
                expect(result.membersToRepair).not.toContain(expect.objectContaining({ uid: 'user1' }));
            });

            it('handles potential corruption check when oldest activity is not older than storedJoinedMs - 1000 (no corruption)', () => {
                const group: InactivityGroupData = {
                    ownerUserId: 'owner',
                    memberLastActive: { 'user1': new Date(oneDayAgo.getTime() + 5000) } // newer activity
                };
                const members = [
                    createMember('owner', { joinedAt: oneDayAgo }),
                    createMember('user1', { joinedAt: oneDayAgo }, oneDayAgo)
                ];
                const result = decideGroupInactivity(group, members, now);
                expect(result.membersToRepair).not.toContain(expect.objectContaining({ uid: 'user1' }));
            });

            it('detects and repairs reset-to-createTime corruption when there is activity older than creation time', () => {
                const group: InactivityGroupData = {
                    ownerUserId: 'owner',
                    memberLastActive: { 'user1': new Date(oneDayAgo.getTime() - 5000) } // older activity
                };
                const members = [
                    createMember('owner', { joinedAt: oneDayAgo }),
                    createMember('user1', { joinedAt: oneDayAgo }, oneDayAgo)
                ];
                const result = decideGroupInactivity(group, members, now);
                expect(result.membersToRepair).toContainEqual({
                    uid: 'user1',
                    joinedAt: oneDayAgo.getTime() - 5000
                });
            });
        });
    });

    describe('calculateMemberStatus', () => {
        it('should handle undefined groupData', () => {
            const memberData: InactivityMemberData = { joinedAt: now };
            const result = calculateMemberStatus('user1', memberData, undefined as any, now);
            expect(result.status).toBe('active');
        });

        it('should evaluate member as inactive if last note/post is old, even if memberLastActive is recent', () => {
            const fourDaysAgo = new Date('2024-04-21T00:00:00Z');
            const memberData: InactivityMemberData = { joinedAt: fourDaysAgo, lastNoteAt: fourDaysAgo, kickThreshold: 3 };
            const groupData: InactivityGroupData = {
                memberLastActive: { 'user1': now }, // recent message activity
                memberLastReadAt: { 'user1': now }
            };
            const result = calculateMemberStatus('user1', memberData, groupData, now);
            expect(result.status).toBe('inactive');
        });
    });

    describe('toMillis', () => {
        it('should convert string dates correctly', () => {
            expect(toMillis('2024-04-25T00:00:00.000Z')).toBe(new Date('2024-04-25T00:00:00.000Z').getTime());
            expect(toMillis('invalid-date-string')).toBe(0);
        });

        it('should convert seconds and _seconds objects', () => {
            expect(toMillis({ seconds: 123456 })).toBe(123456000);
            expect(toMillis({ _seconds: 987654 })).toBe(987654000);
        });

        it('should convert objects with a toMillis function', () => {
            expect(toMillis({ toMillis: () => 123456789 })).toBe(123456789);
        });

        it('should return 0 for unknown object formats', () => {
            expect(toMillis({ foo: 'bar' })).toBe(0);
        });
    });
});
