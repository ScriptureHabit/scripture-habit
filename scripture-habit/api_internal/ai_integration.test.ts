// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import app from '../api/api.js';
import { Server } from 'http';
import { auth, admin } from './lib/firebase-admin.js';
import axios from 'axios';

const isRealAi = process.env.USE_REAL_AI === 'true';

describe('AI Prompt Construction Regression', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
        process.env.SKIP_APP_CHECK = 'true';
        process.env.SENTRY_DISABLED = 'true'; // Disable Sentry in tests
        if (!isRealAi) {
            process.env.GEMINI_API_KEY = 'dummy-key';
        }
        
        return new Promise<void>((resolve) => {
            server = app.listen(0, () => {
                const addr = server.address();
                if (addr && typeof addr !== 'string') {
                    baseUrl = `http://localhost:${addr.port}`;
                }
                resolve();
            });
        });
    });

    afterAll(async () => {
        vi.restoreAllMocks();
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        if (!isRealAi) {
            vi.spyOn(axios, 'post').mockResolvedValue({
                data: {
                    candidates: [{
                        content: { parts: [{ text: '{"msg1": "AI Response"}' }] }
                    }]
                }
            } as any);
        }
    });

    const mockAuth = (uid: string = 'test-user') => {
        vi.spyOn(auth, 'verifyIdToken').mockResolvedValue({
            uid,
            email_verified: true,
            firebase: { sign_in_provider: 'password' }
        } as unknown as admin.auth.DecodedIdToken);
    };

    it('should construct correct prompt for /api/ai/generate-ponder-questions', async () => {
        mockAuth();
        await fetch(`${baseUrl}/api/ai/generate-ponder-questions`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                scripture: 'John 3:16',
                chapter: '1',
                language: 'ja'
            })
        });

        const axiosCall = vi.mocked(axios.post).mock.calls[0];
        const prompt = (axiosCall[1] as { contents: Array<{ parts: Array<{ text: string }> }> }).contents[0].parts[0].text;

        expect(prompt).toContain('John 3:16 1');
        expect(prompt).toContain('Japanese');
        expect(prompt).toMatchSnapshot();
    });

    it('should construct correct prompt for /api/ai/translate (standard)', async () => {
        mockAuth();
        await fetch(`${baseUrl}/api/ai/translate`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: 'Hello world',
                targetLanguage: 'es',
                force: true
            })
        });

        const axiosCall = vi.mocked(axios.post).mock.calls[0];
        const prompt = (axiosCall[1] as { contents: Array<{ parts: Array<{ text: string }> }> }).contents[0].parts[0].text;

        expect(prompt).toContain('Translate the following study note into Spanish');
        expect(prompt).toContain('Hello world');
        expect(prompt).toMatchSnapshot();
    });

    it('should construct correct prompt for /api/ai/translate (group metadata)', async () => {
        mockAuth();
        await fetch(`${baseUrl}/api/ai/translate`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: 'My Awesome Group',
                targetLanguage: 'ja',
                updateType: 'group_name',
                force: true
            })
        });

        const axiosCall = vi.mocked(axios.post).mock.calls[0];
        const prompt = (axiosCall[1] as { contents: Array<{ parts: Array<{ text: string }> }> }).contents[0].parts[0].text;

        expect(prompt).toContain('Translate the following group name into Japanese');
        expect(prompt).toContain('Output ONLY the translated plain text');
        expect(prompt).toMatchSnapshot();
    });

    it('should construct correct prompt for /api/ai/translate-batch', async () => {
        mockAuth();
        await fetch(`${baseUrl}/api/ai/translate-batch`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [{ id: 'msg1', text: 'Note 1' }],
                targetLanguage: 'pt',
                groupId: 'group1',
                force: true
            })
        });

        const axiosCall = vi.mocked(axios.post).mock.calls[0];
        const prompt = (axiosCall[1] as { contents: Array<{ parts: Array<{ text: string }> }> }).contents[0].parts[0].text;

        expect(prompt).toContain('Translate these message items into Portuguese');
        expect(prompt).toContain('Note 1');
        expect(prompt).toMatchSnapshot();
    });

    it('should handle hallucinated missing IDs in translate-batch gracefully', async () => {
        mockAuth();
        if (!isRealAi) {
            // Mock AI to only return msg1, completely ignoring msg2
            vi.mocked(axios.post).mockResolvedValue({
                data: {
                    candidates: [{
                        content: { parts: [{ text: '```json\n{"hallu1": "Translated 1"}\n```' }] }
                    }]
                }
            });
        }

        const res = await fetch(`${baseUrl}/api/ai/translate-batch`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [{ id: 'hallu1', text: 'Hallucination Note 1' }, { id: 'hallu2', text: 'Hallucination Note 2' }],
                targetLanguage: 'pt',
                groupId: 'group1',
                force: true
            })
        });

        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        if (!isRealAi) {
            expect(data.translations).toHaveProperty('hallu1');
            expect(data.translations.hallu1).toBe('Translated 1');
            // hallu2 was hallucinated/dropped by AI, it should just be missing, not crash the server
            expect(data.translations).not.toHaveProperty('hallu2');
        }
    }, 15000);

    it('should separate cache keys based on updateType to prevent cache poisoning', async () => {
        const testText = 'Category:';
        mockAuth();
        
        // Ensure cache is empty for this text
        const crypto = await import('crypto');
        const cacheKeyNormal = crypto.createHash('md5').update(`${testText}_ja_normal`).digest('hex');
        const cacheKeyGroup = crypto.createHash('md5').update(`${testText}_ja_group_name`).digest('hex');
        
        const { db } = await import('./lib/firebase-admin.js');
        await db.collection('translation_cache').doc(cacheKeyNormal).delete();
        await db.collection('translation_cache').doc(cacheKeyGroup).delete();

        if (!isRealAi) {
            vi.mocked(axios.post).mockResolvedValue({
                data: { candidates: [{ content: { parts: [{ text: 'Mocked Translation' }] } }] }
            });
        }

        // Request 1: Normal
        await fetch(`${baseUrl}/api/ai/translate`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: testText, targetLanguage: 'ja' })
        });

        // Request 2: Group Name
        await fetch(`${baseUrl}/api/ai/translate`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: testText, targetLanguage: 'ja', updateType: 'group_name' })
        });

        // Verify both documents exist separately
        const docNormal = await db.collection('translation_cache').doc(cacheKeyNormal).get();
        const docGroup = await db.collection('translation_cache').doc(cacheKeyGroup).get();

        expect(docNormal.exists).toBe(true);
        expect(docGroup.exists).toBe(true);
    }, 15000);

    it('should construct correct prompt for /api/ai/generate-personal-weekly-recap', async () => {
        const testUid = `ai-user-${Date.now()}`;
        mockAuth(testUid);

        // Setup user and notes in emulator
        const { db } = await import('./lib/firebase-admin.js');
        await db.collection('users').doc(testUid).set({
            displayName: 'AI Test User'
        });
        await db.collection('users').doc(testUid).collection('notes').add({
            text: 'I learned about faith today.',
            createdAt: new Date()
        });

        await fetch(`${baseUrl}/api/ai/generate-personal-weekly-recap`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uid: testUid,
                language: 'en'
            })
        });

        const axiosCall = vi.mocked(axios.post).mock.calls[0];
        const prompt = (axiosCall[1] as { contents: Array<{ parts: Array<{ text: string }> }> }).contents[0].parts[0].text;

        expect(prompt).toContain('Task: Write a warm personal letter');
        expect(prompt).toContain('I learned about faith today.');
        expect(prompt).toMatchSnapshot();
    }, 60000);

    describe('SKIP_AI === true mode', () => {
        const originalSkipAi = process.env.SKIP_AI;

        beforeAll(() => {
            process.env.SKIP_AI = 'true';
        });

        afterAll(() => {
            process.env.SKIP_AI = originalSkipAi;
        });

        it('should return mocked study questions for /generate-ponder-questions', async () => {
            mockAuth();
            const res = await fetch(`${baseUrl}/api/ai/generate-ponder-questions`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ scripture: 'Alma 32', chapter: '21', language: 'en' })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.questions).toBe('Mocked Study Question');
        });

        it('should return mocked translation for /translate', async () => {
            mockAuth();
            const res = await fetch(`${baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: 'Original text to translate', targetLanguage: 'ja' })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.translatedText).toBe('Original text to translate');
        });

        it('should return mocked batch translations for /translate-batch', async () => {
            mockAuth();
            const res = await fetch(`${baseUrl}/api/ai/translate-batch`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [{ id: 'm1', text: 'Text 1' }], targetLanguage: 'es', groupId: 'g1' })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.translations).toEqual({ m1: 'Text 1' });
        });

        it('should return mocked recap for /generate-weekly-recap', async () => {
            const testUid = `recap-uid-${Date.now()}`;
            mockAuth(testUid);
            const res = await fetch(`${baseUrl}/api/ai/generate-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: 'group1', language: 'ja' })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.recap).toBe('Mocked Weekly Recap');
        });

        it('should return mocked discussion topic for /generate-discussion-topic', async () => {
            mockAuth();
            const res = await fetch(`${baseUrl}/api/ai/generate-discussion-topic`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: 'en' })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.topic).toBe('Mocked Discussion Topic');
        });

        it('should return mocked personal recap for /generate-personal-weekly-recap', async () => {
            const testUid = `recap-uid-${Date.now()}`;
            mockAuth(testUid);
            const res = await fetch(`${baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: testUid, language: 'en' })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.recap).toBe('Mocked Personal Recap');
        });
    });

    describe('Validation and Authentication Failures', () => {
        it('should return 401 if unauthenticated on generating questions', async () => {
            const res = await fetch(`${baseUrl}/api/ai/generate-ponder-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scripture: 'John 1', chapter: '1' })
            });
            expect(res.status).toBe(401);
        });

        it('should return 400 if invalid input for generate-ponder-questions', async () => {
            mockAuth();
            const res = await fetch(`${baseUrl}/api/ai/generate-ponder-questions`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ scripture: 'John 1' }) // Missing chapter
            });
            expect(res.status).toBe(400);
        });

        it('should return 400 if invalid input for translate', async () => {
            mockAuth();
            const res = await fetch(`${baseUrl}/api/ai/translate`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: '' }) // Invalid text/targetLanguage
            });
            expect(res.status).toBe(400);
        });

        it('should return 403 Forbidden for generate-personal-weekly-recap if user requests another user\'s recap', async () => {
            mockAuth('user-A');
            const res = await fetch(`${baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: 'user-B', language: 'en' })
            });
            expect(res.status).toBe(403);
            const text = await res.text();
            expect(text).toBe('Forbidden');
        });
    });

    describe('Weekly Recap Edge Cases', () => {
        const testGroupId = `group-recap-${Date.now()}`;
        const testOwnerUid = `user-recap-owner-${Date.now()}`;

        beforeAll(async () => {
            const { db } = await import('./lib/firebase-admin.js');
            await db.collection('groups').doc(testGroupId).set({
                ownerUserId: testOwnerUid,
                name: 'Recap Test Group'
            });
        });

        it('should return 404 if group is not found', async () => {
            mockAuth(testOwnerUid);
            const res = await fetch(`${baseUrl}/api/ai/generate-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: 'non-existent-group', language: 'en' })
            });
            expect(res.status).toBe(404);
            const text = await res.text();
            expect(text).toBe('Group not found');
        });

        it('should return 403 if user is not the group owner', async () => {
            mockAuth('not-the-owner');
            const res = await fetch(`${baseUrl}/api/ai/generate-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: testGroupId, language: 'en' })
            });
            expect(res.status).toBe(403);
            const text = await res.text();
            expect(text).toBe('Access denied: Owner only');
        });

        it('should return message if no notes exist for this week', async () => {
            mockAuth(testOwnerUid);
            const res = await fetch(`${baseUrl}/api/ai/generate-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: testGroupId, language: 'en' })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toBe('No notes found for this week.');
        });

        it('should enforce weekly recap cooldown rate limit (429)', async () => {
            mockAuth(testOwnerUid);
            const { db } = await import('./lib/firebase-admin.js');
            
            // Set lastRecapGeneratedAt to yesterday
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            await db.collection('groups').doc(testGroupId).update({
                lastRecapGeneratedAt: admin.firestore.Timestamp.fromDate(yesterday)
            });

            const res = await fetch(`${baseUrl}/api/ai/generate-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: testGroupId, language: 'en' })
            });

            expect(res.status).toBe(429);
            const data = await res.json();
            expect(data.error).toBe('Recap already generated recently. Please wait a week.');

            // Clean it up
            await db.collection('groups').doc(testGroupId).update({
                lastRecapGeneratedAt: admin.firestore.FieldValue.delete()
            });
        });

        it('should generate weekly recap and persist to Firestore', async () => {
            mockAuth(testOwnerUid);
            const { db } = await import('./lib/firebase-admin.js');

            // Seed a message matching the weekly query
            await db.collection('groups').doc(testGroupId).collection('messages').add({
                text: 'Faith study note',
                isNote: true,
                createdAt: admin.firestore.Timestamp.fromDate(new Date())
            });

            if (!isRealAi) {
                vi.mocked(axios.post).mockResolvedValue({
                    data: { candidates: [{ content: { parts: [{ text: 'Here is the summary of faith.' }] } }] }
                });
            }

            const res = await fetch(`${baseUrl}/api/ai/generate-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: testGroupId, language: 'en' })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.recap).toBe('Here is the summary of faith.');

            // Verify a system message was persisted in the messages subcollection
            const msgsSnap = await db.collection('groups').doc(testGroupId).collection('messages')
                .where('isSystemMessage', '==', true)
                .get();
            expect(msgsSnap.empty).toBe(false);
            const systemMsg = msgsSnap.docs[0].data();
            expect(systemMsg.text).toBe('Here is the summary of faith.');
            expect(systemMsg.messageType).toBe('weeklyRecap');
        });
    });

    describe('Personal Weekly Recap Edge Cases', () => {
        const testUserUid = `user-personal-recap-${Date.now()}`;

        beforeAll(async () => {
            const { db } = await import('./lib/firebase-admin.js');
            await db.collection('users').doc(testUserUid).set({
                displayName: 'Personal Recap Owner'
            });
        });

        it('should return 404 if user not found', async () => {
            const nonExistentUid = 'non-existent-uid';
            mockAuth(nonExistentUid);
            const res = await fetch(`${baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: nonExistentUid, language: 'en' })
            });
            expect(res.status).toBe(404);
            const text = await res.text();
            expect(text).toBe('User not found');
        });

        it('should return message if no personal notes found', async () => {
            mockAuth(testUserUid);
            const res = await fetch(`${baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: testUserUid, language: 'en' })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toBe('No personal notes found for this week.');
        });

        it('should enforce personal weekly recap cooldown rate limit (429)', async () => {
            mockAuth(testUserUid);
            const { db } = await import('./lib/firebase-admin.js');
            
            // Set lastRecapGeneratedAt to yesterday
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            await db.collection('users').doc(testUserUid).update({
                lastRecapGeneratedAt: admin.firestore.Timestamp.fromDate(yesterday)
            });

            const res = await fetch(`${baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: testUserUid, language: 'en' })
            });

            expect(res.status).toBe(429);
            const data = await res.json();
            expect(data.error).toBe('Personal recap already generated recently. Please wait a week.');

            // Clean it up
            await db.collection('users').doc(testUserUid).update({
                lastRecapGeneratedAt: admin.firestore.FieldValue.delete()
            });
        });

        it('should generate personal recap and persist to Firestore', async () => {
            mockAuth(testUserUid);
            const { db } = await import('./lib/firebase-admin.js');

            // Seed a note
            await db.collection('users').doc(testUserUid).collection('notes').add({
                comment: 'My sweet daily scripture study.',
                createdAt: admin.firestore.Timestamp.fromDate(new Date())
            });

            if (!isRealAi) {
                vi.mocked(axios.post).mockResolvedValue({
                    data: { candidates: [{ content: { parts: [{ text: 'Dear Friend, I see you study daily.' }] } }] }
                });
            }

            const res = await fetch(`${baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: testUserUid, language: 'en' })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.recap).toBe('Dear Friend, I see you study daily.');

            // Verify db persistence of recap
            const recapsSnap = await db.collection('users').doc(testUserUid).collection('recaps').get();
            expect(recapsSnap.empty).toBe(false);
            const recapDoc = recapsSnap.docs[0].data();
            expect(recapDoc.text).toBe('Dear Friend, I see you study daily.');
            expect(recapDoc.type).toBe('weekly_encouragement');

            // Verify user document has updated lastRecapGeneratedAt
            const userSnap = await db.collection('users').doc(testUserUid).get();
            expect(userSnap.data()?.lastRecapGeneratedAt).toBeDefined();
        });
    });

    describe('Discussion Topic and Error Handling', () => {
        it('should generate discussion topic with group notes context', async () => {
            mockAuth();
            const { db } = await import('./lib/firebase-admin.js');
            const groupId = `group-disc-${Date.now()}`;
            
            await db.collection('groups').doc(groupId).set({ name: 'Discussion Group' });
            await db.collection('groups').doc(groupId).collection('messages').add({
                text: 'We discussed charity.',
                isNote: true,
                createdAt: admin.firestore.Timestamp.fromDate(new Date())
            });

            if (!isRealAi) {
                vi.mocked(axios.post).mockResolvedValue({
                    data: { candidates: [{ content: { parts: [{ text: 'What is charity to you?' }] } }] }
                });
            }

            const res = await fetch(`${baseUrl}/api/ai/generate-discussion-topic`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId, language: 'en' })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.topic).toBe('What is charity to you?');

            if (!isRealAi) {
                const axiosCall = vi.mocked(axios.post).mock.calls[0];
                const prompt = (axiosCall[1] as { contents: Array<{ parts: Array<{ text: string }> }> }).contents[0].parts[0].text;
                expect(prompt).toContain('Recent study context');
                expect(prompt).toContain('We discussed charity.');
            }
        });

        it('should handle AI error flow gracefully (500)', async () => {
            mockAuth();
            if (!isRealAi) {
                vi.mocked(axios.post).mockRejectedValue({
                    response: { status: 400, data: 'API Key Blocked' }
                });
            }

            const res = await fetch(`${baseUrl}/api/ai/generate-ponder-questions`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ scripture: 'Alma 32', chapter: '21', language: 'en' })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('AI ponder questions failed');
            expect(data.details).toBe('API Key Blocked');
        });

        it('should handle AI error flow gracefully for generate-discussion-topic', async () => {
            mockAuth();
            if (!isRealAi) {
                vi.mocked(axios.post).mockRejectedValue({
                    response: { status: 403, data: 'API Key Blocked' }
                });
            }

            const res = await fetch(`${baseUrl}/api/ai/generate-discussion-topic`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: 'en' })
            });

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.error).toBe('AI discussion topic failed');
            expect(data.details).toBe('API Key Blocked');
        });

        it('should handle weekly recap query error gracefully', async () => {
            const testGroupId = `group-recap-${Date.now()}`;
            const testOwnerUid = `user-recap-owner-${Date.now()}`;
            mockAuth(testOwnerUid);
            const { db } = await import('./lib/firebase-admin.js');
            
            await db.collection('groups').doc(testGroupId).set({
                ownerUserId: testOwnerUid,
                name: 'Recap Test Group'
            });

            const collectionSpy = vi.spyOn(db, 'collection').mockImplementation(() => {
                throw new Error('Timeout or DB failure');
            });

            const res = await fetch(`${baseUrl}/api/ai/generate-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: testGroupId, language: 'en' })
            });
            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe('AI weekly recap failed');
            expect(data.details).toBe('Timeout or DB failure');

            collectionSpy.mockRestore();
        });

        it('should handle weekly recap persistence warning gracefully', async () => {
            const testGroupId = `group-recap-warn-${Date.now()}`;
            const testOwnerUid = `user-recap-owner-warn-${Date.now()}`;
            mockAuth(testOwnerUid);
            const { db } = await import('./lib/firebase-admin.js');

            await db.collection('groups').doc(testGroupId).set({
                ownerUserId: testOwnerUid,
                name: 'Recap Test Group Warn'
            });

            await db.collection('groups').doc(testGroupId).collection('messages').add({
                text: 'Another study note to recap',
                isNote: true,
                createdAt: admin.firestore.Timestamp.fromDate(new Date())
            });

            // Mock messages collection add to throw an error, mimicking persistence failure
            const originalDoc = db.collection('groups').doc;
            vi.spyOn(db.collection('groups'), 'doc').mockImplementation((id: string) => {
                const docRef = originalDoc.call(db.collection('groups'), id);
                if (id === testGroupId) {
                    return {
                        ...docRef,
                        get: () => docRef.get(),
                        collection: (name: string) => {
                            if (name === 'messages') {
                                const collRef = docRef.collection(name);
                                return {
                                    ...collRef,
                                    where: (field: any, op: any, val: any) => collRef.where(field, op, val),
                                    add: () => {
                                        throw new Error('Persistence add failed');
                                    }
                                } as any;
                            }
                            return docRef.collection(name);
                        }
                    } as any;
                }
                return docRef;
            });

            if (!isRealAi) {
                vi.mocked(axios.post).mockResolvedValue({
                    data: { candidates: [{ content: { parts: [{ text: 'Here is the summary of faith.' }] } }] }
                });
            }

            const res = await fetch(`${baseUrl}/api/ai/generate-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: testGroupId, language: 'en' })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.recap).toBe('Here is the summary of faith.');
        });

        it('should handle personal recap query failure gracefully', async () => {
            const testUserUid = `user-personal-fail-${Date.now()}`;
            mockAuth(testUserUid);
            const { db } = await import('./lib/firebase-admin.js');

            await db.collection('users').doc(testUserUid).set({
                displayName: 'Personal Recap Owner Fail'
            });
            
            const collectionSpy = vi.spyOn(db, 'collection').mockImplementation(() => {
                throw new Error('DB read error');
            });

            const res = await fetch(`${baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: testUserUid, language: 'en' })
            });
            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe('AI personal recap failed');
            expect(data.details).toBe('DB read error');

            collectionSpy.mockRestore();
        });

        it('should handle personal recap persistence warning gracefully', async () => {
            const testUserUid = `user-personal-warn-${Date.now()}`;
            mockAuth(testUserUid);
            const { db } = await import('./lib/firebase-admin.js');

            await db.collection('users').doc(testUserUid).set({
                displayName: 'Personal Recap Owner Warn'
            });

            await db.collection('users').doc(testUserUid).collection('notes').add({
                comment: 'Faith daily study comment.',
                createdAt: admin.firestore.Timestamp.fromDate(new Date())
            });

            // Mock collection subcall to fail, causing persistence block catch
            const originalDoc = db.collection('users').doc;
            vi.spyOn(db.collection('users'), 'doc').mockImplementation((id: string) => {
                const docRef = originalDoc.call(db.collection('users'), id);
                if (id === testUserUid) {
                    return {
                        ...docRef,
                        get: () => docRef.get(),
                        collection: () => {
                            throw new Error('Persistence connection failed');
                        }
                    } as any;
                }
                return docRef;
            });

            if (!isRealAi) {
                vi.mocked(axios.post).mockResolvedValue({
                    data: { candidates: [{ content: { parts: [{ text: 'Encouraging words' }] } }] }
                });
            }

            const res = await fetch(`${baseUrl}/api/ai/generate-personal-weekly-recap`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: testUserUid, language: 'en' })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.recap).toBe('Encouraging words');
        });
    });
});
