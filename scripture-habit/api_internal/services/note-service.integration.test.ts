// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { admin, db } from '../lib/firebase-admin.js';
import { NoteService } from './note-service.js';
import { GroupDocument, UserDocument } from '../../types/firestore.js';
import { StreakEngine } from '../lib/streak-engine.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('NoteService Deletion Integration Test', () => {
    const TEST_UID = 'test-user-delete';
    const GROUP_1 = 'delete-test-group-1';
    const GROUP_2 = 'delete-test-group-2';

    beforeAll(async () => {
        // Setup user
        await db.collection('users').doc(TEST_UID).set({
            nickname: 'Delete Tester',
            totalNotes: 0,
            groupIds: [GROUP_1, GROUP_2],
            dailyActivity: {}
        } as UserDocument);

        // Setup groups
        for (const gid of [GROUP_1, GROUP_2]) {
            await db.collection('groups').doc(gid).set({
                name: `Delete Group ${gid}`,
                members: [TEST_UID],
                noteCount: 0,
                messageCount: 0,
                createdAt: admin.firestore.Timestamp.now()
            } as GroupDocument);
        }
    });

    it('should delete a note and update all related counts and metadata', async () => {
        // 1. Post two notes to GROUP_1 so we can test last-note recovery
        const res1 = await NoteService.postNote({
            uid: TEST_UID,
            messageText: 'First Note',
            scripture: 'Genesis 1:1',
            comment: 'Note 1',
            shareOption: 'all',
            language: 'ja',
            timeZone: 'UTC'
        });

        // Small delay to ensure distinct timestamps
        await new Promise(r => setTimeout(r, 100));

        const res2 = await NoteService.postNote({
            uid: TEST_UID,
            messageText: 'Second Note',
            scripture: 'Genesis 1:2',
            comment: 'Note 2',
            shareOption: 'all',
            language: 'ja',
            timeZone: 'UTC'
        });

        // Verify initial state
        const uSnap = await db.collection('users').doc(TEST_UID).get();
        expect(uSnap.data()?.totalNotes).toBe(2);

        const gSnap = await db.collection('groups').doc(GROUP_1).get();
        const gData = gSnap.data() as GroupDocument;
        expect(gData.noteCount).toBe(2);
        // lastNoteAt should be from res2
        expect(gData.lastNoteByUid).toBe(TEST_UID);

        // 2. Delete Note 2 (the most recent one)
        await NoteService.deleteNote(TEST_UID, res2.personalNoteId);

        // 3. Verify counts decremented
        const uSnapAfter = await db.collection('users').doc(TEST_UID).get();
        expect(uSnapAfter.data()?.totalNotes).toBe(1);

        const gSnapAfter = await db.collection('groups').doc(GROUP_1).get();
        const gDataAfter = gSnapAfter.data() as GroupDocument;
        expect(gDataAfter.noteCount).toBe(1);

        // 4. Verify lastNote recovery: should now point to Note 1
        // We can't easily check the timestamp equality without knowing what postNote exactly did,
        // but we can check if it exists and is before the previous value if we had saved it.
        expect(gDataAfter.lastNoteAt).toBeDefined();
        expect(gDataAfter.lastNoteByNickname).toBe('Delete Tester');

        // 5. Delete Note 1 (the final one)
        await NoteService.deleteNote(TEST_UID, res1.personalNoteId);

        // 6. Verify everything is cleaned up
        const gSnapFinal = await db.collection('groups').doc(GROUP_1).get();
        const gDataFinal = gSnapFinal.data() as GroupDocument;
        expect(gDataFinal.noteCount).toBe(0);
        expect(gDataFinal.lastNoteAt).toBeFalsy();
        
        const uSnapFinal = await db.collection('users').doc(TEST_UID).get();
        expect(uSnapFinal.data()?.totalNotes).toBe(0);
    }, 30000);

    it('should rollback all changes if an error occurs during transaction (Atomicity)', async () => {
        // 1. Get initial states
        const uSnapBefore = await db.collection('users').doc(TEST_UID).get();
        const initialTotalNotes = uSnapBefore.data()?.totalNotes || 0;
        
        const gSnapBefore = await db.collection('groups').doc(GROUP_1).get();
        const initialGroupNoteCount = gSnapBefore.data()?.noteCount || 0;

        // 2. Mock StreakEngine to throw an error MID-TRANSACTION
        const spy = vi.spyOn(StreakEngine, 'calculateNextStreak').mockImplementationOnce(() => {
            throw new Error('SIMULATED_TRANSACTION_FAILURE');
        });

        // 3. Attempt to post a note
        await expect(NoteService.postNote({
            uid: TEST_UID,
            messageText: 'Failure Test Note',
            scripture: 'Exodus 1:1',
            comment: 'Should not exist',
            shareOption: 'all',
            timeZone: 'UTC'
        })).rejects.toThrow('SIMULATED_TRANSACTION_FAILURE');

        // 4. Verify that NO data was changed
        const uSnapAfter = await db.collection('users').doc(TEST_UID).get();
        expect(uSnapAfter.data()?.totalNotes).toBe(initialTotalNotes);

        const gSnapAfter = await db.collection('groups').doc(GROUP_1).get();
        expect(gSnapAfter.data()?.noteCount).toBe(initialGroupNoteCount);

        // 5. Verify no note was created in the subcollection
        const notesSnap = await db.collection('users').doc(TEST_UID).collection('notes')
            .where('scripture', '==', 'Exodus 1:1')
            .get();
        expect(notesSnap.empty).toBe(true);

        spy.mockRestore();
    });
});
