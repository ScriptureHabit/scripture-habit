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
graph TD
    subgraph Frontend ["Frontend (React)"]
        Component["UI Components"]
        Hook["Feature Hooks"]
    end

    subgraph Backend ["Backend API (Vercel)"]
        API["Express Controllers"]
        Service["Domain Services"]
    end

    subgraph Firebase ["Firebase Cloud"]
        DB[("Firestore")]
        Auth["Firebase Auth"]
    end

    Component --> Hook
    Hook -- "① API Mutation (Post/Edit)" --> API
    API --> Service
    Service -- "② Transactional Write" --> DB
    DB -- "③ Real-time Feed (onSnapshot)" --> Hook
    Hook --> Component
    Auth -- "JWT Token" --> API
```

- **Mutations**: Dispatched to backend Express endpoints to ensure validation and atomic multi-document updates.
- **Queries**: Real-time Firestore subscriptions (`onSnapshot`) push updates directly into the UI.

---

## 5. Related Documentation

- [Network & Performance Optimization](./network-performance-optimization.md)
- [Database & Security](./database-security.md)
- [API Middleware & Error Handling](./api-middleware-error-handling.md)
- [Development & Setup Guide](./development-guide.md)
