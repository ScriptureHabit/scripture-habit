// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import app from '../api/api.js';
import { Server } from 'http';
import { auth, admin } from './lib/firebase-admin.js';
import axios from 'axios';

const isRealAi = process.env.USE_REAL_AI === 'true';

// Use dynamic mocking to support conditional real AI tests
if (!isRealAi) {
    vi.mock('axios', () => ({
        default: {
            post: vi.fn().mockImplementation((url) => {
                if (url.includes('generateContent')) {
                    // Check if it's a batch request by looking at the prompt in the mock's logic?
                    // Actually, let's just return something that works for both.
                    return Promise.resolve({
                        data: {
                            candidates: [{
                                content: { parts: [{ text: '{"msg1": "AI Response"}' }] }
                            }]
                        }
                    });
                }
                return Promise.resolve({ data: {} });
            }),
            create: vi.fn().mockReturnThis(),
            interceptors: {
                request: { use: vi.fn(), eject: vi.fn() },
                response: { use: vi.fn(), eject: vi.fn() }
            }
        }
    }));
}

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
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    });

    beforeEach(() => {
        vi.clearAllMocks();
        if (!isRealAi) {
            vi.mocked(axios.post).mockResolvedValue({
                data: {
                    candidates: [{
                        content: { parts: [{ text: '{"msg1": "AI Response"}' }] }
                    }]
                }
            });
        }
    });

    const mockAuth = (uid: string = 'test-user') => {
        vi.spyOn(auth, 'verifyIdToken').mockResolvedValue({
            uid,
            email_verified: true,
            firebase: { sign_in_provider: 'password' }
        } as unknown as admin.auth.DecodedIdToken);
    };

    it('should construct correct prompt for /api/generate-ponder-questions', async () => {
        mockAuth();
        await fetch(`${baseUrl}/api/generate-ponder-questions`, {
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

    it('should construct correct prompt for /api/translate (standard)', async () => {
        mockAuth();
        await fetch(`${baseUrl}/api/translate`, {
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

    it('should construct correct prompt for /api/translate (group metadata)', async () => {
        mockAuth();
        await fetch(`${baseUrl}/api/translate`, {
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

    it('should construct correct prompt for /api/translate-batch', async () => {
        mockAuth();
        await fetch(`${baseUrl}/api/translate-batch`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [{ id: 'msg1', text: 'Note 1' }],
                targetLanguage: 'pt',
                groupId: 'group1'
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

        const res = await fetch(`${baseUrl}/api/translate-batch`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [{ id: 'hallu1', text: 'Hallucination Note 1' }, { id: 'hallu2', text: 'Hallucination Note 2' }],
                targetLanguage: 'pt',
                groupId: 'group1'
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
        await fetch(`${baseUrl}/api/translate`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: testText, targetLanguage: 'ja' })
        });

        // Request 2: Group Name
        await fetch(`${baseUrl}/api/translate`, {
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

    it('should construct correct prompt for /api/generate-personal-weekly-recap', async () => {
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

        await fetch(`${baseUrl}/api/generate-personal-weekly-recap`, {
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
    }, 60000); // 60s for the whole suite
});
