import { describe, it, expect, vi } from 'vitest';
import { getGroupUpdatesForMultipleRemovals, removeMemberFromGroup } from './membership-utils.js';
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
        expect((updates.memberPreviews as Array<{ uid: string }>).find(p => p.uid === 'u3')).toBeUndefined();

        // Map deletions
        expect(updates['memberJoinedAt.u3']).toBeDefined();
        expect(updates['memberLastActive.u3']).toBeDefined();
    });

    it('should generate correct update object for multiple removals', () => {
        const updates = getGroupUpdatesForMultipleRemovals(mockGroup, ['u2', 'u3']);
        
        expect(updates.membersCount).toBe(1);
        expect(updates.memberPreviews).toHaveLength(1);
        expect((updates.memberPreviews as Array<{ uid: string }>)[0].uid).toBe('u1');
        
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

    it('should set isDeleted: true for AI group when all human members are removed even if bot remains', () => {
        const aiGroup: GroupDocument = {
            isAiGroup: true,
            aiCompanionUid: 'ai-partner-bot',
            members: ['u1', 'ai-partner-bot'],
            membersCount: 2
        };
        const updates = getGroupUpdatesForMultipleRemovals(aiGroup, ['u1']);
        
        expect(updates.membersCount).toBe(1);
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

    describe('removeMemberFromGroup Integration / Mock Tests', () => {
        const makeSnap = (exists: boolean, dataVal: any) => ({
            exists,
            data: () => dataVal,
            ref: {}
        });

        it('should early return if group does not exist (line 98)', async () => {
            const mockTransaction = {
                get: vi.fn().mockImplementation(async (ref) => {
                    if (ref.path.startsWith('groups/non-existent')) {
                        return makeSnap(false, null);
                    }
                    return makeSnap(true, {});
                }),
                update: vi.fn(),
                delete: vi.fn(),
                set: vi.fn()
            } as unknown as admin.firestore.Transaction;

            await removeMemberFromGroup(mockTransaction, 'non-existent-group', 'u1');

            expect(mockTransaction.update).not.toHaveBeenCalled();
            expect(mockTransaction.delete).not.toHaveBeenCalled();
        });

        it('should fallback to empty object if groupSnap.data() is falsy (line 99)', async () => {
            const mockTransaction = {
                get: vi.fn().mockImplementation(async () => makeSnap(true, null)),
                update: vi.fn(),
                delete: vi.fn(),
                set: vi.fn()
            } as unknown as admin.firestore.Transaction;

            await removeMemberFromGroup(mockTransaction, 'g1', 'u1');

            expect(mockTransaction.update).toHaveBeenCalled();
            expect(mockTransaction.delete).toHaveBeenCalled();
        });

        it('should handle missing members array gracefully in getGroupUpdatesForMultipleRemovals (line 44)', () => {
            const updates = getGroupUpdatesForMultipleRemovals({} as GroupDocument, ['u1']);
            expect(updates.membersCount).toBe(0);
        });

        it('should not transfer ownership if no remaining members left (lines 107-110)', async () => {
            const mockTransaction = {
                get: vi.fn().mockImplementation(async (ref) => {
                    if (ref.path.startsWith('groups/g1')) {
                        return makeSnap(true, { ownerUserId: 'u1', members: ['u1'] });
                    }
                    return makeSnap(true, {});
                }),
                update: vi.fn(),
                delete: vi.fn(),
                set: vi.fn()
            } as unknown as admin.firestore.Transaction;

            await removeMemberFromGroup(mockTransaction, 'g1', 'u1', { transferOwnership: true });

            // Expect that transaction.get is only called for the initial group and user
            expect(mockTransaction.get).toHaveBeenCalledTimes(2);
            expect(mockTransaction.set).not.toHaveBeenCalled();
        });

        it('should transfer ownership to next member silently without system message', async () => {
            const mockTransaction = {
                get: vi.fn().mockImplementation(async (ref) => {
                    if (ref.path.startsWith('groups/g1')) {
                        return makeSnap(true, { ownerUserId: 'u1', members: ['u1', 'u2'] });
                    }
                    if (ref.path.startsWith('users/u2')) {
                        return makeSnap(true, {});
                    }
                    return makeSnap(true, {});
                }),
                update: vi.fn(),
                delete: vi.fn(),
                set: vi.fn()
            } as unknown as admin.firestore.Transaction;

            await removeMemberFromGroup(mockTransaction, 'g1', 'u1', { 
                transferOwnership: true,
                preferredLanguage: 'ja' 
            });

            expect(mockTransaction.update).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    ownerUserId: 'u2'
                })
            );
            expect(mockTransaction.set).not.toHaveBeenCalled();
        });

        it('should clear user groupId if it matches the group (lines 129-136)', async () => {
            // Case A: userSnap does not exist
            const mockTxA = {
                get: vi.fn().mockImplementation(async (ref) => {
                    if (ref.path.startsWith('users/u1')) {
                        return makeSnap(false, null);
                    }
                    return makeSnap(true, {});
                }),
                update: vi.fn(),
                delete: vi.fn(),
                set: vi.fn()
            } as unknown as admin.firestore.Transaction;

            await removeMemberFromGroup(mockTxA, 'g1', 'u1', { clearUserGroupId: true });
            expect(mockTxA.update).toHaveBeenCalledTimes(1); // Only for group, not for user

            // Case B: userSnap exists but groupId does not match
            const mockTxB = {
                get: vi.fn().mockImplementation(async (ref) => {
                    if (ref.path.startsWith('users/u1')) {
                        return makeSnap(true, { groupId: 'otherGroup' });
                    }
                    return makeSnap(true, {});
                }),
                update: vi.fn(),
                delete: vi.fn(),
                set: vi.fn()
            } as unknown as admin.firestore.Transaction;

            await removeMemberFromGroup(mockTxB, 'g1', 'u1', { clearUserGroupId: true });
            expect(mockTxB.update).toHaveBeenCalledTimes(1);

            // Case C: userSnap exists and groupId is missing
            const mockTxC = {
                get: vi.fn().mockImplementation(async (ref) => {
                    if (ref.path.startsWith('users/u1')) {
                        return makeSnap(true, null);
                    }
                    return makeSnap(true, {});
                }),
                update: vi.fn(),
                delete: vi.fn(),
                set: vi.fn()
            } as unknown as admin.firestore.Transaction;

            await removeMemberFromGroup(mockTxC, 'g1', 'u1', { clearUserGroupId: true });
            expect(mockTxC.update).toHaveBeenCalledTimes(1);

            // Case D: userSnap exists and groupId matches
            const mockTxD = {
                get: vi.fn().mockImplementation(async (ref) => {
                    if (ref.path.startsWith('users/u1')) {
                        return makeSnap(true, { groupId: 'g1' });
                    }
                    return makeSnap(true, {});
                }),
                update: vi.fn(),
                delete: vi.fn(),
                set: vi.fn()
            } as unknown as admin.firestore.Transaction;

            await removeMemberFromGroup(mockTxD, 'g1', 'u1', { clearUserGroupId: true });
            expect(mockTxD.update).toHaveBeenCalledTimes(2); // One for group, one for user
        });

        it('should remove group state if option is enabled (line 136)', async () => {
            const mockTransaction = {
                get: vi.fn().mockImplementation(async () => makeSnap(true, {})),
                update: vi.fn(),
                delete: vi.fn(),
                set: vi.fn()
            } as unknown as admin.firestore.Transaction;

            await removeMemberFromGroup(mockTransaction, 'g1', 'u1', { removeGroupState: true });
            expect(mockTransaction.delete).toHaveBeenCalledTimes(2); // One for member doc, one for groupState doc
        });

        it('should remove from user doc if option is enabled (line 123)', async () => {
            const mockTransaction = {
                get: vi.fn().mockImplementation(async () => makeSnap(true, {})),
                update: vi.fn(),
                delete: vi.fn(),
                set: vi.fn()
            } as unknown as admin.firestore.Transaction;

            await removeMemberFromGroup(mockTransaction, 'g1', 'u1', { removeFromUserDoc: true });
            expect(mockTransaction.update).toHaveBeenCalledTimes(2); // One for group, one for user document groupIds
        });

        it('should post system message when leaving or kicked, with fallback preferredLanguage (line 158)', async () => {
            const mockTransaction = {
                get: vi.fn().mockImplementation(async () => makeSnap(true, {})),
                update: vi.fn(),
                delete: vi.fn(),
                set: vi.fn()
            } as unknown as admin.firestore.Transaction;

            await removeMemberFromGroup(mockTransaction, 'g1', 'u1', { 
                systemMessage: { type: 'leave', nickname: 'TestUser' }
            });

            expect(mockTransaction.set).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    senderId: 'system',
                    type: 'leave'
                })
            );
        });

        it('should set isDeleted: true when last human member leaves an AI group', async () => {
            const mockUpdate = vi.fn();
            const mockTransaction = {
                get: vi.fn().mockImplementation(async (ref) => {
                    if (ref.path.startsWith('groups/g1')) {
                        return makeSnap(true, { 
                            isAiGroup: true, 
                            aiCompanionUid: 'ai-partner-bot',
                            ownerUserId: 'u1', 
                            members: ['u1', 'ai-partner-bot'] 
                        });
                    }
                    return makeSnap(true, {});
                }),
                update: mockUpdate,
                delete: vi.fn(),
                set: vi.fn()
            } as unknown as admin.firestore.Transaction;

            await removeMemberFromGroup(mockTransaction, 'g1', 'u1', { transferOwnership: true });

            expect(mockUpdate).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    isDeleted: true
                })
            );
            // Should not transfer ownership to ai-partner-bot
            const updateCall = mockUpdate.mock.calls[0][1];
            expect(updateCall.ownerUserId).toBeUndefined();
        });
    });
});
