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

Our security strategy uses a multi-layered model: Firestore rules guard the database, and the **Backend API** is the main handler for writes.

### 1. Firestore Rules & Frontend Restrictions
*   All critical collections (`users`, `messages`, `members`) have `allow write: if false;` in `firestore.rules`.
*   *Frontend Limitation*: Frontend code must **never** directly call `setDoc()`, `updateDoc()`, or `addDoc()` on core entities.
*   *Frontend Exception*: Creating a group is allowed directly via the frontend to enable instant group creation, but is strictly capped at **max 4 groups per user** (`groupIds.size() < 4`) in `firestore.rules`.

### 2. Backend-First (API Mutations)
*   All state updates (such as posting notes, cheering, marking messages as read, updating profile streaks, and group membership changes) must go through the Express backend via **Vercel Functions** (`api_internal/routes/*`).
*   **Atomic Transactions**: All updates affecting multiple records must be wrapped in `db.runTransaction()` to guarantee rollback on failure.

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
