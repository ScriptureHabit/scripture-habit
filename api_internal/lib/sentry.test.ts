import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Sentry from '@sentry/node';
import { isSentryEnabled, initBackendSentry, setupBackendSentryErrorHandler, captureException } from './sentry.js';
import { AppError } from './errors.js';
import type { Express } from 'express';

vi.mock('@sentry/node', () => ({
    init: vi.fn(),
    setupExpressErrorHandler: vi.fn(),
    captureException: vi.fn().mockReturnValue('mock-event-id')
}));

describe('sentry helper module', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('isSentryEnabled', () => {
        it('returns false when NODE_ENV is development', () => {
            process.env.NODE_ENV = 'development';
            process.env.VITE_SENTRY_DSN = 'https://dsn@sentry.io/123';
            delete process.env.SENTRY_DISABLED;
            expect(isSentryEnabled()).toBe(false);
        });

        it('returns false when NODE_ENV is test', () => {
            process.env.NODE_ENV = 'test';
            process.env.VITE_SENTRY_DSN = 'https://dsn@sentry.io/123';
            delete process.env.SENTRY_DISABLED;
            expect(isSentryEnabled()).toBe(false);
        });

        it('returns false when SENTRY_DISABLED is true even in production', () => {
            process.env.NODE_ENV = 'production';
            process.env.SENTRY_DISABLED = 'true';
            process.env.VITE_SENTRY_DSN = 'https://dsn@sentry.io/123';
            expect(isSentryEnabled()).toBe(false);
        });

        it('returns false when VITE_DEV_MODE is true in production', () => {
            process.env.NODE_ENV = 'production';
            process.env.VITE_DEV_MODE = 'true';
            process.env.VITE_SENTRY_DSN = 'https://dsn@sentry.io/123';
            expect(isSentryEnabled()).toBe(false);
        });

        it('returns false when DSN is missing in production', () => {
            process.env.NODE_ENV = 'production';
            delete process.env.VITE_SENTRY_DSN;
            delete process.env.SENTRY_DSN;
            delete process.env.SENTRY_DISABLED;
            delete process.env.VITE_DEV_MODE;
            expect(isSentryEnabled()).toBe(false);
        });

        it('returns true when in production with valid DSN and not disabled', () => {
            process.env.NODE_ENV = 'production';
            process.env.VITE_SENTRY_DSN = 'https://dsn@sentry.io/123';
            delete process.env.SENTRY_DISABLED;
            delete process.env.VITE_DEV_MODE;
            expect(isSentryEnabled()).toBe(true);
        });
    });

    describe('initBackendSentry', () => {
        it('does not initialize Sentry in non-production environments', () => {
            process.env.NODE_ENV = 'development';
            initBackendSentry();
            expect(Sentry.init).not.toHaveBeenCalled();
        });

        it('initializes Sentry with beforeSend filter in production', () => {
            process.env.NODE_ENV = 'production';
            process.env.VITE_SENTRY_DSN = 'https://dsn@sentry.io/123';
            delete process.env.SENTRY_DISABLED;
            delete process.env.VITE_DEV_MODE;

            initBackendSentry();
            expect(Sentry.init).toHaveBeenCalled();

            const initCall = vi.mocked(Sentry.init).mock.calls[0][0];
            expect(initCall?.environment).toBe('production');

            // Test beforeSend filtering of 4xx AppErrors
            const beforeSend = initCall?.beforeSend as any;
            const appError404 = new AppError('Not found', 404);
            expect(beforeSend({} as any, { originalException: appError404 })).toBe(null);

            const serverError = new Error('Database crash');
            const eventObj = { message: 'error' } as any;
            expect(beforeSend(eventObj, { originalException: serverError })).toBe(eventObj);
        });
    });

    describe('setupBackendSentryErrorHandler', () => {
        it('does not mount error handler in non-production', () => {
            process.env.NODE_ENV = 'development';
            const fakeApp = {} as Express;
            setupBackendSentryErrorHandler(fakeApp);
            expect(Sentry.setupExpressErrorHandler).not.toHaveBeenCalled();
        });

        it('mounts error handler in production', () => {
            process.env.NODE_ENV = 'production';
            process.env.VITE_SENTRY_DSN = 'https://dsn@sentry.io/123';
            delete process.env.SENTRY_DISABLED;
            delete process.env.VITE_DEV_MODE;

            const fakeApp = {} as Express;
            setupBackendSentryErrorHandler(fakeApp);
            expect(Sentry.setupExpressErrorHandler).toHaveBeenCalledWith(fakeApp);
        });
    });

    describe('captureException', () => {
        it('returns undefined and does not call Sentry in development or test', () => {
            process.env.NODE_ENV = 'development';
            const result = captureException(new Error('Test dev error'));
            expect(result).toBeUndefined();
            expect(Sentry.captureException).not.toHaveBeenCalled();
        });

        it('calls Sentry.captureException in production and returns event id', () => {
            process.env.NODE_ENV = 'production';
            process.env.VITE_SENTRY_DSN = 'https://dsn@sentry.io/123';
            delete process.env.SENTRY_DISABLED;
            delete process.env.VITE_DEV_MODE;

            const err = new Error('Production failure');
            const result = captureException(err, { tags: { context: 'test' } });
            expect(result).toBe('mock-event-id');
            expect(Sentry.captureException).toHaveBeenCalledWith(err, { tags: { context: 'test' } });
        });
    });
});
