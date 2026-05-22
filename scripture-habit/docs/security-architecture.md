# App Check & API Protection Architecture: Technical Deep-Dive

To protect backend resources from bot spam, scraper nets, distributed denial-of-service (DDoS) requests, and unauthorized third-party API clients, **scripture-habit** integrates **Firebase App Check** as a fundamental gateway guard. 

App Check verifies that incoming HTTP requests originate from legitimate, unmodified instances of our application (whether web-based or wrapped in Capacitor native mobile shells) before allowing execution of expensive operations like AI translations, group creations, or metadata parsing.

---

## 🛡️ Defense-in-Depth: The Two-Tier Security Model

Our architecture utilizes a **Defense-in-Depth (多重防御)** strategy. Security protection is evaluated at two distinct boundaries: the **API Gateway Layer** (this document) and the **Database Security Rules Layer**.

```
Incoming Request  ──►  [ Tier 1: API Middleware ]  ──►  [ Tier 2: Database Rules ]  ──► Data Commit
                       - Express Router                 - firestore.rules
                       - verifyAppCheck                 - isAuthenticated()
                       - globalLimiter                  - isAppCheckVerified()
                       (This Document)                  (See firebase-security-rules.md)
```

1.  **Tier 1 (API Gateway - This Document)**: Protects CPU/Memory-expensive endpoints and external system APIs (such as Gemini AI, push notifications, and webpage scrapers). This gateway filters invalid, un-attested, or spammy requests before they consume costly cloud server resource allocations.
2.  **Tier 2 (Database Layer)**: Direct Firestore Security Rules act as a fallback firewall lock. If a hacker attempts to bypass our Express API by writing directly to Firestore using client-side SDKs, the database layer immediately halts and rejects the write. (See **[Firebase Security Rules & Write Isolation](firebase-security-rules.md)**).

---

## 🛡️ The App Check Gateway Flow

App Check operates as an interceptor middleware sitting at the front of the backend router pipeline.

```mermaid
sequenceDiagram
    autonumber
    participant Client as Client Application (Web / Mobile)
    participant SDK as Firebase App Check SDK
    participant API as Express Router / Middleware (verifyAppCheck)
    participant Admin as Firebase Admin SDK (appCheck)
    participant Controller as API Controller (e.g., /post-note)
 
    Client->>SDK: Request App Check Token
    Note over Client,SDK: SDK verifies client environment integrity (reCAPTCHA v3 / Play Integrity)
    SDK-->>Client: Return App Check Token String
    Client->>API: POST /api/messages/post-note (Include X-Firebase-AppCheck Header)
    
    API->>API: Check Environment Variables (isProduction & SKIP_APP_CHECK)
    alt SKIP_APP_CHECK === true AND in Local Development
        API-->>Controller: Bypass check & Forward request (next())
    else SKIP_APP_CHECK === true AND in Production
        API->>API: Log [SECURITY ALERT]
        API-->>Client: HTTP 401 Unauthorized (Security check required)
    end
 
    alt Token Header Missing
        API-->>Client: HTTP 401 Unauthorized (Security context missing)
    else Token Header Present
        API->>Admin: appCheck.verifyToken(token)
        alt Token Verification Successful
            Admin-->>API: Token Decoded & Validated
            API->>Controller: Forward to API Controller (next())
            Controller-->>Client: HTTP 200 Success Response
        else Token Verification Failed (Expired / Fake)
            Admin-->>API: Throw Token Exception
            API->>API: Log Warning (Obfuscated Token)
            API-->>Client: HTTP 401 Unauthorized (Security check failed)
        end
    end
```

---

## 🔒 Security Gateways & Middleware Implementation

The core logic resides in `api_internal/lib/middleware.ts` within the `verifyAppCheck` middleware function.

### 1. Verification Logic
```typescript
export const verifyAppCheck = async (req: Request, res: Response, next: NextFunction) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const skipRequested = process.env.SKIP_APP_CHECK === 'true';

    // 1. Strict Production Lockdown
    if (skipRequested) {
        if (isProduction) {
            console.error('[SECURITY ALERT] SKIP_APP_CHECK is enabled in production! This is forbidden.');
            return res.status(401).json({ error: 'Unauthorized: Security check required' });
        }
        console.warn('[AppCheck] Skipping verification (Development only)');
        return next();
    }

    // 2. Extract Token
    const token = req.header('X-Firebase-AppCheck');
    if (!token) {
        console.warn('[AppCheck] Security context missing from:', req.ip);
        return next(new AppError('Unauthorized: Security context missing', 401, 'APP_CHECK_MISSING'));
    }

    // 3. Verify via Firebase Admin SDK
    try {
        if (!appCheck) {
            throw new Error('Firebase App Check service is unavailable.');
        }
        await appCheck.verifyToken(token);
        next();
    } catch (err: unknown) {
        const error = err as Error;
        // Obfuscate the token in logs to protect user privacy
        console.warn('[AppCheck] Verification failed for token:', token.substring(0, 10) + '...', 'Error:', error.message);
        return next(new AppError('Unauthorized: Security check failed', error.message.includes('unavailable') ? 503 : 401, 'APP_CHECK_FAILED'));
    }
};
```

---

## ⚙️ Environment Strategies & Test Bypasses

Running security constraints during automated testing and local integration sweeps requires flexible but airtight configurations:

### 1. Local Development Bypasses
To allow developers to code, test APIs, or use API clients like Postman/cURL locally without generating cryptographically signed app tokens:
*   **Configuration**: Add `SKIP_APP_CHECK=true` in `.env.local`.
*   **Security Guard**: The middleware enforces that if `NODE_ENV === 'production'`, any request to skip App Check throws a high-severity `[SECURITY ALERT]` log and blocks the request with a hard `HTTP 401`.

### 2. Integration & End-to-End Testing (Vitest / Playwright)
*   **Vitest**: During integration testing, backend tests (e.g., `api_internal/routes/groups.integration.test.ts`) are launched in an environment where `SKIP_APP_CHECK=true` is automatically set, allowing route-level validation to occur cleanly.
*   **Playwright**: For true browser end-to-end tests, Firebase provides **App Check Debug Providers**. The E2E environment injects a pre-shared debug token into the browser context, which is verified by App Check as a legitimate test device, maintaining full end-to-end path testing.

---

## 🚦 Protected API Inventory

Almost all state-mutating or resource-heavy routes are protected by the `verifyAppCheck` middleware. Below is an inventory of critical routes shielded by this gateway:

| Category | Endpoint | Protected Actions | Reason for Protection |
| :--- | :--- | :--- | :--- |
| **Authentication** | `POST /api/auth/update-profile` | Modifies user nicknames or settings. | Prevents bulk database spamming. |
| | `POST /api/auth/verify-login` | Resolves user sessions. | Secures session resolution gateways. |
| **Habit Loop** | `POST /api/messages/post-note` | Submits scripture notes, updates streaks, increments levels. | Stops streak forging and note spamming. |
| | `POST /api/messages/toggle-reaction` | Toggles message emoji reactions. | Prevents automated visual reaction floods. |
| **Group Admins** | `POST /api/groups/create-group` | Sets up new study groups. | Stops group exhaustion / resource bloating. |
| | `POST /api/groups/regenerate-invite` | Revokes and refreshes invite codes. | Blocks token exhaustion. |
| **AI Integration** | `POST /api/ai/translate` | Triggers LLM Translation jobs. | Protects from high LLM token costs. |
| | `POST /api/ai/generate-ponder-questions` | Prompts LLM for reflection items. | Prevents LLM billing inflation. |
| **Scrapers** | `GET /api/preview/fetch-church-metadata` | Fetches external webpage contents. | Blocks third-party scrapers using our SSRF proxies. |
