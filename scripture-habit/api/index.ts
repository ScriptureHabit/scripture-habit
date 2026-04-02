import '../api_internal/lib/load-env.ts';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Import Route Handlers
import authRoutes from '../api_internal/routes/auth.ts';
import groupRoutes from '../api_internal/routes/groups.ts';
import messageRoutes from '../api_internal/routes/messages.ts';
import aiRoutes from '../api_internal/routes/ai.ts';
import previewRoutes from '../api_internal/routes/preview.ts';
import cronRoutes from '../api_internal/routes/cron.ts';
import reportRoutes from '../api_internal/routes/reports.ts';
import adminRoutes from '../api_internal/routes/admin.ts';

// Middleware
import { globalLimiter } from '../api_internal/lib/middleware.ts';

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

// --- Error Handling ---
import { AppError } from '../api_internal/lib/errors.ts';

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
