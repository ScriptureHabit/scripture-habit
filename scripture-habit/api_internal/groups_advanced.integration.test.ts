// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import app from '../api/api.js';
import { Server } from 'http';
import { auth, db, admin } from './lib/firebase-admin.js';

describe('Advanced Groups API Tests (Data Integrity & Concurrency)', () => {
    vi.setConfig({ testTimeout: 60000 });
    let server: Server;
    let baseUrl: string;
    const createdGroupIds: string[] = [];
    const createdUserUids: string[] = [];

    beforeAll(async () => {
        console.log('[Test] Starting beforeAll...');
        process.env.SKIP_APP_CHECK = 'true';
        await new Promise<void>((resolve) => {
            server = app.listen(0, () => {
                const addr = server.address();
                if (addr && typeof addr !== 'string') {
                    baseUrl = `http://localhost:${addr.port}`;
                    console.log(`[Test] Server listening on ${baseUrl}`);
                }
                resolve();
            });
        });

        // Warmup: ensure server is responsive and Firestore is connected
        try {
            console.log('[Test] Performing warmup fetch...');
            await fetch(`${baseUrl}/api/health`);
            console.log('[Test] Warmup complete.');
        } catch (e) {
            console.error('[Test] Warmup failed:', e);
        }
    });

    afterAll(async () => {
        // Cleanup all created groups and users
        for (const gid of createdGroupIds) {
            await db.recursiveDelete(db.collection('groups').doc(gid)).catch(() => {});
        }
        for (const uid of createdUserUids) {
            await db.collection('users').doc(uid).delete().catch(() => {});
        }
        
        return new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });
    });

    beforeEach(async () => {
        vi.restoreAllMocks();
    });

    const mockAuth = (uid: string, emailVerified: boolean = true) => {
        vi.spyOn(auth, 'verifyIdToken').mockResolvedValue({
            uid,
            email_verified: emailVerified,
            firebase: { sign_in_provider: 'password' }
        } as unknown as admin.auth.DecodedIdToken);
    };

    describe('Data Integrity & Side Effects', () => {
        it('should verify all side effects after a successful join', async () => {
            const ownerUid = 'owner-' + Date.now();
            const joinerUid = 'joiner-' + Date.now();
            const groupId = 'integrity-group-' + Date.now();

            // 1. Setup
            await db.collection('users').doc(ownerUid).set({ uid: ownerUid, nickname: 'Owner', groupIds: [groupId] });
            await db.collection('users').doc(joinerUid).set({ uid: joinerUid, nickname: 'Joiner', groupIds: [] });
            createdUserUids.push(ownerUid, joinerUid);

            await db.collection('groups').doc(groupId).set({
                id: groupId,
                name: 'Integrity Test Group',
                ownerUserId: ownerUid,
                members: [ownerUid],
                membersCount: 1,
                memberPreviews: [{ uid: ownerUid, nickname: 'Owner' }],
                isPublic: true,
                messageCount: 5, // Simulated existing messages
                lastInactivityCheckedAt: admin.firestore.Timestamp.now()
            });
            // Ensure CounterService sees the messages by creating a shard
            await db.collection('groups').doc(groupId).collection('shards').doc('0').set({
                messageCount: 5
            });
            createdGroupIds.push(groupId);

            // 2. Action
            mockAuth(joinerUid);
            const response = await fetch(`${baseUrl}/api/groups/join-group`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer valid-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupId })
            });

            expect(response.status).toBe(200);

            // 3. Verification of Side Effects
            const [groupSnap, joinerSnap, memberSnap, groupStateSnap, messagesSnap] = await Promise.all([
                db.collection('groups').doc(groupId).get(),
                db.collection('users').doc(joinerUid).get(),
                db.collection('groups').doc(groupId).collection('members').doc(joinerUid).get(),
                db.collection('users').doc(joinerUid).collection('groupStates').doc(groupId).get(),
                db.collection('groups').doc(groupId).collection('messages').where('type', '==', 'join').get()
            ]);

            const gData = groupSnap.data();
            expect(gData?.membersCount).toBe(2);
            expect(gData?.members).toContain(joinerUid);
            expect(gData?.memberPreviews).toHaveLength(2);
            expect(gData?.memberPreviews[0].uid).toBe(joinerUid); // Newest should be first based on code

            const uData = joinerSnap.data();
            expect(uData?.groupIds).toContain(groupId);

            expect(memberSnap.exists).toBe(true);
            expect(memberSnap.data()?.nickname).toBe('Joiner');
            expect(memberSnap.data()?.readMessageCount).toBe(5); // Should match current messageCount

            expect(groupStateSnap.exists).toBe(true);
            expect(groupStateSnap.data()?.readMessageCount).toBe(5);

            expect(messagesSnap.empty).toBe(false);
            expect(messagesSnap.docs[0].data().text).toContain('Joiner');
        });
    });

    describe('Invite Code Expiry', () => {
        it('should fail when joining with an expired invite code', async () => {
            const uid = 'expiry-user-' + Date.now();
            const groupId = 'expired-group-' + Date.now();
            const inviteCode = 'EXPIRED';

            await db.collection('users').doc(uid).set({ uid, nickname: 'Expiry User' });
            createdUserUids.push(uid);

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await db.collection('groups').doc(groupId).set({
                id: groupId,
                name: 'Expired Group',
                inviteCode,
                inviteCodeExpiresAt: admin.firestore.Timestamp.fromDate(yesterday),
                isPublic: false,
                isPrivate: true,
                members: ['some-owner'],
                lastInactivityCheckedAt: admin.firestore.Timestamp.now()
            });
            createdGroupIds.push(groupId);

            mockAuth(uid);
            const response = await fetch(`${baseUrl}/api/groups/join-group`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer valid-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inviteCode })
            });

            const data = await response.json();
            expect(response.status).toBe(400);
            expect(data.error).toContain('expired');
        });
    });

    describe('Concurrency (Race Conditions)', () => {
        it('should handle multiple users joining a limited group simultaneously', async () => {
            const groupId = 'race-group-' + Date.now();
            const maxMembers = 2; // 1 owner + 1 slot

            // 1. Setup group with 1 slot left
            await db.collection('groups').doc(groupId).set({
                id: groupId,
                name: 'Race Group',
                members: ['owner'],
                membersCount: 1,
                maxMembers: maxMembers,
                isPublic: true,
                lastInactivityCheckedAt: admin.firestore.Timestamp.now()
            });
            createdGroupIds.push(groupId);

            // 2. Prepare 3 users trying to join at once
            const joiners = [1, 2, 3].map(i => ({
                uid: `race-joiner-${i}-${Date.now()}`,
                nickname: `Joiner ${i}`
            }));

            for (const j of joiners) {
                await db.collection('users').doc(j.uid).set({ uid: j.uid, nickname: j.nickname });
                createdUserUids.push(j.uid);
            }

            // 3. Re-mock auth to handle multiple tokens BEFORE firing requests
            vi.spyOn(auth, 'verifyIdToken').mockImplementation(async (token) => {
                const uid = token.replace('token-', '');
                return {
                    uid,
                    email_verified: true,
                    firebase: { sign_in_provider: 'password' }
                } as unknown as admin.auth.DecodedIdToken;
            });

            // 4. Execute simultaneous requests
            const requests = joiners.map(j => {
                return fetch(`${baseUrl}/api/groups/join-group`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer token-${j.uid}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ groupId })
                });
            });

            const responses = await Promise.all(requests);
            const statuses = responses.map(r => r.status);
            
            // Only 1 should succeed (status 200), others should fail (status 400)
            const successCount = statuses.filter(s => s === 200).length;
            const failCount = statuses.filter(s => s === 400).length;

            expect(successCount).toBe(1);
            expect(failCount).toBe(2);

            // Verify final count in DB
            const finalGroupSnap = await db.collection('groups').doc(groupId).get();
            expect(finalGroupSnap.data()?.membersCount).toBe(2);
            expect(finalGroupSnap.data()?.members).toHaveLength(2);
        });
    });

    describe('Ownership Transfer', () => {
        it('should transfer ownership when the owner leaves', async () => {
            const ownerUid = 'owner-leaving-' + Date.now();
            const memberUid = 'member-staying-' + Date.now();
            const groupId = 'transfer-group-' + Date.now();

            await db.collection('users').doc(ownerUid).set({ uid: ownerUid, nickname: 'Old Owner', groupIds: [groupId] });
            await db.collection('users').doc(memberUid).set({ uid: memberUid, nickname: 'New Owner Candidate', groupIds: [groupId] });
            createdUserUids.push(ownerUid, memberUid);

            await db.collection('groups').doc(groupId).set({
                id: groupId,
                name: 'Transfer Group',
                ownerUserId: ownerUid,
                members: [ownerUid, memberUid],
                membersCount: 2,
                lastInactivityCheckedAt: admin.firestore.Timestamp.now()
            });
            createdGroupIds.push(groupId);

            // Action: Owner leaves
            mockAuth(ownerUid);
            const response = await fetch(`${baseUrl}/api/groups/leave-group`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer valid-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupId })
            });

            expect(response.status).toBe(200);

            // Verification
            const groupSnap = await db.collection('groups').doc(groupId).get();
            expect(groupSnap.data()?.ownerUserId).toBe(memberUid);
            expect(groupSnap.data()?.members).not.toContain(ownerUid);
            expect(groupSnap.data()?.membersCount).toBe(1);
        });
    });

    describe('Counter Integrity & Recovery', () => {
        it('should recover from corrupted counter values using Supreme Truth recount', async () => {
            const uid = 'counter-user-' + Date.now();
            const groupId = 'counter-group-' + Date.now();

            // 1. Setup: Create group with 3 messages but CORRUPT shards to say 100
            await db.collection('users').doc(uid).set({ uid, nickname: 'CounterTester', groupIds: [groupId] });
            createdUserUids.push(uid);

            await db.collection('groups').doc(groupId).set({
                id: groupId,
                name: 'Counter Recovery Test',
                ownerUserId: uid,
                members: [uid],
                membersCount: 1,
                messageCount: 100, // Corrupted value
                lastInactivityCheckedAt: admin.firestore.Timestamp.now()
            });
            createdGroupIds.push(groupId);

            // Create 3 real messages
            for (let i = 0; i < 3; i++) {
                await db.collection('groups').doc(groupId).collection('messages').add({
                    text: `Msg ${i}`,
                    senderId: uid,
                    createdAt: admin.firestore.Timestamp.now()
                });
            }

            // Corrupt shards manually
            await db.collection('groups').doc(groupId).collection('shards').doc('0').set({
                messageCount: 100
            });

            // 2. Action: Call update-read-status which triggers recountMessageCountWithArchive
            mockAuth(uid);
            const response = await fetch(`${baseUrl}/api/groups/update-read-status`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer valid-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupId, readMessageCount: 0 })
            });

            expect(response.status).toBe(200);

            // 3. Verification: The messageCount should have been recovered to 3 (not 100, and not 103)
            const groupSnap = await db.collection('groups').doc(groupId).get();
            const shardSnap = await db.collection('groups').doc(groupId).collection('shards').doc('0').get();
            const memberSnap = await db.collection('groups').doc(groupId).collection('members').doc(uid).get();

            // The API uses recountMessageCountWithArchive which counts actual docs
            // Total should be 3 messages + 0 archived = 3
            expect(groupSnap.data()?.messageCount).toBe(3);
            expect(shardSnap.data()?.messageCount).toBe(3); 
            expect(memberSnap.data()?.readMessageCount).toBe(3);
        });
    });
});
