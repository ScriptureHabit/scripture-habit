import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { appCheck, auth } from './firebase-admin.js';

// --- Rate Limiters ---

export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

export const inviteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 15,
    message: { error: 'Too many invite attempts, please try again later.' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

export const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    message: { error: 'AI limit reached. Please try again in an hour.' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return crypto.createHash('sha256').update(authHeader).digest('hex');
        }
        // Use a safe ID that combines IP and other info, hash it to avoid IPv6 warnings
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        return crypto.createHash('sha256').update(ip).digest('hex');
    },
});

export const verifyAppCheck = async (req, res, next) => {
    if (process.env.SKIP_APP_CHECK === 'true') {
        console.log('[AppCheck] Skipping verification');
        return next();
    }

    const token = req.header('X-Firebase-AppCheck');
    if (!token) {
        console.warn('[AppCheck] Security context missing');
        return res.status(401).json({ error: 'Unauthorized: Security context missing' });
    }

    try {
        await appCheck.verifyToken(token);
        next();
    } catch (err) {
        console.warn('[AppCheck] Verification failed:', err.message);
        return res.status(401).json({ error: 'Unauthorized: Security check failed' });
    }
};

// --- Authentication Middleware ---

export const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('[Auth] Authentication required - Missing Bearer token');
        return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await auth.verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (err) {
        console.warn('[Auth] Verification failed:', err.message);
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
};

/**
 * Enforces email verification for password-based accounts.
 * Should be used AFTER authenticate middleware.
 */
export const requireEmailVerified = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: Not authenticated' });
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
