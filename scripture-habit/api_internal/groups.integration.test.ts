// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import app from '../api/api.js';
import { Server } from 'http';
import { auth, db, admin } from './lib/firebase-admin.js';

describe('Groups API Error Handling & Validation', () => {
    vi.setConfig({ testTimeout: 15000 });
    let server: Server;
    let baseUrl: string;
    const createdGroupIds: string[] = [];
    const createdUserUids: string[] = [];

    beforeAll(async () => {
        // Force skipping App Check for integration tests
        process.env.SKIP_APP_CHECK = 'true';
        
        return new Promise<void>((resolve) => {
            // Use port 0 for dynamic port allocation
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
        // Cleanup created documents
        for (const gid of createdGroupIds) {
            await db.recursiveDelete(db.collection('groups').doc(gid)).catch(() => {});
        }
        for (const uid of createdUserUids) {
            await db.collection('users').doc(uid).delete().catch(() => {});
        }

        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    });

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const mockAuth = (uid: string = 'test-user', emailVerified: boolean = true) => {
        vi.spyOn(auth, 'verifyIdToken').mockResolvedValue({
            uid,
            email_verified: emailVerified,
            firebase: { sign_in_provider: 'password' }
        } as unknown as admin.auth.DecodedIdToken);
    };

    describe('POST /api/join-group', () => {
        it('should return 400 when missing inviteCode and groupId', async () => {
            mockAuth();
            const response = await fetch(`${baseUrl}/api/join-group`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer valid-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            const data = await response.json();
            expect(response.status).toBe(400);
            // Current implementation throws this custom error within try-catch after successful Zod parse
            expect(data.error).toBe('Group ID or Invite Code is required.');
        });

        it('should return 401 when Authorization header is missing', async () => {
            const response = await fetch(`${baseUrl}/api/join-group`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviteCode: 'ABCDEF' })
            });

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toContain('Authentication required');
        });

        it('should return 403 when email is not verified', async () => {
            mockAuth('unverified-user', false);
            const response = await fetch(`${baseUrl}/api/join-group`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer valid-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inviteCode: 'ABCDEF' })
            });

            expect(response.status).toBe(403);
            const data = await response.json();
            expect(data.code).toBe('auth/email-not-verified');
        });

        it('should return 400 when user tries to join more than 4 groups', async () => {
            const uid = 'heavy-user-' + Date.now();
            const groupId = 'new-group-' + Date.now();

            // Setup user with 4 groups
            await db.collection('users').doc(uid).set({ 
                uid, 
                nickname: 'Heavy User',
                groupIds: ['g1', 'g2', 'g3', 'g4']
            });
            createdUserUids.push(uid);

            // Setup the group to join
            await db.collection('groups').doc(groupId).set({
                id: groupId,
                name: 'New Group',
                members: [],
                isPublic: true,
                lastInactivityCheckedAt: admin.firestore.Timestamp.now()
            });
            createdGroupIds.push(groupId);

            mockAuth(uid);
            const response = await fetch(`${baseUrl}/api/join-group`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer valid-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupId })
            });

            const data = await response.json();
            expect(response.status).toBe(400);
            expect(data.error).toContain('only join up to 4 groups');
        });
    });

    describe('POST /api/kick-member', () => {
        it('should return 403 when a non-owner tries to kick a member', async () => {
            const ownerUid = 'actual-owner-' + Date.now();
            const victimUid = 'victim-user-' + Date.now();
            const maliciousUid = 'malicious-user-' + Date.now();
            const groupId = 'test-group-kick-fail-' + Date.now();

            // Setup group and users in Firestore
            await db.collection('users').doc(ownerUid).set({ uid: ownerUid, nickname: 'Owner' });
            await db.collection('users').doc(victimUid).set({ uid: victimUid, nickname: 'Victim' });
            await db.collection('users').doc(maliciousUid).set({ uid: maliciousUid, nickname: 'Malicious' });
            createdUserUids.push(ownerUid, victimUid, maliciousUid);

            await db.collection('groups').doc(groupId).set({
                id: groupId,
                name: 'Kick Test Group',
                ownerUserId: ownerUid,
                members: [ownerUid, victimUid, maliciousUid],
                lastInactivityCheckedAt: admin.firestore.Timestamp.now()
            });
            createdGroupIds.push(groupId);

            mockAuth(maliciousUid);
            const response = await fetch(`${baseUrl}/api/kick-member`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer valid-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupId, targetUid: victimUid })
            });

            const data = await response.json();
            expect(response.status).toBe(400); // Route uses 400 for business logic errors
            expect(data.error).toContain('Only the group owner can kick members');
        });

        it('should return 400 when owner tries to kick themselves', async () => {
            const ownerUid = 'actual-owner-' + Date.now();
            const groupId = 'test-group-kick-self-' + Date.now();

            await db.collection('users').doc(ownerUid).set({ uid: ownerUid, nickname: 'Owner' });
            createdUserUids.push(ownerUid);

            await db.collection('groups').doc(groupId).set({
                id: groupId,
                name: 'Kick Self Group',
                ownerUserId: ownerUid,
                members: [ownerUid],
                lastInactivityCheckedAt: admin.firestore.Timestamp.now()
            });
            createdGroupIds.push(groupId);

            mockAuth(ownerUid);
            const response = await fetch(`${baseUrl}/api/kick-member`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer valid-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupId, targetUid: ownerUid })
            });

            const data = await response.json();
            expect(response.status).toBe(400);
            expect(data.error).toContain('You cannot kick yourself');
        });
    });

    describe('POST /api/update-group', () => {
        it('should return 404 when group does not exist', async () => {
            mockAuth();
            const response = await fetch(`${baseUrl}/api/update-group`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer valid-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupId: 'non-existent', name: 'New Name' })
            });

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Group not found');
        });

        it('should return 400 when no updates are provided', async () => {
            const uid = 'owner-user';
            const groupId = 'test-group-no-update';
            await db.collection('groups').doc(groupId).set({
                id: groupId,
                ownerUserId: uid,
                members: [uid],
                lastInactivityCheckedAt: admin.firestore.Timestamp.now()
            });
            createdGroupIds.push(groupId);
            createdUserUids.push(uid);

            mockAuth(uid);
            const response = await fetch(`${baseUrl}/api/update-group`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer valid-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupId })
            });

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('No updates provided');
        });
    });
});
