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
- **Note**: Locally, the server runs on port 3001 (configurable). Ensure the frontend `API_BASE` is pointed correctly during local tests.

---

## Mobile Development (Capacitor)

The mobile app uses **Capacitor 8**.

### Android Development with Livereload
To develop and test on Android with real-time updates, use **Livereload**:
```bash
# 1. Sync native plugins
npx cap sync android

# 2. Run with Livereload
# Replace [LOCAL_IP] with your machine's IP (e.g. 192.168.1.10)
npx cap run android --livereload --external
```
This connects the Android WebView to your Vite development server, letting you test native features (like Google Auth) with live updates.

### Common Troubleshooting
- **HTTPS/SSL**: Capacitor WebViews sometimes block HTTP traffic to local IPs. Ensure `android:usesCleartextTraffic` is set to `true` in `AndroidManifest.xml` for local development.
- **Plugin Sync**: If you add a new `@capacitor` package, you MUST run `npx cap sync` to update the native project.

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
