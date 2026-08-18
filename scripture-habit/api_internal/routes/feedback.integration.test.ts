// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../lib/firebase-admin.js';
import { TestSetup } from '../test-setup.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Feedback Route Integration', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();

    const USER_ID = 'FEEDBACK_TEST_USER';

    beforeAll(async () => {
        await setup.start();
        try {
            await db.recursiveDelete(db.collection('feedbacks'));
        } catch (e) {
            console.error('Initial cleanup failed:', e);
        }
    });

    afterAll(async () => {
        await setup.stop();
        try {
            await db.recursiveDelete(db.collection('feedbacks'));
        } catch (e) {
            console.error('Cleanup failed:', e);
        }
    });

    beforeEach(() => {
        delete process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
        delete process.env.DISCORD_WEBHOOK_URL;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return 401 if unauthenticated', async () => {
        const res = await fetch(`${setup.baseUrl}/api/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: 'idea',
                message: 'Add dark mode please'
            })
        });
        expect(res.status).toBe(401);
    });

    it('should return 400 if category is invalid', async () => {
        setup.mockAuth(USER_ID);
        const res = await fetch(`${setup.baseUrl}/api/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer fake-token-${USER_ID}`
            },
            body: JSON.stringify({
                category: 'invalid-category',
                message: 'Hello'
            })
        });
        expect(res.status).toBe(400);
    });

    it('should return 400 if message is empty', async () => {
        setup.mockAuth(USER_ID);
        const res = await fetch(`${setup.baseUrl}/api/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer fake-token-${USER_ID}`
            },
            body: JSON.stringify({
                category: 'bug',
                message: ''
            })
        });
        expect(res.status).toBe(400);
    });

    it('should successfully submit feedback and save to firestore', async () => {
        setup.mockAuth(USER_ID);
        const res = await fetch(`${setup.baseUrl}/api/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer fake-token-${USER_ID}`
            },
            body: JSON.stringify({
                category: 'cheer',
                message: 'Thank you for making this wonderful app!',
                userNickname: 'Alice',
                userEmail: 'test@example.com'
            })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);

        // Verify Firestore record
        const snapshot = await db.collection('feedbacks')
            .where('userId', '==', USER_ID)
            .get();

        expect(snapshot.empty).toBe(false);
        const doc = snapshot.docs[0].data();
        expect(doc.category).toBe('cheer');
        expect(doc.message).toBe('Thank you for making this wonderful app!');
        expect(doc.userNickname).toBe('Alice');
        expect(doc.userEmail).toBe('test@example.com');
        expect(doc.status).toBe('unread');
    });
});
