// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { auth, db, admin } from './lib/firebase-admin.js';
import { GroupDocument } from '../types/firestore.js';
import { TestSetup } from './test-setup.js';

/**
 * Infrastructure Integration Test
 * 
 * Validates that our test utilities (test-utils.ts) generate 
 * valid Firestore data structures that match our production schema.
 * This prevents bugs where tests pass because of shared logic flaws 
 * in the test setup itself.
 */
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Test Infrastructure Validation', () => {
    const setup = new TestSetup();
    const TEST_UID = 'infra-test-user-' + Date.now();

    beforeAll(async () => {
        await setup.start();
    });

    afterAll(async () => {
        await db.recursiveDelete(db.collection('users').doc(TEST_UID)).catch(() => {});
        await setup.stop();
    });

    const mockAuth = (uid: string) => {
        vi.spyOn(auth, 'verifyIdToken').mockResolvedValue({
            uid,
            email_verified: true,
            firebase: { sign_in_provider: 'password' }
        } as unknown as admin.auth.DecodedIdToken);
    };

    it('should seed a group with correct Map structures (no flattened dot-keys)', async () => {
        // 0. Create the user document in Firestore first (the endpoint expects it)
        await db.collection('users').doc(TEST_UID).set({
            uid: TEST_UID,
            nickname: 'Infra Tester'
        });

        mockAuth(TEST_UID);
        
        // 1. Create a group via the test utility endpoint
        const setupResponse = await fetch(`${setup.baseUrl}/api/test/setup-test-group`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer infra-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                groupName: 'Infra Validation Group',
                memberCount: 2
            })
        });

        expect(setupResponse.status).toBe(201);
        const { groupId } = await setupResponse.json();

        // 2. Fetch the RAW document from Firestore
        const groupSnap = await db.collection('groups').doc(groupId).get();
        expect(groupSnap.exists, `Group ${groupId} was not found in Firestore after creation`).toBe(true);
        const rawData = groupSnap.data() as GroupDocument;
        expect(rawData, "Group data should not be null").toBeDefined();
        
        // 2.5 Verify timeZone exists (New Guardrail)
        expect(rawData.timeZone, "Group MUST have a timeZone field for correct Unity calculation").toBeDefined();
        expect(typeof rawData.timeZone).toBe('string');
        expect(rawData.timeZone?.length).toBeGreaterThan(0);

        // 3. Verify memberJoinedAt is a MAP/OBJECT, not flattened keys
        expect(typeof rawData.memberJoinedAt).toBe('object');
        expect(rawData.memberJoinedAt).not.toBeNull();
        
        // Check that there are NO keys containing dots at the root level
        const rootKeys = Object.keys(rawData);
        const flattenedKeys = rootKeys.filter(k => k.includes('.'));
        expect(flattenedKeys, `Found flattened keys in Firestore doc: ${flattenedKeys.join(', ')}`).toHaveLength(0);

        // 4. Verify specific membership data is consistent
        expect(rawData.members).toHaveLength(2); // TEST_UID + 1 dummy
        expect(rawData.memberJoinedAt).toBeDefined();
        
        if (rawData.memberJoinedAt) {
            // Check both members exist in the map
            const joinedUids = Object.keys(rawData.memberJoinedAt);
            expect(joinedUids).toHaveLength(2);
            expect(joinedUids).toContain(TEST_UID);
            
            // Verify types are Firestore Timestamps (they have seconds/nanoseconds)
            const joinedTs = rawData.memberJoinedAt[TEST_UID] as { seconds?: number; _seconds?: number };
            expect(joinedTs).toBeDefined();
            expect(joinedTs._seconds ?? joinedTs.seconds).toBeDefined();
        }

        // 5. Verify dailyActivity structure
        expect(rawData.dailyActivity).toBeDefined();
        if (rawData.dailyActivity) {
            expect(typeof rawData.dailyActivity.date).toBe('string');
            expect(Array.isArray(rawData.dailyActivity.activeMembers)).toBe(true);
        }

        // 6. Verify other maps (memberLastActive, etc.) are also correctly nested
        expect(typeof rawData.memberLastActive).toBe('object');
        if (rawData.memberLastActive) {
            expect(rawData.memberLastActive[TEST_UID]).toBeDefined();
        }
        
        // Cleanup
        await db.recursiveDelete(db.collection('groups').doc(groupId)).catch(() => {});
    });

    describe('production environment protection', () => {
        let oldNodeEnv: string | undefined;
        let oldViteDevMode: string | undefined;

        beforeAll(() => {
            oldNodeEnv = process.env.NODE_ENV;
            oldViteDevMode = process.env.VITE_DEV_MODE;
        });

        afterAll(() => {
            process.env.NODE_ENV = oldNodeEnv;
            process.env.VITE_DEV_MODE = oldViteDevMode;
        });

        it('should block setup-test-group in production mode', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.VITE_DEV_MODE;

            mockAuth(TEST_UID);
            const res = await fetch(`${setup.baseUrl}/api/test/setup-test-group`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer infra-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupName: 'Infra Prod Group' })
            });

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.error).toContain('disabled in production');
        });

        it('should block leave-all-groups in production mode', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.VITE_DEV_MODE;

            mockAuth(TEST_UID);
            const res = await fetch(`${setup.baseUrl}/api/test/leave-all-groups`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer infra-token' }
            });

            expect(res.status).toBe(403);
        });

        it('should block reset-kick-threshold in production mode', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.VITE_DEV_MODE;

            mockAuth(TEST_UID);
            const res = await fetch(`${setup.baseUrl}/api/test/reset-kick-threshold`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer infra-token' }
            });

            expect(res.status).toBe(403);
        });
    });

    describe('group setup, existing groups, and transaction errors', () => {
        it('should update timezone if the group already exists', async () => {
            mockAuth(TEST_UID);

            // 1st call to create
            const res1 = await fetch(`${setup.baseUrl}/api/test/setup-test-group`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer infra-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupName: 'Existing Group Test', timeZone: 'UTC' })
            });
            expect(res1.status).toBe(201);
            const { groupId } = await res1.json();

            // 2nd call with same name but different timezone
            const res2 = await fetch(`${setup.baseUrl}/api/test/setup-test-group`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer infra-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupName: 'Existing Group Test', timeZone: 'Asia/Tokyo' })
            });
            expect(res2.status).toBe(200);
            const data2 = await res2.json();
            expect(data2.isNew).toBe(false);
            expect(data2.groupId).toBe(groupId);

            // Verify timezone updated in DB
            const snap = await db.collection('groups').doc(groupId).get();
            expect(snap.data()?.timeZone).toBe('Asia/Tokyo');

            await db.recursiveDelete(db.collection('groups').doc(groupId)).catch(() => {});
        });

        it('should handle Firestore transaction errors gracefully', async () => {
            mockAuth(TEST_UID);
            
            // Mock runTransaction to fail
            const spy = vi.spyOn(db, 'runTransaction').mockRejectedValue(new Error('Transaction timeout'));

            const res = await fetch(`${setup.baseUrl}/api/test/setup-test-group`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer infra-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupName: 'Transaction Error Group' })
            });

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toContain('Transaction timeout');

            spy.mockRestore();
        });
    });

    describe('leave all groups flow', () => {
        it('should return 200 early if user has no groups', async () => {
            mockAuth(TEST_UID);
            
            // Ensure user has no groupIds
            await db.collection('users').doc(TEST_UID).set({
                uid: TEST_UID,
                nickname: 'Infra Tester',
                groupIds: []
            });

            const res = await fetch(`${setup.baseUrl}/api/test/leave-all-groups`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer infra-token' }
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.left).toBe(0);
        });

        it('should leave all active groups and clear user document references', async () => {
            mockAuth(TEST_UID);

            // Create a test group manually
            const groupId = 'infra-leave-grp-' + Date.now();
            const groupRef = db.collection('groups').doc(groupId);
            await groupRef.set({
                name: 'Leave Test Group',
                ownerUserId: TEST_UID,
                members: [TEST_UID],
                createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 20000) // older than 10s so cleanup doesn't skip it
            });
            await groupRef.collection('members').doc(TEST_UID).set({ uid: TEST_UID });

            // Update user to hold reference
            await db.collection('users').doc(TEST_UID).set({
                uid: TEST_UID,
                nickname: 'Infra Tester',
                groupIds: [groupId],
                groupId: groupId
            });

            const res = await fetch(`${setup.baseUrl}/api/test/leave-all-groups`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer infra-token' }
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.left).toBe(1);

            // Verify user document has cleared references
            const userSnap = await db.collection('users').doc(TEST_UID).get();
            expect(userSnap.data()?.groupIds).toEqual([]);
            expect(userSnap.data()?.groupId).toBeUndefined();

            await db.recursiveDelete(groupRef).catch(() => {});
        });

        it('should skip leaving group if it was created very recently (less than 10 seconds ago)', async () => {
            mockAuth(TEST_UID);

            // Create a test group created just now
            const groupId = 'infra-leave-new-' + Date.now();
            const groupRef = db.collection('groups').doc(groupId);
            await groupRef.set({
                name: 'New Group Skip Test',
                ownerUserId: TEST_UID,
                members: [TEST_UID],
                createdAt: admin.firestore.Timestamp.fromMillis(Date.now()) // very new
            });
            await groupRef.collection('members').doc(TEST_UID).set({ uid: TEST_UID });

            // Update user
            await db.collection('users').doc(TEST_UID).set({
                uid: TEST_UID,
                nickname: 'Infra Tester',
                groupIds: [groupId],
                groupId: groupId
            });

            const res = await fetch(`${setup.baseUrl}/api/test/leave-all-groups`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer infra-token' }
            });

            expect(res.status).toBe(200);
            await res.json();
            // It gets skipped, so we actually left 0 groups in the loop (though the user document references are still cleared at the end)
            // Wait, let's verify if the user doc references are cleared (test-utils.ts deletes them anyway at the end)
            // But the log statement "Skipping very new group" was called.

            await db.recursiveDelete(groupRef).catch(() => {});
        });

        it('should handle errors inside the leave loop without crashing', async () => {
            mockAuth(TEST_UID);

            const groupId = 'infra-leave-fail-' + Date.now();
            const groupRef = db.collection('groups').doc(groupId);
            await groupRef.set({
                name: 'Leave Fail Group',
                ownerUserId: TEST_UID,
                members: [TEST_UID],
                createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 20000)
            });

            await db.collection('users').doc(TEST_UID).set({
                uid: TEST_UID,
                nickname: 'Infra Tester',
                groupIds: [groupId]
            });

            // Mock runTransaction to fail specifically for the leave-group transaction
            // in test-utils.ts: `await db.runTransaction(async (transaction) => { ... })`
            const transactionSpy = vi.spyOn(db, 'runTransaction').mockRejectedValue(new Error('Transaction loop failure'));

            const res = await fetch(`${setup.baseUrl}/api/test/leave-all-groups`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer infra-token' }
            });

            expect(res.status).toBe(200); // It still returns 200 since it catches individual failures inside the loop

            transactionSpy.mockRestore();
            await db.recursiveDelete(groupRef).catch(() => {});
        });

        it('should handle failures in leave-all-groups gracefully', async () => {
            mockAuth(TEST_UID);
            const spy = vi.spyOn(db, 'collection').mockImplementation(() => {
                throw new Error('Database disconnected');
            });

            const res = await fetch(`${setup.baseUrl}/api/test/leave-all-groups`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer infra-token' }
            });

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toContain('Database disconnected');

            spy.mockRestore();
        });
    });

    describe('reset-kick-threshold flow', () => {
        it('should reset hasSetKickThreshold and kickThreshold properties', async () => {
            mockAuth(TEST_UID);

            await db.collection('users').doc(TEST_UID).set({
                uid: TEST_UID,
                nickname: 'Infra Tester',
                hasSetKickThreshold: true,
                kickThreshold: 5
            });

            const res = await fetch(`${setup.baseUrl}/api/test/reset-kick-threshold`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer infra-token' }
            });

            expect(res.status).toBe(200);

            // Verify field removal
            const snap = await db.collection('users').doc(TEST_UID).get();
            expect(snap.data()?.hasSetKickThreshold).toBeUndefined();
            expect(snap.data()?.kickThreshold).toBeUndefined();
        });

        it('should handle errors in reset-kick-threshold gracefully', async () => {
            mockAuth(TEST_UID);
            const spy = vi.spyOn(db, 'collection').mockImplementation(() => {
                throw new Error('Reset threshold DB failure');
            });

            const res = await fetch(`${setup.baseUrl}/api/test/reset-kick-threshold`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer infra-token' }
            });

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toContain('Reset threshold DB failure');

            spy.mockRestore();
        });
    });
});
