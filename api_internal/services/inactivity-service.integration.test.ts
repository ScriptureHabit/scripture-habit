// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { admin, db } from '../lib/firebase-admin.js';
import { InactivityService } from './inactivity-service.js';
import { toMillis } from '../lib/inactivity-utils.js';
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

    // Unique run ID to prevent state leaks between parallel test runs or reruns
    const RUN_ID = Math.random().toString(36).substring(2, 7);

    // Mock IDs — all suffixed with RUN_ID to prevent cross-run contamination
    const G1 = `INA_GRP_ACTIVE_${RUN_ID}`;
    const G2 = `INA_GRP_INACTIVE_MEMBER_${RUN_ID}`;
    const G3 = `INA_GRP_TRANSFER_OWNER_${RUN_ID}`;
    const G4 = `INA_GRP_DELETE_ALL_${RUN_ID}`;
    const G5 = `INA_GRP_GHOST_CLEANUP_${RUN_ID}`;
    const G6 = `INA_GRP_LOCALIZATION_${RUN_ID}`;
    const G7 = `INA_GRP_MARKED_DELETE_${RUN_ID}`;
    const G_STALE_A = `INA_STALE_A_${RUN_ID}`;
    const G_STALE_B = `INA_STALE_B_${RUN_ID}`;
    const G_STALE_C = `INA_STALE_C_${RUN_ID}`;
    const G10 = `INA_GRP_MASSIVE_${RUN_ID}`;           // Case 10: 50+ members removed
    const G11 = `INA_GRP_NEVER_KICK_${RUN_ID}`;        // Case 11: threshold = 0
    const G12 = `INA_GRP_UNINITIALIZED_${RUN_ID}`;     // Case 12: empty members subcollection
    const G13 = `INA_GRP_NEW_MISSING_FIELD_${RUN_ID}`; // Case 13: missing lastInactivityCheckedAt

    const U_ACTIVE = `USER_ACTIVE_${RUN_ID}`;
    const U_INACTIVE = `USER_INACTIVE_${RUN_ID}`;
    const U_OWNER = `USER_OWNER_${RUN_ID}`;
    const U_NEW_OWNER = `USER_NEW_OWNER_${RUN_ID}`;
    const U_JA = `USER_JAPANESE_${RUN_ID}`;
    const U_SEC = `USER_SECONDARY_${RUN_ID}`;
    const U_GHOST = `USER_GHOST_${RUN_ID}`;
    const U_SC9 = `USER_SCENARIO_9_${RUN_ID}`;
    const U_MASSIVE_PREFIX = `U_MASS_${RUN_ID}_`;


    beforeAll(async () => {
        // Setup Users
        const users = [U_ACTIVE, U_INACTIVE, U_OWNER, U_NEW_OWNER, U_JA, U_SEC, U_GHOST, U_SC9];
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

        // 8. Scenario 8: Rotation Stale Groups
        await setupGroup(G_STALE_A, U_OWNER, [U_OWNER, U_INACTIVE], 3, TEN_DAYS_AGO);
        await setupGroup(G_STALE_B, U_OWNER, [U_OWNER, U_INACTIVE], 3, SIX_DAYS_AGO);
        await setupGroup(G_STALE_C, U_OWNER, [U_OWNER, U_INACTIVE], 3, TWO_DAYS_AGO); // Not stale
        const massiveMembers = [];
        for (let i = 0; i < 50; i++) massiveMembers.push(`${U_MASSIVE_PREFIX}${i}`);
        // Use a past date for lastCheckedAt to keep it out of the "New" rotation
        await setupGroup(G10, U_OWNER, [U_OWNER, ...massiveMembers], 3, TWO_DAYS_AGO);
        await setMemberActivity(G10, U_OWNER, TWO_DAYS_AGO);
        for (const uid of massiveMembers) {
            await setMemberActivity(G10, uid, SIX_DAYS_AGO);
        }

        // 12. Group 11: Never Kick (Threshold 0)
        await setupGroup(G11, U_OWNER, [U_OWNER, U_INACTIVE], 3, TWO_DAYS_AGO);
        await setMemberActivity(G11, U_OWNER, TWO_DAYS_AGO);
        
        const FOURTEEN_DAYS_AGO = new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000);
        const ts14 = admin.firestore.Timestamp.fromDate(FOURTEEN_DAYS_AGO);

        // Set U_INACTIVE to threshold 0 (Never) and last active long ago
        await db.collection('groups').doc(G11).collection('members').doc(U_INACTIVE).set({
            joinedAt: ts14,
            lastActiveAt: ts14,
            kickThreshold: 0
        });
        await db.collection('groups').doc(G11).update({
            [`memberKickThresholds.${U_INACTIVE}`]: 0,
            [`memberLastActive.${U_INACTIVE}`]: ts14
        });

        // 13. Group 12: Uninitialized (Heal Scenario)
        // Created with members array but NO members subcollection
        await db.collection('groups').doc(G12).set({
            name: 'Uninitialized Group',
            ownerUserId: U_OWNER,
            members: [U_OWNER, U_ACTIVE],
            createdAt: ts14,
            memberJoinedAt: { [U_OWNER]: ts14, [U_ACTIVE]: ts14 },
            memberLastActive: { [U_OWNER]: ts14, [U_ACTIVE]: ts14 },
            lastInactivityCheckedAt: admin.firestore.Timestamp.fromDate(TWO_DAYS_AGO)
        });

        // 14. Group 13: New Group Missing Field
        // Should be picked up by the "Net" query (orderBy createdAt)
        await db.collection('groups').doc(G13).set({
            name: 'New Group Missing Field',
            ownerUserId: U_OWNER,
            members: [U_OWNER],
            createdAt: admin.firestore.Timestamp.fromDate(NOW)
            // lastInactivityCheckedAt is EXPLICITLY missing
        });
    }, 120000);


    afterAll(async () => {
        const groups = [G1, G2, G3, G4, G5, G6, G7, G10, G11, G12, G13, G_STALE_A, G_STALE_B, G_STALE_C, `INA_GRP_SCENARIO_9_${RUN_ID}`];
        for (const gid of groups) {
            await db.recursiveDelete(db.collection('groups').doc(gid)).catch(() => {});
        }
        const users = [U_ACTIVE, U_INACTIVE, U_OWNER, U_NEW_OWNER, U_JA, U_SEC, U_GHOST, U_SC9];
        for (let i = 0; i < 50; i++) users.push(`${U_MASSIVE_PREFIX}${i}`);
        for (const uid of users) {
            await db.collection('users').doc(uid).delete().catch(() => {});
        }
    }, 120000);

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
            await db.collection('users').doc(uid).set({
                groupIds: admin.firestore.FieldValue.arrayUnion(groupId)
            }, { merge: true });
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

        // Verify that the inactivity removal message is added to messages_latest/latest cache
        const latestSnap = await db.collection('groups').doc(G2).collection('messages_latest').doc('latest').get();
        expect(latestSnap.exists).toBe(true);
        const messages = latestSnap.data()?.messages || [];
        expect(messages.length).toBeGreaterThan(0);
        const removalMsg = messages.find((m: any) => m.messageType === 'inactivityRemoval');
        expect(removalMsg).toBeDefined();
        expect(removalMsg.messageData?.count).toBe(1);
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

    it('Scenario 6: Verify silent ownership transfer (no chat announcement created)', async () => {
        const result = await InactivityService.processGroupInactivity(G6);
        expect(result.transferCount).toBe(1);

        const gDoc = await db.collection('groups').doc(G6).get();
        expect(gDoc.data()?.ownerUserId).toBe(U_JA);

        const messagesSnap = await db.collection('groups').doc(G6).collection('messages')
            .where('isSystemMessage', '==', true)
            .get();
        
        // Ownership transfer should be silent now (no system message posted)
        const transferMsg = messagesSnap.docs.find(d => d.data().text?.includes(t('ja', 'notifications.ownership_transferred').substring(0, 5)));
        expect(transferMsg).toBeUndefined();
    });

    it('Scenario 7: Purge group marked with isDeleted=true', async () => {
        const result = await InactivityService.processGroupInactivity(G7);
        expect(result.groupDeleted).toBe(true);

        const gDoc = await db.collection('groups').doc(G7).get();
        expect(gDoc.exists).toBe(false);
    });

    it('Scenario 8: Batch check respects rotation (lastInactivityCheckedAt)', async () => {
        // Run batch check with limit 2. It should pick up 2 stale groups (A, B) from
        // rotation + at least G13 from "the Net". Other groups from concurrent tests
        // may also be picked up, so we assert >= 3 and focus on the timestamps.
        const stats = await InactivityService.batchCheckInactivity(2);
        
        expect(stats.processedGroups).toBeGreaterThanOrEqual(3);

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
        const G_SC9 = `INA_GRP_SCENARIO_9_${RUN_ID}`;
        const U_SC9_local = `USER_SCENARIO_9_local_${RUN_ID}`;
        const TEN_DAYS_AGO_TS = admin.firestore.Timestamp.fromDate(TEN_DAYS_AGO);

        // 1. Setup group with Pace 100 (very loose)
        await setupGroup(G_SC9, U_OWNER, [U_OWNER, U_SC9_local], 100, TWO_DAYS_AGO);
        await setMemberActivity(G_SC9, U_OWNER, TWO_DAYS_AGO);
        
        // 2. Create member doc for U_SC9_local with activity 10 days ago
        const memberRef = db.collection('groups').doc(G_SC9).collection('members').doc(U_SC9_local);
        await memberRef.set({
            lastActiveAt: TEN_DAYS_AGO_TS,
            lastReadAt: TEN_DAYS_AGO_TS,
            readMessageCount: 1,
            joinedAt: admin.firestore.FieldValue.serverTimestamp() // Initial value
        });
        
        const snap = await memberRef.get();
        const createTime = snap.createTime!;
        
        // 3. Set joinedAt to exactly createTime (simulating the bug)
        await memberRef.update({
            joinedAt: createTime
        });
        
        // 4. Add OLDER activity to the group-level map
        await db.collection('groups').doc(G_SC9).update({
            [`memberLastActive.${U_SC9_local}`]: TEN_DAYS_AGO_TS
        });

        // 5. Process
        const result = await InactivityService.processGroupInactivity(G_SC9);
        expect(result.removedCount).toBe(0); // Should NOT be removed (10 < 100)

        // 6. Verify Repair
        const repairedSnap = await memberRef.get();
        const joinedAtMs = toMillis(repairedSnap.data()?.joinedAt);
        const createTimeMs = toMillis(repairedSnap.createTime);
        
        // It SHOULD be different now. It should have been pulled back to 10 days ago.
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

    it('Scenario 11: Respect kickThreshold=0 (Never)', async () => {
        const result = await InactivityService.processGroupInactivity(G11);
        // U_INACTIVE is long inactive but has threshold 0, so should NOT be removed
        expect(result.removedCount).toBe(0);
        
        const gDoc = await db.collection('groups').doc(G11).get();
        expect(gDoc.data()?.members).toContain(U_INACTIVE);
    });

    it('Scenario 12: Heal uninitialized members subcollection', async () => {
        const groupRef = db.collection('groups').doc(G12);
        const initialSnap = await groupRef.get();
        
        if (!initialSnap.exists) {
            // It was already processed and deleted by Scenario 8's "Net" check.
            // This is expected behavior since Scenario 8 runs first.
            return;
        }

        const result = await InactivityService.processGroupInactivity(G12);
        expect(result.groupDeleted).toBe(true);
    });

    it('Scenario 13: Batch check picks up groups missing lastInactivityCheckedAt', async () => {
        // G13 is missing the field but is the newest (orderBy createdAt desc)
        await InactivityService.batchCheckInactivity(50);
        
        const gDoc = await db.collection('groups').doc(G13).get();
        expect(gDoc.data()?.lastInactivityCheckedAt).toBeDefined();
    });

    it('Scenario 14: batchCheckInactivity catch and throw on processGroupInactivity failure (covering line 60-61)', async () => {
        const { vi } = await import('vitest');
        const processSpy = vi.spyOn(InactivityService, 'processGroupInactivity').mockRejectedValue(new Error('Process error'));
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(InactivityService.batchCheckInactivity(1)).rejects.toThrow('Process error');
        expect(consoleErrorSpy).toHaveBeenCalled();

        processSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it('Scenario 15: processGroupInactivity catch and throw on batch commit failure (covering line 282-283)', async () => {
        const { vi } = await import('vitest');
        const commitSpy = vi.spyOn(admin.firestore.WriteBatch.prototype, 'commit').mockRejectedValue(new Error('Commit timeout'));
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(InactivityService.processGroupInactivity(G1)).rejects.toThrow('Commit timeout');
        expect(consoleErrorSpy).toHaveBeenCalled();

        commitSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it('Scenario 16: sendKickNotification with tokens and language split (covering line 299-300)', async () => {
        const { vi } = await import('vitest');
        const { messaging } = await import('../lib/firebase-admin.js');
        const sendSpy = vi.spyOn(messaging, 'sendEachForMulticast').mockResolvedValue({
            successCount: 1,
            failureCount: 0,
            responses: [{ success: true }]
        });

        const U_TEST_KICK = `USER_TEST_KICK_${RUN_ID}`;
        await db.collection('users').doc(U_TEST_KICK).set({
            nickname: 'Kick User',
            language: 'ja-JP',
            fcmTokens: ['token_kick_1']
        });

        await (InactivityService as any).sendKickNotification(U_TEST_KICK, 'dummy-grp', 'KickGroup');
        
        expect(sendSpy).toHaveBeenCalled();
        sendSpy.mockRestore();
        await db.collection('users').doc(U_TEST_KICK).delete();
    });

    it('Scenario 17: sendKickNotification failed tokens cleanup (covering line 311-315)', async () => {
        const { vi } = await import('vitest');
        const { messaging } = await import('../lib/firebase-admin.js');
        const sendSpy = vi.spyOn(messaging, 'sendEachForMulticast').mockResolvedValue({
            successCount: 0,
            failureCount: 1,
            responses: [{
                success: false,
                error: {
                    code: 'messaging/registration-token-not-registered',
                    message: 'Not registered'
                } as any
            }]
        });

        const U_TEST_KICK_FAIL = `USER_TEST_KICK_FAIL_${RUN_ID}`;
        await db.collection('users').doc(U_TEST_KICK_FAIL).set({
            nickname: 'Kick User Fail',
            language: 'en-US',
            fcmTokens: ['token_kick_fail_1']
        });
        await db.collection('users').doc(U_TEST_KICK_FAIL).collection('private').doc('tokens').set({
            fcmTokens: []
        });

        await (InactivityService as any).sendKickNotification(U_TEST_KICK_FAIL, 'dummy-grp', 'KickGroup');
        
        expect(sendSpy).toHaveBeenCalled();
        
        // Verify that the failed token was cleaned up
        const uSnap = await db.collection('users').doc(U_TEST_KICK_FAIL).get();
        expect(uSnap.data()?.fcmTokens).toEqual([]);

        sendSpy.mockRestore();
        await db.collection('users').doc(U_TEST_KICK_FAIL).delete();
    });

    it('Scenario 18: sendKickNotification catch block error logging (covering line 315-316)', async () => {
        const { vi } = await import('vitest');
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const getSpy = vi.spyOn(admin.firestore.DocumentReference.prototype, 'get').mockRejectedValue(new Error('DB Timeout'));

        await (InactivityService as any).sendKickNotification('some-uid-error', 'dummy-grp', 'KickGroup');

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
        getSpy.mockRestore();
    });

    it('Scenario 19: initialize joinedAt for member missing joinedAt (covering line 211-214)', async () => {
        const G_SC19 = `INA_GRP_SCENARIO_19_${RUN_ID}`;
        const U_SC19 = `USER_SCENARIO_19_${RUN_ID}`;
        const NOW_TS = admin.firestore.Timestamp.fromDate(NOW);

        await setupGroup(G_SC19, U_OWNER, [U_OWNER, U_SC19], 3, TWO_DAYS_AGO);
        await setMemberActivity(G_SC19, U_OWNER, TWO_DAYS_AGO);

        // Set member doc for U_SC19 with lastActiveAt but NO joinedAt
        const memberRef = db.collection('groups').doc(G_SC19).collection('members').doc(U_SC19);
        await memberRef.set({
            lastActiveAt: NOW_TS,
            lastReadAt: NOW_TS,
            readMessageCount: 1
            // joinedAt is EXPLICITLY missing!
        });

        const result = await InactivityService.processGroupInactivity(G_SC19);
        expect(result.initializedCount).toBe(1);

        // Verify that joinedAt was initialized
        const snap = await memberRef.get();
        expect(snap.data()?.joinedAt).toBeDefined();

        await db.recursiveDelete(db.collection('groups').doc(G_SC19)).catch(() => {});
    });
});

