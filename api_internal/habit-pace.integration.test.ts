// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from './lib/firebase-admin.js';
import { TestSetup } from './test-setup.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Habit Pace Update Persistence', () => {
    vi.setConfig({ testTimeout: 60000 });
    const setup = new TestSetup();
    const TEST_UID = 'habit-user-' + Date.now();
    const TEST_GID = 'habit-group-' + Date.now();

    beforeAll(async () => {
        await setup.start();
    });

    afterAll(async () => {
        if (db) {
            await db.collection('users').doc(TEST_UID).delete().catch(() => {});
            await db.collection('groups').doc(TEST_GID).delete().catch(() => {});
        }
        await setup.stop();
    });

    describe('Happy Path', () => {
        it('should successfully update kick threshold even if field was missing on group', async () => {
            // 1. Setup user
            await db.collection('users').doc(TEST_UID).set({
                uid: TEST_UID,
                nickname: 'Habit Tester',
                groupIds: [TEST_GID]
            });

            // 2. Setup group WITHOUT memberKickThresholds (simulating old data)
            await db.collection('groups').doc(TEST_GID).set({
                id: TEST_GID,
                name: 'Old Group',
                members: [TEST_UID],
            });

            setup.mockAuth(TEST_UID);

            // 3. Try to update kick threshold
            const res = await fetch(`${setup.baseUrl}/api/groups/update-kick-threshold`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ threshold: 7 })
            });

            const data = await res.json();
            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            
            // 4. Verify updates across all documents
            const userSnap = await db.collection('users').doc(TEST_UID).get();
            expect(userSnap.data()?.kickThreshold).toBe(7);
            expect(userSnap.data()?.hasSetKickThreshold).toBe(true);

            const groupSnap = await db.collection('groups').doc(TEST_GID).get();
            expect(groupSnap.data()?.memberKickThresholds?.[TEST_UID]).toBe(7);
            
            const memberSubSnap = await db.collection('groups').doc(TEST_GID).collection('members').doc(TEST_UID).get();
            expect(memberSubSnap.data()?.kickThreshold).toBe(7);
        });
    });

    describe('Error Cases', () => {
        it('should return 401 when called without authentication', async () => {
            const res = await fetch(`${setup.baseUrl}/api/groups/update-kick-threshold`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threshold: 7 })
            });
            expect(res.status).toBe(401);
        });

        it('should return 403 when email is not verified', async () => {
            setup.mockAuth(TEST_UID, false); // email NOT verified
            const res = await fetch(`${setup.baseUrl}/api/groups/update-kick-threshold`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ threshold: 7 })
            });
            expect(res.status).toBe(403);
        });

        it('should return 400 when threshold is missing from request body', async () => {
            setup.mockAuth(TEST_UID);
            const res = await fetch(`${setup.baseUrl}/api/groups/update-kick-threshold`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({}) // Missing threshold
            });
            expect(res.status).toBe(400);
        });

        it('should return 400 when threshold is not a number', async () => {
            setup.mockAuth(TEST_UID);
            const res = await fetch(`${setup.baseUrl}/api/groups/update-kick-threshold`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ threshold: 'invalid' })
            });
            expect(res.status).toBe(400);
        });
    });
});
