// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import app from '../api/api.js';
import { Server } from 'http';
import { db, messaging } from './lib/firebase-admin.js';

// Mock FCM
const mockSendEachForMulticast = vi.spyOn(messaging, 'sendEachForMulticast');

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Streak Warning Integration', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
        process.env.CRON_SECRET = 'test-secret';
        
        return new Promise<void>((resolve) => {
            // Start server on dynamic port
            server = app.listen(0, () => {
                const addr = server.address();
                if (addr && typeof addr !== 'string') {
                    baseUrl = `http://localhost:${addr.port}`;
                }
                resolve();
            });
        });
    }, 120000);

    afterAll(async () => {
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    }, 120000);

    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Clean up test users collection
        const snapshot = await db.collection('users').where('isTestUser', '==', true).get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }, 120000);

    it('should correctly filter users by timezone, token, and completion status', async () => {
        const batch = db.batch();

        // User A (Should receive notification)
        // Timezone: Tokyo, Token: Yes, LastPost: Yesterday
        const userARef = db.collection('users').doc('user-A');
        batch.set(userARef, {
            isTestUser: true,
            timeZone: 'Asia/Tokyo',
            lastPostDate: '2026-05-17',
            language: 'en',
            hasFcmToken: true
        });
        batch.set(userARef.collection('private').doc('tokens'), { fcmTokens: ['token-a'] });

        // User B (Should NOT receive: Posted today)
        const userBRef = db.collection('users').doc('user-B');
        batch.set(userBRef, {
            isTestUser: true,
            timeZone: 'Asia/Tokyo',
            lastPostDate: '2026-05-18', // Today in JST
            hasFcmToken: true
        });
        batch.set(userBRef.collection('private').doc('tokens'), { fcmTokens: ['token-b'] });

        // User C (Should NOT receive: Wrong Timezone - NY is morning)
        const userCRef = db.collection('users').doc('user-C');
        batch.set(userCRef, {
            isTestUser: true,
            timeZone: 'America/New_York',
            lastPostDate: '2026-05-17', 
            hasFcmToken: true
        });
        batch.set(userCRef.collection('private').doc('tokens'), { fcmTokens: ['token-c'] });

        // User D (Should NOT receive: No FCM tokens)
        const userDRef = db.collection('users').doc('user-D');
        batch.set(userDRef, {
            isTestUser: true,
            timeZone: 'Asia/Tokyo',
            lastPostDate: '2026-05-17',
            hasFcmToken: false
        });
        batch.set(userDRef.collection('private').doc('tokens'), { fcmTokens: [] });

        // User E (Should receive: Japanese locale)
        const userERef = db.collection('users').doc('user-E');
        batch.set(userERef, {
            isTestUser: true,
            timeZone: 'Asia/Tokyo',
            lastPostDate: '2026-05-17',
            language: 'ja',
            hasFcmToken: true
        });
        batch.set(userERef.collection('private').doc('tokens'), { fcmTokens: ['token-e'] });

        await batch.commit();

        // Setup FCM mock to return success
        mockSendEachForMulticast.mockResolvedValue({
            successCount: 1,
            failureCount: 0,
            responses: [{ success: true }]
        });

        // Execute CRON at exactly 20:30 JST (May 18) -> 11:30 UTC
        const testTime = '2026-05-18T11:30:00Z';
        
        const response = await fetch(`${baseUrl}/api/cron/streak-warning`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer test-secret',
                'x-test-time': testTime
            }
        });

        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data.stats).toBeDefined();

        // Assert FCM was called EXACTLY twice (once for 'en', once for 'ja')
        expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2);

        // We don't know the exact order due to object entry iteration, so we search
        const calls = mockSendEachForMulticast.mock.calls.map(c => c[0]);
        
        const enCall = calls.find(c => c.tokens.includes('token-a'));
        expect(enCall).toBeDefined();
        expect(enCall!.notification!.title).toBe('📖 Have you had your spiritual time today?');
        expect(enCall!.tokens).toEqual(['token-a']);

        const jaCall = calls.find(c => c.tokens.includes('token-e'));
        expect(jaCall).toBeDefined();
        expect(jaCall!.notification!.title).toBe('📖 今日、霊的な時間を過ごせましたか？');
        expect(jaCall!.tokens).toEqual(['token-e']);
    });

    it('should clean up invalid FCM tokens automatically', async () => {
        // Seed user with one valid and one invalid token
        const userRef = db.collection('users').doc('user-invalid-test');
        await userRef.set({
            isTestUser: true,
            timeZone: 'Asia/Tokyo',
            lastPostDate: '2026-05-17',
            hasFcmToken: true
        });
        await userRef.collection('private').doc('tokens').set({
            fcmTokens: ['valid-token', 'expired-token']
        });

        // Mock FCM to fail on the second token
        mockSendEachForMulticast.mockResolvedValue({
            successCount: 1,
            failureCount: 1,
            responses: [
                { success: true },
                { success: false, error: { code: 'messaging/registration-token-not-registered' } as unknown as import('firebase-admin/messaging').FirebaseMessagingError }
            ]
        });

        const testTime = '2026-05-18T11:30:00Z'; // 20:30 JST
        
        const response = await fetch(`${baseUrl}/api/cron/streak-warning`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer test-secret',
                'x-test-time': testTime
            }
        });

        expect(response.status).toBe(200);
        
        // Check Firestore to see if 'expired-token' was removed
        const updatedDoc = await userRef.collection('private').doc('tokens').get();
        const tokens = updatedDoc.data()?.fcmTokens;
        
        expect(tokens).toContain('valid-token');
        expect(tokens).not.toContain('expired-token'); // Should have been cleaned up!
    });
});
