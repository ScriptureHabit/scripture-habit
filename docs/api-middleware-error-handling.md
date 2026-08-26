# API Middleware & Error Handling

This document details the backend Express middleware pipeline (`api_internal/`), rate-limiting strategies, standardized `AppError` class hierarchy, and Sentry error tracking.

---

## 1. Middleware Pipeline Order

Backend requests traverse a strict, security-first middleware pipeline:

```mermaid
flowchart TD
    Req[Incoming Client Request] --> ReqId[1. x-request-id Injection<br/>(Request correlation ID)]
    ReqId --> CORS[2. CORS Verification<br/>(Valid Origin Check)]
    CORS --> RateLimit[3. Rate Limiters<br/>(IP/Token Bucket)]
    RateLimit --> AppCheck[4. verifyAppCheck<br/>(App Check Token Check)]
    AppCheck --> Auth[5. authenticate<br/>(Firebase JWT Validation)]
    Auth --> EmailCheck[6. requireEmailVerified<br/>(Email Verification Guard)]
    EmailCheck --> Handler[7. Route Handler Execution]
    Handler --> ErrHandler[8. Global Error Handler<br/>(Sentry Capture & Scrubbing)]
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
graph TD
    NativeError[Native Error] --> AppError[AppError (statusCode, errorCode)]
    AppError --> ValidationError["ValidationError (400)"]
    AppError --> AuthError["AuthenticationError (401)"]
    AppError --> ForbiddenError["ForbiddenError (403)"]
    AppError --> NotFoundError["NotFoundError (404)"]
    AppError --> ConflictError["ConflictError (409)"]
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
