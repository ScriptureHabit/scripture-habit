// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '../lib/firebase-admin.js';
import * as NotificationsLib from '../lib/notifications.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('NotificationService Integration', () => {
    const SENDER_UID = 'NOTIF_SENDER';
    const GID = 'NOTIF_GRP';
    
    const RECEIVER_JA = 'USER_JA';
    const RECEIVER_EN = 'USER_EN';

    beforeAll(async () => {
        await db.collection('users').doc(RECEIVER_JA).set({
            nickname: '日本語ユーザー',
            language: 'ja-JP',
            fcmTokens: ['token_ja_public'],
            groupIds: [GID]
        });

        await db.collection('users').doc(RECEIVER_EN).set({
            nickname: 'English User',
            language: 'en-US',
            fcmTokens: ['token_en_public'],
            groupIds: [GID]
        });

        await db.collection('groups').doc(GID).set({
            members: [SENDER_UID, RECEIVER_JA, RECEIVER_EN],
            name: 'Language Test Group'
        });
    }, 30000);

    afterAll(async () => {
        try {
            await Promise.all([
                db.collection('users').doc(RECEIVER_JA).delete(),
                db.collection('users').doc(RECEIVER_EN).delete(),
                db.collection('groups').doc(GID).delete()
            ]);
        } catch (e) {
            console.error('Cleanup failed:', e);
        }
    }, 30000);

    it('should group tokens by language and include correct lang in data', async () => {
        const { messaging } = await import('../lib/firebase-admin.js');
        const sendSpy = vi.spyOn(messaging, 'sendEachForMulticast').mockResolvedValue({
            successCount: 1,
            failureCount: 0,
            responses: [{ success: true }]
        });

        // 通知を送信
        await NotificationsLib.notifyGroupMembers(GID, SENDER_UID, {
            title: 'Test Notification',
            body: 'Hello / こんにちは',
            data: { originalKey: 'value' }
        });

        // 検証: 言語が2種類あるので、2回送信が呼ばれているはず
        expect(sendSpy).toHaveBeenCalledTimes(2);

        // 日本語ユーザーへの呼び出し内容を確認
        const jaCall = sendSpy.mock.calls.find(call => 
            (call[0] as { tokens: string[] }).tokens.includes('token_ja_public')
        );
        expect(jaCall).toBeDefined();
        // dataに lang: 'ja' が追加されていること
        expect((jaCall![0] as { data: Record<string, string> }).data.lang).toBe('ja');
        expect((jaCall![0] as { data: Record<string, string> }).data.originalKey).toBe('value');

        // 英語ユーザーへの呼び出し内容を確認
        const enCall = sendSpy.mock.calls.find(call => 
            (call[0] as { tokens: string[] }).tokens.includes('token_en_public')
        );
        expect(enCall).toBeDefined();
        // dataに lang: 'en' が追加されていること
        expect((enCall![0] as { data?: Record<string, string> }).data?.lang).toBe('en');
    });

    it('should handle token cleanup across different language groups', async () => {
        const { messaging } = await import('../lib/firebase-admin.js');
        // 日本語トークンが失敗したと仮定
        const sendSpy = vi.spyOn(messaging, 'sendEachForMulticast').mockResolvedValue({
            successCount: 0,
            failureCount: 1,
            responses: [{ 
                success: false, 
                error: { code: 'messaging/registration-token-not-registered' }
            }]
        } as unknown as import('firebase-admin/messaging').BatchResponse);

        await NotificationsLib.notifyGroupMembers(GID, SENDER_UID, {
            title: 'Cleanup Test',
            body: 'Test',
            data: {}
        });

        // クリーンアップ処理を待つ
        await new Promise(r => setTimeout(r, 500));

        // トークンが削除されているか確認
        const jaSnap = await db.collection('users').doc(RECEIVER_JA).get();
        expect(jaSnap.data()?.fcmTokens).not.toContain('token_ja_public');
        
        expect(sendSpy).toHaveBeenCalled();
    });
});
