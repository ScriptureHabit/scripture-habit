# Scripture Habit 📖🔥

Scripture Habit is a social scripture study and habit-tracking app. It is built with React, TypeScript, Express, and Firebase, and supports Android via Capacitor.

---

## 📂 Project Structure

This repository is divided into two main parts: the documentation (`docs/`) and the application source code (`scripture-habit/`).

```
final-project/
├── docs/                          # Technical documentation
├── scripture-habit/               # Application workspace
│   ├── src/                       # React frontend (Vite)
│   ├── backend/                   # Express backend (Firebase Admin)
│   ├── api/                       # API routes
│   ├── android/                   # Capacitor Android project files
│   ├── public/                    # Static assets & Service Worker
│   └── package.json               # Package configuration
└── README.md                      # This file
```

---

## 🚀 Getting Started

All development and build scripts are run inside the `scripture-habit` directory.

### 1. Setup
From the repository root, go to the project directory and install dependencies:
```bash
cd scripture-habit
npm install
```

### 2. Run Frontend (Vite)
```bash
npm run dev
```

### 3. Run Backend (Express API)
```bash
npm run server
```

---

## 📚 Documentation Index

Detailed technical documents are stored in the [docs/](docs/README.md) folder.

> [!NOTE]
> 🇯🇵 **[日本語の技術ドキュメント一覧はこちら (Japanese Version Available)](docs/ja/README.md)**

### Architecture & Security
*   **[Architecture & Structure](docs/architecture.md)**: Overview of directories and code layers (Frontend/Backend/API).
*   **[AI Context & Dev Guide](docs/ai-context.md)**: Rules for development and coding standards.
*   **[Database Security Foundation](docs/database-security.md)**: Firestore database structure and path-based permissions.
*   **[Security & App Check](docs/security-architecture.md)**: User authentication and Firebase App Check settings.
*   **[Firebase Security Rules](docs/firebase-security-rules.md)**: Firestore security rules and write permissions.
*   **[Middleware & Error Handling](docs/api-middleware-error-handling.md)**: CORS settings, error classes, and Sentry tracking.
*   **[SEO & Meta Management](docs/seo-and-meta-management.md)**: Search engine optimization and Open Graph tags.

### Features
*   **[Chat & Dashboard Sync](docs/feature-chat-dashboard.md)**: Real-time chat sync and unread counts using Firestore.
*   **[AI Integration](docs/feature-ai-integration.md)**: Gemini integration for translation, weekly summaries, and automation.
*   **[Notifications](docs/feature-notifications.md)**: Push notifications via FCM (Firebase Cloud Messaging).

### Core Logic
*   **[Note Posting](docs/logic-note-posting.md)**: How users post notes, and how study streaks and levels are updated.
*   **[Gospel Library Mapper](docs/gospel-library-mapper.md)**: Parsing and linking scripture chapters/verses in different languages.
*   **[Group Invites](docs/group-invites.md)**: Invite codes and joining process for groups.
*   **[Inactivity & Auto-Kick](docs/inactivity-and-autokick.md)**: System to kick inactive users and transfer group ownership.
*   **[URL Metadata](docs/url-metadata-extraction.md)**: Fetching web page titles securely with server-side caching.
*   **[I18n Localization](docs/logic-i18n.md)**: Multi-language setup for both frontend and backend.
*   **[Midnight Reset Hooks](docs/client-unity-midnight-reset.md)**: Hook to handle local midnight resets and keep user streaks accurate.
*   **[Firestore Transactions](docs/firestore-transactions-counters.md)**: Firestore data updates and counter systems.
*   **[Book Suggestions](docs/incremental-book-suggestions.md)**: Search suggestions and alphabetical sorting logic.
*   **[User Profile Anonymization](docs/profile-sync-anonymization.md)**: Deleting user accounts and removing personal data.
*   **[Timezone Reminders](docs/timezone-streak-reminders.md)**: Sending push notifications based on user's timezone.

### Operations & Deploy
*   **[Development Guide](docs/development-guide.md)**: Local development setup and mobile app settings.
*   **[Testing Guide](docs/testing-guide.md)**: Writing and running tests (Vitest and Playwright).
*   **[CI/CD Pipelines](docs/cicd-maintenance-automation.md)**: GitHub Actions for building, testing, and Vercel deployment.
*   **[PWA & Hybrid Lifecycle](docs/hybrid-mobile-lifecycle.md)**: PWA updates and mobile WebView settings.
*   **[Offline Support](docs/firestore-offline-persistence.md)**: Firestore offline caching and multi-tab synchronization.
*   **[Android App Signing](docs/hybrid-mobile-release-guide.md)**: Keystore files and App Store deployment guides.
*   **[Troubleshooting & FAQ](docs/troubleshooting.md)**: Common fixes for emulator, Android build, and setup issues.

---

## 🔧 Tech Stack

*   **Frontend:** React 19, TypeScript, Vite, Zustand, React Query, CSS Variables
*   **Backend:** Node.js, Express, Firebase Admin SDK (Vercel Serverless)
*   **Mobile:** Capacitor 8 (Android)
*   **Database & Auth:** Cloud Firestore, Firebase Authentication, Firebase App Check