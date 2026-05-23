# AI Context Guide & Development Charter

Welcome, AI Developer! This document defines the core architecture, constraints, state conventions, and coding patterns of the **scripture-habit** project. Please adhere strictly to these rules when generating or modifying code in this repository.

---

## 🏗️ Architectural Foundations

We follow a clean, type-safe, and highly modular architecture designed for high-performance cross-platform (Web & Android) performance.

### 1. The Logic-Component Split
*   **UI Components**: Responsible *only* for rendering, layout, and styling. No direct API calls, routing side-effects, or complex state calculations should reside in a UI component.
*   **Custom Hooks / Services**: All data synchronization, API calling, logic calculation, and business rules must be encapsulated in hooks (frontend) or services (backend).
*   **Styling**: Use **Vanilla CSS** with global variables (`src/index.css`) and glassmorphic utility classes (e.g., `.AppGlass`). 
    *   *Constraint*: **Do NOT use TailwindCSS or utility libraries** unless explicitly requested by the user. Keep CSS modular and readable.

### 2. State Taxonomy (Rule of Source)
To prevent flickering, performance degradation, and data desynchronization, always categorize state by its primary source and utilize the correct tool:

| State Type | Management Tool | Guidelines |
| :--- | :--- | :--- |
| **Server Metadata** | **TanStack Query (React Query)** | Use for standard stateless API requests (fetching settings, profiles, static metadata). |
| **Real-time Social State** | **Firebase client SDK `onSnapshot`** | Use for chat messages, read markers, group stats, and active participant states. |
| **Global UI State** | **Zustand** | Use for non-context client-only state (modals, dark mode toggles, navigation state). |
| **User Identity** | **React AuthContext** | Use to propagate the current user’s session token and identity object. |

---

## 🔒 Write Policy & Data Integrity

Our security strategy uses a "Swiss Cheese" model: Firestore rules guard the database, but the **Backend API** is the primary arbiter of atomic writes.

### 1. Firestore Lockdown & Frontend Restrictions
*   All critical collections (`users`, `messages`, `members`) have `allow write: if false;` in `firestore.rules`.
*   *Frontend Limitation*: Frontend code must **never** directly call `setDoc()`, `updateDoc()`, or `addDoc()` on core entities.
*   *Frontend Exception*: Creating a group is permitted directly via the frontend to enable instant group initiation, but is strictly capped at **max 4 groups per user** (`groupIds.size() < 4`) in `firestore.rules`.

### 2. Backend-First (API Mutations)
*   All state updates (such as posting notes, cheering, marking messages as read, updating profile streaks, and group membership changes) must be routed through the Express backend via **Vercel Functions** (`api_internal/routes/*`).
*   **Atomic Transactions**: All mutations affecting multiple records (e.g., posting a note updates the user's streak, increments the group message counters, registers activity, and inserts the message) must be wrapped in `db.runTransaction()` to guarantee rollback on failure.

---

## 🤖 AI & Localization Integration

### 1. Multilingual Design
*   The application is global-first. Do not hardcode strings in the UI. 
*   Always use the `t()` translation hook (from `useLanguage`) on the frontend, and modular locale bundles (under `api_internal/locales/`) on the backend.

### 2. Gemini Prompts & Personas
*   We use **Gemini 3.1 Flash-Lite Preview** globally with `thinkingLevel: "minimal"` to maximize response speed.
*   Prompt engineering must always implement the **"Encouraging Facilitator"** persona: warm, highly approachable, personal-application focused, with absolute exclusion of dense academic or theological terminology.

---

## 🧪 Testing & Reliability

*   **Security Rules**: Validate security rule adjustments with `@firebase/rules-unit-testing` in `api_internal/rules.test.ts`.
*   **API Integrations**: Test Express routes against emulated Firestore services. Ensure that `verifyIdToken` is mocked appropriately for user contexts.
*   **Prompt Regression**: Always snapshot Gemini prompts (`ai_integration.test.ts`) to prevent slight phrasing changes from breaking structured model behaviors.
