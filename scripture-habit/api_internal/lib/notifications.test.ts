import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockGetAll = vi.fn();
const mockBatch = vi.fn();
const mockSendEachForMulticast = vi.fn();

vi.mock('./firebase-admin.js', () => {
    const mockDb = {
        collection: vi.fn().mockReturnThis(),
        doc: vi.fn().mockReturnThis(),
        get: (...args: any[]) => mockGet(...args),
        getAll: (...args: any[]) => mockGetAll(...args),
        batch: () => mockBatch(),
    };

    const mockMessaging = {
        sendEachForMulticast: (...args: any[]) => mockSendEachForMulticast(...args),
    };

    const mockAdmin = {
        firestore: {
            FieldValue: {
                arrayRemove: vi.fn().mockImplementation((val) => ({ type: 'arrayRemove', value: val })),
            },
        },
    };

    return {
        db: mockDb,
        messaging: mockMessaging,
        admin: mockAdmin,
    };
});

import {
    getUserFcmTokens,
    sendPushNotification,
    cleanupTokens,
    notifyGroupMembers
} from './notifications.js';

function makeSnap(exists: boolean, dataVal: any) {
    return {
        exists,
        data: () => dataVal,
    };
}

describe('notifications core lib tests', () => {
    describe('getUserFcmTokens', () => {
        it('should return unique tokens from public and private collections', async () => {
            mockGet.mockResolvedValueOnce(makeSnap(true, { fcmTokens: ['token1', 'token2'] })) // Public doc
                   .mockResolvedValueOnce(makeSnap(true, { fcmTokens: ['token2', 'token3'] })); // Private doc

            const tokens = await getUserFcmTokens('u1');
            expect(tokens).toEqual(['token1', 'token2', 'token3']);
        });

        it('should handle non-existent documents', async () => {
            mockGet.mockResolvedValueOnce(makeSnap(false, null))
                   .mockResolvedValueOnce(makeSnap(false, null));

            const tokens = await getUserFcmTokens('u1');
            expect(tokens).toEqual([]);
        });
    });

    describe('sendPushNotification', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should return early if tokens list is empty', async () => {
            const result = await sendPushNotification([], { title: 'T', body: 'B' });
            expect(result).toEqual({ successCount: 0, failureCount: 0, failedTokens: [] });
            expect(mockSendEachForMulticast).not.toHaveBeenCalled();
        });

        it('should successfully send multicast messages and return stats', async () => {
            mockSendEachForMulticast.mockResolvedValue({
                successCount: 2,
                failureCount: 1,
                responses: [
                    { success: true },
                    { success: true },
                    { success: false, error: { code: 'messaging/invalid-registration-token' } }
                ]
            });

            const result = await sendPushNotification(['t1', 't2', 't3'], { title: 'T', body: 'B' });
            expect(result).toEqual({
                successCount: 2,
                failureCount: 1,
                failedTokens: ['t3']
            });
        });

        it('should catch error when sendEachForMulticast fails (line 63)', async () => {
            mockSendEachForMulticast.mockRejectedValue(new Error('multicast error'));
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await sendPushNotification(['t1'], { title: 'T', body: 'B' });
            expect(result).toEqual({ successCount: 0, failureCount: 0, failedTokens: [] });
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('cleanupTokens', () => {
        it('should return early if no failed tokens', async () => {
            vi.clearAllMocks();
            await cleanupTokens('u1', []);
            expect(mockBatch).not.toHaveBeenCalled();
        });

        it('should commit batch updates for failed tokens and reset hasFcmToken if no tokens remain', async () => {
            const mockCommit = vi.fn();
            const mockUpdate = vi.fn();
            mockBatch.mockReturnValue({
                update: mockUpdate,
                commit: mockCommit
            });
            mockGet.mockResolvedValueOnce(makeSnap(true, { fcmTokens: ['badToken'] })) // Public doc
                   .mockResolvedValueOnce(makeSnap(true, { fcmTokens: [] }));           // Private doc

            await cleanupTokens('u1', ['badToken']);
            expect(mockUpdate).toHaveBeenCalledTimes(3);
            expect(mockUpdate).toHaveBeenLastCalledWith(
                expect.anything(),
                { hasFcmToken: false }
            );
            expect(mockCommit).toHaveBeenCalled();
        });

        it('should commit updates but NOT reset hasFcmToken if other tokens remain', async () => {
            const mockCommit = vi.fn();
            const mockUpdate = vi.fn();
            mockBatch.mockReturnValue({
                update: mockUpdate,
                commit: mockCommit
            });
            mockGet.mockResolvedValueOnce(makeSnap(true, { fcmTokens: ['badToken'] })) // Public doc
                   .mockResolvedValueOnce(makeSnap(true, { fcmTokens: ['goodToken'] })); // Private doc

            await cleanupTokens('u1', ['badToken']);
            expect(mockUpdate).toHaveBeenCalledTimes(2);
            expect(mockCommit).toHaveBeenCalled();
        });
    });

    describe('notifyGroupMembers', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should exit early if there are no other members to notify (lines 100-101)', async () => {
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            await notifyGroupMembers('g1', 'sender1', { title: 'T', body: 'B' }, []);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No other members to notify'));

            mockGet.mockResolvedValueOnce(makeSnap(false, null));
            await notifyGroupMembers('g1', 'sender1', { title: 'T', body: 'B' });

            consoleLogSpy.mockRestore();
        });

        it('should handle undefined group members and fallback to empty array (line 96)', async () => {
            mockGet.mockResolvedValueOnce(makeSnap(true, { members: null }));
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            await notifyGroupMembers('g1', 'sender1', { title: 'T', body: 'B' });
            
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No other members to notify'));
            consoleLogSpy.mockRestore();
        });

        it('should collect public and private tokens, including filtering private duplicates (lines 137-141)', async () => {
            const memberIdsOverride = ['receiver1'];
            mockGetAll.mockResolvedValue([
                makeSnap(true, { language: 'ja-JP', fcmTokens: ['publicToken1'] }),
                makeSnap(true, { fcmTokens: ['publicToken1', 'privateToken1'] })
            ]);

            mockSendEachForMulticast.mockResolvedValue({
                successCount: 1,
                failureCount: 0,
                responses: [{ success: true }]
            });

            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            await notifyGroupMembers('g1', 'sender1', { title: 'T', body: 'B' }, memberIdsOverride);

            expect(mockSendEachForMulticast).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    lang: 'ja'
                }),
                tokens: ['publicToken1', 'privateToken1']
            }));
            consoleLogSpy.mockRestore();
        });

        it('should handle registration error cleanup on failed tokens during group notification', async () => {
            const memberIdsOverride = ['receiver1'];
            mockGetAll.mockResolvedValue([
                makeSnap(true, { language: 'en-US', fcmTokens: ['token_public'] }),
                makeSnap(true, { fcmTokens: ['token_private'] })
            ]);

            mockSendEachForMulticast.mockResolvedValue({
                successCount: 0,
                failureCount: 2,
                responses: [
                    { success: false, error: { code: 'messaging/registration-token-not-registered' } },
                    { success: false, error: { code: 'messaging/invalid-registration-token' } }
                ]
            });

            const mockCommit = vi.fn();
            const mockUpdate = vi.fn();
            mockBatch.mockReturnValue({
                update: mockUpdate,
                commit: mockCommit
            });

            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            await notifyGroupMembers('g1', 'sender1', { title: 'T', body: 'B' }, memberIdsOverride);

            expect(mockUpdate).toHaveBeenCalledTimes(3);
            expect(mockUpdate).toHaveBeenLastCalledWith(
                expect.anything(),
                { hasFcmToken: false }
            );
            expect(mockCommit).toHaveBeenCalled();
            consoleLogSpy.mockRestore();
        });

        it('should catch generic errors in try-catch block (line 187)', async () => {
            mockGetAll.mockRejectedValue(new Error('getAll db connection failed'));
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await notifyGroupMembers('g1', 'sender1', { title: 'T', body: 'B' }, ['receiver1']);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error in notifyGroupMembers:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });

        it('should translate notifications with titleKey and bodyKey depending on target language', async () => {
            const memberIdsOverride = ['receiver1', 'receiver2'];
            
            mockGetAll.mockResolvedValue([
                makeSnap(true, { language: 'ja-JP', fcmTokens: ['token-ja'] }), // receiver1 public doc
                makeSnap(true, { language: 'es-ES', fcmTokens: ['token-es'] }), // receiver2 public doc
                makeSnap(true, { fcmTokens: [] }), // receiver1 private doc
                makeSnap(true, { fcmTokens: [] })  // receiver2 private doc
            ]);

            mockSendEachForMulticast.mockResolvedValue({
                successCount: 1,
                failureCount: 0,
                responses: [{ success: true }]
            });

            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            
            await notifyGroupMembers('g1', 'sender1', { 
                title: 'Default Title', 
                body: 'Default Body',
                titleKey: 'notifications.note_posted_title',
                bodyKey: 'notifications.note_posted_body',
                bodyReplacements: { nickname: 'Alice' }
            }, memberIdsOverride);

            // Expect sendEachForMulticast to be called twice: once for 'ja', once for 'es'
            expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2);

            const calls = mockSendEachForMulticast.mock.calls.map(c => c[0]);
            
            // Japanese check
            const jaCall = calls.find(c => c.tokens.includes('token-ja'));
            expect(jaCall).toBeDefined();
            expect(jaCall!.data.title).toBe('📖 聖典学習'); // ja translation
            expect(jaCall!.data.body).toBe('Aliceさんがノートを投稿しました！✨'); // ja body template

            // Spanish check
            const esCall = calls.find(c => c.tokens.includes('token-es'));
            expect(esCall).toBeDefined();
            expect(esCall!.data.title).toBe('📖 Estudio de las escrituras'); // es translation
            expect(esCall!.data.body).toBe('¡Alice publicó una nota! ✨'); // es body template

            consoleLogSpy.mockRestore();
        });
    });
});
