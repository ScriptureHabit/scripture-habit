// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { db, messaging } from './lib/firebase-admin.js';
import { TestSetup } from './test-setup.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Streak Warning Integration', () => {
    const setup = new TestSetup();
    const TEST_TODAY = '2026-05-18';
    const TEST_YESTERDAY = '2026-05-17';
    const TEST_TIME = `${TEST_TODAY}T11:30:00Z`; // 20:30 JST (Cron execution target time)

    beforeAll(async () => {
        process.env.CRON_SECRET = 'test-secret';
        await setup.start();
    }, 120000);

    afterAll(async () => {
        await setup.stop();
    }, 120000);

    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Clean up only the specific users used in these tests
        const targetUids = [
            'user-A',
            'user-B',
            'user-C',
            'user-D',
            'user-E',
            'user-invalid-test',
            'user-all-invalid-test'
        ];
        
        const batch = db.batch();
        for (const uid of targetUids) {
            const userRef = db.collection('users').doc(uid);
            batch.delete(userRef);
            batch.delete(userRef.collection('private').doc('tokens'));
        }
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
            lastPostDate: TEST_YESTERDAY,
            language: 'en',
            hasFcmToken: true
        });
        batch.set(userARef.collection('private').doc('tokens'), { fcmTokens: ['token-a'] });

        // User B (Should NOT receive: Posted today)
        const userBRef = db.collection('users').doc('user-B');
        batch.set(userBRef, {
            isTestUser: true,
            timeZone: 'Asia/Tokyo',
            lastPostDate: TEST_TODAY, // Today in JST
            hasFcmToken: true
        });
        batch.set(userBRef.collection('private').doc('tokens'), { fcmTokens: ['token-b'] });

        // User C (Should NOT receive: Wrong Timezone - NY is morning)
        const userCRef = db.collection('users').doc('user-C');
        batch.set(userCRef, {
            isTestUser: true,
            timeZone: 'America/New_York',
            lastPostDate: TEST_YESTERDAY, 
            hasFcmToken: true
        });
        batch.set(userCRef.collection('private').doc('tokens'), { fcmTokens: ['token-c'] });

        // User D (Should NOT receive: No FCM tokens)
        const userDRef = db.collection('users').doc('user-D');
        batch.set(userDRef, {
            isTestUser: true,
            timeZone: 'Asia/Tokyo',
            lastPostDate: TEST_YESTERDAY,
            hasFcmToken: false
        });
        batch.set(userDRef.collection('private').doc('tokens'), { fcmTokens: [] });

        // User E (Should receive: Japanese locale)
        const userERef = db.collection('users').doc('user-E');
        batch.set(userERef, {
            isTestUser: true,
            timeZone: 'Asia/Tokyo',
            lastPostDate: TEST_YESTERDAY,
            language: 'ja',
            hasFcmToken: true
        });
        batch.set(userERef.collection('private').doc('tokens'), { fcmTokens: ['token-e'] });

        await batch.commit();

        // Setup FCM mock to return success
        const mockSendEachForMulticast = vi.spyOn(messaging, 'sendEachForMulticast');
        mockSendEachForMulticast.mockResolvedValue({
            successCount: 1,
            failureCount: 0,
            responses: [{ success: true }]
        });

        const response = await fetch(`${setup.baseUrl}/api/cron/streak-warning`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer test-secret',
                'x-test-time': TEST_TIME
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
            lastPostDate: TEST_YESTERDAY,
            hasFcmToken: true
        });
        await userRef.collection('private').doc('tokens').set({
            fcmTokens: ['valid-token', 'expired-token']
        });

        // Mock FCM to fail on the second token
        const mockSendEachForMulticast = vi.spyOn(messaging, 'sendEachForMulticast');
        mockSendEachForMulticast.mockResolvedValue({
            successCount: 1,
            failureCount: 1,
            responses: [
                { success: true },
                { success: false, error: { code: 'messaging/registration-token-not-registered' } as unknown as import('firebase-admin/messaging').FirebaseMessagingError }
            ]
        });

        const response = await fetch(`${setup.baseUrl}/api/cron/streak-warning`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer test-secret',
                'x-test-time': TEST_TIME
            }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        console.log('DEBUG: Streak warning cleanup stats:', data);
        
        // Wait for Firestore emulator to reflect updates
        await new Promise(r => setTimeout(r, 500));
        
        // Check Firestore to see if 'expired-token' was removed
        const updatedDoc = await userRef.collection('private').doc('tokens').get();
        const tokens = updatedDoc.data()?.fcmTokens;
        
        expect(tokens).toContain('valid-token');
        expect(tokens).not.toContain('expired-token'); // Should have been cleaned up!
    });

    it('should clean up invalid FCM tokens and update hasFcmToken to false when no tokens remain', async () => {
        // Seed user with ONLY invalid tokens
        const userRef = db.collection('users').doc('user-all-invalid-test');
        await userRef.set({
            isTestUser: true,
            timeZone: 'Asia/Tokyo',
            lastPostDate: TEST_YESTERDAY,
            hasFcmToken: true
        });
        await userRef.collection('private').doc('tokens').set({
            fcmTokens: ['expired-token-1', 'expired-token-2']
        });

        // Mock FCM to fail on both tokens
        const mockSendEachForMulticast = vi.spyOn(messaging, 'sendEachForMulticast');
        mockSendEachForMulticast.mockResolvedValue({
            successCount: 0,
            failureCount: 2,
            responses: [
                { success: false, error: { code: 'messaging/registration-token-not-registered' } as unknown as import('firebase-admin/messaging').FirebaseMessagingError },
                { success: false, error: { code: 'messaging/invalid-registration-token' } as unknown as import('firebase-admin/messaging').FirebaseMessagingError }
            ]
        });

        const response = await fetch(`${setup.baseUrl}/api/cron/streak-warning`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer test-secret',
                'x-test-time': TEST_TIME
            }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        console.log('DEBUG: Streak warning all-invalid cleanup stats:', data);
        
        // Wait for Firestore emulator to reflect updates
        await new Promise(r => setTimeout(r, 500));
        
        // 1. Check Firestore to see if tokens subcollection is empty
        const updatedTokensDoc = await userRef.collection('private').doc('tokens').get();
        const tokens = updatedTokensDoc.data()?.fcmTokens || [];
        expect(tokens.length).toBe(0);

        // 2. Check if the public user document was updated to hasFcmToken: false
        const updatedUserDoc = await userRef.get();
        expect(updatedUserDoc.data()?.hasFcmToken).toBe(false);
    });
});
