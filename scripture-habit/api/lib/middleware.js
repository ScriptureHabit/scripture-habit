import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { appCheck } from './firebase-admin.js';

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
            // Use SHA256 hash of the token as the key to prevent token leakage in memory/logs
            return crypto.createHash('sha256').update(authHeader).digest('hex');
        }
        return req.ip; // Fallback to IP if no token
    },
});

// --- Firebase App Check Middleware ---

export const verifyAppCheck = async (req, res, next) => {
    // In development environment, skip if configured
    if (process.env.NODE_ENV !== 'production' && process.env.SKIP_APP_CHECK === 'true') {
        return next();
    }

    const token = req.header('X-Firebase-AppCheck');
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Security context missing' });
    }

    try {
        await appCheck.verifyToken(token);
        next();
    } catch (err) {
        console.warn('App Check verification failed:', err.message);
        return res.status(401).json({ error: 'Unauthorized: Security check failed' });
    }
};
