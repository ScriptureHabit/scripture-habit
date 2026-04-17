// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db, admin } from '../lib/firebase-admin.js';
import * as NotificationsLib from '../lib/notifications.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('NotificationService Integration', () => {
    const SENDER_UID = 'NOTIF_SENDER';
    const RECEIVER_UID = 'NOTIF_RECEIVER';
    const GID = 'NOTIF_GRP';

    beforeAll(async () => {
        // Setup Receiver with tokens in both places
        await db.collection('users').doc(RECEIVER_UID).set({
            nickname: 'Receiver',
            fcmTokens: ['token_public_1'],
            groupIds: [GID]
        });
        await db.collection('users').doc(RECEIVER_UID).collection('private').doc('tokens').set({
            fcmTokens: ['token_private_1', 'token_dead']
        });

        // Setup Group
        await db.collection('groups').doc(GID).set({
            members: [SENDER_UID, RECEIVER_UID],
            name: 'Notif Group'
        });
    });

    afterAll(async () => {
        await db.recursiveDelete(db.collection('users').doc(RECEIVER_UID));
        await db.collection('groups').doc(GID).delete();
    });

    it('should correctly gather all tokens and attempt to notify members', async () => {
        const { messaging } = await import('../lib/firebase-admin.js');
        const sendSpy = vi.spyOn(messaging, 'sendEachForMulticast').mockResolvedValue({
            successCount: 2,
            failureCount: 1,
            responses: [
                { success: true },
                { success: true },
                { success: false, error: { code: 'messaging/registration-token-not-registered' } as unknown as admin.FirebaseError }
            ]
        });

        await NotificationsLib.notifyGroupMembers(GID, SENDER_UID, {
            title: 'Test',
            body: 'Hello'
        });

        // Verify send was called
        expect(sendSpy).toHaveBeenCalled();
        const calledTokens = (sendSpy.mock.calls[0][0] as { tokens: string[] }).tokens;
        expect(calledTokens).toContain('token_public_1');
        expect(calledTokens).toContain('token_private_1');
        expect(calledTokens).toContain('token_dead');

        // Verify dead token cleanup
        // Wait a bit for potential batch commit
        await new Promise(r => setTimeout(r, 500));
        
        const userSnap = await db.collection('users').doc(RECEIVER_UID).get();
        const privSnap = await db.collection('users').doc(RECEIVER_UID).collection('private').doc('tokens').get();
        
        const combinedTokens = [...(userSnap.data()?.fcmTokens || []), ...(privSnap.data()?.fcmTokens || [])];
        expect(combinedTokens).not.toContain('token_dead');
    });
});
