// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { db, admin } from '../lib/firebase-admin.js';
import { TestSetup } from '../test-setup.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Admin Route Integration', () => {
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

    const mockAdminAuth = (uid: string = 'test-admin', isAdmin: boolean = true) => {
        vi.spyOn(admin.auth(), 'verifyIdToken').mockResolvedValue({
            uid,
            admin: isAdmin,
            email_verified: true,
            firebase: { sign_in_provider: 'password' }
        } as unknown as admin.auth.DecodedIdToken);
    };

    it('should return 401 if no authorization header is provided', async () => {
        const res = await fetch(`${setup.baseUrl}/api/admin/migrate-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        expect(res.status).toBe(401);
        const text = await res.text();
        expect(text).toContain('Unauthorized: No token provided');
    });

    it('should return 401 if token verification throws an error', async () => {
        vi.spyOn(admin.auth(), 'verifyIdToken').mockRejectedValue(new Error('Invalid token signature'));

        const res = await fetch(`${setup.baseUrl}/api/admin/migrate-data`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer invalid-token'
            }
        });
        expect(res.status).toBe(401);
        const text = await res.text();
        expect(text).toContain('Unauthorized: Invalid token');
    });

    it('should return 403 if user has no admin privilege custom claim', async () => {
        mockAdminAuth('regular-user', false);

        const res = await fetch(`${setup.baseUrl}/api/admin/migrate-data`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token-regular'
            }
        });
        expect(res.status).toBe(403);
        const text = await res.text();
        expect(text).toContain('Forbidden: Admin privileges required');
    });

    it('should authorize using legacy ADMIN_SECRET if provided in env', async () => {
        const originalSecret = process.env.ADMIN_SECRET;
        process.env.ADMIN_SECRET = 'super-secret-key-123';

        const res = await fetch(`${setup.baseUrl}/api/admin/migrate-data`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer super-secret-key-123'
            }
        });
        // Returns 200 since it is authenticated, but migrations might run on empty collections.
        expect(res.status).toBe(200);

        if (originalSecret === undefined) {
            delete process.env.ADMIN_SECRET;
        } else {
            process.env.ADMIN_SECRET = originalSecret;
        }
    });

    it('should successfully run migrate-data and perform all migrations correctly', async () => {
        mockAdminAuth('test-admin-uid', true);

        // Seed data in Firestore
        const groupRef = db.collection('groups').doc('admin-mig-group');
        await groupRef.set({ name: 'Admin Migration Group' });

        // Seed a message in the group: isEntry = true, isNote = undefined
        const messageRef = groupRef.collection('messages').doc('mig-msg-1');
        await messageRef.set({
            text: 'Study note content',
            isEntry: true,
            createdAt: new Date()
        });

        // Seed a user: totalEntries = 5, totalNotes = undefined
        const userRef = db.collection('users').doc('admin-mig-user');
        await userRef.set({
            uid: 'admin-mig-user',
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

        // Perform request
        const res = await fetch(`${setup.baseUrl}/api/admin/migrate-data`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token-admin'
            }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toBe('Migration complete');
        expect(data.stats.messagesMigrated).toBeGreaterThanOrEqual(1);
        expect(data.stats.usersMigrated).toBeGreaterThanOrEqual(1);
        expect(data.stats.notesMigrated).toBeGreaterThanOrEqual(2);

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

    it('should return 500 if migration fails with unexpected error', async () => {
        mockAdminAuth('test-admin-uid', true);

        // Force db.collection to throw an error to simulate database failure
        const collectionSpy = vi.spyOn(db, 'collection').mockImplementation(() => {
            throw new Error('Database read failed');
        });

        const res = await fetch(`${setup.baseUrl}/api/admin/migrate-data`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token-admin'
            }
        });

        expect(res.status).toBe(500);
        const text = await res.text();
        expect(text).toContain('Migration failed: Database read failed');

        collectionSpy.mockRestore();
    });
});
