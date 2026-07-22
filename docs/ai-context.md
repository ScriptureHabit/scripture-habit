# AI Context Guide & Development Charter

Welcome, AI Developer! This document defines the core architecture, constraints, state conventions, and coding patterns of the **scripture-habit** project. Please follow these rules when generating or modifying code in this repository.

---

## 🏗️ Architectural Foundations

We follow a clean, type-safe, and modular architecture designed for good cross-platform (Web & Android) performance.

### 1. The Logic-Component Split
*   **UI Components**: Responsible *only* for rendering, layout, and styling. No direct API calls, routing, or complex state calculations should reside in a UI component.
*   **Custom Hooks / Services**: All data synchronization, API calling, logic calculation, and business rules must be in hooks (frontend) or services (backend).
*   **Styling**: Use **Vanilla CSS** with global variables (`src/index.css`) and glassmorphic utility classes (e.g., `.AppGlass`). 
    *   *Constraint*: **Do NOT use TailwindCSS or utility libraries** unless explicitly requested. Keep CSS modular and readable.

### 2. State Management (Rule of Source)
To prevent performance issues and data synchronization errors, always categorize state by its primary source and use the correct tool:

| State Type | Management Tool | Guidelines |
| :--- | :--- | :--- |
| **Server Metadata** | **TanStack Query (React Query)** | Use for standard stateless API requests (fetching settings, profiles, static metadata). |
| **Real-time Social State** | **Firebase client SDK `onSnapshot`** | Use for chat messages, read markers, group stats, and active participant states. |
| **Global UI State** | **Zustand** | Use for client-only state (modals, dark mode toggles, navigation state). |
| **User Identity** | **React AuthContext** | Use to share the current user’s session and identity. |

---

## 🔒 Write Policy & Data Integrity

To balance production security with offline responsiveness (Firestore Offline Persistence), the application adopts a **hybrid write policy**.

### 1. Firestore Rules & Frontend Restrictions
*   **Collaborative Resources (`messages`, `members`, `cheers`, `groups`)**:
    To prevent tampering and preserve data integrity, collaborative resources have `allow write: if false;` (with `groups` blocking client-side `create` as well) in `firestore.rules`. Frontend code must **never** directly write to them.
*   **User-Specific Resources (`users`, `private/tokens`, `groupStates`, `letters`)**:
    To allow local caching and instant responsiveness during offline states, direct document creation and updates are safely allowed by rules for the authenticated owner (`request.auth.uid == userId`).
*   **Frontend Exceptions**:
    Sending reports (`reports` create) is allowed directly from the frontend. *Note*: Creating a group (`groups` create) is no longer allowed client-side and has been consolidated under the backend API (`/api/groups/create-group`) to ensure security and enforce strict caps.

### 2. Backend-First (API Mutations)
*   All collaborative state updates (such as creating groups, posting notes, cheering, joining groups, and transferring ownership) must go through the Express backend via **Vercel Functions** (`api_internal/routes/*`).
*   **Atomic Transactions (Read-before-Write Enforcement)**:
    All updates affecting multiple records must be wrapped in `runPhasedTransaction()` to guarantee rollback on failure.
    *   *Constraint & Roadmap*: To ensure compliance with the "Read-before-Write" order constraint of Firestore Admin transactions, direct usage of `db.runTransaction()` is restricted (warn level) via ESLint (`no-restricted-properties`). Always use `runPhasedTransaction()`. Once historical transactions (e.g. in `auth.ts`) are fully migrated, this lint restriction will be upgraded from `warn` to `error`.
    *   *Type-Level Protection*: The callback argument of the `read` phase in `runPhasedTransaction()` is typed as `ReadOnlyTransaction` (which only exposes `get` and `getAll`). Calling mutation methods (`set`, `update`, `delete`) in the read phase is strictly blocked at compile time.
    *   *Idempotency Guarantee (No Side Effects)*: Firestore transactions auto-retry multiple times on write contentions. Therefore, **only write idempotent database mutations inside the transaction blocks.** Do not execute side effects (such as sending push notifications, HTTP requests to external APIs, or non-atomic state mutations) inside the transaction. Run them only after the transaction successfully commits (outside the transaction block).

### 3. Unified Express Error Handling
*   Business logic errors thrown in express controllers (e.g., unauthorized access, missing resources, validation failures) must throw custom `AppError` subclasses defined in [api_internal/lib/errors.ts](file:///c:/Users/dazhi/code/final-project/scripture-habit/api_internal/lib/errors.ts) (such as `ForbiddenError`, `NotFoundError`, `ValidationError`) instead of generic `Error` instances.
*   In the controller `catch` block, delegate response formatting to `sendErrorResponse(res, error, 'Fallback message')`. This helper automatically sets the proper HTTP status code (403, 404, 400, etc.) and propagates structured error codes to the client.

### 4. Firestore TTL & Size Bounds
*   To keep database operations efficient and scale chat performance, chat messages are automatically pruned after 30 days using Firestore's native Time-to-Live (TTL) feature (via the `expireAt` field).
*   Active chat sync is optimized to load only the latest 25 messages, keeping clients lightweight and preventing excessive read operations.

---

## 🤖 AI & Localization Integration

### 1. Multilingual Design
*   The application supports multiple languages. Do not hardcode strings in the UI. 
*   Always use the `t()` translation hook (from `useLanguage`) on the frontend, and locale bundles (under `api_internal/locales/`) on the backend.

### 2. Gemini Prompts & Personas
*   We use **Gemini 3.1 Flash-Lite Preview** globally with `thinkingLevel: "minimal"` to maximize response speed.
*   Prompts must always implement the **"Encouraging Facilitator"** persona: warm, approachable, personal-application focused, and avoiding academic or theological terminology.

---

## 🧪 Testing & Reliability

*   **Security Rules**: Validate security rule adjustments with `@firebase/rules-unit-testing` in `api_internal/rules.test.ts`.
*   **API Integrations**: Test Express routes against emulated Firestore services. Ensure that `verifyIdToken` is mocked appropriately for user contexts.
*   **Prompt Regression**: Always snapshot Gemini prompts (`ai_integration.test.ts`) to prevent phrasing changes from breaking structured model behaviors.
