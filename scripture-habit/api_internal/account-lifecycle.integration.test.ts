// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { db, admin } from './lib/firebase-admin.js';
import { TestSetup } from './test-setup.js';
import { UserDocument, GroupDocument, MessageDocument } from '../types/firestore.js';

describe('Account Lifecycle Integration', () => {
    vi.setConfig({ testTimeout: 60000 });
    const setup = new TestSetup();
    const createdUserUids: string[] = [];
    const createdGroupIds: string[] = [];

    beforeAll(async () => {
        await setup.start();
    });

    afterAll(async () => {
        // Cleanup remaining test data
        for (const uid of createdUserUids) {
            await db.recursiveDelete(db.collection('users').doc(uid)).catch(() => {});
        }
        for (const gid of createdGroupIds) {
            await db.recursiveDelete(db.collection('groups').doc(gid)).catch(() => {});
        }
        await setup.stop();
    });

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('Profile Management', () => {
        const uid = 'lifecycle-user-' + Date.now();

        it('should initialize a new profile with default values', async () => {
            setup.mockAuth(uid, false); // Not verified yet
            createdUserUids.push(uid);

            const res = await fetch(`${setup.baseUrl}/api/auth/initialize-profile`, {
                method: 'POST',
                headers: { 
                    'Authorization': 'Bearer token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    nickname: 'Newcomer',
                    timeZone: 'Asia/Tokyo'
                })
            });

            expect(res.status).toBe(201);
            const data = await res.json();
            expect(data.userData.nickname).toBe('Newcomer');
            expect(data.userData.kickThreshold).toBe(3);

            // Verify Firestore
            const userSnap = await db.collection('users').doc(uid).get();
            expect(userSnap.exists).toBe(true);
            const userData = userSnap.data() as UserDocument;
            expect(userData.timeZone).toBe('Asia/Tokyo');
            expect(userData.streakCount).toBe(0);
        });

        it('should update profile and keep it synced', async () => {
            setup.mockAuth(uid, true);

            const res = await fetch(`${setup.baseUrl}/api/auth/update-profile`, {
                method: 'POST',
                headers: { 
                    'Authorization': 'Bearer token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    nickname: 'Updated Name',
                    bio: 'I love scriptures'
                })
            });

            expect(res.status).toBe(200);
            
            const userSnap = await db.collection('users').doc(uid).get();
            expect(userSnap.data()?.nickname).toBe('Updated Name');
            expect(userSnap.data()?.bio).toBe('I love scriptures');
        });
    });

    describe('Account Deletion', () => {
        const uid = 'delete-target-' + Date.now();
        const gid = 'delete-group-' + Date.now();

        it('should completely purge user data and exit groups on deletion', async () => {
            // 1. Setup User in Auth & Firestore
            await admin.auth().createUser({
                uid,
                email: `${uid}@test.local`,
                displayName: 'Bye User'
            });
            
            await db.collection('users').doc(uid).set({
                uid,
                email: `${uid}@test.local`,
                nickname: 'Bye User',
                groupIds: [gid],
                createdAt: admin.firestore.Timestamp.now()
            });
            createdUserUids.push(uid);

            await db.collection('groups').doc(gid).set({
                name: 'Stay Group',
                ownerUserId: 'someone-else',
                members: ['someone-else', uid],
                membersCount: 2,
                memberPreviews: [
                    { uid: 'someone-else', nickname: 'Stay' },
                    { uid, nickname: 'Bye User' }
                ],
                lastNoteByUid: uid,
                lastNoteByNickname: 'Bye User'
            });
            createdGroupIds.push(gid);

            await db.collection('groups').doc(gid).collection('members').doc(uid).set({
                nickname: 'Bye User',
                joinedAt: admin.firestore.Timestamp.now()
            });

            // 2. Add a message with a reaction from the user
            const msgId = 'msg-1';
            await db.collection('groups').doc(gid).collection('messages').doc(msgId).set({
                text: 'Hello!',
                senderId: 'someone-else',
                senderNickname: 'Stay',
                createdAt: admin.firestore.Timestamp.now(),
                reactionPreviews: {
                    '👍': [{ uid, nickname: 'Bye User' }]
                }
            });

            // 3. Perform Deletion
            setup.mockAuth(uid, true);
            const res = await fetch(`${setup.baseUrl}/api/auth/delete-account`, {
                method: 'POST',
                headers: { 
                    'Authorization': 'Bearer token',
                    'Content-Type': 'application/json'
                }
            });

            expect(res.status).toBe(200);

            // 4. Verify Purge
            // User doc gone
            const userSnap = await db.collection('users').doc(uid).get();
            expect(userSnap.exists).toBe(false);

            // Member subcollection gone
            const memberSnap = await db.collection('groups').doc(gid).collection('members').doc(uid).get();
            expect(memberSnap.exists).toBe(false);

            // Group metadata updated
            const groupSnap = await db.collection('groups').doc(gid).get();
            const gData = groupSnap.data() as GroupDocument;
            expect(gData.membersCount).toBe(1);
            expect(gData.memberPreviews?.find(p => p.uid === uid)).toBeUndefined();

            // Reaction anonymized (Background sync might take a moment, but in emulator it's usually fast)
            // Note: ProfileService.purgeSocialIdentity is called in the route
            const msgSnap = await db.collection('groups').doc(gid).collection('messages').doc(msgId).get();
            const mData = msgSnap.data() as MessageDocument;
            const reactions = mData.reactionPreviews?.['👍'];
            expect(reactions?.[0].nickname).toBe('...');
            expect(reactions?.[0].uid).toBe(uid); // UID remains for consistency, but identity is gone
        });
    });
});
