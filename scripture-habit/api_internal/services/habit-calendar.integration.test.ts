// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/firebase-admin.js';
import { NoteService } from './note-service.js';
import { UserDocument } from '../../types/firestore.js';
import { formatDateInTimeZone } from '../../src/utils/time-utils.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Habit Calendar Integration Test', () => {
    const TEST_UID = 'calendar-test-user';

    beforeEach(async () => {
        // Reset user data
        await db.collection('users').doc(TEST_UID).set({
            uid: TEST_UID,
            nickname: 'Calendar Tester',
            totalNotes: 0,
            streakCount: 0,
            daysStudiedCount: 0,
            lastPostDate: null,
            studiedDates: []
        } as UserDocument);
    }, 20000);

    it('should add current date to studiedDates when a note is posted', async () => {
        const now = new Date();
        const todayStr = formatDateInTimeZone(now, 'UTC');

        // 1. Post first note
        await NoteService.postNote({
            uid: TEST_UID,
            messageText: 'Testing calendar 1',
            scripture: 'Genesis 1:1',
            comment: 'Note 1',
            shareOption: 'none',
            timeZone: 'UTC'
        });

        // 2. Verify studiedDates has today
        const uSnap = await db.collection('users').doc(TEST_UID).get();
        const userData = uSnap.data() as UserDocument;
        
        expect(userData.studiedDates).toBeDefined();
        expect(userData.studiedDates).toContain(todayStr);
        expect(userData.studiedDates?.length).toBe(1);
    }, 20000);

    it('should not add duplicate dates to studiedDates on the same day', async () => {
        const now = new Date();
        const todayStr = formatDateInTimeZone(now, 'UTC');

        // 1. Post multiple notes on the same day
        await NoteService.postNote({
            uid: TEST_UID,
            messageText: 'Note 1',
            scripture: 'Genesis 1:1',
            comment: 'Note 1',
            shareOption: 'none',
            timeZone: 'UTC'
        });

        await NoteService.postNote({
            uid: TEST_UID,
            messageText: 'Note 2',
            scripture: 'Genesis 1:2',
            comment: 'Note 2',
            shareOption: 'none',
            timeZone: 'UTC'
        });

        // 2. Verify studiedDates still only has one entry for today
        const uSnap = await db.collection('users').doc(TEST_UID).get();
        const userData = uSnap.data() as UserDocument;
        
        expect(userData.studiedDates).toContain(todayStr);
        expect(userData.studiedDates?.length).toBe(1);
    }, 20000);
});
