// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { db } from '../api_internal/lib/firebase-admin.js';
import { TestSetup } from '../api_internal/test-setup.js';
import { runMigration } from './migrate-data.ts';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('CLI Migration Script Integration', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();

    beforeAll(async () => {
        await setup.start();
    });

    afterAll(async () => {
        await setup.stop();
    });

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should successfully run migrate-data and perform all migrations correctly', async () => {
        // Seed data in Firestore
        const groupRef = db.collection('groups').doc('cli-mig-group');
        await groupRef.set({ name: 'CLI Migration Group' });

        // Seed a message in the group: isEntry = true, isNote = undefined
        const messageRef = groupRef.collection('messages').doc('mig-msg-1');
        await messageRef.set({
            text: 'Study note content',
            isEntry: true,
            createdAt: new Date()
        });

        // Seed a user: totalEntries = 5, totalNotes = undefined
        const userRef = db.collection('users').doc('cli-mig-user');
        await userRef.set({
            uid: 'cli-mig-user',
            totalEntries: 5
        });

        // Seed user's note: scripture has wrong category, missing searchTokens
        const noteRef = userRef.collection('notes').doc('mig-note-1');
        await noteRef.set({
            scripture: 'Doctrine & Covenants', // should map to 'Other' or be re-normalized if valid
            chapter: '84',
            comment: 'A comment here',
            title: 'Amazing title',
            speaker: 'Speaker',
            createdAt: new Date()
        });

        // Seed another user note to test valid category mapping
        const noteRef2 = userRef.collection('notes').doc('mig-note-2');
        await noteRef2.set({
            scripture: 'Old Testament', // standard category
            chapter: 'Genesis 1',
            comment: 'Faith comment',
            searchTokens: [] // empty tokens
        });

        // Perform migration
        const stats = await runMigration();

        expect(stats.messagesMigrated).toBeGreaterThanOrEqual(1);
        expect(stats.usersMigrated).toBeGreaterThanOrEqual(1);
        expect(stats.notesMigrated).toBeGreaterThanOrEqual(2);

        // Verify updated documents
        const updatedMsg = await messageRef.get();
        expect(updatedMsg.data()?.isNote).toBe(true);

        const updatedUser = await userRef.get();
        expect(updatedUser.data()?.totalNotes).toBe(5);

        const updatedNote1 = await noteRef.get();
        expect(updatedNote1.data()?.scripture).toBe('Other');
        expect(updatedNote1.data()?.searchTokens).toContain('other');
        expect(updatedNote1.data()?.searchTokens).toContain('84');

        const updatedNote2 = await noteRef2.get();
        expect(updatedNote2.data()?.scripture).toBe('Old Testament');
        expect(updatedNote2.data()?.searchTokens).toContain('old');
        expect(updatedNote2.data()?.searchTokens).toContain('testament');
    });

    it('should throw error if migration fails with unexpected error', async () => {
        // Force db.collection to throw an error to simulate database failure
        const collectionSpy = vi.spyOn(db, 'collection').mockImplementation(() => {
            throw new Error('Database read failed');
        });

        await expect(runMigration()).rejects.toThrow('Database read failed');

        collectionSpy.mockRestore();
    });
});
