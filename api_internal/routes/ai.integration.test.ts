// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { db, admin } from '../lib/firebase-admin.js';
import { TestSetup } from '../test-setup.js';
import axios from 'axios';

let mockDbOverride: any = undefined;

vi.mock('../lib/firebase-admin.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/firebase-admin.js')>();
    return {
        ...actual,
        get db() {
            return mockDbOverride !== undefined ? mockDbOverride : actual.db;
        }
    };
});

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('AI Route Integration', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();
    const USER_ID = 'AI_TEST_USER';
    const GROUP_ID = 'AI_TEST_GROUP';

    let originalSkipAi: string | undefined;

    beforeAll(async () => {
        originalSkipAi = process.env.SKIP_AI;
        process.env.SKIP_AI = 'false';
        process.env.GEMINI_API_KEY = 'fake-gemini-key';
        await setup.start();
    });

    afterAll(async () => {
        vi.restoreAllMocks();
        process.env.SKIP_AI = originalSkipAi;
        await setup.stop();
    });

    beforeEach(async () => {
        vi.restoreAllMocks();
        setup.mockAuth(USER_ID);

        // 1. Clear translation_cache collection
        const cacheSnap = await db.collection('translation_cache').get();
        const batchCache = db.batch();
        cacheSnap.docs.forEach(d => batchCache.delete(d.ref));
        await batchCache.commit();
        const messagesSnap = await db.collection('groups').doc(GROUP_ID).collection('messages').get();
        const batchMessages = db.batch();
        messagesSnap.docs.forEach(d => batchMessages.delete(d.ref));
        await batchMessages.commit();
        await db.collection('groups').doc(GROUP_ID).delete();

        // 3. Clear user notes, recaps & user document
        const notesSnap = await db.collection('users').doc(USER_ID).collection('notes').get();
        const batchNotes = db.batch();
        notesSnap.docs.forEach(d => batchNotes.delete(d.ref));
        await batchNotes.commit();

        const recapsSnap = await db.collection('users').doc(USER_ID).collection('recaps').get();
        const batchRecaps = db.batch();
        recapsSnap.docs.forEach(d => batchRecaps.delete(d.ref));
        await batchRecaps.commit();

        const lettersSnap = await db.collection('users').doc(USER_ID).collection('letters').get();
        const batchLetters = db.batch();
        lettersSnap.docs.forEach(d => batchLetters.delete(d.ref));
        await batchLetters.commit();

        await db.collection('users').doc(USER_ID).delete();
    });

    const mockGeminiResponse = (text: string) => {
        return vi.spyOn(axios, 'post').mockResolvedValue({
            status: 200,
            data: {
                candidates: [
                    {
                        content: {
                            parts: [
                                { text }
                            ]
                        }
                    }
                ]
            }
        } as any);
    };

    const mockGeminiSafetyBlock = () => {
        return vi.spyOn(axios, 'post').mockResolvedValue({
            status: 200,
            data: {
                candidates: [
                    {
                        finishReason: 'SAFETY'
                    }
                ]
            }
        } as any);
    };

    describe('POST /generate-ponder-questions', () => {
        it('should successfully generate study questions', async () => {
            const promptMock = mockGeminiResponse('What did you learn today?');

            const res = await fetch(`${setup.baseUrl}/api/ai/generate-ponder-questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    scripture: '1 Nephi',
                    chapter: '1',
                    language: 'en'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.questions).toBe('What did you learn today?');
            expect(promptMock).toHaveBeenCalled();
        });

        it('should return 400 for invalid validation', async () => {
            const res = await fetch(`${setup.baseUrl}/api/ai/generate-ponder-questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    scripture: '1 Nephi'
                })
            });

            expect(res.status).toBe(400);
        });

        it('should handle safety blocks from Gemini', async () => {
            mockGeminiSafetyBlock();

            const res = await fetch(`${setup.baseUrl}/api/ai/generate-ponder-questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    scripture: '1 Nephi',
                    chapter: '1',
                    language: 'en'
                })
            });

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe('AI ponder questions failed');
            expect(data.details).toContain('AI content blocked by safety filters');
        });
    });

    describe('POST /translate', () => {
        const TEXT_TO_TRANSLATE = 'Study note hello';
        const CACHE_KEY = 'a5a04b8e2acd60ecc2414942920055f0'; // md5 of: Study note hello_ja_normal

        beforeEach(async () => {
            await db.collection('translation_cache').doc(CACHE_KEY).delete();
        });

        it('should translate and cache successfully when cache is missed', async () => {
            const promptMock = mockGeminiResponse('勉強ノートこんにちは');

            const res = await fetch(`${setup.baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    text: TEXT_TO_TRANSLATE,
                    targetLanguage: 'ja'
                })
            });

            const status = res.status;
            const data = await res.json();
            if (status !== 200) {
                console.error('--- DEBUG TRANSLATE 1 ---', status, data);
            }

            expect(status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.translatedText).toBe('勉強ノートこんにちは');
            expect(promptMock).toHaveBeenCalled();

            // Verify was cached in Firestore
            const cacheDoc = await db.collection('translation_cache').doc(CACHE_KEY).get();
            expect(cacheDoc.exists).toBe(true);
            expect(cacheDoc.data()?.translatedText).toBe('勉強ノートこんにちは');
        });

        it('should hit cache and not call Gemini if already cached', async () => {
            await db.collection('translation_cache').doc(CACHE_KEY).set({
                originalText: TEXT_TO_TRANSLATE,
                translatedText: 'Cached translation',
                targetLanguage: 'ja',
                createdAt: new Date()
            });

            const promptMock = mockGeminiResponse('Should not call this');

            const res = await fetch(`${setup.baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    text: TEXT_TO_TRANSLATE,
                    targetLanguage: 'ja'
                })
            });

            const status = res.status;
            const data = await res.json();
            if (status !== 200) {
                console.error('--- DEBUG TRANSLATE 2 ---', status, data);
            }

            expect(status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.translatedText).toBe('Cached translation');
            expect(promptMock).not.toHaveBeenCalled();
        });

        it('should bypass cache if force=true', async () => {
            await db.collection('translation_cache').doc(CACHE_KEY).set({
                originalText: TEXT_TO_TRANSLATE,
                translatedText: 'Cached translation',
                targetLanguage: 'ja',
                createdAt: new Date()
            });

            const promptMock = mockGeminiResponse('Forced translation');

            const res = await fetch(`${setup.baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    text: TEXT_TO_TRANSLATE,
                    targetLanguage: 'ja',
                    force: true
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.translatedText).toBe('Forced translation');
            expect(promptMock).toHaveBeenCalled();
        });

        it('should handle custom updateTypes (group_name / group_description)', async () => {
            const promptMock = mockGeminiResponse('Translated Group Name');

            const res = await fetch(`${setup.baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    text: 'Original Group Name',
                    targetLanguage: 'es',
                    updateType: 'group_name'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.translatedText).toBe('Translated Group Name');
            expect(promptMock).toHaveBeenCalled();
        });

        it('should persist translation to message doc and group doc if ids are provided', async () => {
            const MSG_ID = 'AI_TRANS_MSG';
            // Seed group and message docs
            await db.collection('groups').doc(GROUP_ID).set({ name: 'Group' });
            await db.collection('groups').doc(GROUP_ID).collection('messages').doc(MSG_ID).set({ text: 'Original Msg' });

            mockGeminiResponse('Translated Msg');

            const res = await fetch(`${setup.baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    text: 'Original Msg',
                    targetLanguage: 'ja',
                    messageId: MSG_ID,
                    groupId: GROUP_ID
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.translatedText).toBe('Translated Msg');

            // Verify message doc update
            const msgSnap = await db.collection('groups').doc(GROUP_ID).collection('messages').doc(MSG_ID).get();
            expect(msgSnap.data()?.translations?.ja).toBe('Translated Msg');
        });

        it('should persist metadata translation to group doc if updateType is provided', async () => {
            await db.collection('groups').doc(GROUP_ID).set({ name: 'Original Name' });

            mockGeminiResponse('Nom de Groupe');

            const res = await fetch(`${setup.baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    text: 'Original Name',
                    targetLanguage: 'pt',
                    groupId: GROUP_ID,
                    updateType: 'group_name'
                })
            });

            const status = res.status;
            const data = await res.json();
            if (status !== 200) {
                console.error('--- DEBUG TRANSLATE METADATA ---', status, data);
            }

            expect(status).toBe(200);
            const groupSnap = await db.collection('groups').doc(GROUP_ID).get();
            expect(groupSnap.data()?.translations?.pt?.name).toBe('Nom de Groupe');
        });

        it('should handle persist error gracefully without breaking the response', async () => {
            mockGeminiResponse('Safe output');
            vi.spyOn(admin.firestore.DocumentReference.prototype, 'update').mockRejectedValue(new Error('Update failed'));

            const res = await fetch(`${setup.baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    text: 'Original',
                    targetLanguage: 'ja',
                    groupId: 'NON_EXISTENT',
                    updateType: 'group_name'
                })
            });

            const status = res.status;
            const data = await res.json();
            if (status !== 200) {
                console.error('--- DEBUG PERSIST ERROR ---', status, data);
            }

            expect(status).toBe(200); // Succeeds despite firestore write failure
        });
    });

    describe('POST /translate-batch', () => {
        const MSG_1 = { id: 'm1', text: 'Text one' };
        const MSG_2 = { id: 'm2', text: 'Text two' };
        const KEY_1 = '4a82408a854e1bc3f9e28110bb9c9f80'; // md5 of Text one_ja_normal
        
        beforeEach(async () => {
            await db.collection('translation_cache').doc(KEY_1).delete();
        });

        it('should translate batch successfully and use cache where possible', async () => {
            // Seed one cached item
            await db.collection('translation_cache').doc(KEY_1).set({
                originalText: 'Text one',
                translatedText: 'テキスト１',
                targetLanguage: 'ja'
            });

            // Mock Gemini for the other uncached item. Returning JSON format.
            mockGeminiResponse(JSON.stringify({ m2: 'テキスト２' }));

            const res = await fetch(`${setup.baseUrl}/api/ai/translate-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    messages: [MSG_1, MSG_2],
                    targetLanguage: 'ja',
                    groupId: GROUP_ID
                })
            });

            const status = res.status;
            const data = await res.json();
            if (status !== 200) {
                console.error('--- DEBUG BATCH ---', status, data);
            }

            expect(status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.translations.m1).toBe('テキスト１');
            expect(data.translations.m2).toBe('テキスト２');
        });

        it('should fallback gracefully to plain text translation for single message if Gemini returns non-JSON', async () => {
            mockGeminiResponse('テキスト２');

            const res = await fetch(`${setup.baseUrl}/api/ai/translate-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    messages: [MSG_2],
                    targetLanguage: 'ja',
                    groupId: GROUP_ID
                })
            });

            const status = res.status;
            const data = await res.json();

            expect(status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.translations.m2).toBe('テキスト２');
        });

        it('should fallback to original text for multi-message batch if Gemini returns invalid JSON', async () => {
            mockGeminiResponse('This is not JSON text at all!');

            const res = await fetch(`${setup.baseUrl}/api/ai/translate-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    messages: [MSG_1, MSG_2],
                    targetLanguage: 'ja',
                    groupId: GROUP_ID
                })
            });

            const status = res.status;
            const data = await res.json();

            expect(status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.translations.m1).toBe('Text one');
            expect(data.translations.m2).toBe('Text two');
        });

        it('should survive if batch commit throws timeout / persistence fail', async () => {
            vi.spyOn(admin.firestore.Firestore.prototype, 'batch').mockImplementation(() => {
                return {
                    set: () => {},
                    commit: () => Promise.reject(new Error('Persistence timeout mock'))
                } as any;
            });

            mockGeminiResponse(JSON.stringify({ m2: 'テキスト２' }));

            const res = await fetch(`${setup.baseUrl}/api/ai/translate-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    messages: [MSG_2],
                    targetLanguage: 'ja',
                    groupId: GROUP_ID
                })
            });

            expect(res.status).toBe(200); // Survives the commit fail
            const data = await res.json();
            expect(data.translations.m2).toBe('テキスト２');
        });
    });

    describe('POST /generate-personal-weekly-recap', () => {
        beforeEach(async () => {
            await db.collection('users').doc(USER_ID).delete();
        });

        it('should return 403 if requested uid is not the authenticated user', async () => {
            const res = await fetch(`${setup.baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    uid: 'OTHER_USER_UID',
                    language: 'en'
                })
            });
            expect(res.status).toBe(403);
        });

        it('should return 404 if user does not exist', async () => {
            const res = await fetch(`${setup.baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    uid: USER_ID,
                    language: 'en'
                })
            });
            expect(res.status).toBe(404);
        });

        it('should return 400 if personal letter requested with fewer than 2 new notes', async () => {
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 3);

            await db.collection('users').doc(USER_ID).set({
                uid: USER_ID,
                lastRecapGeneratedAt: admin.firestore.Timestamp.fromDate(recentDate)
            });

            const res = await fetch(`${setup.baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    uid: USER_ID,
                    language: 'en'
                })
            });
            expect(res.status).toBe(400);
        });

        it('should return cached recap if generated too recently and recap exists in collection', async () => {
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 3);

            await db.collection('users').doc(USER_ID).set({
                uid: USER_ID,
                lastRecapGeneratedAt: admin.firestore.Timestamp.fromDate(recentDate)
            });

            const userRef = db.collection('users').doc(USER_ID);
            await userRef.collection('recaps').add({
                text: 'This is a cached recap from a few days ago.',
                createdAt: admin.firestore.Timestamp.fromDate(recentDate)
            });

            const res = await fetch(`${setup.baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    uid: USER_ID,
                    language: 'en'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.recap).toBe('This is a cached recap from a few days ago.');
            expect(data.fromCache).toBe(true);
        });

        it('should return cached recap from letters fallback if recaps collection is empty but letter exists', async () => {
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 3);

            await db.collection('users').doc(USER_ID).set({
                uid: USER_ID,
                lastRecapGeneratedAt: admin.firestore.Timestamp.fromDate(recentDate)
            });

            const userRef = db.collection('users').doc(USER_ID);
            await userRef.collection('letters').add({
                content: 'This is a cached recap from letters collection.',
                type: 'weekly_recap',
                createdAt: admin.firestore.Timestamp.fromDate(recentDate)
            });

            const res = await fetch(`${setup.baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    uid: USER_ID,
                    language: 'en'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.recap).toBe('This is a cached recap from letters collection.');
            expect(data.fromCache).toBe(true);
        });

        it('should return 200 with no notes message if no personal notes found', async () => {
            await db.collection('users').doc(USER_ID).set({
                uid: USER_ID
            });

            const res = await fetch(`${setup.baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    uid: USER_ID,
                    language: 'en'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toBe('No personal notes found.');
        });

        it('should generate personal recap successfully and cache/persist correctly', async () => {
            await db.collection('users').doc(USER_ID).set({
                uid: USER_ID
            });

            const userRef = db.collection('users').doc(USER_ID);
            await userRef.collection('notes').add({
                comment: 'Faith is hope in things not seen.',
                createdAt: admin.firestore.Timestamp.now()
            });
            await userRef.collection('notes').add({
                comment: 'Charity never faileth.',
                createdAt: admin.firestore.Timestamp.now()
            });

            mockGeminiResponse('Title: Living by Faith\n\nDear Friend, you had a wonderful study of faith.');

            const res = await fetch(`${setup.baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    uid: USER_ID,
                    language: 'en'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.title).toBe('Living by Faith');
            expect(data.recap).toBe('Dear Friend, you had a wonderful study of faith.');

            // Verify user's lastRecapGeneratedAt update
            const userSnap = await db.collection('users').doc(USER_ID).get();
            expect(userSnap.data()?.lastRecapGeneratedAt).toBeDefined();
            expect(userSnap.data()?.lastLetterGeneratedAt).toBeDefined();

            // Verify recap document exists with expiresAt
            const recapsSnap = await userRef.collection('recaps').get();
            expect(recapsSnap.empty).toBe(false);
            expect(recapsSnap.docs[0].data().title).toBe('Living by Faith');
            expect(recapsSnap.docs[0].data().text).toBe('Dear Friend, you had a wonderful study of faith.');
            expect(recapsSnap.docs[0].data().expiresAt).toBeDefined();

            // Verify letters document exists with expiresAt
            const lettersSnap = await userRef.collection('letters').get();
            expect(lettersSnap.empty).toBe(false);
            expect(lettersSnap.docs[0].data().title).toBe('Living by Faith');
            expect(lettersSnap.docs[0].data().content).toBe('Dear Friend, you had a wonderful study of faith.');
            expect(lettersSnap.docs[0].data().expiresAt).toBeDefined();
        });

        it('should survive if personal recap persistence fails', async () => {
            await db.collection('users').doc(USER_ID).set({
                uid: USER_ID
            });

            const userRef = db.collection('users').doc(USER_ID);
            await userRef.collection('notes').add({
                comment: 'Faith is hope in things not seen.',
                createdAt: admin.firestore.Timestamp.now()
            });
            await userRef.collection('notes').add({
                comment: 'Charity never faileth.',
                createdAt: admin.firestore.Timestamp.now()
            });

            mockGeminiResponse('Dear Friend, you had a wonderful study of faith.');

            // Force set to fail
            vi.spyOn(admin.firestore.DocumentReference.prototype, 'set').mockRejectedValue(new Error('Storage quota exceeded'));

            const res = await fetch(`${setup.baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    uid: USER_ID,
                    language: 'en'
                })
            });

            expect(res.status).toBe(200); // Succeeds despite persistence failure
            const data = await res.json();
            expect(data.recap).toBe('Dear Friend, you had a wonderful study of faith.');
        });
    });

    describe('process.env.SKIP_AI = true bypass paths', () => {
        beforeAll(() => {
            process.env.SKIP_AI = 'true';
        });

        afterAll(() => {
            process.env.SKIP_AI = 'false';
        });

        it('should bypass and return mocked ponder questions', async () => {
            const res = await fetch(`${setup.baseUrl}/api/ai/generate-ponder-questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({ scripture: 'Genesis', chapter: '1', language: 'en' })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.questions).toBe('Mocked Study Question');
        });

        it('should bypass and return original text for translation', async () => {
            const res = await fetch(`${setup.baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({ text: 'Hello World', targetLanguage: 'ja' })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.translatedText).toBe('Hello World');
        });

        it('should bypass and return original texts for batch translation', async () => {
            const res = await fetch(`${setup.baseUrl}/api/ai/translate-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    messages: [{ id: '1', text: 'Text One' }],
                    targetLanguage: 'ja',
                    groupId: GROUP_ID
                })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.translations['1']).toBe('Text One');
        });


        it('should bypass and return mocked personal recap', async () => {
            await db.collection('users').doc(USER_ID).set({ uid: USER_ID });
            const res = await fetch(`${setup.baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({ uid: USER_ID, language: 'en' })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.recap).toBe('Mocked Personal Recap');
        });
    });

    describe('Failure and Timeout coverage', () => {

        it('should handle timeout when fetching notes for personal recap', async () => {
            await db.collection('users').doc(USER_ID).set({ uid: USER_ID });

            // Force query get to reject to simulate timeout/error
            vi.spyOn(admin.firestore.Query.prototype, 'get').mockRejectedValue(new Error('Firestore timeout'));

            const res = await fetch(`${setup.baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({ uid: USER_ID, language: 'en' })
            });

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe('AI personal recap failed');
        });

        it('should handle empty response in callGemini', async () => {
            // Mock empty candidates
            vi.spyOn(axios, 'post').mockResolvedValue({
                status: 200,
                data: { candidates: [] }
            } as any);

            const res = await fetch(`${setup.baseUrl}/api/ai/generate-ponder-questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({ scripture: 'Genesis', chapter: '1', language: 'en' })
            });
            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe('AI ponder questions failed');
        });

        it('should bypass translation cache on read error', async () => {
            vi.spyOn(admin.firestore.DocumentReference.prototype, 'get').mockRejectedValue(new Error('Cache read failure'));
            mockGeminiResponse('Translated online');

            const res = await fetch(`${setup.baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({ text: 'Hello World', targetLanguage: 'ja' })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.translatedText).toBe('Translated online');
        });

        it('should warn and skip when cache set fails', async () => {
            vi.spyOn(admin.firestore.DocumentReference.prototype, 'set').mockRejectedValue(new Error('Cache write failure'));
            mockGeminiResponse('Translated online');

            const res = await fetch(`${setup.baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({ text: 'Hello World', targetLanguage: 'ja' })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.translatedText).toBe('Translated online');
        });

        it('should log error when updating message document fails', async () => {
            vi.spyOn(admin.firestore.DocumentReference.prototype, 'update').mockRejectedValue(new Error('Update msg failure'));
            mockGeminiResponse('Translated online');

            const res = await fetch(`${setup.baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    text: 'Hello World',
                    targetLanguage: 'ja',
                    messageId: 'MSG_123',
                    groupId: GROUP_ID
                })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.translatedText).toBe('Translated online');
        });

        it('should handle general translation error in callGemini', async () => {
            vi.spyOn(axios, 'post').mockRejectedValue(new Error('Gemini offline'));

            const res = await fetch(`${setup.baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({ text: 'Hello World', targetLanguage: 'ja' })
            });
            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe('AI translation failed');
        });

        it('should handle global catch in batch translation cache check', async () => {
            const originalCollection = admin.firestore.Firestore.prototype.collection;
            let shouldThrow = true;
            vi.spyOn(admin.firestore.Firestore.prototype, 'collection').mockImplementation(function(this: any, ...args: unknown[]) {
                const name = args[0] as string;
                if (shouldThrow && name === 'translation_cache') {
                    shouldThrow = false;
                    throw new Error('Global collection failure');
                }
                return originalCollection.call(this, name);
            });
            mockGeminiResponse(JSON.stringify({ '1': 'Uncached Translated' }));

            const res = await fetch(`${setup.baseUrl}/api/ai/translate-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    messages: [{ id: '1', text: 'Text One' }],
                    targetLanguage: 'ja',
                    groupId: GROUP_ID
                })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.translations['1']).toBe('Uncached Translated');
        });

        it('should bypass cache check in batch translation if FIRESTORE_EMULATOR_HOST is missing', async () => {
            const oldEmulator = process.env.FIRESTORE_EMULATOR_HOST;
            delete process.env.FIRESTORE_EMULATOR_HOST;
            mockGeminiResponse(JSON.stringify({ '1': 'Direct Translation' }));

            const res = await fetch(`${setup.baseUrl}/api/ai/translate-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    messages: [{ id: '1', text: 'Text One' }],
                    targetLanguage: 'ja',
                    groupId: GROUP_ID
                })
            });
            process.env.FIRESTORE_EMULATOR_HOST = oldEmulator;
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.translations['1']).toBe('Direct Translation');
        });

        it('should fallback to populating results without DB in batch translation', async () => {
            mockDbOverride = null;
            mockGeminiResponse(JSON.stringify({ '1': 'Offline Translation' }));

            const res = await fetch(`${setup.baseUrl}/api/ai/translate-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    messages: [{ id: '1', text: 'Text One' }],
                    targetLanguage: 'ja',
                    groupId: GROUP_ID
                })
            });
            mockDbOverride = undefined;
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.translations['1']).toBe('Offline Translation');
        });


        it('should handle Axios-like error with non-string response data in handleAiError', async () => {
            const fakeAxiosErr = new Error('Axios error');
            (fakeAxiosErr as any).response = {
                status: 429,
                data: { error: 'Quota exceeded' }
            };
            vi.spyOn(axios, 'post').mockRejectedValue(fakeAxiosErr);

            const res = await fetch(`${setup.baseUrl}/api/ai/generate-ponder-questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({ scripture: 'Genesis', chapter: '1', language: 'en' })
            });
            expect(res.status).toBe(429);
            const data = await res.json();
            expect(data.error).toBe('AI ponder questions failed');
            expect(data.details).toBe('Axios error');
        });
    });
});

