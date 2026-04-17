// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import app from '../api/api.js';
import { Server } from 'http';
import { auth, db, admin } from './lib/firebase-admin.js';
import { GroupDocument } from '../types/firestore.js';

/**
 * Infrastructure Integration Test
 * 
 * Validates that our test utilities (test-utils.ts) generate 
 * valid Firestore data structures that match our production schema.
 * This prevents bugs where tests pass because of shared logic flaws 
 * in the test setup itself.
 */
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Test Infrastructure Validation', () => {
    let server: Server;
    let baseUrl: string;
    const TEST_UID = 'infra-test-user-' + Date.now();

    beforeAll(async () => {
        process.env.SKIP_APP_CHECK = 'true';
        return new Promise<void>((resolve) => {
            server = app.listen(0, () => {
                const addr = server.address();
                if (addr && typeof addr !== 'string') {
                    baseUrl = `http://localhost:${addr.port}`;
                }
                resolve();
            });
        });
    });

    afterAll(async () => {
        await db.collection('users').doc(TEST_UID).delete();
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
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
        const setupResponse = await fetch(`${baseUrl}/api/test/setup-test-group`, {
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
        const rawData = groupSnap.data() as GroupDocument;

        // 3. Verify memberJoinedAt is a MAP/OBJECT, not flattened keys
        // If it was flattened, rawData would contain a key named "memberJoinedAt.uid"
        expect(typeof rawData.memberJoinedAt).toBe('object');
        expect(rawData.memberJoinedAt).not.toBeNull();
        
        // Check that there are NO keys containing dots at the root level
        const rootKeys = Object.keys(rawData);
        const flattenedKeys = rootKeys.filter(k => k.includes('.'));
        
        expect(flattenedKeys, `Found flattened keys in Firestore doc: ${flattenedKeys.join(', ')}`).toHaveLength(0);

        // 4. Verify specific membership data is accessible via nested paths
        expect(rawData.memberJoinedAt).toBeDefined();
        if (rawData.memberJoinedAt) {
            expect(rawData.memberJoinedAt[TEST_UID]).toBeDefined();
        }
        
        // Cleanup
        await db.collection('groups').doc(groupId).delete();
    });
});
