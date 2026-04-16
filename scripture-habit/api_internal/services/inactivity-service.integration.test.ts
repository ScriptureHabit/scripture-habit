// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { admin, db } from '../lib/firebase-admin.js';
import { InactivityService } from './inactivity-service.js';
import { t } from '../lib/i18n.js';

/**
 * Integration Tests for InactivityService
 * Uses Firebase Emulator via `npm run test:internal`
 */
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('InactivityService Integration', () => {
    const NOW = new Date();
    const SIX_DAYS_AGO = new Date(NOW.getTime() - 6 * 24 * 60 * 60 * 1000);
    const TWO_DAYS_AGO = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
    const TEN_DAYS_AGO = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000);

    // Mock IDs
    const G1 = 'TEST_GRP_ACTIVE';
    const G2 = 'TEST_GRP_INACTIVE_MEMBER';
    const G3 = 'TEST_GRP_TRANSFER_OWNER';
    const G4 = 'TEST_GRP_DELETE_ALL';
    const G5 = 'TEST_GRP_GHOST_CLEANUP';
    const G6 = 'TEST_GRP_LOCALIZATION';
    const G7 = 'TEST_GRP_MARKED_DELETE';
    const G_STALE_A = 'STALE_A';
    const G_STALE_B = 'STALE_B';
    const G_STALE_C = 'STALE_C';
    const G8 = 'TEST_GRP_CORRUPTED_JOINEDAT'; // Case A: joinedAt > createTime
    const G9 = 'TEST_GRP_CORRUPTED_V2';       // Case B: joinedAt == createTime but older activity exists
    const G10 = 'TEST_GRP_MASSIVE';           // Case 10: 50+ members removed

    const U_ACTIVE = 'USER_ACTIVE';
    const U_INACTIVE = 'USER_INACTIVE';
    const U_OWNER = 'USER_OWNER';
    const U_NEW_OWNER = 'USER_NEW_OWNER';
    const U_JA = 'USER_JAPANESE';
    const U_SEC = 'USER_SECONDARY';
    const U_CORRUPTED = 'USER_CORRUPTED_JOINEDAT'; // Case A: joinedAt > createTime
    const U_CORRUPTED_V2 = 'USER_CORRUPTED_V2';    // Case B: joinedAt == createTime but older activity exists
    const U_MASSIVE_PREFIX = 'U_MASS_';

    beforeAll(async () => {
        // Setup Users
        const users = [U_ACTIVE, U_INACTIVE, U_OWNER, U_NEW_OWNER, U_JA, U_SEC, U_CORRUPTED, U_CORRUPTED_V2];
        for (let i = 0; i < 50; i++) users.push(`${U_MASSIVE_PREFIX}${i}`);
        for (const uid of users) {
            await db.collection('users').doc(uid).set({
                nickname: `Nick_${uid}`,
                language: uid === U_JA ? 'ja' : 'en',
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
        await setMemberActivity(G2, U_INACTIVE, SIX_DAYS_AGO);

        // 3. Group 3: Owner Inactive, Transfer to Active
        await setupGroup(G3, U_OWNER, [U_OWNER, U_NEW_OWNER], 3);
        await setMemberActivity(G3, U_OWNER, SIX_DAYS_AGO);
        await setMemberActivity(G3, U_NEW_OWNER, TWO_DAYS_AGO);

        // 4. Group 4: All Inactive (Delete Group)
        await setupGroup(G4, U_OWNER, [U_OWNER, U_INACTIVE, U_SEC], 3);
        await setMemberActivity(G4, U_OWNER, SIX_DAYS_AGO);
        await setMemberActivity(G4, U_INACTIVE, SIX_DAYS_AGO);
        await setMemberActivity(G4, U_SEC, SIX_DAYS_AGO);

        // 5. Group 5: Ghost Cleanup
        await setupGroup(G5, U_OWNER, [U_OWNER, U_INACTIVE], 3);
        await setMemberActivity(G5, U_OWNER, TWO_DAYS_AGO);

        // 6. Group 6: Localization (Japanese Owner Transfer)
        await setupGroup(G6, U_OWNER, [U_OWNER, U_JA], 3);
        await setMemberActivity(G6, U_OWNER, SIX_DAYS_AGO);
        await setMemberActivity(G6, U_JA, TWO_DAYS_AGO);

        // 7. Group 7: Marked for Deletion
        await setupGroup(G7, U_OWNER, [U_OWNER], 3);
        await db.collection('groups').doc(G7).update({ isDeleted: true });

        // 8. Stale Groups for Batch Rotation
        await setupGroup(G_STALE_A, U_OWNER, [U_OWNER], 15, TEN_DAYS_AGO);
        await setMemberActivity(G_STALE_A, U_OWNER, TEN_DAYS_AGO);
        
        await setupGroup(G_STALE_B, U_OWNER, [U_OWNER], 15, SIX_DAYS_AGO);
        await setMemberActivity(G_STALE_B, U_OWNER, SIX_DAYS_AGO);
        
        await setupGroup(G_STALE_C, U_OWNER, [U_OWNER], 15, TWO_DAYS_AGO);
        await setMemberActivity(G_STALE_C, U_OWNER, TWO_DAYS_AGO);

        // 9. Group 8: Corrupted joinedAt (Regression - Cosmos bug)
        // Simulates a user who was truly inactive (last active 14 days ago via group map),
        // but whose joinedAt in the member subcollection was set to a date AFTER createTime
        // by the old cron's serverTimestamp initialization bug.
        await setupGroup(G8, U_OWNER, [U_OWNER, U_CORRUPTED], 7);
        await setMemberActivity(G8, U_OWNER, TWO_DAYS_AGO);
        // U_CORRUPTED: last truly active 14+ days ago in group maps
        const FOURTEEN_DAYS_AGO = new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000);
        const ts14 = admin.firestore.Timestamp.fromDate(FOURTEEN_DAYS_AGO);
        // Step 1: Create the member doc WITHOUT joinedAt (old join path)
        await db.collection('groups').doc(G8).collection('members').doc(U_CORRUPTED).set({
            lastReadAt: ts14,
            lastActiveAt: ts14,
            readMessageCount: 1
        });
        // Step 2: Wait to ensure createTime < update timestamp
        await new Promise(r => setTimeout(r, 100));
        // Step 3: Simulate old cron bug by setting joinedAt = NOW (future relative to createTime)
        // Using serverTimestamp() mirrors the exact old behavior that caused the bug on April 9
        await db.collection('groups').doc(G8).collection('members').doc(U_CORRUPTED).update({
            joinedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // Also update group-level map to show truly old activity
        await db.collection('groups').doc(G8).update({
            [`memberLastActive.${U_CORRUPTED}`]: ts14,
            [`memberLastReadAt.${U_CORRUPTED}`]: ts14
        });
        await db.collection('users').doc(U_CORRUPTED).update({
            groupIds: admin.firestore.FieldValue.arrayUnion(G8)
        });

        // 10. Scenario 9b: Corrupted joinedAt (matches createTime but older activity exists)
        // This is exactly what happened to "Cosmos".
        await setupGroup(G9, U_OWNER, [U_OWNER, U_CORRUPTED_V2], 15);
        await setMemberActivity(G9, U_OWNER, TWO_DAYS_AGO);
        const TEN_DAYS_AGO_TS = admin.firestore.Timestamp.fromDate(TEN_DAYS_AGO);
        
        // Step 1: Create member doc. Its createTime will be "now".
        const memberRefV2 = db.collection('groups').doc(G9).collection('members').doc(U_CORRUPTED_V2);
        await memberRefV2.set({
            lastActiveAt: TEN_DAYS_AGO_TS,
        });
        const snapV2 = await memberRefV2.get();
        const createTimeV2 = snapV2.createTime!;
        
        // Step 2: Set joinedAt to exactly createTime (simulating the "repair to createTime" bug)
        await memberRefV2.update({
            joinedAt: createTimeV2
        });
        
        // Step 3: Add OLDER activity to the group-level map
        await db.collection('groups').doc(G9).update({
            [`memberLastActive.${U_CORRUPTED_V2}`]: TEN_DAYS_AGO_TS
        });
        await db.collection('users').doc(U_CORRUPTED_V2).update({
            groupIds: admin.firestore.FieldValue.arrayUnion(G9)
        });
        
        // 11. Group 10: Massive Group (50 inactive + 1 active owner)
        const massiveMembers = [];
        for (let i = 0; i < 50; i++) massiveMembers.push(`${U_MASSIVE_PREFIX}${i}`);
        await setupGroup(G10, U_OWNER, [U_OWNER, ...massiveMembers], 3);
        await setMemberActivity(G10, U_OWNER, TWO_DAYS_AGO);
        for (const uid of massiveMembers) {
            await setMemberActivity(G10, uid, SIX_DAYS_AGO);
        }
    }, 60000);


    afterAll(async () => {
        const groups = [G1, G2, G3, G4, G5, G6, G7, G8, G9, G10, G_STALE_A, G_STALE_B, G_STALE_C];
        for (const gid of groups) {
            await db.recursiveDelete(db.collection('groups').doc(gid)).catch(() => {});
        }
        const users = [U_ACTIVE, U_INACTIVE, U_OWNER, U_NEW_OWNER, U_JA, U_SEC, U_CORRUPTED, U_CORRUPTED_V2];
        for (let i = 0; i < 50; i++) users.push(`${U_MASSIVE_PREFIX}${i}`);
        for (const uid of users) {
            await db.collection('users').doc(uid).delete().catch(() => {});
        }
    });

    async function setupGroup(groupId: string, ownerId: string, members: string[], pace: number, lastCheckedAt?: Date) {
        await db.collection('groups').doc(groupId).set({
            name: `Group ${groupId}`,
            ownerUserId: ownerId,
            members,
            membersCount: members.length,
            pace,
            lastInactivityCheckedAt: lastCheckedAt ? admin.firestore.Timestamp.fromDate(lastCheckedAt) : admin.firestore.FieldValue.serverTimestamp()
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

        const uDoc = await db.collection('users').doc(U_INACTIVE).get();
        expect(uDoc.data()?.groupIds).not.toContain(G2);
    });

    it('Scenario 3: Transfer ownership when owner is inactive', async () => {
        const result = await InactivityService.processGroupInactivity(G3);
        expect(result.transferCount).toBe(1);
        expect(result.removedCount).toBe(1);

        const gDoc = await db.collection('groups').doc(G3).get();
        expect(gDoc.data()?.ownerUserId).toBe(U_NEW_OWNER);
    });

    it('Scenario 4: Delete group and CLEANUP ALL user refs when all inactive', async () => {
        const result = await InactivityService.processGroupInactivity(G4);
        expect(result.groupDeleted).toBe(true);

        // Verify group is gone
        const gDoc = await db.collection('groups').doc(G4).get();
        expect(gDoc.exists).toBe(false);

        // Verify ALL users are cleaned up
        for (const uid of [U_OWNER, U_INACTIVE, U_SEC]) {
            const uDoc = await db.collection('users').doc(uid).get();
            expect(uDoc.data()?.groupIds).not.toContain(G4);
            const stateSnap = await db.collection('users').doc(uid).collection('groupStates').doc(G4).get();
            expect(stateSnap.exists).toBe(false);
        }
    });

    it('Scenario 5: Cleanup ghost members', async () => {
        const result = await InactivityService.processGroupInactivity(G5);
        expect(result.removedCount).toBe(1);

        const gDoc = await db.collection('groups').doc(G5).get();
        expect(gDoc.data()?.members).not.toContain(U_INACTIVE);
    });

    it('Scenario 6: Verify Japanese localization for ownership transfer', async () => {
        const result = await InactivityService.processGroupInactivity(G6);
        expect(result.transferCount).toBe(1);

        const messagesSnap = await db.collection('groups').doc(G6).collection('messages')
            .where('isSystemMessage', '==', true)
            .get();
        
        const transferMsg = messagesSnap.docs.find(d => d.data().text.includes(t('ja', 'notifications.ownership_transferred').substring(0, 5)));
        expect(transferMsg).toBeDefined();
        
        // Final check: exact match
        const expectedText = t('ja', 'notifications.ownership_transferred');
        expect(transferMsg?.data().text).toBe(expectedText);
    });

    it('Scenario 7: Purge group marked with isDeleted=true', async () => {
        const result = await InactivityService.processGroupInactivity(G7);
        expect(result.groupDeleted).toBe(true);

        const gDoc = await db.collection('groups').doc(G7).get();
        expect(gDoc.exists).toBe(false);
    });

    it('Scenario 8: Batch check respects rotation (lastInactivityCheckedAt)', async () => {
        // Run batch check with limit 2
        const stats = await InactivityService.batchCheckInactivity(2);
        
        expect(stats.processedGroups).toBe(2);

        // Check if G_STALE_A and G_STALE_B were the ones checked (their timestamp should be updated to NOW-ish)
        const docA = await db.collection('groups').doc(G_STALE_A).get();
        const docB = await db.collection('groups').doc(G_STALE_B).get();
        const docC = await db.collection('groups').doc(G_STALE_C).get();

        const tsA = docA.data()?.lastInactivityCheckedAt?.toMillis() || 0;
        const tsB = docB.data()?.lastInactivityCheckedAt?.toMillis() || 0;
        const tsC = docC.data()?.lastInactivityCheckedAt?.toMillis() || 0;

        // A and B should be newer than C now
        expect(tsA).toBeGreaterThan(TEN_DAYS_AGO.getTime());
        expect(tsB).toBeGreaterThan(SIX_DAYS_AGO.getTime());
        expect(tsC).toBe(TWO_DAYS_AGO.getTime()); // C should remain untouched
    });

    it('Scenario 9 (Regression): Repair joinedAt when it matches createTime but older activity exists', async () => {
        // This case checks the new logic that fixed the "Cosmos" bug.
        const G9 = 'TEST_GRP_CORRUPTED_V2';
        const result = await InactivityService.processGroupInactivity(G9);
        expect(result.removedCount).toBe(0);

        const memberDoc = await db.collection('groups').doc(G9).collection('members').doc(U_CORRUPTED_V2).get();
        const joinedAtMs = (memberDoc.data()?.joinedAt as admin.firestore.Timestamp)?.toMillis();
        const createTimeMs = (memberDoc.createTime as admin.firestore.Timestamp)?.toMillis();
        
        // It SHOULD be different now. It should have been pulled back to 10 days ago (oldest activity).
        expect(joinedAtMs).toBeLessThan(createTimeMs);
        expect(joinedAtMs).toBe(TEN_DAYS_AGO.getTime());
    });

    it('Scenario 10: Massive Group cleanup (50 members)', async () => {
        const result = await InactivityService.processGroupInactivity(G10);
        expect(result.removedCount).toBe(50);
        expect(result.groupDeleted).toBe(false);

        const gDoc = await db.collection('groups').doc(G10).get();
        expect(gDoc.data()?.membersCount).toBe(1);
        expect(gDoc.data()?.members).toEqual([U_OWNER]);
        
        // Verify a random user is cleaned up
        const randomUser = `${U_MASSIVE_PREFIX}25`;
        const uDoc = await db.collection('users').doc(randomUser).get();
        expect(uDoc.data()?.groupIds).not.toContain(G10);
    });
});
