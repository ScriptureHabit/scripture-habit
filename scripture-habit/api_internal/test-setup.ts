import { vi } from 'vitest';
import { Server } from 'http';
import app from '../api/api.js';
import { auth, admin } from './lib/firebase-admin.js';

/**
 * Shared setup for backend integration tests.
 * Manages the API server and Firebase Auth mocking.
 */
export class TestSetup {
    private server?: Server;
    public baseUrl: string = '';

    async start() {
        process.env.SKIP_APP_CHECK = 'true';
        return new Promise<void>((resolve) => {
            this.server = app.listen(0, () => {
                const addr = this.server?.address();
                if (addr && typeof addr !== 'string') {
                    this.baseUrl = `http://localhost:${addr.port}`;
                }
                resolve();
            });
        });
    }

    async stop() {
        return new Promise<void>((resolve) => {
            this.server?.close(() => resolve());
        });
    }

    mockAuth(uid: string = 'test-user', emailVerified: boolean = true) {
        vi.spyOn(auth, 'verifyIdToken').mockResolvedValue({
            uid,
            email_verified: emailVerified,
            firebase: { sign_in_provider: 'password' }
        } as unknown as admin.auth.DecodedIdToken);
    }

    mockAuthMultiple() {
        vi.spyOn(auth, 'verifyIdToken').mockImplementation(async (token) => {
            const uid = token.replace('token-', '');
            return {
                uid,
                email_verified: true,
                firebase: { sign_in_provider: 'password' }
            } as unknown as admin.auth.DecodedIdToken;
        });
    }
}
