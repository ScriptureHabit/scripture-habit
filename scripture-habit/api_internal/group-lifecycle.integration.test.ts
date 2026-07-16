// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { db, admin } from './lib/firebase-admin.js';
import { TestSetup } from './test-setup.js';
import { NoteService } from './services/note-service.js';
import { calculateUnityPercentage } from '../src/utils/unity-utils.js';
import { Group } from '../src/types/chat.js';

describe('Group Management & Lifecycle Integration', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();
    const createdGroupIds: string[] = [];
    const createdUserUids: string[] = [];

    beforeAll(async () => {
        await setup.start();
    });

    afterAll(async () => {
        // Cleanup
        for (const gid of createdGroupIds) {
            await db.recursiveDelete(db.collection('groups').doc(gid)).catch(() => {});
        }
        for (const uid of createdUserUids) {
            await db.collection('users').doc(uid).delete().catch(() => {});
        }
        await setup.stop();
    });

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('Validation & Limits', () => {
        it('should prevent group creation when user already has 4 groups', async () => {
            const uid = 'limit-user-' + Date.now();
            await db.collection('users').doc(uid).set({
                uid,
                nickname: 'Limited User',
                groupIds: ['g1', 'g2', 'g3', 'g4']
            });
            createdUserUids.push(uid);

            setup.mockAuth(uid);
            const response = await fetch(`${setup.baseUrl}/api/groups/create-group`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Excess Group', isPublic: true })
            });

            const data = await response.json();
            if (response.status === 200) createdGroupIds.push(data.groupId);
            
            expect(response.status).toBe(400);
            expect(data.error).toContain('maximum limit of 4 groups');
        });

        it('should return 403 when email is not verified', async () => {
            setup.mockAuth('unverified-user', false);
            const response = await fetch(`${setup.baseUrl}/api/groups/join-group`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviteCode: 'ABCDEF' })
            });
            expect(response.status).toBe(403);
        });
    });

    describe('Full Lifecycle (Create -> Join -> Leave -> Delete)', () => {
        const ownerUid = 'life-owner-' + Date.now();
        const memberUid = 'life-member-' + Date.now();
        let targetGroupId: string;
        let targetInviteCode: string;

        it('should create a group as an owner', async () => {
            await db.collection('users').doc(ownerUid).set({ uid: ownerUid, nickname: 'Owner' });
            createdUserUids.push(ownerUid);

            setup.mockAuth(ownerUid);
            const res = await fetch(`${setup.baseUrl}/api/groups/create-group`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Lifecycle Group', isPublic: true })
            });

            const data = await res.json();
            targetGroupId = data.groupId;
            createdGroupIds.push(targetGroupId);

            const groupSnap = await db.collection('groups').doc(targetGroupId).get();
            targetInviteCode = groupSnap.data()?.inviteCode;
            expect(groupSnap.data()?.ownerUserId).toBe(ownerUid);
        });

        it('should allow another member to join via invite code', async () => {
            await db.collection('users').doc(memberUid).set({ uid: memberUid, nickname: 'Member' });
            createdUserUids.push(memberUid);

            setup.mockAuth(memberUid);
            const res = await fetch(`${setup.baseUrl}/api/groups/join-group`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviteCode: targetInviteCode })
            });

            expect(res.status).toBe(200);
            const groupSnap = await db.collection('groups').doc(targetGroupId).get();
            expect(groupSnap.data()?.members).toContain(memberUid);
        });

        it('should transfer ownership if owner leaves', async () => {
            setup.mockAuth(ownerUid);
            await fetch(`${setup.baseUrl}/api/groups/leave-group`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: targetGroupId })
            });

            const groupSnap = await db.collection('groups').doc(targetGroupId).get();
            expect(groupSnap.data()?.ownerUserId).toBe(memberUid);
        });

        it('should allow the new owner to delete the group', async () => {
            setup.mockAuth(memberUid);
            const res = await fetch(`${setup.baseUrl}/api/groups/delete-group`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: targetGroupId })
            });

            expect(res.status).toBe(200);
            const groupSnap = await db.collection('groups').doc(targetGroupId).get();
            expect(groupSnap.exists).toBe(false);
        });
    });

    describe('Pagination & Search', () => {
        it('should correctly paginate through public groups', async () => {
            const prefix = 'page-test-' + Date.now();
            const batch = db.batch();
            for (let i = 0; i < 15; i++) {
                const ref = db.collection('groups').doc();
                batch.set(ref, {
                    name: `${prefix} ${i.toString().padStart(2, '0')}`,
                    isPublic: true,
                    lastMessageAt: admin.firestore.Timestamp.fromDate(new Date(2030, 0, i + 1)),
                    membersCount: 1
                });
                createdGroupIds.push(ref.id);
            }
            await batch.commit();

            const res1 = await fetch(`${setup.baseUrl}/api/groups?limit=10`);
            const groups1 = await res1.json();
            expect(groups1).toHaveLength(10);
            const prefixGroups1 = groups1.filter((g: any) => g.name.startsWith(prefix));
            expect(prefixGroups1).toHaveLength(10);
            expect(prefixGroups1[0].name).toContain('14');

            const last = prefixGroups1[9];
            const res2 = await fetch(`${setup.baseUrl}/api/groups?limit=10&lastId=${last.id}&lastValue=${last.lastMessageAt}`);
            const groups2 = await res2.json();
            const prefixGroups2 = groups2.filter((g: any) => g.name.startsWith(prefix));
            expect(prefixGroups2).toHaveLength(5);
            expect(prefixGroups2[0].name).toContain('04');
        });
    });

    describe('Concurrency & Data Integrity', () => {
        it('should handle simultaneous joins in a limited group', { retry: 3, timeout: 30000 }, async () => {
            const groupId = 'concurrency-' + Date.now();
            await db.collection('groups').doc(groupId).set({
                id: groupId, name: 'Limited', members: ['owner'], membersCount: 1, maxMembers: 2, isPublic: true,
                lastInactivityCheckedAt: admin.firestore.Timestamp.now()
            });
            createdGroupIds.push(groupId);

            const joiners = ['j1', 'j2', 'j3'].map(id => ({ uid: id + '-' + Date.now(), nickname: id }));
            for (const j of joiners) {
                await db.collection('users').doc(j.uid).set({ uid: j.uid, nickname: j.nickname });
                createdUserUids.push(j.uid);
            }

            setup.mockAuthMultiple();
            const requests = joiners.map(j => fetch(`${setup.baseUrl}/api/groups/join-group`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer token-${j.uid}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId })
            }));

            const responses = await Promise.all(requests);
            const successCount = responses.filter(r => r.status === 200).length;
            expect(successCount).toBe(1); // Only 1 should succeed
        });
    });

    describe('Unity & Counters', () => {
        it('should correctly calculate and persist unity percentage', async () => {
            const uid = 'unity-user-' + Date.now();
            const gid = 'unity-group-' + Date.now();
            const yesterday = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000));

            await db.collection('users').doc(uid).set({ 
                uid, 
                nickname: 'U1', 
                groupIds: [gid],
                groupId: gid // Add current groupId for 'current' shareOption
            });
            createdUserUids.push(uid);

            await db.collection('groups').doc(gid).set({
                id: gid, name: 'Unity Group', members: [uid], memberJoinedAt: { [uid]: yesterday },
                dailyActivity: { date: '', activeMembers: [] },
                lastInactivityCheckedAt: admin.firestore.Timestamp.now()
            });
            createdGroupIds.push(gid);

            // Initial: eligible but not posted = 0%
            const snap1 = await db.collection('groups').doc(gid).get();
            expect(calculateUnityPercentage(snap1.data() as Group)).toBe(0);

            // Post note
            const postRes = await NoteService.postNote({ uid, messageText: 'Post', scripture: 'S1', comment: '', shareOption: 'current' });
            if (postRes.backgroundPromise) await postRes.backgroundPromise;

            // After post: 100%
            const snap2 = await db.collection('groups').doc(gid).get();
            expect(snap2.data()?.unityPercentage).toBe(100);
        });


    });
});
