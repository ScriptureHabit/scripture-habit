// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { admin, db } from '../lib/firebase-admin.js';
import { NoteService } from './note-service.js';

describe('NoteService Integration Test', () => {
    const TEST_UID = 'cFg1i9IybmfV1la4OekO2jDWE9h1' // test1;
    const TEST_GROUP_ID = 'OVtYdwOhB8uDor6MfDPG' // test group;

    beforeAll(async () => {
        // Ensure user is in the group for testing
        const groupRef = db.collection('groups').doc(TEST_GROUP_ID);
        const gSnap = await groupRef.get();
        if (!gSnap.exists) throw new Error('Test group not found: ' + TEST_GROUP_ID);

        const gData = gSnap.data()!;
        const members = gData.members || [];
        if (!members.includes(TEST_UID)) {
            console.log(`Adding user ${TEST_UID} to group ${TEST_GROUP_ID} members list for test...`);
            await groupRef.update({
                members: admin.firestore.FieldValue.arrayUnion(TEST_UID)
            });
        }
    });

    it('should post a note and update all counters and group data consistency correctly', async () => {
        const userRef = db.collection('users').doc(TEST_UID);
        const groupRef = db.collection('groups').doc(TEST_GROUP_ID);
        const memberRef = groupRef.collection('members').doc(TEST_UID);
        const groupStateRef = userRef.collection('groupStates').doc(TEST_GROUP_ID);

        // 1. Get initial state
        const [uSnapInit, gSnapInit] = await Promise.all([
            userRef.get(), 
            groupRef.get()
        ]);
        
        const uDataInit = uSnapInit.data()!;
        const gDataInit = gSnapInit.data()!;

        const initialTotalNotes = Number(uDataInit.totalNotes || 0);
        const initialGroupNoteCount = Number(gDataInit.noteCount || 0);
        const initialGroupMsgCount = Number(gDataInit.messageCount || 0);

        // 2. Post a note
        const testScripture = '1 Nephi 1';
        const testComment = 'Consistency Tech Test ' + new Date().toISOString();
        
        const result = await NoteService.postNote({
            uid: TEST_UID,
            messageText: 'Testing Note Posting Consistency',
            scripture: testScripture,
            comment: testComment,
            shareOption: 'specific',
            selectedShareGroups: [TEST_GROUP_ID],
            language: 'ja',
            timeZone: 'Asia/Tokyo'
        });

        expect(result.personalNoteId).toBeDefined();

        // 3. Verify Updates & Consistency
        const [uSnapAfter, gSnapAfter, mSnapAfter, gsSnapAfter] = await Promise.all([
            userRef.get(), 
            groupRef.get(),
            memberRef.get(),
            groupStateRef.get()
        ]);

        const uDataAfter = uSnapAfter.data()!;
        const gDataAfter = gSnapAfter.data()!;
        const mDataAfter = mSnapAfter.data()!;
        const gsDataAfter = gsSnapAfter.data()!;

        // --- Core Counters ---
        expect(Number(uDataAfter.totalNotes)).toBe(initialTotalNotes + 1);
        expect(Number(gDataAfter.noteCount)).toBe(initialGroupNoteCount + 1);
        
        // If streak was updated, a streak announcement message is also posted, so +2
        const expectedMsgIncrement = result.streakUpdated && result.newStreak > 0 ? 2 : 1;
        expect(Number(gDataAfter.messageCount)).toBe(initialGroupMsgCount + expectedMsgIncrement);

        // --- Group Metadata Consistency ---
        expect(gDataAfter.lastNoteByUid).toBe(TEST_UID);
        expect(gDataAfter.lastNoteByNickname).toBe(uDataInit.nickname);
        // lastNoteAt and lastMessageAt should be equivalent within the transaction
        expect(gDataAfter.lastNoteAt.toMillis()).toBe(gDataAfter.lastMessageAt.toMillis());

        // --- Member Subcollection Consistency ---
        expect(mDataAfter.lastNoteAt.toMillis()).toBe(gDataAfter.lastNoteAt.toMillis());
        expect(mDataAfter.lastPostAt.toMillis()).toBe(gDataAfter.lastNoteAt.toMillis());
        expect(mDataAfter.lastActiveAt.toMillis()).toBe(gDataAfter.lastNoteAt.toMillis());

        // --- User GroupState Consistency ---
        // readMessageCount should be current group messageCount
        expect(Number(gsDataAfter.readMessageCount)).toBe(Number(gDataAfter.messageCount));
        expect(gsDataAfter.lastReadAt.toMillis()).toBe(gDataAfter.lastNoteAt.toMillis());
        expect(gsDataAfter.lastActiveAt.toMillis()).toBe(gDataAfter.lastNoteAt.toMillis());

        console.log('[Test] Consistency Check PASSED');

        // 4. Cleanup
        console.log('[Test] Cleaning up...');
        const msgSnap = await groupRef.collection('messages').where('originalNoteId', '==', result.personalNoteId).get();
        const batch = db.batch();
        batch.delete(userRef.collection('notes').doc(result.personalNoteId));
        if (!msgSnap.empty) batch.delete(msgSnap.docs[0].ref);
        
        // Restore counters (approximately)
        batch.update(userRef, { totalNotes: admin.firestore.FieldValue.increment(-1) });
        batch.update(groupRef, { 
            noteCount: admin.firestore.FieldValue.increment(-1),
            messageCount: admin.firestore.FieldValue.increment(-1)
        });
        
        await batch.commit();
        console.log('[Test] Cleanup complete.');
    }, 40000);

    it('should increment streak and maintain consistency when lastPostDate was yesterday', async () => {
        const userRef = db.collection('users').doc(TEST_UID);
        const groupRef = db.collection('groups').doc(TEST_GROUP_ID);

        // 1. Force state to "posted yesterday"
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayStr = new Intl.DateTimeFormat('sv-SE', { 
            timeZone: 'Asia/Tokyo',
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(yesterday);

        const uSnapOrig = await userRef.get();
        const uDataOrig = uSnapOrig.data()!;
        const originalStreak = Number(uDataOrig.streakCount || 0);
        const originalLastPostDate = uDataOrig.lastPostDate;
        const originalLastPostAt = uDataOrig.lastPostAt;

        console.log(`[Streak Test] Setting lastPostDate to ${yesterdayStr}...`);
        await userRef.update({
            lastPostDate: yesterdayStr,
            lastPostAt: admin.firestore.Timestamp.fromDate(yesterday)
        });

        try {
            // 2. Post a note
            const result = await NoteService.postNote({
                uid: TEST_UID,
                messageText: 'Streak Test Note',
                scripture: 'Alma 32',
                comment: 'Verifying streak and consistency',
                shareOption: 'specific',
                selectedShareGroups: [TEST_GROUP_ID],
                language: 'ja',
                timeZone: 'Asia/Tokyo'
            });

            expect(result.streakUpdated).toBe(true);
            expect(result.newStreak).toBe(originalStreak + 1);

            const uSnapAfter = await userRef.get();
            expect(Number(uSnapAfter.data()!.streakCount)).toBe(originalStreak + 1);
            
            // 3. Cleanup
            const msgSnap = await groupRef.collection('messages').where('originalNoteId', '==', result.personalNoteId).get();
            const batch = db.batch();
            batch.delete(userRef.collection('notes').doc(result.personalNoteId));
            if (!msgSnap.empty) batch.delete(msgSnap.docs[0].ref);
            batch.update(userRef, { 
                totalNotes: admin.firestore.FieldValue.increment(-1),
                daysStudiedCount: admin.firestore.FieldValue.increment(-1)
            });
            batch.update(groupRef, { 
                noteCount: admin.firestore.FieldValue.increment(-1),
                messageCount: admin.firestore.FieldValue.increment(-1)
            });
            await batch.commit();

        } finally {
            // Restore user state
            console.log('[Streak Test] Restoring user original state...');
            await userRef.update({
                streakCount: originalStreak,
                lastPostDate: originalLastPostDate,
                lastPostAt: originalLastPostAt
            });
        }
    }, 45000);
});
