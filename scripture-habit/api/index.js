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
    origin: (origin, callback) => {
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
app.get(['/api/health', '/api/health/'], (req, res) => {
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
app.use((err, req, res, next) => {
    console.error(`[Error] ${req.method} ${req.path}:`, err.message);
    res.status(err.status || 500).json({ error: 'Internal Server Error' });
});

export default app;
