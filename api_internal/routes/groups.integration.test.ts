// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { db, admin } from '../lib/firebase-admin.js';
import { TestSetup } from '../test-setup.js';

describe('Groups Route Additional Integration Tests', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();

    const OWNER_ID = 'GRP_TEST_OWNER_' + Date.now();
    const MEMBER_ID = 'GRP_TEST_MEMBER_' + Date.now();
    const GHOST_GROUP_ID = 'GHOST_GRP_' + Date.now();
    const ACTIVE_GROUP_ID = 'ACTIVE_GRP_' + Date.now();

    beforeAll(async () => {
        await setup.start();

        // Create initial users
        await db.collection('users').doc(OWNER_ID).set({
            uid: OWNER_ID,
            nickname: 'Owner User',
            emailVerified: true,
            groupIds: [ACTIVE_GROUP_ID, GHOST_GROUP_ID],
            groupId: ACTIVE_GROUP_ID,
            kickThreshold: 3
        });

        await db.collection('users').doc(MEMBER_ID).set({
            uid: MEMBER_ID,
            nickname: 'Member User',
            emailVerified: true,
            groupIds: [ACTIVE_GROUP_ID],
            groupId: ACTIVE_GROUP_ID,
            kickThreshold: 3
        });

        // Setup active group document (exist)
        await db.collection('groups').doc(ACTIVE_GROUP_ID).set({
            name: 'Active Group',
            description: 'This is an active group',
            createdAt: admin.firestore.Timestamp.now(),
            ownerUserId: OWNER_ID,
            members: [OWNER_ID, MEMBER_ID],
            membersCount: 2,
            inviteCode: 'ACTV12',
            inviteCodeExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 86400000),
            isPublic: true,
            translations: {
                ja: {
                    name: 'アクティブグループ',
                    description: '日本語の説明'
                }
            }
        });

        // Set member documents in active group
        await db.collection('groups').doc(ACTIVE_GROUP_ID).collection('members').doc(OWNER_ID).set({
            uid: OWNER_ID,
            nickname: 'Owner User',
            joinedAt: admin.firestore.Timestamp.now()
        });

        await db.collection('groups').doc(ACTIVE_GROUP_ID).collection('members').doc(MEMBER_ID).set({
            uid: MEMBER_ID,
            nickname: 'Member User',
            joinedAt: admin.firestore.Timestamp.now()
        });

        // Note: GHOST_GROUP_ID is NOT created in the groups collection, mimicking a deleted group.
    });

    afterAll(async () => {
        await db.recursiveDelete(db.collection('groups').doc(ACTIVE_GROUP_ID)).catch(() => {});
        await db.collection('users').doc(OWNER_ID).delete().catch(() => {});
        await db.collection('users').doc(MEMBER_ID).delete().catch(() => {});
        await setup.stop();
    });

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('POST /kick-member', () => {
        it('should return 400 for validation errors', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/kick-member`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: ACTIVE_GROUP_ID
                    // missing targetUid
                })
            });
            expect(res.status).toBe(400);
        });

        it('should return 400 if user tries to kick themselves', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/kick-member`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: ACTIVE_GROUP_ID,
                    targetUid: OWNER_ID
                })
            });
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toContain('cannot kick yourself');
        });

        it('should return 403 if a non-owner tries to kick', async () => {
            setup.mockAuth(MEMBER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/kick-member`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${MEMBER_ID}`
                },
                body: JSON.stringify({
                    groupId: ACTIVE_GROUP_ID,
                    targetUid: OWNER_ID
                })
            });
            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.error).toContain('Only the group owner can kick members');
        });

        it('should return 400 if target user is not in the group', async () => {
            const outsiderUid = 'OUTSIDER_' + Date.now();
            await db.collection('users').doc(outsiderUid).set({
                uid: outsiderUid,
                nickname: 'Outsider User',
                emailVerified: true,
                groupIds: []
            });

            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/kick-member`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: ACTIVE_GROUP_ID,
                    targetUid: outsiderUid
                })
            });
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toContain('is not a member of this group');

            await db.collection('users').doc(outsiderUid).delete();
        });

        it('should successfully kick a member', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/kick-member`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: ACTIVE_GROUP_ID,
                    targetUid: MEMBER_ID
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);

            // Verify member was removed from groups members list in db
            const groupSnap = await db.collection('groups').doc(ACTIVE_GROUP_ID).get();
            expect(groupSnap.data()?.members).not.toContain(MEMBER_ID);

            // Re-setup member in group for subsequent tests
            await db.collection('groups').doc(ACTIVE_GROUP_ID).update({
                members: [OWNER_ID, MEMBER_ID],
                membersCount: 2
            });
            await db.collection('users').doc(MEMBER_ID).update({
                groupIds: [ACTIVE_GROUP_ID],
                groupId: ACTIVE_GROUP_ID
            });
        });
    });

    describe('POST /update-kick-threshold', () => {
        it('should return 400 for validation errors', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/update-kick-threshold`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    threshold: 'invalid_string'
                })
            });
            expect(res.status).toBe(400);
        });

        it('should return 404 if user not found in DB', async () => {
            setup.mockAuth('NON_EXISTENT_UID');
            const res = await fetch(`${setup.baseUrl}/api/groups/update-kick-threshold`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer token'
                },
                body: JSON.stringify({
                    threshold: 5
                })
            });
            expect(res.status).toBe(404);
            const data = await res.json();
            expect(data.error).toBe('User not found');
        });

        it('should successfully update kick threshold', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/update-kick-threshold`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    threshold: 5
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.cleanedUpGroups).toEqual([]);

            // Verify kickThreshold was updated in user doc
            const userSnap = await db.collection('users').doc(OWNER_ID).get();
            expect(userSnap.data()?.kickThreshold).toBe(5);

            // Verify members subcollection got the updated threshold
            const subMemberSnap = await db.collection('groups').doc(ACTIVE_GROUP_ID).collection('members').doc(OWNER_ID).get();
            expect(subMemberSnap.data()?.kickThreshold).toBe(5);
        });
    });

    describe('POST /update-group', () => {
        it('should return 400 for validation errors', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/update-group`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: '' // empty fails validation
                })
            });
            expect(res.status).toBe(400);
        });

        it('should return 404 if group is not found', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/update-group`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: 'NON_EXISTENT_GROUP_ID',
                    name: 'Updated Name'
                })
            });
            expect(res.status).toBe(404);
        });

        it('should return 403 if user is not the group owner', async () => {
            setup.mockAuth(MEMBER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/update-group`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${MEMBER_ID}`
                },
                body: JSON.stringify({
                    groupId: ACTIVE_GROUP_ID,
                    name: 'Malicious Update'
                })
            });
            expect(res.status).toBe(403);
        });

        it('should return 400 if no updates are provided', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/update-group`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: ACTIVE_GROUP_ID
                })
            });
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('No updates provided');
        });

        it('should successfully update group details', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/update-group`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: ACTIVE_GROUP_ID,
                    name: 'Super Active Group',
                    description: 'Brand new description',
                    timeZone: 'Europe/London'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);

            // Check updates in DB
            const snap = await db.collection('groups').doc(ACTIVE_GROUP_ID).get();
            const group = snap.data();
            expect(group?.name).toBe('Super Active Group');
            expect(group?.description).toBe('Brand new description');
            expect(group?.timeZone).toBe('Europe/London');
        });
    });

    describe('POST /regenerate-invite-code', () => {
        it('should return 400 for validation errors', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/regenerate-invite-code`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({})
            });
            expect(res.status).toBe(400);
        });

        it('should return 403 when user is not a member of the group', async () => {
            setup.mockAuth('NON_MEMBER_STRANGER');
            const res = await fetch(`${setup.baseUrl}/api/groups/regenerate-invite-code`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-NON_MEMBER_STRANGER`
                },
                body: JSON.stringify({
                    groupId: ACTIVE_GROUP_ID
                })
            });
            expect(res.status).toBe(403);
        });

        it('should successfully regenerate invite code by a group member', async () => {
            setup.mockAuth(MEMBER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/regenerate-invite-code`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${MEMBER_ID}`
                },
                body: JSON.stringify({
                    groupId: ACTIVE_GROUP_ID,
                    expiryDays: 14
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.inviteCode).toBeDefined();
            expect(data.expiresAt).toBeDefined();

            // Verify code updated in DB
            const snap = await db.collection('groups').doc(ACTIVE_GROUP_ID).get();
            expect(snap.data()?.inviteCode).toBe(data.inviteCode);
        });

        it('should successfully regenerate permanent invite code and save previous code to previousInviteCodes', async () => {
            const beforeSnap = await db.collection('groups').doc(ACTIVE_GROUP_ID).get();
            const oldCode = beforeSnap.data()?.inviteCode;

            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/regenerate-invite-code`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: ACTIVE_GROUP_ID
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.inviteCode).toBeDefined();
            expect(data.inviteCode).not.toBe(oldCode);
            expect(data.expiresAt).toBeNull();

            const snap = await db.collection('groups').doc(ACTIVE_GROUP_ID).get();
            expect(snap.data()?.inviteCodeExpiresAt).toBeNull();
            expect(snap.data()?.previousInviteCodes).toContain(oldCode);
        });
    });

    describe('GET /group-preview/:inviteCode', () => {
        it('should return 404 if invite code does not exist', async () => {
            const res = await fetch(`${setup.baseUrl}/api/groups/group-preview/NOTFOUND`);
            expect(res.status).toBe(404);
        });

        it('should return 200 even if group has past inviteCodeExpiresAt in DB (transparent permanent compatibility)', async () => {
            const legacyGroupId = 'LEGACY_GRP_' + Date.now();
            await db.collection('groups').doc(legacyGroupId).set({
                name: 'Legacy Group with Past Date',
                description: 'Created before permanent migration',
                inviteCode: 'LEGC12',
                inviteCodeExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() - 100000) // past
            });

            const res = await fetch(`${setup.baseUrl}/api/groups/group-preview/LEGC12`);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.name).toBe('Legacy Group with Past Date');

            await db.collection('groups').doc(legacyGroupId).delete();
        });

        it('should return 200 when previewing using an older code from previousInviteCodes', async () => {
            const snap = await db.collection('groups').doc(ACTIVE_GROUP_ID).get();
            const prevCodes = snap.data()?.previousInviteCodes || [];
            expect(prevCodes.length).toBeGreaterThan(0);
            const oldCode = prevCodes[0];

            const res = await fetch(`${setup.baseUrl}/api/groups/group-preview/${oldCode}`);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.name).toBe('Super Active Group');
        });

        it('should return 200 with standard preview and translations', async () => {
            // Re-fetch invite code
            const snap = await db.collection('groups').doc(ACTIVE_GROUP_ID).get();
            const inviteCode = snap.data()?.inviteCode;

            // Fetch with default (en)
            const resEn = await fetch(`${setup.baseUrl}/api/groups/group-preview/${inviteCode}`);
            expect(resEn.status).toBe(200);
            const dataEn = await resEn.json();
            expect(dataEn.name).toBe('Super Active Group');

            // Fetch with ja lang
            const resJa = await fetch(`${setup.baseUrl}/api/groups/group-preview/${inviteCode}?language=ja`);
            expect(resJa.status).toBe(200);
            const dataJa = await resJa.json();
            expect(dataJa.name).toBe('アクティブグループ');
            expect(dataJa.description).toBe('日本語の説明');
        });
    });

    describe('POST /announce-unity', () => {
        it('should announce unity successfully and create system message', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/announce-unity`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: ACTIVE_GROUP_ID
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);

            // Expect announcement date to be set
            const groupSnap = await db.collection('groups').doc(ACTIVE_GROUP_ID).get();
            expect(groupSnap.data()?.lastUnityAnnouncementDate).toBeDefined();
        });

        it('should handle already announced today gracefully', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/announce-unity`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: ACTIVE_GROUP_ID
                })
            });

            expect(res.status).toBe(200);
        });
    });

    describe('GET /group-preview/:inviteCode error handling', () => {
        it('should return 500 when Firestore query throws during group-preview', async () => {
            const spy = vi.spyOn(db, 'collection').mockImplementation(() => {
                throw new Error('Firestore unavailable');
            });

            const res = await fetch(`${setup.baseUrl}/api/groups/group-preview/ANYCODE`);
            expect(res.status).toBe(500);

            spy.mockRestore();
        });
    });
});
