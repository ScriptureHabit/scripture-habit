// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Server } from 'http';
import { TestSetup } from '../api_internal/test-setup.js';
import { db, appCheck, auth } from '../api_internal/lib/firebase-admin.js';

describe('API App Configuration Integration', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();
    const originalGlobalDsn = process.env.VITE_SENTRY_DSN;

    beforeAll(async () => {
        delete process.env.VITE_SENTRY_DSN;
        await setup.start();
        process.env.VITE_SENTRY_DSN = originalGlobalDsn;
    });

    afterAll(async () => {
        await setup.stop();
    });

    it('should return 200 for health check', async () => {
        const res = await fetch(`${setup.baseUrl}/api/health`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe('ok');
    });

    it('should strip trailing slash', async () => {
        const res = await fetch(`${setup.baseUrl}/api/health/`);
        expect(res.status).toBe(200);
    });

    it('should return 404 for unknown api routes', async () => {
        const res = await fetch(`${setup.baseUrl}/api/unknown/route`);
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toBe('NotFound');
    });

    it('should allow valid CORS origins', async () => {
        const res = await fetch(`${setup.baseUrl}/api/health`, {
            headers: {
                'Origin': 'https://scripturehabit.app'
            }
        });
        expect(res.status).toBe(200);
        expect(res.headers.get('access-control-allow-origin')).toBe('https://scripturehabit.app');
    });

    it('should allow localhost CORS in dev', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        
        const res = await fetch(`${setup.baseUrl}/api/health`, {
            headers: {
                'Origin': 'http://localhost:3000'
            }
        });
        expect(res.status).toBe(200);
        expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');

        process.env.NODE_ENV = originalEnv;
    });

    it('should block invalid CORS origins and return error', async () => {
        const res = await fetch(`${setup.baseUrl}/api/health`, {
            headers: {
                'Origin': 'https://malicious.com'
            }
        });
        // Express CORS throws an error which gets caught by our error handler
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('InternalServerError');
        expect(data.message).toContain('CORS not allowed');
    });

    it('should handle AppError correctly through auth error', async () => {
        // Hitting auth route with no token or invalid token throws an AppError (401 Unauthorized)
        const res = await fetch(`${setup.baseUrl}/api/groups/update-kick-threshold`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ threshold: 5 })
        });
        
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe('AppError');
        expect(data.requestId).toBeDefined();
    });

    it('should handle standard Error correctly through invalid JSON', async () => {
        const res = await fetch(`${setup.baseUrl}/api/groups/update-kick-threshold`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: 'invalid-json-body'
        });

        // Express json parser throws standard syntax error (400)
        // Since it's not AppError, it falls back to 500 error handler in our app
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('InternalServerError');
        expect(data.requestId).toBeDefined();
    });

    it('should handle standard Error correctly through invalid JSON and capture request ID', async () => {
        const res = await fetch(`${setup.baseUrl}/api/groups/update-kick-threshold`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Request-ID': 'test-req-123'
            },
            body: 'invalid-json-body'
        });

        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('InternalServerError');
        expect(data.requestId).toBe('test-req-123');
    });

    it('should strip trailing slash when query parameters are present', async () => {
        const res = await fetch(`${setup.baseUrl}/api/health/?foo=bar`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe('ok');
    });

    it('should allow Vercel preview deployment CORS origins', async () => {
        const res = await fetch(`${setup.baseUrl}/api/health`, {
            headers: {
                'Origin': 'https://scripture-habit-feature-branch.vercel.app'
            }
        });
        expect(res.status).toBe(200);
        expect(res.headers.get('access-control-allow-origin')).toBe('https://scripture-habit-feature-branch.vercel.app');
    });

    it('should handle string errors in API error handler', async () => {
        setup.mockAuth('test-user-error');
        
        // Spy on db.collection to throw a raw string error
        const collectionSpy = vi.spyOn(db, 'collection').mockImplementation(() => {
            throw 'Raw string error for testing';
        });

        const res = await fetch(`${setup.baseUrl}/api/auth/update-profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token-test-user-error'
            },
            body: JSON.stringify({ nickname: 'NewNick' })
        });

        // Restore spy
        collectionSpy.mockRestore();

        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('InternalServerError');
        expect(data.message).toBe('Unknown error');
    });

    it('should handle errors in production mode without leaking message', async () => {
        const originalEnv = process.env.NODE_ENV;
        const originalSkipAppCheck = process.env.SKIP_APP_CHECK;

        process.env.NODE_ENV = 'production';
        process.env.SKIP_APP_CHECK = 'false';

        setup.mockAuth('test-user-prod-error');
        const appCheckSpy = vi.spyOn(appCheck, 'verifyToken').mockResolvedValue({} as any);
        
        const collectionSpy = vi.spyOn(db, 'collection').mockImplementation(() => {
            throw new Error('Secret database error');
        });

        const res = await fetch(`${setup.baseUrl}/api/auth/update-profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token-test-user-prod-error',
                'X-Firebase-AppCheck': 'mock-token'
            },
            body: JSON.stringify({ nickname: 'NewNick' })
        });

        collectionSpy.mockRestore();
        appCheckSpy.mockRestore();
        process.env.NODE_ENV = originalEnv;
        process.env.SKIP_APP_CHECK = originalSkipAppCheck;

        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('InternalServerError');
        expect(data.message).toBe('An unexpected error occurred');
    });

    it('should configure Sentry when enabled and handle disabled state', async () => {
        const originalSentryDisabled = process.env.SENTRY_DISABLED;
        const originalDsn = process.env.VITE_SENTRY_DSN;

        // 1. Test when SENTRY_DISABLED is 'true'
        process.env.SENTRY_DISABLED = 'true';
        vi.resetModules();
        await import('./api.js');

        // 2. Test when SENTRY_DISABLED is not 'true' and DSN is truthy
        process.env.SENTRY_DISABLED = 'false';
        process.env.VITE_SENTRY_DSN = 'https://mock-dsn@sentry.io/123';
        vi.resetModules();
        await import('./api.js');

        // 3. Test when SENTRY_DISABLED is not 'true' but DSN is falsy/undefined
        process.env.SENTRY_DISABLED = 'false';
        delete process.env.VITE_SENTRY_DSN;
        vi.resetModules();
        await import('./api.js');

        // Restore env
        process.env.SENTRY_DISABLED = originalSentryDisabled;
        process.env.VITE_SENTRY_DSN = originalDsn;
        vi.resetModules();
    });

    it('should cover TestSetup mockAuthMultiple and address edge cases', async () => {
        // 1. Cover mockAuthMultiple
        setup.mockAuthMultiple();
        const verifyIdToken = auth.verifyIdToken as any;
        const decoded = await verifyIdToken('token-multiple-user-123');
        expect(decoded.uid).toBe('multiple-user-123');

        // 2. Cover test-setup line 19 edge cases where address returns null or string
        const tempSetup = new TestSetup();
        
        // Scenario A: address returns null
        const addressSpy1 = vi.spyOn(Server.prototype, 'address').mockReturnValue(null);
        await tempSetup.start();
        expect(tempSetup.baseUrl).toBe('');
        await tempSetup.stop();
        addressSpy1.mockRestore();

        // Scenario B: address returns string
        const tempSetup2 = new TestSetup();
        const addressSpy2 = vi.spyOn(Server.prototype, 'address').mockReturnValue('unix-socket-path');
        await tempSetup2.start();
        expect(tempSetup2.baseUrl).toBe('');
        await tempSetup2.stop();
        addressSpy2.mockRestore();
    });
});
