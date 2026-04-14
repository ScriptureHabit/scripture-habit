// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { admin, db } from './lib/firebase-admin.js';
import { NoteService } from './services/note-service.js';
import { calculateUnityPercentage } from '../src/utils/unity-utils.js';
import { Group } from '../src/types/chat.js';

/**
 * Unity Sync Integration Test
 * 
 * Verifies that posting a note correctly updates the group's dailyActivity 
 * and that the percentage calculation logic (used by Sidebar/Chat) 
 * returns the expected value based on that state.
 */
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Unity Percentage Integration', () => {
    const TEST_UID = 'unity-test-user-' + Date.now();
    const TEST_GROUP_ID = 'unity-test-group-' + Date.now();
    const NICKNAME = 'Unity Tester';

    beforeAll(async () => {
        // Setup initial user and group state directly in Firestore Emulator
        await db.collection('users').doc(TEST_UID).set({
            uid: TEST_UID,
            nickname: NICKNAME,
            groupId: TEST_GROUP_ID,
            groupIds: [TEST_GROUP_ID],
            timeZone: 'UTC'
        });

        const now = admin.firestore.FieldValue.serverTimestamp();
        await db.collection('groups').doc(TEST_GROUP_ID).set({
            id: TEST_GROUP_ID,
            name: 'Unity Integration Group',
            members: [TEST_UID],
            memberJoinedAt: { [TEST_UID]: now },
            timeZone: 'UTC',
            dailyActivity: {
                date: '',
                activeMembers: []
            }
        });
    });

    afterAll(async () => {
        // Cleanup (Emulator data persists within the process, but good practice)
        await db.collection('users').doc(TEST_UID).delete();
        await db.collection('groups').doc(TEST_GROUP_ID).delete();
    });

    it('should start with 0% unity when no notes are posted', async () => {
        const groupSnap = await db.collection('groups').doc(TEST_GROUP_ID).get();
        const groupData = groupSnap.data() as Group;
        
        const percentage = calculateUnityPercentage(groupData);
        expect(percentage).toBe(0);
    });

    it('should update to 100% unity after the only member posts a note', async () => {
        // 1. Post a note via the service
        await NoteService.postNote({
            uid: TEST_UID,
            messageText: 'Test Unity reaching 100%',
            scripture: 'John 1:1',
            comment: 'Testing unity sync',
            shareOption: 'current'
        });

        // 2. Fetch fresh group data
        const groupSnap = await db.collection('groups').doc(TEST_GROUP_ID).get();
        const groupData = groupSnap.data() as Group;

        // 3. Verify dailyActivity was updated by the service
        expect(groupData.dailyActivity).toBeDefined();
        expect(groupData.dailyActivity?.activeMembers).toContain(TEST_UID);

        // 4. Verify calculation logic reflects the new state
        const percentage = calculateUnityPercentage(groupData);
        expect(percentage).toBe(100);
    });

    it('should reflect 50% unity when 1 of 2 eligible members has posted', async () => {
        const SECOND_UID = 'unity-second-user-' + Date.now();
        
        // Setup state for 2nd user (joined yesterday to be eligible)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayTs = admin.firestore.Timestamp.fromDate(yesterday);

        await db.collection('users').doc(SECOND_UID).set({
            uid: SECOND_UID,
            nickname: 'Second Tester',
            groupId: TEST_GROUP_ID,
            groupIds: [TEST_GROUP_ID],
            timeZone: 'UTC'
        });

        // Add 2nd user to group
        await db.collection('groups').doc(TEST_GROUP_ID).update({
            members: admin.firestore.FieldValue.arrayUnion(SECOND_UID),
            [`memberJoinedAt.${SECOND_UID}`]: yesterdayTs
        });

        // Fetch group
        const groupSnap = await db.collection('groups').doc(TEST_GROUP_ID).get();
        const groupData = groupSnap.data() as Group;

        // Verify: 1 posted (TEST_UID), 2 eligible (TEST_UID, SECOND_UID)
        const percentage = calculateUnityPercentage(groupData);
        expect(percentage).toBe(50);
        
        // Cleanup 2nd user
        await db.collection('users').doc(SECOND_UID).delete();
    });
});
