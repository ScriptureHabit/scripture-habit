// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { admin, db } from '../lib/firebase-admin.js';
import { NoteService } from './note-service.js';
import { GroupDocument, UserDocument } from '../../types/firestore.js';
import { StreakEngine } from '../lib/streak-engine.js';
import { formatDateInTimeZone } from '../../src/utils/time-utils.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('NoteService Integration Tests', () => {
    const TEST_UID = `note_srv_test_user_${Math.random().toString(36).substring(7)}`;
    const GROUP_1 = `note_srv_test_grp1_${Math.random().toString(36).substring(7)}`;
    const GROUP_2 = `note_srv_test_grp2_${Math.random().toString(36).substring(7)}`;
    const MULTI_GROUPS = [
        `note_srv_multi1_${Math.random().toString(36).substring(7)}`,
        `note_srv_multi2_${Math.random().toString(36).substring(7)}`,
        `note_srv_multi3_${Math.random().toString(36).substring(7)}`
    ];

    beforeEach(async () => {
        // Clean up any existing notes/messages for these IDs to ensure total isolation
        await db.recursiveDelete(db.collection('users').doc(TEST_UID).collection('notes')).catch(() => {});
        for (const gid of [GROUP_1, GROUP_2, ...MULTI_GROUPS]) {
            await db.recursiveDelete(db.collection('groups').doc(gid).collection('messages')).catch(() => {});
        }

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
                name: gid === GROUP_1 ? 'Unity Test Group 1' : `Test Group ${gid}`,
                members: [TEST_UID, 'other-user'],
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
            if (res1.backgroundPromise) await res1.backgroundPromise;

            const res2 = await NoteService.postNote({
                uid: TEST_UID,
                messageText: 'Second Note',
                scripture: 'Genesis 1:2',
                comment: 'Note 2',
                shareOption: 'all',
                language: 'ja',
                timeZone: 'UTC'
            });
            if (res2.backgroundPromise) await res2.backgroundPromise;

            const uSnap = await db.collection('users').doc(TEST_UID).get();
            expect(uSnap.data()?.totalNotes).toBe(2);

            await NoteService.deleteNote(TEST_UID, res2.personalNoteId);

            const gSnapAfter = await db.collection('groups').doc(GROUP_1).get();
            expect(gSnapAfter.data()?.lastNoteByNickname).toBe('Note Tester');

            await NoteService.deleteNote(TEST_UID, res1.personalNoteId);

            const gSnapFinal = await db.collection('groups').doc(GROUP_1).get();
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
            if (result.backgroundPromise) await result.backgroundPromise;

            expect(result.personalNoteId).toBeDefined();

            for (const gid of MULTI_GROUPS) {
                
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

            const r1 = await NoteService.postNote({
                uid: TEST_UID,
                messageText: 'Note 1',
                scripture: 'John 1:1',
                comment: '',
                shareOption: 'none',
                timeZone: 'UTC'
            });
            if (r1.backgroundPromise) await r1.backgroundPromise;

            const r2 = await NoteService.postNote({
                uid: TEST_UID,
                messageText: 'Note 2',
                scripture: 'John 1:2',
                comment: '',
                shareOption: 'none',
                timeZone: 'UTC'
            });
            if (r2.backgroundPromise) await r2.backgroundPromise;

            const uSnap = await db.collection('users').doc(TEST_UID).get();
            const userData = uSnap.data() as UserDocument;
            expect(userData.studiedDates).toContain(todayStr);
            expect(userData.studiedDates?.length).toBe(1);

            // Verify no announcements or messages were sent to groups
            for (const gid of [GROUP_1, GROUP_2, ...MULTI_GROUPS]) {
                const msgListSnap = await db.collection('groups').doc(gid).collection('messages').get();
                expect(msgListSnap.empty).toBe(true);
            }
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

            spy.mockRestore();
        });

        it('should handle non-existent group or message during deleteNote (covering line 372-373)', async () => {
            const res = await NoteService.postNote({
                uid: TEST_UID,
                messageText: 'Note with missing msg',
                scripture: 'Genesis 1:1',
                comment: 'To be orphaned',
                shareOption: 'all',
                timeZone: 'UTC'
            });
            if (res.backgroundPromise) await res.backgroundPromise;

            // Manually delete the shared message from GROUP_1 to make mSnap.exists false
            const msgId = res.sharedMessageIds?.[GROUP_1];
            expect(msgId).toBeDefined();
            await db.collection('groups').doc(GROUP_1).collection('messages').doc(msgId!).delete();

            // Now call deleteNote - it should continue and succeed
            const deleteResult = await NoteService.deleteNote(TEST_UID, res.personalNoteId);
            expect(deleteResult.success).toBe(true);

            // Note doc should be deleted
            const noteSnap = await db.collection('users').doc(TEST_UID).collection('notes').doc(res.personalNoteId).get();
            expect(noteSnap.exists).toBe(false);
        });

        it('should log and throw error when deleteNote transaction fails (covering line 476-477)', async () => {
            const { vi } = await import('vitest');
            const deleteSpy = vi.spyOn(admin.firestore.Transaction.prototype, 'delete').mockImplementationOnce(() => {
                throw new Error('SIMULATED_DELETE_FAILURE');
            });
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const res = await NoteService.postNote({
                uid: TEST_UID,
                messageText: 'To Delete',
                scripture: 'Genesis 1:1',
                comment: '',
                shareOption: 'none',
                timeZone: 'UTC'
            });
            if (res.backgroundPromise) await res.backgroundPromise;

            await expect(NoteService.deleteNote(TEST_UID, res.personalNoteId)).rejects.toThrow('SIMULATED_DELETE_FAILURE');
            expect(consoleErrorSpy).toHaveBeenCalled();

            deleteSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        it('should recover from future date / clock drift in group dailyActivity (covering lines 188 and 199)', async () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            // Manually set a group's daily activity date to a future date
            await db.collection('groups').doc(GROUP_2).update({
                dailyActivity: {
                    date: '2035-12-31',
                    activeMembers: ['some-user']
                }
            });

            // Post a note - it should reset the future date to today's date
            const res = await NoteService.postNote({
                uid: TEST_UID,
                messageText: 'Note checking clock drift',
                scripture: 'Genesis 1:1',
                comment: 'Recover',
                shareOption: 'specific',
                selectedShareGroups: [GROUP_2],
                timeZone: 'UTC'
            });
            if (res.backgroundPromise) await res.backgroundPromise;

            expect(res.personalNoteId).toBeDefined();
            expect(consoleWarnSpy).toHaveBeenCalled();

            const gSnap = await db.collection('groups').doc(GROUP_2).get();
            const groupData = gSnap.data()!;
            
            // The daily activity date should have been reset from the future date
            expect(groupData.dailyActivity?.date).not.toBe('2035-12-31');
            expect(groupData.dailyActivity?.activeMembers).toEqual([TEST_UID]);

            consoleWarnSpy.mockRestore();
        });

        it('should handle legacy fields, raw lastPostAt formats, and daily activity date progression (covering remaining branches)', async () => {
            // 1. Set legacy streak and string-based lastPostAt on user
            await db.collection('users').doc(TEST_UID).update({
                streak: 5,
                lastPostAt: '2026-05-18T12:00:00Z' // triggers the string/Date-based raw format parse (line 86)
            });

            // Set an old daily activity date on GROUP_2 to trigger dailyActivity reset (today > stored)
            await db.collection('groups').doc(GROUP_2).update({
                dailyActivity: {
                    date: '2020-01-01',
                    activeMembers: ['some-user']
                }
            });

            // Post first note
            const res1 = await NoteService.postNote({
                uid: TEST_UID,
                messageText: 'Note with string date',
                scripture: 'Genesis 1:1',
                comment: 'Legacy check 1',
                shareOption: 'specific',
                selectedShareGroups: [GROUP_2],
                timeZone: 'UTC'
            });
            if (res1.backgroundPromise) await res1.backgroundPromise;

            expect(res1.personalNoteId).toBeDefined();

            // Verify legacy streak field is deleted
            const uSnap1 = await db.collection('users').doc(TEST_UID).get();
            expect(uSnap1.data()?.streak).toBeUndefined();

            // 2. Set seconds-based lastPostAt on user to test line 84
            await db.collection('users').doc(TEST_UID).update({
                lastPostAt: { seconds: 1779836400 } as any // triggers the seconds-based raw format parse (line 84)
            });

            // Post second note
            const res2 = await NoteService.postNote({
                uid: TEST_UID,
                messageText: 'Note with seconds date',
                scripture: 'Genesis 1:2',
                comment: 'Legacy check 2',
                shareOption: 'specific',
                selectedShareGroups: [GROUP_2],
                timeZone: 'UTC'
            });
            if (res2.backgroundPromise) await res2.backgroundPromise;

            expect(res2.personalNoteId).toBeDefined();

            // Verify dailyActivity is reset to today
            const gSnap = await db.collection('groups').doc(GROUP_2).get();
            expect(gSnap.data()?.dailyActivity?.date).not.toBe('2020-01-01');
            expect(gSnap.data()?.dailyActivity?.activeMembers).toEqual([TEST_UID]);
        });
    });
});
