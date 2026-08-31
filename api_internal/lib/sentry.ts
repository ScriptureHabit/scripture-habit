import * as Sentry from '@sentry/node';
import type { Express } from 'express';
import { AppError } from './errors.js';

/**
 * Check whether Sentry should be active.
 * Sentry is strictly disabled in development and test environments.
 */
export const isSentryEnabled = (): boolean => {
    return process.env.NODE_ENV === 'production' &&
           process.env.SENTRY_DISABLED !== 'true' &&
           process.env.VITE_DEV_MODE !== 'true' &&
           Boolean(process.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN);
};

/**
 * Initialize backend Sentry (Production only).
 */
export const initBackendSentry = (): void => {
    if (!isSentryEnabled()) {
        return;
    }

    Sentry.init({
        dsn: process.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN || "",
        environment: 'production',
        tracesSampleRate: 0.1,
        beforeSend(event, hint) {
            const err = hint?.originalException;
            if (err instanceof AppError && err.statusCode < 500) {
                return null; // Ignore 4xx client-side errors in Sentry
            }
            return event;
        },
    });
};

/**
 * Mount Sentry Express error handler (Production only).
 */
export const setupBackendSentryErrorHandler = (app: Express): void => {
    if (isSentryEnabled()) {
        Sentry.setupExpressErrorHandler(app);
    }
};

/**
 * Safe captureException wrapper that guarantees no-op in development and test environments.
 */
export const captureException = (error: unknown, captureContext?: Sentry.CaptureContext): string | undefined => {
    if (!isSentryEnabled()) {
        return undefined;
    }
    return Sentry.captureException(error, captureContext);
};

export { Sentry };
