import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import admin, { appCheck } from './lib/firebase-admin.js';

// Import Route Handlers
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import messageRoutes from './routes/messages.js';
import aiRoutes from './routes/ai.js';
import previewRoutes from './routes/preview.js';
import cronRoutes from './routes/cron.js';

// Middleware
import { globalLimiter } from './lib/middleware.js';

dotenv.config();
const app = express();

// --- Middleware & Configuration ---
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

// --- Error Handling ---
app.use((err, req, res, next) => {
    console.error(`[Error] ${req.method} ${req.path}:`, err.message);
    res.status(err.status || 500).json({ error: 'Internal Server Error' });
});

export default app;
