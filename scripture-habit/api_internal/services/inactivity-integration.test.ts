// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { admin, db } from '../lib/firebase-admin.js';
import { GroupDocument } from '../../types/firestore.js';
import { calculateMemberStatus, InactivityMemberData, InactivityGroupData } from '../lib/inactivity-utils.js';

/**
 * Note: This integration test mimics the logic in api_internal/routes/cron.ts
 * since the route handlers are not exported as functions.
 */
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Inactivity Integration Test (Member Removal)', () => {
    const TEST_UID = 'cFg1i9IybmfV1la4OekO2jDWE9h1' // test1;
    const TEST_GROUP_ID = 'TEST_INACTIVITY_GROUP_' + Date.now();

    beforeAll(async () => {
        // Setup a temporary test group
        await db.collection('groups').doc(TEST_GROUP_ID).set({
            name: 'Inactivity Test Group',
            ownerUserId: 'some_other_owner',
            members: [TEST_UID, 'some_other_owner'],
            membersCount: 2,
            memberPreviews: [
                { uid: TEST_UID, nickname: 'TestUser' },
                { uid: 'some_other_owner', nickname: 'Owner' }
            ],
            pace: 3, // 3 day pace
            lastInactivityCheckedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Add user to members subcollection
        await db.collection('groups').doc(TEST_GROUP_ID).collection('members').doc(TEST_UID).set({
            joinedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)),
            lastNoteAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)), // 5 days ago (Inactive)
            lastActiveAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000))
        });

        // Add groupState to user
        await db.collection('users').doc(TEST_UID).collection('groupStates').doc(TEST_GROUP_ID).set({
            readMessageCount: 0,
            lastReadAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Ensure user exists and has the group in their groupIds
        await db.collection('users').doc(TEST_UID).set({
            nickname: 'InactivityUser',
            groupIds: admin.firestore.FieldValue.arrayUnion(TEST_GROUP_ID)
        }, { merge: true });
    });

    afterAll(async () => {
        // Cleanup
        await db.recursiveDelete(db.collection('groups').doc(TEST_GROUP_ID));
        await db.collection('users').doc(TEST_UID).update({
            groupIds: admin.firestore.FieldValue.arrayRemove(TEST_GROUP_ID)
        });
        await db.collection('users').doc(TEST_UID).collection('groupStates').doc(TEST_GROUP_ID).delete();
    });

    it('should identify an inactive member and simulate the removal process', async () => {
        const groupRef = db.collection('groups').doc(TEST_GROUP_ID);
        const gSnap = await groupRef.get();
        const gData = gSnap.data() as InactivityGroupData;

        const mSnap = await groupRef.collection('members').doc(TEST_UID).get();
        const mData = mSnap.data() as InactivityMemberData;

        // 1. Run Calculation
        const result = calculateMemberStatus(TEST_UID, mData, gData);
        expect(result.status).toBe('inactive');
        expect(result.reason).toContain('Inactive for 5.0 days');

        // 2. Simulate Removal Logic (mimics cron.ts)
        const batch = db.batch();
        const inactiveMembers = [TEST_UID];
        const ownerUserId = 'some_other_owner';

        const finalMembersToRemove = inactiveMembers.filter(uid => uid !== ownerUserId);
        
        if (finalMembersToRemove.length > 0) {
            const groupUpdates: admin.firestore.UpdateData<GroupDocument> = {
                members: admin.firestore.FieldValue.arrayRemove(...finalMembersToRemove),
                membersCount: admin.firestore.FieldValue.increment(-finalMembersToRemove.length),
                [`memberLastActive.${TEST_UID}`]: admin.firestore.FieldValue.delete(),
                [`memberLastReadAt.${TEST_UID}`]: admin.firestore.FieldValue.delete()
            };
            
            // Note: In real cron, memberPreviews is also filtered
            batch.update(groupRef, groupUpdates);

            for (const uid of finalMembersToRemove) {
                const userRef = db.collection('users').doc(uid);
                batch.update(userRef, { groupIds: admin.firestore.FieldValue.arrayRemove(TEST_GROUP_ID) });
                batch.delete(userRef.collection('groupStates').doc(TEST_GROUP_ID));
                batch.delete(groupRef.collection('members').doc(uid));
            }
        }

        await batch.commit();

        // 3. Verify Final State
        const [gSnapAfter, mSnapAfter, uSnapAfter, gsSnapAfter] = await Promise.all([
            groupRef.get(),
            groupRef.collection('members').doc(TEST_UID).get(),
            db.collection('users').doc(TEST_UID).get(),
            db.collection('users').doc(TEST_UID).collection('groupStates').doc(TEST_GROUP_ID).get()
        ]);

        const gDataAfter = gSnapAfter.data()!;
        expect(gDataAfter.members).not.toContain(TEST_UID);
        expect(gDataAfter.membersCount).toBe(1);
        expect(mSnapAfter.exists).toBe(false);
        expect(uSnapAfter.data()!.groupIds).not.toContain(TEST_GROUP_ID);
        expect(gsSnapAfter.exists).toBe(false);

        console.log('[Test] Inactivity Member Removal PASSED');
    });
});
