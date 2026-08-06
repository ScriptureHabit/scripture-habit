import { describe, it, expect } from 'vitest';
import { decideGroupInactivity, InactivityGroupData, InactivityMemberData, toMillis, calculateMemberStatus } from './inactivity-utils';

describe('decideGroupInactivity', () => {
    const now = new Date('2024-04-25T00:00:00Z');
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 - 1000); // 3 days + 1s ago
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

    it('should recommend deleting the group if isDeleted is true', () => {
        const group: InactivityGroupData = { isDeleted: true };
        const result = decideGroupInactivity(group, []);
        expect(result.shouldDeleteGroup).toBe(true);
    });

    it('should keep active members and remove inactive ones', () => {
        const group: InactivityGroupData = { ownerUserId: 'owner' };
        const members = [
            { uid: 'owner', data: { joinedAt: oneDayAgo } },
            { uid: 'active_user', data: { joinedAt: oneDayAgo } },
            { uid: 'inactive_user', data: { joinedAt: threeDaysAgo, kickThreshold: 3 } }
        ];

        const result = decideGroupInactivity(group, members, now);

        expect(result.shouldDeleteGroup).toBe(false);
        expect(result.membersToRemove).toContain('inactive_user');
        expect(result.membersToRemove).not.toContain('active_user');
        expect(result.membersToRemove).not.toContain('owner');
    });

    it('should transfer ownership and REMOVE the old owner if they are inactive', () => {
        const group: InactivityGroupData = { ownerUserId: 'owner' };
        const members = [
            { uid: 'owner', data: { joinedAt: threeDaysAgo, kickThreshold: 3 } },
            { uid: 'active_user', data: { joinedAt: oneDayAgo } }
        ];

        const result = decideGroupInactivity(group, members, now);

        expect(result.newOwnerId).toBe('active_user');
        expect(result.membersToRemove).toContain('owner'); // 旧オーナーは削除リストに入る
    });

    it('should delete the group if the owner is inactive and nobody else is active', () => {
        const group: InactivityGroupData = { ownerUserId: 'owner' };
        const members = [
            { uid: 'owner', data: { joinedAt: threeDaysAgo, kickThreshold: 3 } },
            { uid: 'inactive_user', data: { joinedAt: threeDaysAgo, kickThreshold: 3 } }
        ];

        const result = decideGroupInactivity(group, members, now);

        expect(result.shouldDeleteGroup).toBe(true);
    });

    it('should mark members for initialization if they have a subcollection doc but no joinedAt', () => {
        const group: InactivityGroupData = { ownerUserId: 'owner' };
        const members = [
            { uid: 'owner', data: { joinedAt: oneDayAgo } },
            { uid: 'new_user', data: { createTime: oneDayAgo } as InactivityMemberData }
        ];

        const result = decideGroupInactivity(group, members, now);

        expect(result.membersToInitialize).toContain('new_user');
        expect(result.membersToRemove).not.toContain('new_user');
    });

    it('should remove "Ghost" members who have no subcollection document at all', () => {
        const group: InactivityGroupData = { ownerUserId: 'owner' };
        const members = [
            { uid: 'owner', data: { joinedAt: oneDayAgo } },
            { uid: 'ghost_user', data: {} as InactivityMemberData } // No joinedAt, no createTime
        ];

        const result = decideGroupInactivity(group, members, now);

        expect(result.membersToRemove).toContain('ghost_user');
        expect(result.membersToInitialize).not.toContain('ghost_user');
    });

    it('should respect the "Never Kick" (threshold 0) setting', () => {
        const group: InactivityGroupData = { ownerUserId: 'owner' };
        const members = [
            { uid: 'owner', data: { joinedAt: oneDayAgo } },
            { uid: 'old_user', data: { joinedAt: threeDaysAgo, kickThreshold: 0 } }
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
            { uid: 'owner', data: { joinedAt: oneDayAgo } },
            { uid: 'user1', data: { joinedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) } } // 4 days ago
        ];

        const result = decideGroupInactivity(group, members, now);
        // With threshold 5 days, 4 days ago is still active, so should NOT be removed
        expect(result.membersToRemove).not.toContain('user1');
    });

    it('should fallback to group pace if no specific member threshold is defined', () => {
        const group: InactivityGroupData = {
            ownerUserId: 'owner',
            pace: 5
        };
        const members = [
            { uid: 'owner', data: { joinedAt: oneDayAgo } },
            { uid: 'user1', data: { joinedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) } } // 4 days ago
        ];

        const result = decideGroupInactivity(group, members, now);
        expect(result.membersToRemove).not.toContain('user1');
    });

    it('handles potential corruption check when otherActivityMs is empty (no corruption)', () => {
        const group: InactivityGroupData = { ownerUserId: 'owner' };
        const members = [
            { uid: 'owner', data: { joinedAt: oneDayAgo } },
            {
                uid: 'user1',
                data: { joinedAt: oneDayAgo }, // storedJoinedMs is oneDayAgo
                createTime: oneDayAgo // joinedMs is oneDayAgo
            }
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
            { uid: 'owner', data: { joinedAt: oneDayAgo } },
            {
                uid: 'user1',
                data: { joinedAt: oneDayAgo }, // storedJoinedMs is oneDayAgo
                createTime: oneDayAgo // joinedMs is oneDayAgo
            }
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
            { uid: 'owner', data: { joinedAt: oneDayAgo } },
            {
                uid: 'user1',
                data: { joinedAt: oneDayAgo }, // storedJoinedMs is oneDayAgo
                createTime: oneDayAgo // joinedMs is oneDayAgo
            }
        ];
        const result = decideGroupInactivity(group, members, now);
        expect(result.membersToRepair).toContainEqual({
            uid: 'user1',
            joinedAt: oneDayAgo.getTime() - 5000
        });
    });
});

describe('inactivity-utils - calculateMemberStatus', () => {
    it('should handle undefined groupData', () => {
        const now = new Date('2024-04-25T00:00:00Z');
        const memberData: InactivityMemberData = { joinedAt: now };
        const result = calculateMemberStatus('user1', memberData, undefined as any, now);
        expect(result.status).toBe('active');
    });

    it('should evaluate member as inactive if last note/post is old, even if memberLastActive is recent', () => {
        const now = new Date('2024-04-25T00:00:00Z');
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

describe('inactivity-utils - toMillis', () => {

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
