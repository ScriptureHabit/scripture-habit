# Architecture & Technical Reference

This document provides a technical overview of the Scripture Habit architecture, detailing the technology stack, directory structure, data flow, and state management strategy.

> [!TIP]
> **Interactive Architecture Tour**: [Open Live Tour (App Bootstrapping & Routing)](https://htmlpreview.github.io/?https://github.com/ScriptureHabit/scripture-habit/blob/main/docs/public/architecture-tour.html?tour=tour-root&lang=en)

---

## 1. Tech Stack

Built on modern web standards to deliver high responsiveness and a cohesive developer experience.

| Layer | Technology | Rationale & Responsibility |
| :--- | :--- | :--- |
| **Frontend** | **React 19** + **Vite 8** | Fast builds and modern component architecture |
| **Routing** | **React Router 7** | SPA navigation and deep-link routing |
| **State & Data Fetching** | **Zustand 5** / **TanStack Query 5** | Lightweight UI state and efficient API cache management |
| **Real-Time Data** | **Firebase Client SDK 12** | Firestore WebSocket listeners for instant message synchronization |
| **Backend API** | **Node.js >= 22 (LTS 24)** + **Express 5** | Robust serverless API gateway hosted on Vercel Functions |
| **Database** | **Cloud Firestore** | Real-time, document-oriented NoSQL database |
| **Authentication** | **Firebase Authentication** | Secure sign-in (Google / Email) and server-side JWT verification |
| **AI Subsystem** | **Gemini 3.1 Flash-Lite** | Multilingual translation, question prompts, and reflection letters |

---

## 2. Directory Structure & Responsibilities

Maintains clear separation of concerns with predictable module boundaries.

```
scripture-habit/
├── api/                  # Vercel Serverless Function entry points
├── api_internal/         # Core backend logic (routes, services, notifications, cron)
├── backend/              # Local development Express server wrapper (Port: 5000)
├── src/                  # Frontend client (React 19 + Vite application)
└── types/                # Shared TypeScript schemas and data contracts
```

---

## 3. Layer Architecture & State Taxonomy

### ① Logic-Component Split
- **UI Components (`src/components/`)**: Dedicated to layout, styling (Vanilla CSS), and visual presentation.
- **Custom Hooks (`src/hooks/`)**: Handle server communication, data synchronization, and business logic.

### ② State Management Division
- **Real-Time Data (Chat, Unread Counts, Streaks)**: Subscribed via Firestore `onSnapshot` for instant updates.
- **Server API State (System Settings, Static Metadata)**: Managed and revalidated through TanStack Query.
- **Global UI State (Modals, Theme)**: Maintained in lightweight Zustand stores.
- **Auth State**: Centrally managed through `AuthContext`.

---

## 4. Data Flow: Decoupled Writes and Real-Time Subscriptions

Scripture Habit adopts a data flow architecture that cleanly separates transactional write operations from real-time subscriptions.

```mermaid
flowchart TD
    classDef fe fill:#1e293b,stroke:#38bdf8,stroke-width:1.5px,color:#f8fafc;
    classDef be fill:#1e1b4b,stroke:#a855f7,stroke-width:1.5px,color:#f8fafc;
    classDef fb fill:#0f172a,stroke:#f59e0b,stroke-width:1.5px,color:#f8fafc;

    subgraph Frontend["1. 📱 Frontend Client (React / PWA)"]
        Component["UI Components"]:::fe --> Hook["Custom Hooks (State & Subscriptions)"]:::fe
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

### Data Flow Mechanism

1. **Write Operations (Mutations)**  
   When a user creates a study note or sends a chat message, the frontend custom hook dispatches a request to the backend API.  
   The server verifies authentication via JWT and validates the payload using Zod schemas. It then executes a **Firestore atomic transaction** to calculate study metrics, synchronize chat feeds, and update progression levels simultaneously.

2. **Real-Time Synchronization (Subscriptions)**  
   Upon database updates, Firestore `onSnapshot` listeners deliver changes directly to the client without requiring page reloads.  
   This instantly updates both the user's own actions and activities from group members, such as new study notes and shared Unity progress.

3. **Separation of Writes and Reads**  
   Executing writes through backend API transactions while streaming updates through real-time subscriptions prevents client-side state divergence and guarantees strict data consistency across devices.

---

## 5. Related Documentation

- [Network & Performance Optimization](./network-performance-optimization.md)
- [Database & Data Security](./database-security.md)
- [API Design & Error Handling](./api-middleware-error-handling.md)
- [Development & Setup Guide](./development-guide.md)
