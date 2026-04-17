// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import app from '../api/api.js';
import { Server } from 'http';
import { auth } from './lib/firebase-admin.js';
import axios from 'axios';

vi.mock('axios');

describe('AI Prompt Construction Regression', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
        process.env.SKIP_APP_CHECK = 'true';
        process.env.GEMINI_API_KEY = 'dummy-key';
        
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
        vi.mocked(axios.post).mockResolvedValue({
            data: {
                candidates: [{
                    content: { parts: [{ text: 'AI Response' }] }
                }]
            }
        });
    });

    const mockAuth = (uid: string = 'test-user') => {
        vi.spyOn(auth, 'verifyIdToken').mockResolvedValue({
            uid,
            email_verified: true,
            firebase: { sign_in_provider: 'password' }
        } as any);
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
        const prompt = (axiosCall[1] as any).contents[0].parts[0].text;

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
                targetLanguage: 'es'
            })
        });

        const axiosCall = vi.mocked(axios.post).mock.calls[0];
        const prompt = (axiosCall[1] as any).contents[0].parts[0].text;

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
                updateType: 'group_name'
            })
        });

        const axiosCall = vi.mocked(axios.post).mock.calls[0];
        const prompt = (axiosCall[1] as any).contents[0].parts[0].text;

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
        const prompt = (axiosCall[1] as any).contents[0].parts[0].text;

        expect(prompt).toContain('Translate these message items into Portuguese');
        expect(prompt).toContain('Note 1');
        expect(prompt).toMatchSnapshot();
    });

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
        const prompt = (axiosCall[1] as any).contents[0].parts[0].text;

        expect(prompt).toContain('Task: Write a warm personal letter');
        expect(prompt).toContain('I learned about faith today.');
        expect(prompt).toMatchSnapshot();
    });
});
