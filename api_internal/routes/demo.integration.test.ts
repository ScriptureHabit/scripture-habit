// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { db } from '../lib/firebase-admin.js';
import { TestSetup } from '../test-setup.js';

describe('Demo Route Integration (Isolated Sandbox)', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();

    const DEMO_USER_A = 'DEMO_USER_ANONYMOUS_A';
    const DEMO_USER_B = 'DEMO_USER_ANONYMOUS_B';

    beforeAll(async () => {
        await setup.start();
    });

    afterAll(async () => {
        await setup.stop();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('POST /api/demo/initialize', () => {
        it('should return 401 if unauthenticated', async () => {
            const res = await fetch(`${setup.baseUrl}/api/demo/initialize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: 'ja' })
            });
            expect(res.status).toBe(401);
        });

        it('should initialize a complete, isolated demo sandbox for user A', async () => {
            setup.mockAuth(DEMO_USER_A);

            const res = await fetch(`${setup.baseUrl}/api/demo/initialize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${DEMO_USER_A}`
                },
                body: JSON.stringify({ language: 'ja' })
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.groupId).toBe(`demo-group-${DEMO_USER_A}`);

            // 1. Verify User Document
            const userSnap = await db.collection('users').doc(DEMO_USER_A).get();
            expect(userSnap.exists).toBe(true);
            const userData = userSnap.data()!;
            expect(userData.nickname).toBe('デモユーザー');
            expect(userData.streakCount).toBe(999);
            expect(userData.studiedDates).toHaveLength(999);
            expect(userData.groupIds).toEqual([`demo-group-${DEMO_USER_A}`]);
            expect(userData.questCreatedGroup).toBe(true);
            expect(userData.isAnonymousDemo).toBe(true);

            // 2. Verify Group Document
            const groupSnap = await db.collection('groups').doc(`demo-group-${DEMO_USER_A}`).get();
            expect(groupSnap.exists).toBe(true);
            const groupData = groupSnap.data()!;
            expect(groupData.name).toBe('日々の糧 📖');
            expect(groupData.members).toContain('bot-alice');
            expect(groupData.members).toContain('bot-bob');
            expect(groupData.members).toContain('bot-charlie');
            expect(groupData.members).toContain(DEMO_USER_A);
            expect(groupData.membersCount).toBe(4);
            expect(groupData.unityPercentage).toBe(67);
            expect(groupData.groupStreak).toBe(7);

            // 3. Verify Group Messages
            const messagesSnap = await db.collection('groups').doc(`demo-group-${DEMO_USER_A}`).collection('messages').get();
            expect(messagesSnap.size).toBe(3);
        });

        it('should ensure User A and User B have completely isolated sandboxes without interference', async () => {
            // Initialize User B
            setup.mockAuth(DEMO_USER_B);
            const resB = await fetch(`${setup.baseUrl}/api/demo/initialize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${DEMO_USER_B}`
                },
                body: JSON.stringify({ language: 'en' })
            });

            expect(resB.status).toBe(200);
            const bodyB = await resB.json();
            expect(bodyB.groupId).toBe(`demo-group-${DEMO_USER_B}`);

            // Group A and Group B are distinct
            expect(bodyB.groupId).not.toBe(`demo-group-${DEMO_USER_A}`);

            const groupASnap = await db.collection('groups').doc(`demo-group-${DEMO_USER_A}`).get();
            const groupBSnap = await db.collection('groups').doc(`demo-group-${DEMO_USER_B}`).get();

            expect(groupASnap.data()!.members).not.toContain(DEMO_USER_B);
            expect(groupBSnap.data()!.members).not.toContain(DEMO_USER_A);
        });
    });
});
