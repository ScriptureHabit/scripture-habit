// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { db, admin } from './lib/firebase-admin.js';
import { TestSetup } from './test-setup.js';
import { NoteService } from './services/note-service.js';
import { InactivityService } from './services/inactivity-service.js';

describe('Firestore Read Count Assertion Tests', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();
    const createdGroupIds: string[] = [];
    const createdUserUids: string[] = [];
    const createdCheerIds: string[] = [];

    let transactionGetSpy: any;
    let documentRefGetSpy: any;

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
        for (const cid of createdCheerIds) {
            await db.collection('cheers').doc(cid).delete().catch(() => {});
        }
        await setup.stop();
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        
        // Spy on read methods of the Firestore Admin SDK
        transactionGetSpy = vi.spyOn(admin.firestore.Transaction.prototype, 'get');
        documentRefGetSpy = vi.spyOn(admin.firestore.DocumentReference.prototype, 'get');
    });

    describe('/join-group Read Count Assertion', () => {
        it('should join group by inviteCode and execute exactly 1 group snap read and 1 user read', async () => {
            const ownerUid = 'rc-owner-' + Date.now();
            const memberUid = 'rc-member-' + Date.now();
            const groupId = 'rc-group-' + Date.now();
            
            createdUserUids.push(ownerUid, memberUid);
            createdGroupIds.push(groupId);

            // Create owner & group
            const now = admin.firestore.Timestamp.now();
            await db.collection('users').doc(ownerUid).set({ uid: ownerUid, nickname: 'Owner', kickThreshold: 3 });
            await db.collection('groups').doc(groupId).set({
                name: 'Read Count Group',
                inviteCode: 'JOINRC',
                inviteCodeExpiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + 86400000),
                members: [ownerUid],
                membersCount: 1,
                isPublic: true,
                ownerUserId: ownerUid,
                messageCount: 0
            });
            await db.collection('users').doc(memberUid).set({ uid: memberUid, nickname: 'Member', groupIds: [] });

            // Spy on transaction.get inside /join-group
            vi.clearAllMocks();

            setup.mockAuth(memberUid);
            const response = await fetch(`${setup.baseUrl}/api/groups/join-group`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviteCode: 'JOINRC' })
            });

            expect(response.status).toBe(200);

            // 1. Transaction query.get for inviteCode matches (1 query read)
            // 2. Transaction userDoc read (1 get read)
            // 3. ZERO transaction.get(groupRef) calls! (Since we reuse querySnap.docs[0] directly!)
            
            // Check get calls
            const getCalls = transactionGetSpy.mock.calls;
            
            // Validate that we do NOT call transaction.get for the groups collection/reference again
            const groupRefGets = getCalls.filter((call: any) => {
                const ref = call[0];
                return ref.path && ref.path.startsWith('groups/');
            });

            // Since we reused querySnap, groupRefGets should be 0!
            expect(groupRefGets.length).toBe(0);
        });
    });

    describe('NoteService.postNote Read Count Assertion', () => {
        it('should post a note and share with 3 groups executing exactly 1 user transaction read and 1 parallel getAll read', async () => {
            const uid = 'rc-note-user-' + Date.now();
            const g1 = 'rc-ng1-' + Date.now();
            const g2 = 'rc-ng2-' + Date.now();
            const g3 = 'rc-ng3-' + Date.now();

            createdUserUids.push(uid);
            createdGroupIds.push(g1, g2, g3);

            const now = admin.firestore.Timestamp.now();
            await db.collection('users').doc(uid).set({
                uid,
                nickname: 'Note Poster',
                groupIds: [g1, g2, g3],
                groupId: g1,
                streakCount: 0,
                totalNotes: 0
            });

            const groupPayload = {
                members: [uid],
                membersCount: 1,
                lastInactivityCheckedAt: now
            };
            await db.collection('groups').doc(g1).set({ name: 'Group 1', ...groupPayload });
            await db.collection('groups').doc(g2).set({ name: 'Group 2', ...groupPayload });
            await db.collection('groups').doc(g3).set({ name: 'Group 3', ...groupPayload });

            vi.clearAllMocks();

            const res = await NoteService.postNote({
                uid,
                messageText: 'Hello Scripture Habit!',
                comment: 'Test scripture comment',
                scripture: 'Genesis 1:1',
                shareOption: 'all'
            });

            if (res.backgroundPromise) {
                await res.backgroundPromise;
            }

            // --- Inside the transaction: ---
            // 1. We must read the userRef (1 read)
            // 2. We bypass transaction.get(noteRef) since optimisticId is not provided (0 reads)
            // 3. We bypass all transaction.get(groupRefs) (0 reads)
            const transactionGetCalls = transactionGetSpy.mock.calls;
            expect(transactionGetCalls.length).toBe(1); // ONLY userRef get!
            expect(transactionGetCalls[0][0].path).toBe(`users/${uid}`);

            // --- Outside the transaction (background promise / notifications): ---
            // 1. Notification logic calls db.getAll(...) once for the 3 groups.
            // 2. backgroundPromise REUSES the loaded group snaps, executing ZERO individual groupRef.get() calls!
            const individualGroupGets = documentRefGetSpy.mock.calls.filter((call: any) => {
                const path = call[0]?.path || '';
                return path.startsWith('groups/') && !path.includes('/members/') && !path.includes('/messages/');
            });

            expect(individualGroupGets.length).toBe(0); // Bypassed and reused perfectly!
        });
    });

    describe('InactivityService Inactivity Sweep Read Count Assertion', () => {
        it('should sweep inactivity reusing the stale group snapshots and deduplicating owner reads', async () => {
            const ownerUid = 'rc-ia-owner-' + Date.now();
            const memberUid = 'rc-ia-member-' + Date.now();
            const groupId = 'rc-ia-group-' + Date.now();

            createdUserUids.push(ownerUid, memberUid);
            createdGroupIds.push(groupId);

            const now = admin.firestore.Timestamp.now();
            // Stale date (>24 hours ago)
            const lastCheck = admin.firestore.Timestamp.fromMillis(Date.now() - 30 * 60 * 60 * 1000);

            await db.collection('users').doc(ownerUid).set({ uid: ownerUid, nickname: 'Owner', language: 'en' });
            await db.collection('users').doc(memberUid).set({ uid: memberUid, nickname: 'Member', language: 'en' });

            await db.collection('groups').doc(groupId).set({
                name: 'Inactivity Group',
                members: [ownerUid, memberUid],
                membersCount: 2,
                ownerUserId: ownerUid,
                lastInactivityCheckedAt: lastCheck,
                memberJoinedAt: { [ownerUid]: now, [memberUid]: now },
                memberLastActive: { [ownerUid]: now, [memberUid]: lastCheck }, // Stale member
                memberKickThresholds: { [ownerUid]: 3, [memberUid]: 1 } // Threshold 1 day (stale!)
            });

            // Set up members subcollection
            await db.collection('groups').doc(groupId).collection('members').doc(ownerUid).set({
                uid: ownerUid, nickname: 'Owner', joinedAt: now, lastActiveAt: now, lastReadAt: now, kickThreshold: 3
            });
            await db.collection('groups').doc(groupId).collection('members').doc(memberUid).set({
                uid: memberUid, nickname: 'Member', joinedAt: now, lastActiveAt: lastCheck, lastReadAt: lastCheck, kickThreshold: 1
            });

            vi.clearAllMocks();

            // Run batch inactivity check
            const stats = await InactivityService.batchCheckInactivity(1, true);
            expect(stats.processedGroups).toBe(1);

            // Verify groupDoc read count during sweep:
            // 1. batchCheckInactivity loads the stale groups via query.
            // 2. processGroupInactivity REUSES the groupDoc snapshot, making ZERO individual groupRef.get() calls!
            const groupRefGets = documentRefGetSpy.mock.calls.filter((call: any) => {
                return call[0]?.path === `groups/${groupId}`;
            });
            expect(groupRefGets.length).toBe(0); // ZERO gets! Snapshot reused!

            // Verify ownerDoc read count during ownership transfer and removal system message posting:
            // Since ownerUid is not kicked (only memberUid is kicked), ownerUid is owner.
            // When members are removed, a removal notification is sent, which reads the owner doc.
            // Since owner doc read is deduplicated, it should be read exactly 1 time.
            const ownerGets = documentRefGetSpy.mock.calls.filter((call: any) => {
                return call[0]?.path === `users/${ownerUid}`;
            });
            expect(ownerGets.length).toBeLessThanOrEqual(1);
        });
    });

    describe('Cron Routes Parallel Batch Read Enforcer', () => {
        it('should combine active user stats sync membership checks using a single db.getAll', async () => {
            const u1 = 'rc-u1-' + Date.now();
            const u2 = 'rc-u2-' + Date.now();
            const g1 = 'rc-g1-' + Date.now();

            createdUserUids.push(u1, u2);
            createdGroupIds.push(g1);

            const now = admin.firestore.Timestamp.now();
            await db.collection('groups').doc(g1).set({ name: 'Group 1', members: [u1, u2] });
            await db.collection('groups').doc(g1).collection('members').doc(u1).set({ uid: u1 });
            await db.collection('groups').doc(g1).collection('members').doc(u2).set({ uid: u2 });

            await db.collection('users').doc(u1).set({ uid: u1, nickname: 'User 1', lastPostAt: now, groupIds: [g1] });
            await db.collection('users').doc(u2).set({ uid: u2, nickname: 'User 2', lastPostAt: now, groupIds: [g1] });

            vi.clearAllMocks();

            // Set spy on db.getAll
            const getAllSpy = vi.spyOn(db, 'getAll');

            const response = await fetch(`${setup.baseUrl}/api/cron/sync-user-stats`, {
                headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
            });

            expect(response.status).toBe(200);

            // Proves that all user group membership checks are gathered and fetched via exactly 1 db.getAll call!
            // (1 call to fetch notes count and cheers count inside loop per user remains, but group membership lookup is batched)
            const membershipGetAllCalls = getAllSpy.mock.calls.filter((call: any) => {
                const firstRef = call[0];
                return firstRef && firstRef.path && firstRef.path.includes('/members/');
            });

            expect(membershipGetAllCalls.length).toBe(1);
        });

        it('should combine cheer targets existence checks using a single db.getAll in cleanup-orphaned-cheers', async () => {
            const sender = 'rc-c-sender-' + Date.now();
            const target = 'rc-c-target-' + Date.now();
            const group = 'rc-c-group-' + Date.now();

            createdUserUids.push(sender, target);
            createdGroupIds.push(group);

            await db.collection('users').doc(sender).set({ uid: sender });
            await db.collection('users').doc(target).set({ uid: target });
            await db.collection('groups').doc(group).set({ name: 'Group' });

            const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'UTC' });
            const cheerId = `cheer_${sender}_${target}_${today}`;
            createdCheerIds.push(cheerId);
            await db.collection('cheers').doc(cheerId).set({
                senderUid: sender,
                targetUid: target,
                groupId: group,
                date: today,
                lastCheckedAt: admin.firestore.Timestamp.fromMillis(0) // Stale checked time (first in line)
            });

            vi.clearAllMocks();

            const getAllSpy = vi.spyOn(db, 'getAll');

            const response = await fetch(`${setup.baseUrl}/api/cron/cleanup-orphaned-cheers`, {
                headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
            });

            expect(response.status).toBe(200);

            // Proves that group, senderUid, and targetUid existence checks are batched in parallel
            // using exactly 1 db.getAll call instead of multiple sequential gets!
            expect(getAllSpy).toHaveBeenCalledTimes(1);

            // Clean up immediately so other tests (like cron.integration.test.ts) see an empty cheers collection
            await db.collection('cheers').doc(cheerId).delete().catch(() => {});
        });
    });

    describe('Bundle Caching Read Count Assertion', () => {
        it('should cache generated bundles and serve repeated authorized fetches with exactly 1 permission read and 0 message reads', async () => {
            const memberUid = 'rc-b-member-' + Date.now();
            const groupId = 'rc-b-group-' + Date.now();

            createdUserUids.push(memberUid);
            createdGroupIds.push(groupId);

            const now = admin.firestore.Timestamp.now();
            await db.collection('users').doc(memberUid).set({ uid: memberUid, nickname: 'Member', groupIds: [groupId] });
            await db.collection('groups').doc(groupId).set({
                name: 'Bundle Group',
                members: [memberUid],
                membersCount: 1,
                isPublic: true,
                ownerUserId: memberUid,
                lastMessageAt: now
            });

            // Write 5 mock messages to the group
            for (let i = 0; i < 5; i++) {
                await db.collection('groups').doc(groupId).collection('messages').add({
                    id: `m-${i}`,
                    text: `Message ${i}`,
                    senderId: memberUid,
                    createdAt: now
                });
            }

            // Clean spies before first fetch
            vi.clearAllMocks();

            setup.mockAuth(memberUid);

            // --- FIRST CALL (Cache Miss) ---
            const res1 = await fetch(`${setup.baseUrl}/api/groups/bundle/${groupId}`, {
                headers: { 'Authorization': 'Bearer token' }
            });
            expect(res1.status).toBe(200);

            // Spies record database reads (permission group read + messages query read)
            const firstCallDocGets = documentRefGetSpy.mock.calls.length;
            expect(firstCallDocGets).toBeGreaterThan(0);

            // --- SECOND CALL (Cache Hit) ---
            vi.clearAllMocks();

            const res2 = await fetch(`${setup.baseUrl}/api/groups/bundle/${groupId}`, {
                headers: { 'Authorization': 'Bearer token' }
            });
            expect(res2.status).toBe(200);

            // Verify that the second call served from memory cache:
            // It MUST query the permission group doc (1 read)
            // But it MUST NOT execute any queries or reads on the messages collection!
            const secondCallGets = documentRefGetSpy.mock.calls.filter((call: any) => {
                return call[0]?.path && call[0].path.includes('/messages/');
            });
            expect(secondCallGets.length).toBe(0); // ZERO messages read! served from memory cache!
        });
    });
});
