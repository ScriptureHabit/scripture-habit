import '../api_internal/lib/load-env.js';
import * as Sentry from "@sentry/node";

// Initialize Sentry at the absolute top before importing Express/routers (Production only)
if (process.env.SENTRY_DISABLED !== 'true' && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.VITE_SENTRY_DSN || "",
    environment: 'production',
    tracesSampleRate: 1.0,
    beforeSend(event, hint) {
      const err = hint?.originalException;
      if (err instanceof AppError && err.statusCode < 500) {
        return null; // Ignore 4xx client-side errors in Sentry
      }
      return event;
    },
  });
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import compression from 'compression';

// Import Route Handlers
import authRoutes from '../api_internal/routes/auth.js';
import groupRoutes from '../api_internal/routes/groups.js';
import messageRoutes from '../api_internal/routes/messages.js';
import aiRoutes from '../api_internal/routes/ai.js';
import previewRoutes from '../api_internal/routes/preview.js';
import cronRoutes from '../api_internal/routes/cron.js';
import reportRoutes from '../api_internal/routes/reports.js';
import feedbackRoutes from '../api_internal/routes/feedback.js';
import testUtilsRoutes from '../api_internal/routes/test-utils.js';
import resetUnityRoutes from '../api_internal/routes/reset-unity.js';
import demoRoutes from '../api_internal/routes/demo.js';
import openapiSpec from '../api_internal/openapi-spec.js';

// Middleware & Utils
import { globalLimiter } from '../api_internal/lib/middleware.js';
import { AppError } from '../api_internal/lib/errors.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { dbStorage, dbRegistry } from '../api_internal/lib/firebase-admin.js';

export const testTimeStorage = new AsyncLocalStorage<number>();

if (process.env.NODE_ENV !== 'production') {
    const OriginalDate = global.Date;
    const FakeDate: any = function(...args: any[]) {
        if (!new.target) {
            const storedTime = testTimeStorage.getStore();
            return storedTime !== undefined ? new OriginalDate(storedTime).toString() : OriginalDate();
        }
        if (args.length === 0) {
            const storedTime = testTimeStorage.getStore();
            if (storedTime !== undefined) {
                return new OriginalDate(storedTime);
            }
            return new OriginalDate();
        }
        return new (OriginalDate as any)(...args);
    };
    FakeDate.prototype = OriginalDate.prototype;
    FakeDate.now = () => {
        const storedTime = testTimeStorage.getStore();
        if (storedTime !== undefined) {
            return storedTime;
        }
        return OriginalDate.now();
    };
    FakeDate.UTC = OriginalDate.UTC;
    FakeDate.parse = OriginalDate.parse;

    global.Date = FakeDate as any;
}

const app = express();
app.locals.skipAppCheck = process.env.SKIP_APP_CHECK === 'true';

// Dynamically bind the request's thread to the corresponding TestSetup's Proxy DB based on local port
app.use((req, _res, next) => {
    const port = req.socket.localPort;
    const proxyDb = port ? dbRegistry.get(port) : undefined;
    if (proxyDb) {
        dbStorage.run(proxyDb, next);
    } else {
        next();
    }
});

// --- Middleware & Configuration ---
app.use(helmet());
app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));
app.set('trust proxy', 1);

// Generate or propagate Request ID
app.use((req, _res, next) => {
    const reqId = req.header('x-request-id') || crypto.randomUUID();
    req.headers['x-request-id'] = reqId;
    next();
});

// Middleware to mock system time for E2E testing
app.use((req, _res, next) => {
    const testTimeHeader = req.header('x-test-system-time');
    if (testTimeHeader && process.env.NODE_ENV !== 'production') {
        const testTime = parseInt(testTimeHeader, 10);
        if (!isNaN(testTime)) {
            testTimeStorage.run(testTime, () => {
                next();
            });
            return;
        }
    }
    next();
});

const ALLOWED_ORIGINS = [
    'https://scripturehabit.app',
    'https://scripture-habit.vercel.app',
];

app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }
        if (/^https:\/\/scripture-habit-[\w-]+\.vercel\.app$/.test(origin)) return callback(null, true);
        
        // Return false without an Error object to avoid raising server-side 500 exceptions for CORS violations
        callback(null, false);
    }
}));

app.use(express.json({ limit: '50kb' }));
app.use(globalLimiter);

// --- Request Logger for Local Debugging ---
app.use((req, _res, next) => {
    console.log(`[API Request] ${req.method} ${req.originalUrl || req.url}`);
    next();
});

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

// --- Diagnostics & API Docs ---
app.get(['/api/warmup', '/api/warmup/'], (_req, res) => {
    res.json({
        status: 'ok',
        warmed: true,
        time: new Date().toISOString()
    });
});

app.get(['/api/health', '/api/health/'], (_req, res) => {
    res.json({
        status: 'ok',
        time: new Date().toISOString(),
        env: process.env.NODE_ENV
    });
});

app.get(['/api/openapi.json', '/openapi.json'], (_req, res) => {
    res.json(openapiSpec);
});

app.get(['/api/docs', '/api/docs/', '/docs', '/docs/', '/api-docs', '/api-docs/'], (_req, res) => {
    // Override CSP for Swagger UI: helmet()'s strict defaults block unpkg.com CDN scripts/styles/images.
    // We set a permissive CSP only for this documentation page.
    res.set('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' https://unpkg.com 'unsafe-inline'; " +
        "style-src 'self' https://unpkg.com 'unsafe-inline'; " +
        "img-src 'self' data: https://unpkg.com https://validator.swagger.io; " +
        "connect-src 'self' https://unpkg.com"
    );
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Scripture Habit API Specs (Swagger UI)</title>
            <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
            <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5/favicon-32x32.png" />
            <style>
                html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
                *, *:before, *:after { box-sizing: inherit; }
                body { margin:0; background: #fafafa; }
                .swagger-ui .topbar { display: none; }
            </style>
        </head>
        <body>
            <div id="swagger-ui"></div>
            <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" charset="UTF-8"></script>
            <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
            <script>
                window.onload = function() {
                    window.ui = SwaggerUIBundle({
                        url: "/api/openapi.json",
                        dom_id: '#swagger-ui',
                        deepLinking: true,
                        presets: [
                            SwaggerUIBundle.presets.apis,
                            SwaggerUIStandalonePreset
                        ],
                        plugins: [
                            SwaggerUIBundle.plugins.DownloadUrl
                        ],
                        layout: "StandaloneLayout"
                    });
                };
            </script>
        </body>
        </html>
    `);
});

// --- Route Mounting ---
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/groups', messageRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/preview', previewRoutes);

app.use('/api/cron', cronRoutes);
app.use('/api/report', reportRoutes);
app.use('/api', feedbackRoutes);
app.use('/api/test', testUtilsRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/groups', resetUnityRoutes);
app.use('/api/reset-unity', resetUnityRoutes);

// The Sentry error handler must be before any other error middleware and after all controllers
if (process.env.SENTRY_DISABLED !== 'true' && process.env.NODE_ENV === 'production') {
  Sentry.setupExpressErrorHandler(app);
}

// --- 404 Handler (Keep it JSON for API) ---
app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'NotFound', message: 'The requested API endpoint was not found.' });
});

// --- Error Handling ---

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // 1. Log the error (In production, this would go to Sentry/Datadog)
    const requestId = req.header('x-request-id') || 'unknown';
    console.error('[Error]', req.method, req.path, '| RequestID:', requestId, {
        message: err instanceof Error ? err.message : 'Unknown error',
        user: (req as { user?: { uid: string } }).user?.uid
    });

    // Capture error in Sentry (Only report unexpected server-side errors, ignore 400/401/403/404)
    if (!(err instanceof AppError) || err.statusCode >= 500) {
        Sentry.captureException(err, {
            user: { id: (req as { user?: { uid: string } }).user?.uid },
            tags: { requestId }
        });
    }


    // 2. Handle known application errors
    if (err instanceof AppError) {
        const appErr = err as AppError;
        return res.status(appErr.statusCode).json({
            error: appErr.name,
            message: appErr.message,
            code: appErr.errorCode,
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
