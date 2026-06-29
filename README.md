# Scripture Habit 

[![Vite](https://img.shields.io/badge/vite-v8.0-blueviolet.svg)](https://vite.dev/)
[![React](https://img.shields.io/badge/react-v19.0-blue.svg)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/firebase-v12.0-orange.svg)](https://firebase.google.com/)
[![Express](https://img.shields.io/badge/express-v5.0-green.svg)](https://expressjs.com/)

Scripture Habit is a premium social scripture study and gamified habit-tracking application. Built with React 19, TypeScript, Express, and Firebase.

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
