// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { admin, db } from '../lib/firebase-admin.js';
import { NoteService } from './note-service.js';
import { GroupDocument, UserDocument } from '../../types/firestore.js';
import { StreakEngine } from '../lib/streak-engine.js';
import { formatDateInTimeZone } from '../../src/utils/time-utils.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('NoteService Integration Tests', () => {
    const TEST_UID = 'note-srv-test-user';
    const GROUP_1 = 'note-srv-group-1';
    const GROUP_2 = 'note-srv-group-2';
    const MULTI_GROUPS = ['multi-1', 'multi-2', 'multi-3'];

    beforeEach(async () => {
        // Setup user
        await db.collection('users').doc(TEST_UID).set({
            uid: TEST_UID,
            nickname: 'Note Tester',
            totalNotes: 0,
            streakCount: 0,
            daysStudiedCount: 0,
            studiedDates: [],
            groupIds: [GROUP_1, GROUP_2, ...MULTI_GROUPS],
            dailyActivity: {}
        } as UserDocument);

        // Setup groups
        for (const gid of [GROUP_1, GROUP_2, ...MULTI_GROUPS]) {
            await db.collection('groups').doc(gid).set({
                name: `Test Group ${gid}`,
                members: [TEST_UID],
                noteCount: 0,
                messageCount: 0,
                timeZone: 'UTC',
                createdAt: admin.firestore.Timestamp.now(),
                lastInactivityCheckedAt: admin.firestore.Timestamp.now()
            } as GroupDocument);
        }
    });

    describe('Basic Posting & Deletion', () => {
        it('should delete a note and update all related counts and metadata', async () => {
            const res1 = await NoteService.postNote({
                uid: TEST_UID,
                messageText: 'First Note',
                scripture: 'Genesis 1:1',
                comment: 'Note 1',
                shareOption: 'all',
                language: 'ja',
                timeZone: 'UTC'
            });

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

            const uSnap = await db.collection('users').doc(TEST_UID).get();
            expect(uSnap.data()?.totalNotes).toBe(2);

            const gSnap = await db.collection('groups').doc(GROUP_1).get();
            expect(gSnap.data()?.noteCount).toBe(2);

            await NoteService.deleteNote(TEST_UID, res2.personalNoteId);

            const gSnapAfter = await db.collection('groups').doc(GROUP_1).get();
            expect(gSnapAfter.data()?.noteCount).toBe(1);
            expect(gSnapAfter.data()?.lastNoteByNickname).toBe('Note Tester');

            await NoteService.deleteNote(TEST_UID, res1.personalNoteId);

            const gSnapFinal = await db.collection('groups').doc(GROUP_1).get();
            expect(gSnapFinal.data()?.noteCount).toBe(0);
            expect(gSnapFinal.data()?.lastNoteAt).toBeFalsy();
        }, 30000);
    });

    describe('Multi-Group Posting', () => {
        it('should post a note to multiple groups simultaneously', async () => {
            const result = await NoteService.postNote({
                uid: TEST_UID,
                messageText: 'Multi-group test',
                scripture: 'Psalm 23',
                comment: 'Shared',
                shareOption: 'specific',
                selectedShareGroups: MULTI_GROUPS,
                language: 'ja',
                timeZone: 'Asia/Tokyo'
            });

            expect(result.personalNoteId).toBeDefined();

            for (const gid of MULTI_GROUPS) {
                const gSnap = await db.collection('groups').doc(gid).get();
                expect(gSnap.data()?.noteCount).toBe(1);
                
                const msgId = result.sharedMessageIds?.[gid];
                expect(msgId).toBeDefined();
                const msgSnap = await db.collection('groups').doc(gid).collection('messages').doc(msgId!).get();
                expect(msgSnap.exists).toBe(true);
            }
        });
    });

    describe('Habit Calendar & Streak Logic', () => {
        it('should update studiedDates and avoid duplicates on same day', async () => {
            const todayStr = formatDateInTimeZone(new Date(), 'UTC');

            await NoteService.postNote({
                uid: TEST_UID,
                messageText: 'Note 1',
                scripture: 'John 1:1',
                comment: '',
                shareOption: 'none',
                timeZone: 'UTC'
            });

            await NoteService.postNote({
                uid: TEST_UID,
                messageText: 'Note 2',
                scripture: 'John 1:2',
                comment: '',
                shareOption: 'none',
                timeZone: 'UTC'
            });

            const uSnap = await db.collection('users').doc(TEST_UID).get();
            const userData = uSnap.data() as UserDocument;
            expect(userData.studiedDates).toContain(todayStr);
            expect(userData.studiedDates?.length).toBe(1);
        });
    });

    describe('Error Handling & Atomicity', () => {
        it('should rollback all changes if an error occurs during transaction', async () => {
            const spy = vi.spyOn(StreakEngine, 'calculateNextStreak').mockImplementationOnce(() => {
                throw new Error('SIMULATED_FAILURE');
            });

            await expect(NoteService.postNote({
                uid: TEST_UID,
                messageText: 'Failure Test',
                scripture: 'Exodus 1:1',
                comment: '',
                shareOption: 'all',
                timeZone: 'UTC'
            })).rejects.toThrow('SIMULATED_FAILURE');

            const uSnap = await db.collection('users').doc(TEST_UID).get();
            expect(uSnap.data()?.totalNotes).toBe(0);

            const gSnap = await db.collection('groups').doc(GROUP_1).get();
            expect(gSnap.data()?.noteCount).toBe(0);

            spy.mockRestore();
        });
    });
});
