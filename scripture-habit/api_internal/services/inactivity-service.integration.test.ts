// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { admin, db } from '../lib/firebase-admin.js';
import { InactivityService } from './inactivity-service.js';

/**
 * Integration Tests for InactivityService
 * Uses Firebase Emulator via `npm run test:internal`
 */
describe('InactivityService Integration', () => {
    const NOW = new Date();
    const SIX_DAYS_AGO = new Date(NOW.getTime() - 6 * 24 * 60 * 60 * 1000);
    const TWO_DAYS_AGO = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);

    // Mock IDs
    const G1 = 'TEST_GRP_ACTIVE';
    const G2 = 'TEST_GRP_INACTIVE_MEMBER';
    const G3 = 'TEST_GRP_TRANSFER_OWNER';
    const G4 = 'TEST_GRP_DELETE_ALL';
    const G5 = 'TEST_GRP_GHOST_CLEANUP';

    const U_ACTIVE = 'USER_ACTIVE';
    const U_INACTIVE = 'USER_INACTIVE';
    const U_OWNER = 'USER_OWNER';
    const U_NEW_OWNER = 'USER_NEW_OWNER';

    beforeAll(async () => {
        // Setup Users
        const users = [U_ACTIVE, U_INACTIVE, U_OWNER, U_NEW_OWNER];
        for (const uid of users) {
            await db.collection('users').doc(uid).set({
                nickname: `Nick_${uid}`,
                language: 'en',
                groupIds: []
            });
        }

        // 1. Group 1: All Active
        await setupGroup(G1, U_OWNER, [U_OWNER, U_ACTIVE], 3);
        await setMemberActivity(G1, U_OWNER, TWO_DAYS_AGO);
        await setMemberActivity(G1, U_ACTIVE, TWO_DAYS_AGO);

        // 2. Group 2: One Inactive Member
        await setupGroup(G2, U_OWNER, [U_OWNER, U_INACTIVE], 3);
        await setMemberActivity(G2, U_OWNER, TWO_DAYS_AGO);
        await setMemberActivity(G2, U_INACTIVE, SIX_DAYS_AGO); // Inactive

        // 3. Group 3: Owner Inactive, Transfer to Active
        await setupGroup(G3, U_OWNER, [U_OWNER, U_NEW_OWNER], 3);
        await setMemberActivity(G3, U_OWNER, SIX_DAYS_AGO); // Inactive
        await setMemberActivity(G3, U_NEW_OWNER, TWO_DAYS_AGO);

        // 4. Group 4: All Inactive (Delete Group)
        await setupGroup(G4, U_OWNER, [U_OWNER, U_INACTIVE], 3);
        await setMemberActivity(G4, U_OWNER, SIX_DAYS_AGO);
        await setMemberActivity(G4, U_INACTIVE, SIX_DAYS_AGO);

        // 5. Group 5: Ghost Cleanup
        await setupGroup(G5, U_OWNER, [U_OWNER, U_INACTIVE], 3);
        await setMemberActivity(G5, U_OWNER, TWO_DAYS_AGO);
        // Specifically DON'T set member doc for U_INACTIVE
    });

    afterAll(async () => {
        const groups = [G1, G2, G3, G4, G5];
        for (const gid of groups) {
            await db.recursiveDelete(db.collection('groups').doc(gid));
        }
        const users = [U_ACTIVE, U_INACTIVE, U_OWNER, U_NEW_OWNER];
        for (const uid of users) {
            await db.collection('users').doc(uid).delete();
        }
    });

    async function setupGroup(groupId: string, ownerId: string, members: string[], pace: number) {
        await db.collection('groups').doc(groupId).set({
            name: `Group ${groupId}`,
            ownerUserId: ownerId,
            members,
            membersCount: members.length,
            pace,
            lastInactivityCheckedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        for (const uid of members) {
            await db.collection('users').doc(uid).update({
                groupIds: admin.firestore.FieldValue.arrayUnion(groupId)
            });
        }
    }

    async function setMemberActivity(groupId: string, uid: string, lastActive: Date) {
        const ts = admin.firestore.Timestamp.fromDate(lastActive);
        await db.collection('groups').doc(groupId).collection('members').doc(uid).set({
            joinedAt: admin.firestore.Timestamp.fromDate(new Date(lastActive.getTime() - 1000)),
            lastNoteAt: ts,
            lastActiveAt: ts
        });
        await db.collection('groups').doc(groupId).update({
            [`memberLastActive.${uid}`]: ts
        });
    }

    it('Scenario 1: Keep active members', async () => {
        const result = await InactivityService.processGroupInactivity(G1);
        expect(result.removedCount).toBe(0);
        expect(result.groupDeleted).toBe(false);

        const gDoc = await db.collection('groups').doc(G1).get();
        expect(gDoc.data()?.members).toContain(U_ACTIVE);
    });

    it('Scenario 2: Remove inactive members', async () => {
        const result = await InactivityService.processGroupInactivity(G2);
        expect(result.removedCount).toBe(1);
        
        const gDoc = await db.collection('groups').doc(G2).get();
        expect(gDoc.data()?.members).not.toContain(U_INACTIVE);
        expect(gDoc.data()?.members).toContain(U_OWNER);

        const uDoc = await db.collection('users').doc(U_INACTIVE).get();
        expect(uDoc.data()?.groupIds).not.toContain(G2);
    });

    it('Scenario 3: Transfer ownership when owner is inactive', async () => {
        const result = await InactivityService.processGroupInactivity(G3);
        expect(result.transferCount).toBe(1);
        expect(result.removedCount).toBe(1); // Old owner removed after transfer

        const gDoc = await db.collection('groups').doc(G3).get();
        expect(gDoc.data()?.ownerUserId).toBe(U_NEW_OWNER);
        expect(gDoc.data()?.members).not.toContain(U_OWNER);
    });

    it('Scenario 4: Delete group when all members are inactive', async () => {
        const result = await InactivityService.processGroupInactivity(G4);
        expect(result.groupDeleted).toBe(true);

        const gDoc = await db.collection('groups').doc(G4).get();
        expect(gDoc.exists).toBe(false);

        const uDoc = await db.collection('users').doc(U_INACTIVE).get();
        expect(uDoc.data()?.groupIds).not.toContain(G4);
    });

    it('Scenario 5: Cleanup ghost members (missing subcollection doc)', async () => {
        const result = await InactivityService.processGroupInactivity(G5);
        expect(result.removedCount).toBe(1); // U_INACTIVE ghost removed

        const gDoc = await db.collection('groups').doc(G5).get();
        expect(gDoc.data()?.members).not.toContain(U_INACTIVE);
    });
});
