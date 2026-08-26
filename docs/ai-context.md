# AI Context Guide & Development Standards

This document defines the core architectural guidelines, state management taxonomy, mutation policies, and coding conventions for Scripture Habit.

---

## 1. Architectural Principles

### ① Logic-Component Split
- **UI Components (`src/components/`)**: Focus strictly on layout, rendering, and Vanilla CSS styling. Do not embed direct API requests or complex calculation routines.
- **Custom Hooks (`src/hooks/`)**: Encapsulate data subscriptions, API calls, and business logic.
- **Styling**: Use modular **Vanilla CSS** with variables from `src/index.css`. Avoid adding TailwindCSS or utility libraries unless explicitly requested.

### ② State Management Taxonomy (Single Source of Truth)
- **Static Server Metadata**: TanStack Query
- **Real-Time Data (Chats, Unreads, Streaks)**: Firestore `onSnapshot`
- **Global UI State (Modals, Theme)**: Zustand
- **Auth Session**: `AuthContext`

---

## 2. Mutation & Data Integrity Policies

### ① Shared Resources Routed Through Backend APIs
- Shared resources (`messages`, `members`, `cheers`) are locked down with `allow write: if false;` in `firestore.rules`.
- Mutations must route through Express backend endpoints using the Firebase Admin SDK to ensure validation and atomic consistency.

### ② Direct Client Writes for Private Resources
- Private collections (`users/{uid}`, `private/tokens`, `groupStates`) allow direct writes from authenticated owners (`request.auth.uid == userId`) for instant offline responsiveness.

### ③ Transaction Rules
- **Read-before-Write**: Perform all document reads prior to any writes.
- **No Side Effects Inside Transactions**: Execute notifications, external webhooks, or side effects only after the transaction successfully commits.

---

## 3. Localization & AI Integration

- **No Hardcoded Strings**: Always resolve UI text through the `useLanguage` `t()` translation helper.
- **AI Persona**: Gemini prompts must maintain the "Encouraging Facilitator" persona (warm, approachable, focused on personal daily application).

---

## 4. Error Handling Standards

- Throw specific `AppError` subclasses (`ValidationError`, `AuthenticationError`, `ForbiddenError`, `NotFoundError`, `ConflictError`) rather than generic `Error` instances.
- Use `sendErrorResponse(res, error)` for standardized JSON responses and Sentry correlation.

---

## 5. Related Documentation

- [Architecture Overview](./architecture.md)
- [Firebase Security Rules](./firebase-security-rules.md)
- [API Middleware & Error Handling](./api-middleware-error-handling.md)
