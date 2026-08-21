// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../lib/firebase-admin.js';
import { TestSetup } from '../test-setup.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Reports Route Integration', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();

    const USER_ID = 'REPORTER_USER';
    const REPORTED_USER_ID = 'REPORTED_USER';
    const MSG_ID = 'MESSAGE_TO_REPORT';
    const GID = 'REPORT_GRP';

    beforeAll(async () => {
        await setup.start();
        try {
            await db.recursiveDelete(db.collection('reports'));
        } catch (e) {
            console.error('Initial cleanup failed:', e);
        }
    });

    afterAll(async () => {
        await setup.stop();
        // Clean up reports collection
        try {
            await db.recursiveDelete(db.collection('reports'));
        } catch (e) {
            console.error('Cleanup failed:', e);
        }
    });

    const originalFetch = global.fetch;

    beforeEach(() => {
        delete process.env.DISCORD_WEBHOOK_URL;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return 401 if unauthenticated', async () => {
        const res = await fetch(`${setup.baseUrl}/api/report/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messageId: MSG_ID,
                reportedUserId: REPORTED_USER_ID,
                reason: 'Spam'
            })
        });
        expect(res.status).toBe(401);
    });

    it('should return 400 if validation fails', async () => {
        setup.mockAuth(USER_ID);
        const res = await fetch(`${setup.baseUrl}/api/report/report`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer token-${USER_ID}`
            },
            body: JSON.stringify({
                // missing messageId and reportedUserId
                reason: 'Spam'
            })
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('Invalid input');
        expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should successfully submit report without discord webhook', async () => {
        setup.mockAuth(USER_ID);
        const res = await fetch(`${setup.baseUrl}/api/report/report`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer token-${USER_ID}`
            },
            body: JSON.stringify({
                messageId: MSG_ID,
                groupId: GID,
                reporterNickname: 'The Reporter',
                reportedUserId: REPORTED_USER_ID,
                reportedUserNickname: 'The Bad Guy',
                messageText: 'Some bad words',
                reason: 'Harassment'
            })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toBe('Report submitted successfully');

        // Check it was saved to DB
        const snap = await db.collection('reports').where('messageId', '==', MSG_ID).get();
        expect(snap.size).toBe(1);
        const report = snap.docs[0].data();
        expect(report.reporterId).toBe(USER_ID);
        expect(report.reportedUserId).toBe(REPORTED_USER_ID);
        expect(report.reason).toBe('Harassment');
        expect(report.status).toBe('pending');
    });

    it('should submit report and call discord webhook if configured', async () => {
        process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/dummy';
        const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url, init) => {
            if (url.toString().includes('discord.com')) {
                return Promise.resolve(new Response(null, { status: 204 }));
            }
            return originalFetch(url, init);
        });

        setup.mockAuth(USER_ID);
        const res = await fetch(`${setup.baseUrl}/api/report/report`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer token-${USER_ID}`
            },
            body: JSON.stringify({
                messageId: MSG_ID + '_discord',
                groupId: GID,
                reporterNickname: 'The Reporter',
                reportedUserId: REPORTED_USER_ID,
                reportedUserNickname: 'The Bad Guy',
                messageText: 'Some bad words',
                reason: 'Harassment'
            })
        });

        expect(res.status).toBe(200);
        expect(fetchSpy).toHaveBeenCalled();
    });

    it('should submit report successfully even if discord webhook throws an error', async () => {
        process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/dummy';
        vi.spyOn(global, 'fetch').mockImplementation((url, init) => {
            if (url.toString().includes('discord.com')) {
                return Promise.reject(new Error('Webhook timeout'));
            }
            return originalFetch(url, init);
        });
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        setup.mockAuth(USER_ID);
        const res = await fetch(`${setup.baseUrl}/api/report/report`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer token-${USER_ID}`
            },
            body: JSON.stringify({
                messageId: MSG_ID + '_discord_fail',
                reportedUserId: REPORTED_USER_ID,
                reason: 'Harassment'
            })
        });

        expect(res.status).toBe(200);
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should return 500 if database save fails', async () => {
        setup.mockAuth(USER_ID);
        vi.spyOn(db, 'collection').mockImplementation(() => {
            throw new Error('Firestore read-only');
        });

        const res = await fetch(`${setup.baseUrl}/api/report/report`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer token-${USER_ID}`
            },
            body: JSON.stringify({
                messageId: MSG_ID,
                reportedUserId: REPORTED_USER_ID,
                reason: 'Spam'
            })
        });

        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('Firestore read-only');
    });
});
