# Development & Environment Setup Guide

Welcome to the **Scripture Habit** development guide. This document outlines everything you need to set up a local development environment, run tests, and contribute to the project.

---

## Quick Start (Local Setup)

You do **not** need a paid Firebase project or production API keys to develop locally. Scripture Habit runs entirely within local Firebase Emulators.

### Prerequisites
- **Node.js**: `>= 22.0.0` (Check with `node -v`)
- **npm**: `>= 10.0.0`
- **Java JRE / JDK**: Required for running the Firebase Emulator Suite (Check with `java -version`)

---

### Step-by-Step Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/your-username/scripture-habit.git
cd scripture-habit/scripture-habit
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Set Up Environment Variables
Copy the template environment file:
```bash
# On Linux / macOS / Git Bash:
cp .env.example .env.local

# On Windows (PowerShell):
Copy-Item .env.example .env.local
```
> [!NOTE]
> The default placeholder values in `.env.example` are pre-configured to work out-of-the-box with local emulators.

#### 4. Launch Firebase Emulators
In your terminal, start the local Firebase suite:
```bash
npm run emulators
# or: npx firebase emulators:start --project scripture-habit-auth
```
Once started, the emulator endpoints will be available:
- **Emulator UI Dashboard**: [http://127.0.0.1:4000](http://127.0.0.1:4000)
- **Firestore Emulator**: `127.0.0.1:8080`
- **Auth Emulator**: `127.0.0.1:9099`

#### 5. Seed the Sandbox Database
Open a **new terminal tab/window** and populate the local database with realistic test users, groups, streaks, and chat logs:
```bash
npm run db:seed
```
> [!TIP]
> **Idempotent & Safe**: You can run `npm run db:seed` whenever you want to reset your local database to a clean test state.

#### 6. Start the Frontend Dev Server
In your terminal:
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser to view the application.

---

## Environment Variables Reference

| Variable | Scope | Required in Local Dev? | Description |
| :--- | :--- | :---: | :--- |
| `VITE_FIREBASE_API_KEY` | Frontend | No (Placeholder OK) | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend | No (Placeholder OK) | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Frontend | No (Placeholder OK) | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Frontend | No (Placeholder OK) | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Frontend | No (Placeholder OK) | FCM Sender ID |
| `VITE_FIREBASE_APP_ID` | Frontend | No (Placeholder OK) | Firebase App ID |
| `VITE_APPCHECK_SITE_KEY` | Frontend | No (Leave empty) | reCAPTCHA v3 key (disabled locally) |
| `VITE_SENTRY_DSN` | Frontend | No (Leave empty) | Sentry error logging endpoint |
| `GEMINI_API_KEY` | Backend | Optional | Google Gemini API key for AI features |
| `CRON_SECRET` | Backend | Optional | Shared secret for maintenance cron triggers |
| `DISCORD_WEBHOOK_URL` | Backend | Optional | Webhook for internal monitoring alerts |

---

## Available npm Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite frontend dev server at `localhost:5173` |
| `npm run server` | Starts local Express backend server at `localhost:5000` |
| `npm run build` | Builds frontend production bundle and runs meta-localization |
| `npm run lint` | Runs ESLint across the codebase |
| `npm run check:all` | Runs full type checks, i18n checks, and FCM message verifications |
| `npm run test` | Runs unit & integration tests with Vitest |
| `npm run test:e2e` | Runs Playwright End-to-End tests against emulated sandbox |
| `npm run db:seed` | Seeds test users, study groups, streaks, and chat logs into emulators |

---

## Testing & Quality Verification

Before submitting a Pull Request, verify that all checks pass:

```bash
# 1. Type check & static analysis
npm run check:all

# 2. Run unit tests
npm run test

# 3. (Optional) Run E2E tests
npm run test:e2e
```

---

## Troubleshooting

### Port Conflicts (8080, 9099, 4000)
If the emulator fails to start because a port is occupied:
- **Windows (PowerShell)**:
  ```powershell
  Stop-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess -Force
  ```
- **macOS / Linux**:
  ```bash
  kill -9 $(lsof -t -i:8080)
  ```

### Java Missing for Emulators
The Firebase Emulator Suite requires Java runtime. If you see `Java not found`:
- Install OpenJDK (e.g., via `winget install Microsoft.OpenJDK.21` on Windows, or `brew install openjdk` on macOS).

---

## Contribution Guidelines

1. **Fork & Branch**: Create a feature branch from `main` (`git checkout -b feature/your-feature-name`).
2. **Atomic Commits**: Keep commits concise and descriptive.
3. **Follow Code Conventions**: Use standard React hooks rules, TypeScript types from `/types`, and maintain existing styling patterns.
4. **Create a Pull Request**: Provide a clear summary and screenshots/GIFs for any UI modifications.
