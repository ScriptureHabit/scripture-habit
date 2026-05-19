// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db, admin } from '../lib/firebase-admin.js';
import { TestSetup } from '../test-setup.js';
import { formatDateInTimeZone } from '../../src/utils/time-utils.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Reset Unity Route Integration', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();

    const USER_ID = 'RESET_TEST_USER';
    const GID_VALID = 'RESET_GRP_VALID';
    const GID_NOT_MEMBER = 'RESET_GRP_NOT_MEMBER';
    const GID_NOT_FOUND = 'RESET_GRP_NOT_FOUND';

    beforeAll(async () => {
        await setup.start();

        // 1. Valid group where user is a member
        await db.collection('groups').doc(GID_VALID).set({
            name: 'Valid Reset Group',
            members: [USER_ID],
            timeZone: 'America/New_York',
            unityPercentage: 80,
            dailyActivity: {
                date: '2024-04-24', // Yesterday relative to our test now
                activeMembers: [USER_ID]
            }
        });

        // 2. Group where user is NOT a member
        await db.collection('groups').doc(GID_NOT_MEMBER).set({
            name: 'No Membership Group',
            members: ['other-user'],
            timeZone: 'America/New_York',
            unityPercentage: 80,
            dailyActivity: {
                date: '2024-04-24',
                activeMembers: ['other-user']
            }
        });
    });

    afterAll(async () => {
        await setup.stop();
    });

    it('should return 401 if unauthenticated', async () => {
        const res = await fetch(`${setup.baseUrl}/api/groups/reset-unity-if-midnight`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId: GID_VALID })
        });
        expect(res.status).toBe(401);
    });

    it('should return 400 if groupId is missing', async () => {
        setup.mockAuth(USER_ID);
        const res = await fetch(`${setup.baseUrl}/api/groups/reset-unity-if-midnight`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer token-${USER_ID}`
            },
            body: JSON.stringify({})
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('groupId is required');
    });

    it('should return 404 if group does not exist', async () => {
        setup.mockAuth(USER_ID);
        const res = await fetch(`${setup.baseUrl}/api/groups/reset-unity-if-midnight`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer token-${USER_ID}`
            },
            body: JSON.stringify({ groupId: GID_NOT_FOUND })
        });
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toBe('Group not found');
    });

    it('should return 403 if user is not a member of the group', async () => {
        setup.mockAuth(USER_ID);
        const res = await fetch(`${setup.baseUrl}/api/groups/reset-unity-if-midnight`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer token-${USER_ID}`
            },
            body: JSON.stringify({ groupId: GID_NOT_MEMBER })
        });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toBe('Not a group member');
    });

    it('should successfully reset unity percentage if midnight has passed', async () => {
        setup.mockAuth(USER_ID);
        const res = await fetch(`${setup.baseUrl}/api/groups/reset-unity-if-midnight`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer token-${USER_ID}`
            },
            body: JSON.stringify({ groupId: GID_VALID })
        });
        
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.reset).toBe(true);
        expect(data.unityPercentage).toBe(0);

        // Verify state is saved in DB
        const groupSnap = await db.collection('groups').doc(GID_VALID).get();
        const groupData = groupSnap.data()!;
        expect(groupData.unityPercentage).toBe(0);
        expect(groupData.dailyActivity.activeMembers).toHaveLength(0);
        
        const expectedToday = formatDateInTimeZone(new Date(), 'America/New_York');
        expect(groupData.dailyActivity.date).toBe(expectedToday);
    });

    it('should not reset unity percentage if already reset today', async () => {
        setup.mockAuth(USER_ID);
        const res = await fetch(`${setup.baseUrl}/api/groups/reset-unity-if-midnight`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer token-${USER_ID}`
            },
            body: JSON.stringify({ groupId: GID_VALID })
        });
        
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.reset).toBe(false);
        expect(data.reason).toBe('Already reset for today');
    });

    it('should return 500 if an unexpected database error occurs', async () => {
        setup.mockAuth(USER_ID);
        // Spy on get and force it to throw
        const getSpy = vi.spyOn(db, 'collection').mockImplementation(() => {
            throw new Error('Database connection failed');
        });

        const res = await fetch(`${setup.baseUrl}/api/groups/reset-unity-if-midnight`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer token-${USER_ID}`
            },
            body: JSON.stringify({ groupId: GID_VALID })
        });

        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('Database connection failed');

        getSpy.mockRestore();
    });

    it('should return 401 if uid is missing in decoded token', async () => {
        const verifySpy = vi.spyOn(admin.auth(), 'verifyIdToken').mockResolvedValue({
            email: 'test@example.com'
        } as any);

        const res = await fetch(`${setup.baseUrl}/api/groups/reset-unity-if-midnight`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer token-missing-uid`
            },
            body: JSON.stringify({ groupId: GID_VALID })
        });

        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe('Unauthorized');

        verifySpy.mockRestore();
    });
});
