import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { appCheck, auth } from './firebase-admin.js';
import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Extended Request interface for authenticated users
 */
export interface AuthenticatedRequest extends Request {
    user?: DecodedIdToken;
}

// --- Rate Limiters ---

const isProd = process.env.NODE_ENV === 'production' && process.env.VITE_DEV_MODE !== 'true';

export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProd ? 300 : 10000, // Significantly higher limit for dev/test
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

export const inviteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: isProd ? 15 : 1000,
    message: { error: 'Too many invite attempts, please try again later.' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

export const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: isProd ? 100 : 5000, // Increased for dev/test/lazy-loading
    message: { error: 'AI limit reached. Please try again in an hour.' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return crypto.createHash('sha256').update(authHeader).digest('hex');
        }
        // Fallback to hashed IP for better privacy and consistency across proxies
        const ip = (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString();
        return crypto.createHash('sha256').update(ip).digest('hex');
    },
    // Required to silence the IPv6 warning when using a custom keyGenerator for hashed IPs
    validate: { default: false } 
});

export const verifyAppCheck = async (req: Request, res: Response, next: NextFunction) => {
    // SECURITY: SKIP_APP_CHECK should NEVER be true in production.
    const isProduction = process.env.NODE_ENV === 'production';
    const skipRequested = process.env.SKIP_APP_CHECK === 'true';

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
        return res.status(401).json({ error: 'Unauthorized: Security context missing' });
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
        return res.status(error.message.includes('unavailable') ? 503 : 401).json({ 
            error: 'Unauthorized: Security check failed',
            details: error.message
        });
    }
};

// --- Authentication Middleware ---

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('[Auth] Authentication required - Missing Bearer token');
        return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
        if (!auth) {
            throw new Error('Firebase Auth service is unavailable. Please ensure FIREBASE_SERVICE_ACCOUNT or similar environment variables are set in production.');
        }
        const decodedToken = await auth.verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (err: unknown) {
        const error = err as Error;
        console.warn('[Auth] Verification failed:', error.message);
        return res.status(error.message.includes('unavailable') ? 503 : 401).json({ 
            error: 'Unauthorized: Invalid or expired token',
            details: error.message
        });
    }
};

/**
 * Enforces email verification for password-based accounts.
 * Should be used AFTER authenticate middleware.
 */
export const requireEmailVerified = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: Not authenticated' });
    }

    // Bypass verification for test accounts in non-production environments
    const isTestAccount = req.user.email?.endsWith('@example.com') || req.user.email?.endsWith('@test.local');
    const isDevOrTest = process.env.NODE_ENV !== 'production' || process.env.VITE_DEV_MODE === 'true';

    if (isTestAccount || isDevOrTest) {
        return next();
    }

    // Force check email_verified for password login
    if (req.user.firebase.sign_in_provider === 'password' && !req.user.email_verified) {
        return res.status(403).json({ 
            error: 'Email not verified. Please verify your email.', 
            code: 'auth/email-not-verified' 
        });
    }

    next();
};
