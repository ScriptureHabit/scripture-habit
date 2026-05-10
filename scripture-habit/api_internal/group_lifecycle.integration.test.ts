// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import app from '../api/api.js';
import { Server } from 'http';
import { auth, db, admin } from './lib/firebase-admin.js';

describe('Group Lifecycle (Create, Join, Leave, Delete)', () => {
    vi.setConfig({ testTimeout: 15000 });
    let server: Server;
    let baseUrl: string;
    const createdGroupIds: string[] = [];
    const createdUserUids: string[] = [];

    const ownerUid = 'lifecycle-owner-' + Date.now();
    const memberUid = 'lifecycle-member-' + Date.now();
    let targetGroupId: string;
    let targetInviteCode: string;

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

    const mockAuth = (uid: string, emailVerified: boolean = true) => {
        vi.spyOn(auth, 'verifyIdToken').mockResolvedValue({
            uid,
            email_verified: emailVerified,
            firebase: { sign_in_provider: 'password' }
        } as unknown as admin.auth.DecodedIdToken);
    };

    it('0. Setup users', async () => {
        await db.collection('users').doc(ownerUid).set({
            uid: ownerUid,
            nickname: 'Owner User',
            groupIds: []
        });
        await db.collection('users').doc(memberUid).set({
            uid: memberUid,
            nickname: 'Member User',
            groupIds: []
        });
        createdUserUids.push(ownerUid, memberUid);
    });

    it('1. Owner creates a new group', async () => {
        mockAuth(ownerUid);
        const response = await fetch(`${baseUrl}/api/groups/create-group`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'Lifecycle Test Group',
                description: 'Testing the full group lifecycle',
                isPublic: true
            })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.groupId).toBeDefined();
        
        targetGroupId = data.groupId;
        createdGroupIds.push(targetGroupId);

        // Verify group exists in Firestore
        const groupDoc = await db.collection('groups').doc(targetGroupId).get();
        expect(groupDoc.exists).toBe(true);
        const groupData = groupDoc.data();
        expect(groupData?.name).toBe('Lifecycle Test Group');
        expect(groupData?.ownerUserId).toBe(ownerUid);
        expect(groupData?.members).toContain(ownerUid);

        targetInviteCode = groupData?.inviteCode;
        expect(targetInviteCode).toBeDefined();

        // Verify owner has the group in their groupIds
        const ownerDoc = await db.collection('users').doc(ownerUid).get();
        expect(ownerDoc.data()?.groupIds).toContain(targetGroupId);
    });

    it('2. Member joins the group', async () => {
        mockAuth(memberUid);
        const response = await fetch(`${baseUrl}/api/groups/join-group`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inviteCode: targetInviteCode
            })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.gid).toBe(targetGroupId);

        // Verify member was added to the group in Firestore
        const groupDoc = await db.collection('groups').doc(targetGroupId).get();
        expect(groupDoc.data()?.members).toContain(memberUid);

        // Verify member has the group in their groupIds
        const memberDoc = await db.collection('users').doc(memberUid).get();
        expect(memberDoc.data()?.groupIds).toContain(targetGroupId);
    });

    it('3. Member leaves the group', async () => {
        mockAuth(memberUid);
        const response = await fetch(`${baseUrl}/api/groups/leave-group`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                groupId: targetGroupId
            })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify member is removed from the group
        const groupDoc = await db.collection('groups').doc(targetGroupId).get();
        expect(groupDoc.data()?.members).not.toContain(memberUid);

        // Verify member no longer has the group in their groupIds
        const memberDoc = await db.collection('users').doc(memberUid).get();
        expect(memberDoc.data()?.groupIds).not.toContain(targetGroupId);
    });

    it('4. Owner deletes the group', async () => {
        mockAuth(ownerUid);
        const response = await fetch(`${baseUrl}/api/groups/delete-group`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                groupId: targetGroupId
            })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify group is actually deleted from Firestore
        const groupDoc = await db.collection('groups').doc(targetGroupId).get();
        expect(groupDoc.exists).toBe(false);

        // Verify owner no longer has the group in their groupIds
        const ownerDoc = await db.collection('users').doc(ownerUid).get();
        expect(ownerDoc.data()?.groupIds).not.toContain(targetGroupId);
    });

    it('5. Verify deleting a non-existent group returns 404 with JSON', async () => {
        // The group was already deleted in step 4
        mockAuth(ownerUid);
        const response = await fetch(`${baseUrl}/api/groups/delete-group`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                groupId: targetGroupId
            })
        });

        const data = await response.json();
        // It should return 404 Not Found since the group no longer exists
        expect(response.status).toBe(404);
        // It must return a JSON object with { error: "Group not found" }
        expect(data.error).toBe('Group not found');
    });
});
