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
cd scripture-habit
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

#### 4. Launch Local Development Environment

##### Option A: Unified All-in-One Command (Recommended)
Start Firebase Emulators, wait for initialization, and start both the Express backend and Vite frontend within a single terminal (starts with a clean database):
```bash
npm run dev:all
```
Logs from all services will be streamed with color-coded prefixes (`[SYS]`, `[EMU]`, `[API]`, `[WEB]`). Press `Ctrl+C` to stop all services simultaneously.

> [!TIP]
> **Seeding Test Data**:
> - Once services are running, execute `npm run db:seed:existing` (existing user, group members, streak) or `npm run db:seed:new` (fresh new user, 0 streaks, uncompleted onboarding) in a separate terminal tab whenever you need fresh test data.
> - To start all services and automatically seed existing user test data in one command, use `npm run dev:all:seed`.

##### Option B: Individual Service Commands
If you prefer running services in separate terminal tabs:
```bash
# 1. Start Firebase Emulators
npm run emulators

# 2. Seed test data into local Firestore & Auth emulators
npm run db:seed

# 3. Start local Express backend server (localhost:5000)
npm run server

# 4. Start frontend Vite dev server (localhost:5173)
npm run dev
```

Once started, the emulator and application endpoints will be available:
- **Application Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Emulator UI Dashboard**: [http://127.0.0.1:4000](http://127.0.0.1:4000)
- **Firestore Emulator**: `127.0.0.1:8080`
- **Auth Emulator**: `127.0.0.1:9099`

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
| `npm run dev:all` | Starts all development services (Emulators, Backend, Frontend) with a clean database in a single terminal |
| `npm run dev:all:seed` | Starts all development services and automatically seeds initial test data (db:seed) |
| `npm run dev` | Starts Vite frontend dev server at `localhost:5173` |
| `npm run server` | Starts local Express backend server at `localhost:5000` |
| `npm run emulators` | Starts local Firebase Emulator Suite (Firestore, Auth, Functions) |
| `npm run build` | Builds frontend production bundle and runs meta-localization |
| `npm run lint` | Runs ESLint across the codebase |
| `npm run check:all` | Runs full type checks, i18n checks, and backend integrity checks |
| `npm run check:i18n` | Verifies translation key coverage across all locales |
| `npm run sort:locales` | Automatically sorts and formats translation files |
| `npm run test` | Runs frontend unit tests with Vitest |
| `npm run test:internal` | Runs backend/integration tests with emulated Firebase |
| `npm run test:rules` | Runs dedicated Firestore security rules unit tests |
| `npm run test:e2e` | Runs Playwright End-to-End tests against emulated sandbox |
| `npm run db:seed` | Seeds existing user test environment (alias for `db:seed:existing`) |
| `npm run db:seed:existing` | Seeds existing user test environment (`existing-user@example.com`, Daily Bread group, 8-day streak, notes) |
| `npm run db:seed:new` | Seeds fresh new user test environment (`new-user@example.com`, no groups, uncompleted onboarding) |
| `npm run docs:dev` | Starts local VitePress documentation dev server |
| `npm run docs:build` | Generates TypeDoc references and builds production docs site |

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

## Contribution Workflow
 
Once you have made and verified your changes locally:

1. **Branching**: Create a feature branch from `main` (e.g., `git checkout -b feat/your-feature-name`).
2. **Atomic Commits**: Follow Conventional Commits format with clear messages.
3. **Quality Checks**: Ensure `npm run check:all` and `npm test` pass with 0 errors.
4. **Create a Pull Request**: Submit a PR with a description of what was changed and attach screenshots/GIFs for UI modifications.

> For full branch naming conventions, commit formats, translation contribution steps, and our Code of Conduct, please refer to the **[Contributing Guide (CONTRIBUTING.md)](../CONTRIBUTING.md)**.
