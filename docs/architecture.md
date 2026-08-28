# Architecture & Technical Reference

This document provides a technical overview of the Scripture Habit project, covering the tech stack, layer topology, data flow, and state management patterns.

---

## 1. Tech Stack

| Layer | Technology | Rationale & Responsibility |
| :--- | :--- | :--- |
| **Frontend** | **React 19** + **Vite 8** | Modern component model, fast builds, and efficient HMR |
| **Routing** | **React Router 7** | SPA navigation and deep-link routing |
| **State & Fetching** | **Zustand 5** / **TanStack Query 5** | Lightweight UI state and server API caching |
| **Real-Time Data** | **Firebase Client SDK 12** | Firestore WebSocket listeners for live chat synchronization |
| **Backend API** | **Node.js >= 22 (LTS 24)** + **Express 5** | Serverless API gateway hosted on Vercel Functions |
| **Database** | **Cloud Firestore** | Real-time document-oriented NoSQL database |
| **Authentication** | **Firebase Authentication** | Email/Password & Google Sign-In with server-side JWT verification |
| **AI Subsystem** | **Gemini 3.1 Flash-Lite** | Dynamic note translations, question prompts, and weekly letters |

---

## 2. Directory Structure & Physical Layers

```
scripture-habit/
├── api/                  # Vercel Serverless Function entry point
├── api_internal/         # Core backend logic (routes, services, cron, notifications)
├── backend/              # Local development Express server wrapper (Port: 5000)
├── src/                  # Frontend client (React 19 + Vite application)
└── types/                # Shared TypeScript schemas and data interfaces
```

---

## 3. Layer Architecture & State Taxonomy

### ① Logic-Component Split
- **Components (`src/components/`)**: Focus solely on layout, styling (Vanilla CSS), and rendering.
- **Custom Hooks (`src/hooks/`)**: Encapsulate API mutations, data subscriptions, and domain logic.

### ② State Management Division
- **Real-Time Data (Chat, Unread Counts, Streaks)**: Subscribed via Firestore `onSnapshot`.
- **Server API State (System Status, Static Metadata)**: Cached and refetched via TanStack Query.
- **Global UI State (Modals, Theme)**: Managed in Zustand stores.
- **Auth State**: Standardized in `AuthContext`.

---

## 4. Data Flow: Separation of Mutations and Queries

```mermaid
flowchart TD
    classDef fe fill:#1e293b,stroke:#38bdf8,stroke-width:1.5px,color:#f8fafc;
    classDef be fill:#1e1b4b,stroke:#a855f7,stroke-width:1.5px,color:#f8fafc;
    classDef fb fill:#0f172a,stroke:#f59e0b,stroke-width:1.5px,color:#f8fafc;

    subgraph Frontend["1. 📱 Frontend Client (React / PWA)"]
        Component["UI Components"]:::fe --> Hook["Feature Hooks (UI State & Subscriptions)"]:::fe
    end

    subgraph Backend["2. ☁️ Backend API (Express / Vercel)"]
        API["Express Controllers (Validation & Auth Guards)"]:::be --> Service["Domain Services (Business Logic)"]:::be
    end

    subgraph Firebase["3. 🔥 Firebase Cloud Infrastructure"]
        Auth["Firebase Auth (JWT Verification)"]:::fb
        DB[("Cloud Firestore (DB)")]:::fb
    end

    Hook -- "① API Mutation (Post/Edit)" --> API
    Auth -. "JWT Verification" .-> API
    Service -- "② Transactional Atomic Write" --> DB
    DB ==>|③ Real-Time Live Feed onSnapshot| Hook

    Frontend ~~~ Backend
    Backend ~~~ Firebase
```

- **Mutations**: Dispatched to backend Express endpoints to ensure validation and atomic multi-document updates.
- **Queries**: Real-time Firestore subscriptions (`onSnapshot`) push updates directly into the UI.

---

## 5. Related Documentation

- [Network & Performance Optimization](./network-performance-optimization.md)
- [Database & Security](./database-security.md)
- [API Middleware & Error Handling](./api-middleware-error-handling.md)
- [Development & Setup Guide](./development-guide.md)
