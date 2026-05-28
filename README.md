# Scripture Habit 📖🔥

[![Vite](https://img.shields.io/badge/vite-v8.0-blueviolet.svg)](https://vite.dev/)
[![React](https://img.shields.io/badge/react-v19.0-blue.svg)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/firebase-v12.0-orange.svg)](https://firebase.google.com/)
[![Express](https://img.shields.io/badge/express-v5.0-green.svg)](https://expressjs.com/)
[![Capacitor](https://img.shields.io/badge/capacitor-v8.0-lightgrey.svg)](https://capacitorjs.com/)

Scripture Habit is a premium social scripture study and gamified habit-tracking application. Built with React 19, TypeScript, Express, and Firebase, it supports seamless cross-platform deployment to Android and iOS via Capacitor.

---

## 📂 Project Structure

This repository is structured into a clean **Docs/Workspace** layout:

```
final-project/
├── docs/                          # In-depth technical blueprints & specifications
│   └── ja/                        # Japanese translated documentation
├── scripture-habit/               # Application workspace
│   ├── src/                       # React 19 frontend SPA
│   ├── backend/                   # Express 5 entrypoint for Vercel Functions
│   ├── api/                       # API routing rules
│   ├── api_internal/              # Server-side business logic, models, and service layer
│   ├── android/                   # Capacitor Native Android integration assets
│   ├── scripts/                   # Seeding & development operations utilities
│   └── package.json               # Universal build & run scripts configuration
└── README.md                      # This onboarding blueprint
```

---

## 🚀 Getting Started

All development, seeding, and execution commands should be run inside the `scripture-habit` directory.

### 1. Installation
Navigate to the workspace root and install all unified dependencies:
```bash
cd scripture-habit
npm install
```

### 2. Run Local Firebase Emulators
To enable a complete local sandbox with high fidelity (Authentication, Firestore, and Hosting), run:
```bash
# This automatically spins up emulators on local ports
npx firebase emulators:start
```

### 3. Seed Local Database 🎮
Connecting to an empty local emulator makes visual verification difficult. We provide a robust, idempotent database seeding utility.
Run the following script to immediately populate a production-like workspace with test users, streaks, study history, and real-time chat sync data:
```bash
npm run db:seed
```
> [!TIP]
> **Idempotent Execution**: The seeding script automatically clears any matching test accounts and groups prior to seeding. You can run it repeatedly without accumulating duplicate documents.

### 4. Fire Up the Services
Run the hot-reloading Dev server (Vite) and the serverless Express backend server:
```bash
# Run Frontend (Vite)
npm run dev

# Run Backend (Express API)
npm run server
```

---

## 🗺️ Interactive CodeTours

We include **22 interactive VS Code CodeTours** that serve as a live guide directly inside your code editor. 

*   **🚀 Tour 0: Scripture Habit Onboarding Tour**: Walks through the step-by-step lifecycles of Study Note submission, Streak calculation, Firestore atomic transactions, FCM notifications, and real-time chat sync optimization.
*   **💻 Tour 1: Frontend Core Mechanics & React Hooks**: Guides developers through the real-time group chat synchronization controller, unread messages calculation, and live daily streak computations.
*   **🛡️ Tour 2: Security, Rules & API Protection**: Focuses on `firestore.rules`, App Check verification middlewares, and Zod validator schemas.
*   **⚙️ Tour 3: Back-end Automation & Maintenance**: Walks through the inactivity-service (auto-kick/ownership rotation) and the archive-service (bucket chat history sweeps).
*   **🎨 Tour 4: Front-end Architecture, State & i18n**: Explores our CSS design tokens, global Zustand/Auth states, and localized Gospel Library mapper logic.
*   **🧪 Tour 5: Testing & CI/CD Pipeline**: Focuses on database rules unit tests, frontend hooks unit tests, and Playwright E2E browser tests linked with GitHub Actions.
*   **📱 Tour 6: Capacitor Hybrid Mobile Bridge**: Shows how Vite builds are wrapped inside Native WebViews and how Google OAuth or local storage fallbacks are configured.
*   **🤖 Tour 7: AI & Gemini Integration Pipeline**: Explores Gemini Flash-Lite Preview API integrations, study question creations, dual-layer MD5 caching, and batch translation algorithms.
*   **📖 Tour 8: Multilingual Gospel Library Mapper & Parsing**: Walks through multi-language scripture mapping matrices (10 languages) and text normalization/RegExp parsing algorithms.
*   **🔢 Tour 9: Distributed Counter Sharding & Transactions**: Focuses on high-throughput database sharding strategies (10 distributed shards), randomized transaction set operations, and archive-aware aggregates.
*   **🛡️ Tour 10: API Middleware, Error Handling & Sentry**: Explores CORS origin safeguards, Vercel trailing slash normalizations, Sentry Express error handlers, custom AppError hierarchies, and centralized catch-all middleware.
*   **💾 Tour 11: Firestore Offline Persistence & SDK Initialization**: Focuses on IndexedDB persistent local cache managers, shared multi-tab synchronization logic, automated web driver auth setups, and reCAPTCHA Enterprise verification setups.
*   **🔍 Tour 12: Incremental Book Suggestion Engine**: Explores static volume lists, Unicode NFKC normalizations, Japanese Hiragana-to-Katakana shifting logic, and the 4-tier sorting/ranking autocomplete cascade.
*   **⚙️ Tour 13: Local Development & Setup**: Guides developers on launching the local Firebase emulator suite, using seed scripts, and utilizing specialized npm commands.
*   **🌐 Tour 14: Localization & i18n Content**: Covers setting up the dynamic multi-language asset loaders, translation maps (10 languages), and localized book datasets.
*   **⚙️ Tour 15: Serverless Endpoint & Router Architecture**: Focuses on routing pipelines inside single serverless entrypoints on Vercel, dynamic CORS gatekeepers, and path normalizations.
*   **📱 Tour 16: Mobile App Platform Bridge & Native Configs**: Explores integration bindings mapping into Capacitor native wrappers, Google Auth configuration metrics, and platform plugins.
*   **🧪 Tour 17: Advanced Database Auditing & Streak Reliability Tests**: Focuses on memory-efficient SDK spies tracking exact document read metrics, multi-timezone streak boundaries, and mock configurations.
*   **🛡️ Tour 18: GDPR Profile Deletion & Anonymization Pipeline**: Covers user data propagation batch sweeps, GDPR deletion requirements, and reaction identity anonymization mappings.
*   **🔔 Tour 19: Push Notifications & Multicast Deduplication**: Focuses on dynamic recipient mapping arrays, duplicate FMCs prevention algorithms, and parallel multi-group localization broadcasts.
*   **🌐 Tour 20: Unified Multilingual Context & Race Guard Sync**: Covers dynamic browser-language detectors, state URL sync bindings, and dynamic translation package load maps with manual overwrite time guards.
*   **🏆 Tour 21: Gamified Group Unity & Member Eligibility**: Covers server-side aggregate activity sync states, real-time message integrations, and triple-fallback joining date filters.
*   **🔍 Tour 22: Dynamic SEO, Meta Managers & OGP Cards**: Covers route-specific HTML document title injections, dynamic Google OGP cards configurations, canonical link builders, and private app routes crawling protection rules.

### How to Start a Tour:
1. Install the **CodeTour** extension in VS Code.
2. Open the Command Palette (`Ctrl+Shift+P` on Windows/Linux or `Cmd+Shift+P` on macOS).
3. Select **CodeTour: Start Tour** and pick from the list!

---

## 📚 Technical Documentation Index

Detailed design blueprints are categorized under [docs/](docs/README.md).

> [!NOTE]  
> 🇯🇵 **[日本語の技術ドキュメント一覧はこちら (Japanese Version Available)](docs/ja/README.md)**

### Architecture & Foundation
*   **[Architecture & Design Layout](docs/architecture.md)**: Deep dive into tech stack layers, Custom Hooks, and state taxonomy.
*   **[Database Security Foundation](docs/database-security.md)**: Document-level Firestore paths and rule permissions.
*   **[Security & App Check](docs/security-architecture.md)**: Application integrity gatekeeping and Firebase App Check bindings.
*   **[Firebase Security Rules](docs/firebase-security-rules.md)**: Granular database permission logic.

### Core Systems & Features
*   **[Chat & Dashboard Sync](docs/feature-chat-dashboard.md)**: Live message streams, read tracking, and bundle caching.
*   **[Streak Warning Notifications](docs/timezone-streak-reminders.md)**: Timezone-aware local reminder schedulers.
*   **[AI Integration Engine](docs/feature-ai-integration.md)**: Gemini weekly summaries, translation utilities, and content moderation.
*   **[Gospel Library Mapper](docs/gospel-library-mapper.md)**: Cross-language scripture reference extraction algorithms.
*   **[GDPR Profile Anonymization](docs/profile-sync-anonymization.md)**: User privacy batch deletion sweeps.