// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { getGroupUpdatesForMultipleRemovals } from './membership-utils.js';
import { GroupDocument } from '../../types/firestore.js';

describe('MembershipUtils Unit Tests', () => {
    
    const mockGroup: GroupDocument = {
        name: 'Test Group',
        members: ['u1', 'u2', 'u3'],
        membersCount: 3,
        ownerUserId: 'u1',
        memberPreviews: [
            { uid: 'u1', nickname: 'N1' },
            { uid: 'u2', nickname: 'N2' },
            { uid: 'u3', nickname: 'N3' }
        ],
        dailyActivity: {
            date: '2026-04-16',
            activeMembers: ['u1', 'u2']
        }
    };

    it('should generate correct update object for single removal', () => {
        const updates = getGroupUpdatesForMultipleRemovals(mockGroup, ['u3']);
        
        // Members array update
        expect(updates.members).toBeDefined();
        
        // Counter update
        expect(updates.membersCount).toBe(2);
        
        // Preview cleanup
        expect(updates.memberPreviews).toHaveLength(2);
        expect((updates.memberPreviews as any[]).find(p => p.uid === 'u3')).toBeUndefined();

        // Map deletions
        expect(updates['memberJoinedAt.u3']).toBeDefined();
        expect(updates['memberLastActive.u3']).toBeDefined();
    });

    it('should generate correct update object for multiple removals', () => {
        const updates = getGroupUpdatesForMultipleRemovals(mockGroup, ['u2', 'u3']);
        
        expect(updates.membersCount).toBe(1);
        expect(updates.memberPreviews).toHaveLength(1);
        expect((updates.memberPreviews as any[])[0].uid).toBe('u1');
        
        expect(updates['memberJoinedAt.u2']).toBeDefined();
        expect(updates['memberJoinedAt.u3']).toBeDefined();

        // Activity cleanup
        expect(updates['dailyActivity.activeMembers']).toEqual(['u1']);
    });

    it('should set isDeleted: true when all members are removed', () => {
        const updates = getGroupUpdatesForMultipleRemovals(mockGroup, ['u1', 'u2', 'u3']);
        
        expect(updates.membersCount).toBe(0);
        expect(updates.isDeleted).toBe(true);
    });

    it('should handle missing fields gracefully', () => {
        const minimalGroup: GroupDocument = {
            members: ['u1'],
            membersCount: 1
        };
        const updates = getGroupUpdatesForMultipleRemovals(minimalGroup, ['u1']);
        expect(updates.isDeleted).toBe(true);
    });
});
