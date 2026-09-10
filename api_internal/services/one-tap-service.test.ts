import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing OneTapService
const mockRunTransaction = vi.fn();
const mockCollection = vi.fn();

vi.mock('../lib/firebase-admin.js', () => ({
    db: {
        runTransaction: (...args: any[]) => mockRunTransaction(...args),
        collection: (...args: any[]) => mockCollection(...args),
    },
    admin: {
        firestore: {
            FieldValue: {
                serverTimestamp: () => 'MOCK_SERVER_TIMESTAMP',
                increment: (n: number) => ({ _increment: n }),
                arrayUnion: (...items: any[]) => ({ _arrayUnion: items }),
            },
            Timestamp: {
                fromDate: (d: Date) => d,
                fromMillis: (ms: number) => new Date(ms),
                now: () => new Date(),
            },
        },
    },
}));

vi.mock('../lib/i18n.js', () => ({
    t: (_lang: string | undefined | null, key: string, replacements?: Record<string, string | number>) => {
        if (key.includes('themes.') && replacements?.theme) return String(replacements.theme);
        return key;
    },
    resolveLanguage: () => 'ja',
}));

vi.mock('../lib/notifications.js', () => ({
    notifyGroupMembers: vi.fn().mockResolvedValue(undefined),
}));

import { OneTapService, VALID_THEMES } from './one-tap-service.js';
import { AppError } from '../lib/errors.js';
import { formatDateInTimeZone } from '../../src/utils/time-utils.js';

describe('OneTapService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('has 8 allowed themes', () => {
        expect(VALID_THEMES).toHaveLength(8);
        expect(VALID_THEMES).toContain('faith');
        expect(VALID_THEMES).toContain('gratitude');
        expect(VALID_THEMES).toContain('prayer');
    });

    it('rejects invalid themes with 400 ValidationError', async () => {
        await expect(OneTapService.completeStudy({ uid: 'user-1', themeId: 'invalid_theme' as any })).rejects.toThrow(AppError);
        await expect(OneTapService.completeStudy({ uid: 'user-1', themeId: '' as any })).rejects.toThrow(AppError);
    });

    it('rejects study if already completed today with CONFLICT error', async () => {
        const tz = 'Asia/Tokyo';
        const todayStr = formatDateInTimeZone(new Date(), tz);

        mockCollection.mockImplementation(() => ({
            doc: vi.fn().mockReturnValue({ id: 'user-completed' })
        }));

        mockRunTransaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
            const tx = {
                get: vi.fn().mockImplementation(async () => {
                    return {
                        exists: true,
                        data: () => ({
                            todayThemeDate: todayStr,
                            todayTheme: 'faith',
                            groupIds: ['group-1'],
                            timeZone: 'Asia/Tokyo'
                        }),
                    };
                }),
                set: vi.fn(),
                update: vi.fn(),
            };
            return callback(tx);
        });

        await expect(OneTapService.completeStudy({ uid: 'user-completed', themeId: 'hope' }))
            .rejects.toThrow('One-tap study already completed today');
    });

    it('successfully completes study in transaction and notifies groups', async () => {
        const mockUserRef = { id: 'user-1' };
        const mockGroupRef = { id: 'group-1' };
        const mockNotesCollection = {
            doc: vi.fn().mockReturnValue({ id: 'note-123' }),
        };
        let msgCounter = 0;
        const mockMessagesCollection = {
            doc: vi.fn().mockImplementation(() => {
                msgCounter++;
                return { id: `msg-${msgCounter}` };
            }),
        };
        const mockMessagesLatestDoc = {
            exists: false,
            data: () => ({}),
        };

        mockCollection.mockImplementation((name: string) => {
            if (name === 'users') {
                return {
                    doc: vi.fn().mockReturnValue({
                        ...mockUserRef,
                        collection: (subName: string) => {
                            if (subName === 'notes') return mockNotesCollection;
                            if (subName === 'groupStates') return { doc: vi.fn().mockReturnValue({ id: 'gs-1' }) };
                            return { doc: vi.fn().mockReturnValue({}) };
                        },
                    }),
                };
            }
            if (name === 'groups') {
                return {
                    doc: vi.fn().mockReturnValue({
                        ...mockGroupRef,
                        collection: (subName: string) => {
                            if (subName === 'messages') return mockMessagesCollection;
                            if (subName === 'members') return { doc: vi.fn().mockReturnValue({ id: 'm-1' }) };
                            if (subName === 'messages_latest') {
                                return {
                                    doc: vi.fn().mockReturnValue({ id: 'latest' }),
                                };
                            }
                            return { doc: vi.fn().mockReturnValue({}) };
                        },
                    }),
                };
            }
            return {
                doc: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({ catch: vi.fn() }),
                }),
            };
        });

        let capturedTx: any;
        mockRunTransaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
            const tx = {
                get: vi.fn().mockImplementation(async (ref: any) => {
                    if (ref.id === 'user-1') {
                        return {
                            exists: true,
                            data: () => ({
                                currentStreak: 3,
                                longestStreak: 5,
                                lastStudyDate: '2026-09-08',
                                streakFrozen: false,
                                groupIds: ['group-1'],
                                nickname: 'Test User',
                                language: 'ja',
                            }),
                        };
                    }
                    if (ref.id === 'group-1') {
                        return {
                            exists: true,
                            data: () => ({
                                id: 'group-1',
                                members: ['user-1'],
                                dailyActivity: {},
                                unity: { streak: 2 },
                            }),
                        };
                    }
                    if (ref.id === 'latest') {
                        return mockMessagesLatestDoc;
                    }
                    return { exists: false, data: () => ({}) };
                }),
                set: vi.fn(),
                update: vi.fn(),
            };
            capturedTx = tx;
            return callback(tx);
        });

        const result = await OneTapService.completeStudy({ uid: 'user-1', themeId: 'faith' });

        expect(result.success).toBe(true);
        expect(result.themeId).toBe('faith');
        expect(result.streakCount).toBeGreaterThanOrEqual(1);

        // Verify standard note structure and message
        expect(mockRunTransaction).toHaveBeenCalled();
        
        // Assert messages_latest/latest write contains both note message and system announcement
        const latestCall = capturedTx.set.mock.calls.find((call: any[]) => 
            call[1] && typeof call[1] === 'object' && 'messages' in call[1]
        );
        expect(latestCall).toBeDefined();
        expect(latestCall[1]).toMatchObject({
            groupId: 'group-1',
            messages: expect.arrayContaining([
                expect.objectContaining({
                    id: 'msg-1',
                    isNote: true,
                    originalNoteId: 'note-123',
                }),
                expect.objectContaining({
                    id: 'msg-2',
                    isSystemMessage: true,
                    messageType: 'notePostedAnnouncement',
                    senderId: 'system',
                })
            ]),
        });
        expect(latestCall[1].recentMessages).toBeUndefined();

        // Assert personal note has sharedMessageIds
        const noteCall = capturedTx.set.mock.calls.find((call: any[]) =>
            call[1] && typeof call[1] === 'object' && call[1].category === 'oneTap'
        );
        expect(noteCall).toBeDefined();
        expect(noteCall[1].sharedMessageIds).toEqual({ 'group-1': 'msg-1' });
    });

    it('falls back to single groupId if groupIds array is missing', async () => {
        const mockUserRef = { id: 'user-legacy' };
        const mockGroupRef = { id: 'group-legacy' };
        const mockNotesCollection = { doc: vi.fn().mockReturnValue({ id: 'note-999' }) };
        let legacyMsgCounter = 0;
        const mockMessagesCollection = {
            doc: vi.fn().mockImplementation(() => {
                legacyMsgCounter++;
                return { id: `msg-legacy-${legacyMsgCounter}` };
            }),
        };
        const mockMessagesLatestDoc = { exists: false, data: () => ({}) };

        mockCollection.mockImplementation((name: string) => {
            if (name === 'users') {
                return {
                    doc: vi.fn().mockReturnValue({
                        ...mockUserRef,
                        collection: (subName: string) => {
                            if (subName === 'notes') return mockNotesCollection;
                            return { doc: vi.fn().mockReturnValue({}) };
                        },
                    }),
                };
            }
            if (name === 'groups') {
                return {
                    doc: vi.fn().mockReturnValue({
                        ...mockGroupRef,
                        collection: (subName: string) => {
                            if (subName === 'messages') return mockMessagesCollection;
                            if (subName === 'messages_latest') return { doc: vi.fn().mockReturnValue({ id: 'latest' }) };
                            return { doc: vi.fn().mockReturnValue({}) };
                        },
                    }),
                };
            }
            return {
                doc: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({ catch: vi.fn() }),
                }),
            };
        });

        let capturedTx: any;
        mockRunTransaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
            const tx = {
                get: vi.fn().mockImplementation(async (ref: any) => {
                    if (ref.id === 'user-legacy') {
                        return {
                            exists: true,
                            data: () => ({
                                streakCount: 1,
                                groupId: 'group-legacy', // Only single groupId!
                                nickname: 'Legacy User',
                                language: 'en',
                            }),
                        };
                    }
                    if (ref.id === 'group-legacy') {
                        return {
                            exists: true,
                            data: () => ({
                                id: 'group-legacy',
                                members: ['user-legacy'],
                            }),
                        };
                    }
                    if (ref.id === 'latest') return mockMessagesLatestDoc;
                    return { exists: false, data: () => ({}) };
                }),
                set: vi.fn(),
                update: vi.fn(),
            };
            capturedTx = tx;
            return callback(tx);
        });

        const result = await OneTapService.completeStudy({ uid: 'user-legacy', themeId: 'prayer' });
        expect(result.success).toBe(true);

        const latestCall = capturedTx.set.mock.calls.find((call: any[]) => 
            call[1] && typeof call[1] === 'object' && 'messages' in call[1]
        );
        expect(latestCall).toBeDefined();
        expect(latestCall[1].groupId).toBe('group-legacy');
        expect(latestCall[1].messages).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'msg-legacy-1', isNote: true }),
                expect.objectContaining({ id: 'msg-legacy-2', isSystemMessage: true, messageType: 'notePostedAnnouncement' }),
            ])
        );
    });

    it('posts streakAnnouncement on milestone days (e.g., 10th cumulative day)', async () => {
        let msgCounter = 0;
        const mockMessagesCollection = {
            doc: vi.fn().mockImplementation(() => {
                msgCounter++;
                return { id: `msg-ms-${msgCounter}` };
            }),
        };

        mockCollection.mockImplementation((name: string) => {
            if (name === 'users') {
                return {
                    doc: vi.fn().mockReturnValue({
                        id: 'user-ms',
                        collection: () => ({ doc: vi.fn().mockReturnValue({ id: 'note-ms' }) }),
                    }),
                };
            }
            if (name === 'groups') {
                return {
                    doc: vi.fn().mockReturnValue({
                        id: 'group-ms',
                        collection: (subName: string) => {
                            if (subName === 'messages') return mockMessagesCollection;
                            return { doc: vi.fn().mockReturnValue({ id: 'doc-ms' }) };
                        },
                    }),
                };
            }
            return {
                doc: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({ catch: vi.fn() }),
                }),
            };
        });

        let capturedTx: any;
        mockRunTransaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
            const tx = {
                get: vi.fn().mockImplementation(async (ref: any) => {
                    if (ref.id === 'user-ms') {
                        return {
                            exists: true,
                            data: () => ({
                                streakCount: 9,
                                daysStudiedCount: 9, // Will become 10 -> Milestone!
                                lastPostDate: '2026-09-08',
                                groupIds: ['group-ms'],
                                nickname: 'Milestone User',
                                language: 'ja',
                            }),
                        };
                    }
                    if (ref.id === 'group-ms') {
                        return {
                            exists: true,
                            data: () => ({
                                id: 'group-ms',
                                members: ['user-ms'],
                            }),
                        };
                    }
                    return { exists: false, data: () => ({}) };
                }),
                set: vi.fn(),
                update: vi.fn(),
            };
            capturedTx = tx;
            return callback(tx);
        });

        const result = await OneTapService.completeStudy({ uid: 'user-ms', themeId: 'charity' });
        expect(result.success).toBe(true);
        expect(result.daysStudiedCount).toBe(10);

        const latestCall = capturedTx.set.mock.calls.find((call: any[]) => 
            call[1] && typeof call[1] === 'object' && 'messages' in call[1]
        );
        expect(latestCall).toBeDefined();
        expect(latestCall[1].messages).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'msg-ms-2',
                    isSystemMessage: true,
                    messageType: 'streakAnnouncement',
                    messageData: expect.objectContaining({
                        streakCount: 10,
                        isCumulative: true,
                    }),
                }),
            ])
        );
    });

    it('posts AI partner congratulation if group is an AI companion group', async () => {
        let msgCounter = 0;
        const mockMessagesCollection = {
            doc: vi.fn().mockImplementation((docId?: string) => {
                if (docId) return { id: docId };
                msgCounter++;
                return { id: `msg-ai-${msgCounter}` };
            }),
        };

        mockCollection.mockImplementation((name: string) => {
            if (name === 'users') {
                return {
                    doc: vi.fn().mockReturnValue({
                        id: 'user-ai',
                        collection: () => ({ doc: vi.fn().mockReturnValue({ id: 'note-ai' }) }),
                    }),
                };
            }
            if (name === 'groups') {
                return {
                    doc: vi.fn().mockReturnValue({
                        id: 'group-ai',
                        collection: (subName: string) => {
                            if (subName === 'messages') return mockMessagesCollection;
                            return { doc: vi.fn().mockReturnValue({ id: 'doc-ai' }) };
                        },
                    }),
                };
            }
            return {
                doc: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({ catch: vi.fn() }),
                }),
            };
        });

        let capturedTx: any;
        mockRunTransaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
            const tx = {
                get: vi.fn().mockImplementation(async (ref: any) => {
                    if (ref.id === 'user-ai') {
                        return {
                            exists: true,
                            data: () => ({
                                streakCount: 1,
                                daysStudiedCount: 1,
                                lastPostDate: '2026-09-08',
                                groupIds: ['group-ai'],
                                nickname: 'AI Student',
                                language: 'ja',
                            }),
                        };
                    }
                    if (ref.id === 'group-ai') {
                        return {
                            exists: true,
                            data: () => ({
                                id: 'group-ai',
                                members: ['user-ai'],
                                isAiGroup: true,
                            }),
                        };
                    }
                    return { exists: false, data: () => ({}) };
                }),
                set: vi.fn(),
                update: vi.fn(),
            };
            capturedTx = tx;
            return callback(tx);
        });

        const result = await OneTapService.completeStudy({ uid: 'user-ai', themeId: 'gratitude' });
        expect(result.success).toBe(true);

        const latestCall = capturedTx.set.mock.calls.find((call: any[]) => 
            call[1] && typeof call[1] === 'object' && 'messages' in call[1]
        );
        expect(latestCall).toBeDefined();
        expect(latestCall[1].messages).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'msg-ai-1',
                    isNote: true,
                }),
                expect.objectContaining({
                    id: 'msg-ai-2',
                    isSystemMessage: true,
                    messageType: 'notePostedAnnouncement',
                }),
                expect.objectContaining({
                    senderId: 'ai-partner-bot',
                    isSystemMessage: false,
                    isNote: false,
                }),
            ])
        );
    });
});

