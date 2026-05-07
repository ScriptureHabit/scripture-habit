// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import app from '../api/api.js';
import { Server } from 'http';
import { auth, db, admin } from './lib/firebase-admin.js';

describe('Group Creation Limit Enforcement', () => {
    vi.setConfig({ testTimeout: 15000 });
    let server: Server;
    let baseUrl: string;
    const createdGroupIds: string[] = [];
    const createdUserUids: string[] = [];

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

    it('should prevent group creation when user already has 4 groups', async () => {
        const uid = 'user-at-limit-' + Date.now();
        await db.collection('users').doc(uid).set({
            uid,
            nickname: 'User At Limit',
            groupIds: ['g1', 'g2', 'g3', 'g4']
        });
        createdUserUids.push(uid);

        mockAuth(uid);
        const response = await fetch(`${baseUrl}/api/create-group`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'Excess Group',
                description: 'This group should not be created',
                isPublic: true
            })
        });

        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('maximum limit of 4 groups');
        
        // Verify no new group was created in groupIds
        const userDoc = await db.collection('users').doc(uid).get();
        expect(userDoc.data()?.groupIds.length).toBe(4);
    });

    it('should allow group creation when user has fewer than 4 groups', async () => {
        const uid = 'user-can-create-' + Date.now();
        await db.collection('users').doc(uid).set({
            uid,
            nickname: 'Free User',
            groupIds: ['g1', 'g2']
        });
        createdUserUids.push(uid);

        mockAuth(uid);
        const response = await fetch(`${baseUrl}/api/create-group`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'New Valid Group',
                description: 'Success test',
                isPublic: true
            })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.groupId).toBeDefined();
        createdGroupIds.push(data.groupId);

        // Verify user's groupIds was updated
        const userDoc = await db.collection('users').doc(uid).get();
        expect(userDoc.data()?.groupIds).toContain(data.groupId);
        expect(userDoc.data()?.groupIds.length).toBe(3);

        // Verify group document fields
        const groupDoc = await db.collection('groups').doc(data.groupId).get();
        expect(groupDoc.exists).toBe(true);
        expect(groupDoc.data()?.groupStreak).toBe(0);
        expect(groupDoc.data()?.name).toBe('New Valid Group');
    });
});
