# Technical Architecture Reference

This document provides details about the technical structure of the **scripture-habit** project, covering the tech stack, component design, data flow, and mobile architecture.

---

## 🛠️ Technical Stack

We use a modern, type-safe stack designed for fast development and good performance on both web and mobile.

### Frontend
- **Framework**: **React 19** (Concurrent Rendering, React Server Components ready).
- **Build Tool**: **Vite 8** (Fast Hot Module Replacement and optimized build bundles).
- **Navigation**: **React Router 7** (Single-page app layouts and deep-linking).
- **Data Fetching**: **TanStack Query 5** (Query state management, automated refetch, and offline sync caching).
- **State Management**: **Zustand 5** (Lightweight global UI and layout state).
- **Real-time**: **Firebase 12 Client SDK** (Firestore real-time sync using WebSocket listeners).

### Backend
- **Platform**: **Node 22** with **Express 5** (Hosted serverless on Vercel Functions).
- **Database**: **Cloud Firestore** (Document-based real-time NoSQL database).
- **Authentication**: **Firebase Admin SDK 13** (Server-side JWT verification and user management).
- **AI Engine**: **Gemini 3.1 Flash-Lite Preview** (Prompt handling, cached translation engine).

### Mobile Bridge
- **Platform**: **Capacitor 8** (WebView wrapper for Android and iOS builds).
- **Plugins**: Google Social Authentication, Push Notifications, AppCheck native integrity, Local Storage.

---

## 🏗️ Architectural Layers

### 1. The Schema Layer (`/types`)
**Centralized Data Models**: All Firestore document models are defined as TypeScript interfaces in the root `types/` folder. This ensures that the Backend (Admin SDK) and Frontend (Client SDK) always use identical data structures.

### 2. The Logic Layer (Custom Hooks)
We follow a **"Logic-Component Split"** philosophy:
- **Components**: Responsible for layout, styling (Vanilla CSS), and rendering.
- **Hooks**: Responsible for API calls, data synchronization, and business logic (e.g., `use-chat-sync-controller.ts`, `use-chat-data-engine.ts`, `useNoteSubmission`).
- **Benefit**: Components remain simple and testable, while logic is reusable across different views.

### 3. The Backend Service Layer (`api_internal/services`)
Routes are simple controllers. All main processes (transactions, streak calculations, notifications) are handled in **Services**:
- **`NoteService`**: Handles the note-posting transaction.
- **`StreakEngine`**: Internal logic for calculating 36-hour grace periods.
- **`ArchiveService`**: Manages bucket-based message archiving.

---

## 💾 State Management Taxonomy

We categorize state by its source and persistence to avoid redundant renders.

| State Category | Tool | Purpose |
| :--- | :--- | :--- |
| **Server State** | TanStack Query | Caching API responses, handling loading/error states for metadata. |
| **Real-time State** | Firestore SDK | Synchronized chat messages, unread counts, and group activity. |
| **Global UI State** | Zustand | Managing modals, sidebar visibility, and theme settings. |
| **Auth State** | AuthContext | Standardizing the `currentUser` object across all components. |

---

## 🔄 Data Flow: The Synchronized Loop

Our architecture separates **Mutations** (API) from **Queries** (Direct DB Listeners).

```mermaid
graph TD
    subgraph Frontend
        Component[React Component]
        Hook[Feature Hook]
        LocalCache[TanStack/Zustand]
    end

    subgraph Backend_Vercel
        API[Express Controller]
        Service[Service Transaction]
    end

    subgraph Firebase_Cloud
        DB[(Firestore)]
        Auth[Firebase Auth]
    end

    Component --> Hook
    Hook -- "1. API CALL (Action)" --> API
    API --> Service
    Service -- "2. ATOMIC WRITE" --> DB
    DB -- "3. onSnapshot (Live Feed)" --> Hook
    Hook --> Component
    Auth -- "JWT Token" --> API
```

---

## 🌎 Cross-Platform Bridge (Capacitor)

The mobile application is a WebView running our Vite build.

- **Bridge Communication**: Standard JS `fetch` calls are handled by the Capacitor bridge for secure network access.
- **Native Storage**: Using native storage for cached user preferences to speed up initial startup.
- **LiveReload workflow**: During development, the Android/iOS app points directly to the Vite dev server (`http://[local-ip]:5173`), allowing updates to appear immediately on physical devices.

---

## 🛡️ Reliability & Security
- **Type Guards**: `firestoreConverters.ts` uses Zod to ensure that malformed data in Firestore is caught and cleaned before it causes errors in the UI.
- **Error Boundaries**: Component-level boundaries prevent errors in a chat message from breaking the entire Dashboard.
- **Sentry Integration**: All layers report performance issues and unhandled exceptions to a centralized Sentry dashboard.
