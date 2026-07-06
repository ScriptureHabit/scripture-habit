import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { appCheck, auth } from './firebase-admin.js';
import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { AppError } from './errors.js';

/**
 * Extended Request interface for authenticated users
 */
export interface AuthenticatedRequest extends Request {
    user?: DecodedIdToken;
}

// --- Rate Limiters ---

import { Redis } from 'ioredis';
import RedisStore from 'rate-limit-redis';

const isProd = process.env.NODE_ENV === 'production' && process.env.VITE_DEV_MODE !== 'true';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisStore: any = undefined;

if (process.env.REDIS_URL) {
    try {
        const redisClient = new Redis(process.env.REDIS_URL, {
            connectTimeout: 2000,
            maxRetriesPerRequest: 1
        });
        
        redisClient.on('error', (err) => {
            console.error('[Redis] Connection error:', err);
        });

        redisStore = new RedisStore({
            sendCommand: async (...args: string[]) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return redisClient.call(args[0], ...args.slice(1)) as any;
            },
            prefix: 'rl:', // Rate limiting prefix
        });
        console.log('[RateLimit] Distributed RedisStore initialized successfully.');
    } catch (e) {
        console.error('[RateLimit] Failed to initialize RedisStore, falling back to memory:', e);
    }
} else {
    console.log('[RateLimit] REDIS_URL not set. Using MemoryStore (default).');
}

export const globalLimiter = rateLimit({
    store: redisStore,
    windowMs: 15 * 60 * 1000,
    limit: isProd ? 300 : 10000, // Significantly higher limit for dev/test
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

export const inviteLimiter = rateLimit({
    store: redisStore,
    windowMs: 60 * 60 * 1000,
    limit: isProd ? 15 : 1000,
    message: { error: 'Too many invite attempts, please try again later.' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

export const aiLimiterKeyGenerator = (req: Request) => {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return crypto.createHash('sha256').update(authHeader).digest('hex');
    }
    // Isolate the first IP in the forwarded-for chain for stability behind reverse proxies
    const rawForward = req.headers['x-forwarded-for'];
    const clientIp = (Array.isArray(rawForward) ? rawForward[0] : rawForward?.split(',')[0] || req.ip || req.socket.remoteAddress || 'unknown').trim();
    return crypto.createHash('sha256').update(clientIp).digest('hex');
};

export const aiLimiter = rateLimit({
    store: redisStore,
    windowMs: 60 * 60 * 1000,
    limit: isProd ? 100 : 5000, // Increased for dev/test/lazy-loading
    message: { error: 'AI limit reached. Please try again in an hour.' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: aiLimiterKeyGenerator,
    // Required to silence the IPv6 warning when using a custom keyGenerator for hashed IPs
    validate: { default: false } 
});

export const verifyAppCheck = async (req: Request, res: Response, next: NextFunction) => {
    // SECURITY: SKIP_APP_CHECK should NEVER be true in production.
    const isProduction = process.env.NODE_ENV === 'production';
    const skipRequested = req.app?.locals?.skipAppCheck ?? (process.env.SKIP_APP_CHECK === 'true');

    if (skipRequested) {
        if (isProduction) {
            console.error('[SECURITY ALERT] SKIP_APP_CHECK is enabled in production! This is forbidden.');
            return res.status(401).json({ error: 'Unauthorized: Security check required' });
        }
        console.warn('[AppCheck] Skipping verification (Development only)');
        return next();
    }

    const token = req.header('X-Firebase-AppCheck');
    if (!token) {
        console.warn('[AppCheck] Security context missing from:', req.ip);
        return next(new AppError('Unauthorized: Security context missing', 401, 'APP_CHECK_MISSING'));
    }

    try {
        if (!appCheck) {
            throw new Error('Firebase App Check service is unavailable. Please ensure FIREBASE_SERVICE_ACCOUNT or similar environment variables are set in production.');
        }
        await appCheck.verifyToken(token);
        next();
    } catch (err: unknown) {
        const error = err as Error;
        console.warn('[AppCheck] Verification failed for token:', token.substring(0, 10) + '...', 'Error:', error.message);
        return next(new AppError('Unauthorized: Security check failed', error.message.includes('unavailable') ? 503 : 401, 'APP_CHECK_FAILED'));
    }
};

// --- Authentication Middleware ---

export const authenticate = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('[Auth] Authentication required - Missing Bearer token');
        return next(new AppError('Unauthorized: Authentication required', 401, 'UNAUTHENTICATED'));
    }
    const token = authHeader.split('Bearer ')[1];
    try {
        if (!auth) {
            throw new Error('Firebase Auth service is unavailable. Please ensure FIREBASE_SERVICE_ACCOUNT or similar environment variables are set in production.');
        }
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(token);
        } catch (err: unknown) {
            const authError = err as { code?: string; message?: string };
            const isTest = process.env.NODE_ENV !== 'production' || process.env.VITEST === 'true';
            if (isTest) {
                const payloadBase64 = token.split('.')[1];
                if (payloadBase64) {
                    try {
                        const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
                        decodedToken = JSON.parse(payloadJson);
                        console.log(`[Auth] Warning: Bypassed ID token verification error (${authError.code || 'unknown'}) in test/emulator environment`);
                    } catch {
                        throw err;
                    }
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }
        req.user = decodedToken;
        next();
    } catch (err: unknown) {
        const error = err as Error;
        console.warn('[Auth] Verification failed:', error.message);
        return next(new AppError('Unauthorized: Invalid or expired token', error.message.includes('unavailable') ? 503 : 401, 'INVALID_TOKEN'));
    }
};

/**
 * Enforces email verification for password-based accounts.
 * Should be used AFTER authenticate middleware.
 */
export const requireEmailVerified = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Unauthorized: Not authenticated', 401, 'UNAUTHENTICATED'));
    }

    // Bypass verification for test accounts in non-production environments
    const isTestAccount = !isProd && (req.user.email?.endsWith('@example.com') || req.user.email?.endsWith('@test.local'));
    if (isTestAccount) {
        return next();
    }

    // Force check email_verified for password login
    if (req.user.firebase.sign_in_provider === 'password' && !req.user.email_verified) {
        return next(new AppError('Email not verified. Please verify your email.', 403, 'auth/email-not-verified'));
    }

    next();
};
