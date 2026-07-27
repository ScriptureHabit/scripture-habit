# API Middleware Architecture & Standard Error Handling

This document provides a technical deep-dive into the serverless backend architecture of **scripture-habit** (managed via Vercel Serverless Functions under `api/api.ts` and `api_internal/`). 

It details the gateway validation chain, CORS policies, trailing slash normalization, the multi-tiered middleware pipeline, custom error classifications, and the automated error mitigation/Sentry observability pattern.

---

## 🛰️ 1. Express Gateway & Routing Middleware

The backend uses a unified Express gateway (`api/api.ts`) acting as a lightweight API controller. To maximize performance and keep cold starts low in serverless environments, Sentry and Firebase SDKs are initialized eagerly (Sentry is initialized at the absolute top of the file before importing Express or any routers to ensure automatic instrumentation hooks work correctly), while routes and middlewares are mounted in a strict security-first hierarchy.

### CORS & Origin Validation Matrix
To allow standard Web clients, automated preview environments, and local development servers to query the API safely without permitting arbitrary cross-origin script executions, the CORS policy evaluates dynamic regexes:

| Environment | Allowed Origin Format | Purpose |
| :--- | :--- | :--- |
| **Production Web** | `https://scripturehabit.app` / `...vercel.app` | Standard primary web domains. |
| **Local Development** | `http://localhost:[port]` / `127.0.0.1:[port]` | HMR hot-reloads and local testing. |
| **Vercel Previews** | `https://scripture-habit-[hash].vercel.app` | Automated GitHub Pull Request deploy previews. |

### Path Normalization (Vercel TrailingSlash Fix)
Vercel's hosting settings often append a trailing slash (e.g. `/api/auth/` instead of `/api/auth`) causing routing mismatches. To prevent duplicating routes, a custom gateway filter intercepts and strips internal trailing slashes:
```typescript
app.use((req, _res, next) => {
    if (req.path.length > 1 && req.path.endsWith('/')) {
        const query = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
        const newPath = req.path.slice(0, -1);
        req.url = newPath + query;
    }
    next();
});
```

---

## ⚡ 2. The Verification Middleware Pipeline

All sensitive endpoints mount a middleware sequence before triggering controller files:

```
[ Incoming Request ]
         │
         ▼
 1. Rate Limiting ───────► Limit Exceeded? ──► [ 429 Too Many Requests ]
         │ No
         ▼
 2. App Check ───────────► Invalid Token?   ──► [ 401 Unauthorized ]
         │ No
         ▼
 3. Authentication ──────► Invalid JWT?     ──► [ 401 Unauthorized ]
         │ No
         ▼
 4. Email Verification ──► Not Verified?    ──► [ 403 Forbidden ]
         │ No
         ▼
[ Trigger Controller ]
```

### 1. Adaptive Rate Limiters (`rateLimit`)
The system manages three distinct rate-limiting zones, scaling thresholds dynamically based on production vs. development contexts:

* **Global Limiter**: Restricts generic endpoints to `300` calls per 15 minutes in production (elevated to `10,000` in dev).
* **Invite Limiter**: Restricts group join and code-generation to `15` attempts per hour (prevents brute-forcing codes).
* **AI Limiter with Privacy Hashing**: Restricts Gemini-powered tasks (Weekly Recaps, chat translations) to `100` calls per hour.
  - **Distributed Limiting (Redis Store)**: In production, if `REDIS_URL` environment variable is supplied, all rate limiters automatically connect to a centralized RedisStore (such as Upstash) to sync counts across multiple parallel serverless instances (falls back to MemoryStore if not provided).
   - **Hashed Keys**: To avoid exposing raw client IP addresses or Auth tokens inside server log dumps during rate breaches, the key generator hashes identifiers using SHA-256 before applying the bucket count. It prioritizes `req.ip` (populated by trusted reverse proxies) and falls back safely to `x-forwarded-for` or socket remote addresses:
    ```typescript
    export const aiLimiterKeyGenerator = (req: Request) => {
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return crypto.createHash('sha256').update(authHeader).digest('hex');
        }
        // Express req.ip is primary; fallback to x-forwarded-for if req.ip is missing
        const rawForward = req.headers['x-forwarded-for'];
        const forwardedIp = Array.isArray(rawForward) ? rawForward[0] : rawForward?.split(',')[0];
        const clientIp = (req.ip || forwardedIp || req.socket.remoteAddress || 'unknown').trim();
        return crypto.createHash('sha256').update(clientIp).digest('hex');
    };
    ```

### 2. Firebase App Check Security (`verifyAppCheck`)
Protects backend APIs from scraping and replay attacks by enforcing App Check tokens (`X-Firebase-AppCheck` headers):
- **Development Bypass**: In local development and unit tests, developers can set `SKIP_APP_CHECK=true` inside `.env.local`.
- **Production Guard**: If `SKIP_APP_CHECK=true` is requested in a production environment, the middleware immediately intercepts the bypass, blocks the request, and triggers a critical security alert to prevent backdoors.

### 3. Firebase Auth Verification (`authenticate`)
Intercepts the Bearer JWT token from the `Authorization` header, decodes it via the Firebase Admin SDK (`auth.verifyIdToken`), and populates `req.user` (of type `DecodedIdToken`) on the request context.
- **Strict Verification Bypass Guard**: In-memory unverified Base64 token payload decoding is strictly restricted to active test and emulator environments (`VITEST === 'true'` or `FIREBASE_AUTH_EMULATOR_HOST`). Bypasses are forbidden on standard development servers or production environments to prevent forged JWT token attacks.

### 4. Custom Email Verification Guard (`requireEmailVerified`)
Enforces that password-based logins complete activation loops before accessing group data:
- Users signing in via Google Social Auth bypass this checks automatically.
- **E2E & Test Bypass**: To facilitate seamless automated testing in CI/CD pipelines, accounts holding domains ending in `@example.com` or `@test.local` bypass this verification automatically, preventing flaky testing states.

---

## 🩹 3. Standardized AppError & Exception Engine

The backend rejects ad-hoc `res.status(X).send()` errors. Instead, it relies on a custom `AppError` class hierarchy to model database conflicts, permission breaches, and validation flaws.

### Error Hierarchy (`api_internal/lib/errors.ts`)
```
         [ Error (Native) ]
                 │
                 ▼
            [ AppError ] (statusCode, errorCode)
                 │
  ┌──────────────┼──────────────┬──────────────┐
  ▼              ▼              ▼              ▼
ValidationError AuthenticationError ForbiddenError NotFoundError
```

- **`ValidationError`** (400, `'VALIDATION_ERROR'`): Triggered when incoming body validation schemas (validated via `zod`) fail checks.
- **`AuthenticationError`** (401, `'UNAUTHENTICATED'`): JWT missing or expired.
- **`ForbiddenError`** (403, `'FORBIDDEN'`): Valid credentials, but lacking permissions (e.g. reading another group's history) or email not verified.
- **`NotFoundError`** (404, `'NOT_FOUND'`): Missing group, user profile, or message.
- **`ConflictError`** (409, `'CONFLICT'`): Transaction collisions, e.g. group invite code duplication.

---

## 🚦 4. Global Error Mitigation & Sentry Integration

Any uncaught exception thrown inside routers propagates to the global express error middleware. This middleware ensures perfect client safety and observability.

### 1. Leak-Proof Information Scrubbing (Production vs. Dev)
If an unknown exception (e.g. database disconnect, runtime syntax error) occurs:
- **Development**: The raw error stack trace is returned to the client to speed up diagnostic tasks.
- **Production**: The middleware scrubs the details, hiding raw SQL/Firestore connection states, and replaces the response with a clean JSON payload:
  ```json
  {
    "error": "InternalServerError",
    "message": "An unexpected error occurred",
    "requestId": "e3b0c442..."
  }
  ```

### 2. Request Tracking with `x-request-id`
Every error response returns a correlation ID (`x-request-id` header or generated fallback). This ID links the customer support request directly to the corresponding server execution logs in Google Cloud Logging or Sentry. A custom middleware generates a UUID (`crypto.randomUUID()`) at the front of the gateway if no request ID is provided, guaranteeing tracing correlation for all requests.

### 3. Sentry Capture Pipeline
The Express gateway mounts `Sentry.setupExpressErrorHandler(app)` ahead of standard routers. If an error is caught:
1. Sentry captures the error context automatically.
2. The user ID (`req.user.uid`) and the correlation `requestId` are appended as metadata tags, allowing developers to query and trace exactly which client experienced the exception.
