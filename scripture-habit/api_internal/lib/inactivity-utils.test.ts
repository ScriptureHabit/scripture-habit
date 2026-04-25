import { describe, it, expect } from 'vitest';
import { decideGroupInactivity, InactivityGroupData, InactivityMemberData } from './inactivity-utils';

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
});
