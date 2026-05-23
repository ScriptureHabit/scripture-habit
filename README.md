# Scripture Habit 📖🔥

Welcome to **Scripture Habit**, a premium React + TypeScript hybrid mobile and web application designed for social scripture study and habit-tracking. Built with React 19, Vite, Tailwind-free modern CSS, Cloud Firestore, and a Node.js/Express backend hosted on Vercel.

---

## 📂 Repository Structure

The project has been optimized to separate core documentation from application source code:

```
final-project/                     ← Repository Root
├── docs/                          ← Technical Documentation (Deep-dives & Guides)
├── scripture-habit/               ← Application Workspace
│   ├── src/                       │── React 19 Frontend
│   ├── backend/                   │── Express Server (Firebase Admin SDK)
│   ├── api/ & api_internal/       │── API routes and services
│   ├── android/                   │── Capacitor Android native project
│   ├── public/                    │── Static assets & PWA Service Workers
│   ├── package.json               │── Application scripts & dependencies
│   └── ...                        └── Firebase/Vercel configuration files
└── README.md                      ← You are here
```

---

## 🚀 Getting Started

All development and build scripts are managed within the `scripture-habit` workspace directory.

### 1. Installation
From the repository root, change to the workspace directory and install dependencies:
```powershell
cd scripture-habit
npm install
```

### 2. Running Local Development Servers
To start the React frontend (Vite):
```powershell
npm run dev
```

To start the Express API backend:
```powershell
npm run server
```

---

## 📚 Technical Documentation Index

We maintain a comprehensive suite of markdown-based technical guides in the root [docs/](docs/README.md) directory. Please refer to these for architectural details, deployment instructions, and local setup:

### 🏛️ General Architecture
*   **[Architecture & Structure](docs/architecture.md)**: Layered overview of API, Internal Services, Backend, and Frontend.
*   **[AI Context & Dev Charter](docs/ai-context.md)**: Crucial LLM boundaries, component-logic split, and transaction integrity.
*   **[Database Security Foundation](docs/database-security.md)**: Cloud Firestore structure and path-based security design.
*   **[Security & App Check Gates](docs/security-architecture.md)**: Authentication shields, token validation, and emulator bypass.
*   **[Firebase Security Rules & CQRS Write Isolation](docs/firebase-security-rules.md)**: Multi-tiered auth and backend-only write isolation.
*   **[Middleware & Global Error Handling](docs/api-middleware-error-handling.md)**: Standardized CORS, AppError custom boundaries, and Sentry alerts.
*   **[SEO & Dynamic Meta Management](docs/seo-and-meta-management.md)**: Multi-lingual canonical mapping and dynamic OG image scaling.

### 💬 Key Feature Deep-Dives
*   **[Chat & Dashboard Sync](docs/feature-chat-dashboard.md)**: Low-latency Firestore snapshot listeners and unread badge math.
*   **[AI Intelligence Integration](docs/feature-ai-integration.md)**: Gemini 3.1 Flash-Lite automation, Weekly Recaps, and translations.
*   **[Notification Push Delivery](docs/feature-notifications.md)**: FCM background service workers and dynamic state synchronization.

### ⚙️ Core Logic & Algorithms
*   **[Note Posting Pipeline](docs/logic-note-posting.md)**: Multi-document streak validation and gamified level-ups.
*   **[Gospel Library Scripture Parser](docs/gospel-library-mapper.md)**: Regular expression multi-lingual verse mapping.
*   **[Concurrency-Safe Group Invites](docs/group-invites.md)**: Expiration timelines and rate-limited invite codes.
*   **[Inactivity Scanner & Auto-Kick](docs/inactivity-and-autokick.md)**: Owner-rotation protocols and automated subcollection self-healing.
*   **[URL Metadata & SSRF Prevention](docs/url-metadata-extraction.md)**: Multi-tiered caching and secure client-server parsing.
*   **[I18n Localization Engine](docs/logic-i18n.md)**: Contextual language wrappers and AU translation fallbacks.
*   **[Solidarity Mathematics (Unity)](docs/unity-participation.md)**: Real-time timezone resets and solidarity math for group study.
*   **[Firestore Transactions](docs/firestore-transactions-counters.md)**: Read-before-write guarantees and counter sharding.
*   **[Book Suggestion Sorting](docs/incremental-book-suggestions.md)**: Unicode mapping and Katakana-Hiragana sound-shifting priorities.
*   **[User Profile Anonymization](docs/profile-sync-anonymization.md)**: Clean cascades and dummy replacement tags.
*   **[Timezone-Aware Reminders](docs/timezone-streak-reminders.md)**: Multi-tenant batch querying via client Intl clocks.

### 🛠️ Operations & Release Guides
*   **[Development & Mobile Config](docs/development-guide.md)**: Local Capacitor Android settings and development guides.
*   **[Vitest & Playwright E2E Testing](docs/testing-guide.md)**: Rules, mocks, and browser verification scripts.
*   **[CI/CD Pipelines](docs/cicd-maintenance-automation.md)**: GitHub Actions continuous delivery, Vercel deployments, and daily Cron schedules.
*   **[PWA & Webview Native Lifecycles](docs/hybrid-mobile-lifecycle.md)**: In-app WebView sandboxing, SW refresh prompts, and loopback escapes.
*   **[Offline Persistence Design](docs/firestore-offline-persistence.md)**: IndexedDB multi-tab lock configurations and recovery strategies.
*   **[Android App Signing & Releases](docs/hybrid-mobile-release-guide.md)**: Google Play console signatures, provisioning, and SHA mapping.
*   **[Midnight Reset Hooks](docs/client-unity-midnight-reset.md)**: Sub-minute active polling hooks keeping user streaks dynamically fresh.
*   **[Troubleshooting & FAQ](docs/troubleshooting.md)**: Quick-fixes for typical mobile builds, keystores, and network routing.

---

## 🔧 Technology Stack

*   **Frontend UI:** React 19 + TypeScript + Vite + Zustand (UI state) + React Query (Server sync)
*   **Backend Services:** Node.js + Express + Firebase Admin SDK (Vercel serverless functions)
*   **Mobile Core:** Capacitor 8 (native Android layer integration)
*   **Database & Core Auth:** Cloud Firestore + Firebase Authentication (App Check & Rules enforced)
*   **Styling Standards:** Premium modern CSS variables, glassmorphism, responsive grids, and subtle micro-animations.

---

> [!TIP]
> Each document in the `docs/` folder contains comprehensive diagrams and guides to keep development intuitive and structured. Open these files in markdown preview mode inside VS Code or GitHub for the best reading experience.