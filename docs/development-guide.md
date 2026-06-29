# Development & Environment Setup

This guide explains how to set up, build, and deploy the **scripture-habit** platform for Local, Web, and Mobile environments.

---

## Environment Variables

Ensure your `.env` file contains the following variables:

| Variable | Scope | Purpose |
| :--- | :--- | :--- |
| `VITE_FIREBASE_...` | Frontend | Public Firebase configuration for the React app. |
| `GEMINI_API_KEY` | Backend | API Key for accessing Gemini 3.1 AI features. |
| `CRON_SECRET` | Backend | Shared secret to authorize maintenance/cron requests. |
| `VITE_SENTRY_DSN` | Frontend | Endpoint for Sentry error and performance reporting. |

---

## Local Development Workflow

### 1. Local Sandbox & Firebase Emulators 🎮

Connecting a fresh developer workspace to blank emulators makes UI testing tedious. Scripture Habit includes a full local emulator setup and an automated seeder script.

#### Step A: Boot the Emulators
To launch the Local Firebase Emulator Suite (Authentication, Firestore, Hosting, etc.):
```bash
# From the scripture-habit directory
npx firebase emulators:start
```
- **Auth Emulator**: `127.0.0.1:9099`
- **Firestore Emulator**: `127.0.0.1:8080`
- **Emulator UI Dashboard**: `127.0.0.1:4000`

#### Step B: Populate the Sandbox (Database Seeder)
Open a new terminal window and run the idempotent database seeder to immediately populate a production-like database sandbox with users, study group states, active calendars, streaks, levels, and real-time chat histories:
```bash
# Runs the robust TypeScript seeding pipeline
npm run db:seed
```
> [!TIP]
> **Idempotency Guarantee**: The seeder script automatically cleans and deletes any matching test accounts/groups prior to seeding. You can run it repeatedly without database duplication.

#### Emulator Troubleshooting & Tips:
- **Port Conflict**: If port `8080`, `9099`, or `4000` is already in use, find and terminate the blocking process:
  - *Windows*: `Stop-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess -Force`
  - *macOS/Linux*: `kill -9 $(lsof -t -i:8080)`
- **Offline Persistence**: Local Firestore emulators do not persist data across reboots unless configured with `--import/--export` flags.
- **Security Rules**: The local emulator evaluates the rules defined in `firestore.rules` in real-time. Ensure your Zod schema and query shapes align with these policies.

---

## Workspace Frontend & Backend Servers

### 1. Frontend (Vite)
To run the Vite development server:
```bash
npm install
npm run dev
```

### 2. Backend (Node/Express)
The backend code is located under `api_internal` (configured at the root level for Vercel).
```bash
npm run server
```
- **Note**: Locally, the server runs on port 5000 (configurable). Ensure the frontend `API_BASE` is pointed correctly during local tests.

---

## Deployment & Infrastructure

### 1. Backend: Vercel Functions
The backend runs as serverless functions on Vercel.
- **Routing**: `vercel.json` maps all `/api/*` requests to the `api/api.ts` entry point.
- **Cold Starts**: To reduce cold start times, `api_internal/lib/firebase-admin.ts` is initialized outside the main request handler.

### 2. Frontend: Firebase Hosting
The frontend is deployed to Firebase Hosting.
```bash
npm run build
firebase deploy --only hosting
```
- **Assets**: Vite minifies JS and CSS files during the build.
- **Cache Control**: `firebase.json` is configured so that `index.html` is not cached (for instant updates), while static assets are cached for one year.

---

## Code Style & Type Safety
- **Type Checking**: Run `tsc -b` before submitting a pull request to ensure types in `/types` are correct.
- **Linting**: ESLint is configured to check React hook dependencies (`useEffect` arrays).
