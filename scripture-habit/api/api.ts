import '../api_internal/lib/load-env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Import Route Handlers
import authRoutes from '../api_internal/routes/auth.js';
import groupRoutes from '../api_internal/routes/groups.js';
import messageRoutes from '../api_internal/routes/messages.js';
import aiRoutes from '../api_internal/routes/ai.js';
import previewRoutes from '../api_internal/routes/preview.js';
import cronRoutes from '../api_internal/routes/cron.js';
import reportRoutes from '../api_internal/routes/reports.js';
import adminRoutes from '../api_internal/routes/admin.js';
import testUtilsRoutes from '../api_internal/routes/test-utils.js';

// Middleware
import { globalLimiter } from '../api_internal/lib/middleware.js';

const app = express();

// --- Middleware & Configuration ---
app.use(helmet());
app.set('trust proxy', 1);

const ALLOWED_ORIGINS = [
    'https://scripturehabit.app',
    'https://scripture-habit.vercel.app',
    'capacitor://localhost',
];

app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }
        if (/^https:\/\/scripture-habit-[\w-]+\.vercel\.app$/.test(origin)) return callback(null, true);
        
        callback(new Error('CORS not allowed'), false);
    }
}));

app.use(express.json({ limit: '50kb' }));
app.use(globalLimiter);

// --- Path Normalization for Vercel trailingSlash: true ---
app.use((req, _res, next) => {
    // If path ends with / and is longer than 1 char, strip it internally
    // to match standard router paths without duplicating every route definition.
    if (req.path.length > 1 && req.path.endsWith('/')) {
        const query = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
        const newPath = req.path.slice(0, -1);
        req.url = newPath + query;
    }
    next();
});

// Explicitly allow both slash and non-slash paths
app.set('strict routing', false);

// --- Diagnostics ---
app.get(['/api/health', '/api/health/'], (_req, res) => {
    res.json({
        status: 'ok',
        time: new Date().toISOString(),
        env: process.env.NODE_ENV
    });
});

// --- Route Mounting ---
app.use('/api', authRoutes);
app.use('/api', groupRoutes);
app.use('/api', messageRoutes);
app.use('/api', aiRoutes);
app.use('/api', previewRoutes);
app.use('/api', cronRoutes);
app.use('/api', reportRoutes);
app.use('/api', adminRoutes);
app.use('/api', testUtilsRoutes);

// --- 404 Handler (Keep it JSON for API) ---
app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'NotFound', message: 'The requested API endpoint was not found.' });
});

// --- Error Handling ---
import { AppError } from '../api_internal/lib/errors.js';

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // 1. Log the error (In production, this would go to Sentry/Datadog)
    const requestId = req.header('x-request-id') || 'unknown';
    console.error(`[Error] ${req.method} ${req.path} | RequestID: ${requestId}`, {
        message: err instanceof Error ? err.message : 'Unknown error',
        user: (req as { user?: { uid: string } }).user?.uid
    });


    // 2. Handle known application errors
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: err.name,
            message: err.message,
            code: err.errorCode,
            requestId
        });
    }

    // 3. Fallback for unknown errors
    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({
        error: 'InternalServerError',
        message: isProd ? 'An unexpected error occurred' : (err instanceof Error ? err.message : 'Unknown error'),
        requestId
    });
});

export default app;
