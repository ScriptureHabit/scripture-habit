// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from './lib/firebase-admin.js';
import { TestSetup } from './test-setup.js';

describe('Habit Pace Update Persistence', () => {
    vi.setConfig({ testTimeout: 30000 });
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
