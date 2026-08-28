# API Middleware & Error Handling

This document details the backend Express middleware pipeline (`api_internal/`), rate-limiting strategies, standardized `AppError` class hierarchy, and Sentry error tracking.

---

## 1. Middleware Pipeline Order

Backend requests traverse a security-first middleware pipeline:

```mermaid
flowchart TD
    classDef req fill:#1e1b4b,stroke:#a855f7,stroke-width:2px,color:#f8fafc;
    classDef mw fill:#1e293b,stroke:#64748b,stroke-width:1.5px,color:#f8fafc;
    classDef handler fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#f0fdf4;
    classDef err fill:#7f1d1d,stroke:#ef4444,stroke-width:2px,color:#fef2f2;

    Req["Incoming Client HTTP Request"]:::req
    ReqId["1. x-request-id Injection (Request UUID)"]:::mw
    CORS["2. CORS Verification (Valid Origin Check)"]:::mw
    RateLimit["3. Rate Limiters (IP / Token Bucket)"]:::mw
    AppCheck["4. verifyAppCheck (App Check Token Check)"]:::mw
    Auth["5. authenticate (Firebase JWT Validation)"]:::mw
    EmailCheck["6. requireEmailVerified (Email Verification Guard)"]:::mw
    Handler["🌟 7. Route Handler Execution (Business Logic)"]:::handler
    ErrHandler["⚠️ 8. Global Error Handler (Sentry Capture & Scrubbing)"]:::err

    Req --> ReqId --> CORS --> RateLimit --> AppCheck --> Auth --> EmailCheck --> Handler
    Handler -.->|On Exception| ErrHandler
```

---

## 2. Security & Authentication Middleware

1. **Request Tracking (`x-request-id`)**:
   Injects an unique UUID into every request and response header to correlate client errors with server logs and Sentry events.
2. **Rate Limiting (`express-rate-limit`)**:
   - **Global**: 300 requests per 15 minutes.
   - **Invites & Joins**: 15 attempts per hour (prevents brute-force scanning).
   - **AI Requests**: 100 calls per hour.
3. **App Check (`verifyAppCheck`)**:
   Validates app authenticity against Firebase App Check.
4. **JWT Verification (`authenticate`)**:
   Extracts Bearer tokens and sets decoded user context on `req.user`.
5. **Email Verification (`requireEmailVerified`)**:
   Ensures password-authenticated users have verified their email before accessing private group chats (bypassed for Google Sign-In and test accounts).

---

## 3. Standardized Error Hierarchy (`AppError`)

Instead of ad-hoc status returns, the backend utilizes structured `AppError` subclasses:

```mermaid
flowchart TD
    classDef base fill:#1e293b,stroke:#64748b,stroke-width:1.5px,color:#f8fafc;
    classDef clientErr fill:#78350f,stroke:#f59e0b,stroke-width:1.5px,color:#fef3c7;

    NativeError["Native Error (Standard JS Error)"]:::base --> AppError["AppError (statusCode, errorCode)"]:::base
    
    AppError --> ValidationError["ValidationError (400 Bad Request)"]:::clientErr
    AppError --> AuthError["AuthenticationError (401 Unauthorized)"]:::clientErr
    AppError --> ForbiddenError["ForbiddenError (403 Forbidden)"]:::clientErr
    AppError --> NotFoundError["NotFoundError (404 Not Found)"]:::clientErr
    AppError --> ConflictError["ConflictError (409 Conflict)"]:::clientErr
```

- **`ValidationError` (400)**: Failed schema validation (Zod).
- **`AuthenticationError` (401)**: Missing or expired authentication token.
- **`ForbiddenError` (403)**: Permission denied or unverified email.
- **`NotFoundError` (404)**: Requested resource does not exist.
- **`ConflictError` (409)**: Transaction or constraint conflicts.

---

## 4. Error Scrubbing & Sentry Integration

- **Production Scrubbing**:
  In production, unexpected 500 errors are scrubbed of internal stack traces, returning a clean JSON error response alongside the `requestId`.
- **Sentry Capture**:
  Unhandled exceptions automatically log to Sentry with attached metadata (`req.user.uid`, `requestId`, route parameters) for rapid diagnosis.

---

## 5. Related Documentation

- [Architecture Overview](./architecture.md)
- [App Check & API Protection](./security-architecture.md)
- [Monitoring & Observability](./monitoring-observability.md)
