# Development & Environment: Operational Excellence

This guide provides the technical specifics required to set up, build, and deploy the **scripture-habit** platform across all environments (Local, Web, and Mobile).

---

## 🛠️ Environmental Variables Reference

The project uses diverse environments. Ensure your `.env` contains:

| Variable | Scope | Purpose |
| :--- | :--- | :--- |
| `VITE_FIREBASE_...` | Frontend | Public Firebase configuration for the React app. |
| `GEMINI_API_KEY` | Backend | API Key for accessing Gemini 3.1 AI features. |
| `CRON_SECRET` | Backend | Shared secret to authorize maintenance/cron requests. |
| `VITE_SENTRY_DSN` | Frontend | Endpoint for Sentry error and performance reporting. |

---

## 💻 Local Development Workflow

### 1. Frontend (Vite)
Running the HMR dev server:
```bash
npm install
npm run dev
```

### 2. Backend (Node/Express)
The backend is located in the root for Vercel compatibility, but organized under `api_internal`.
```bash
npm run server
```
- **Note**: Locally, the server runs on port 3001 (configurable). Ensure the frontend `API_BASE` is pointed correctly during local tests.

---

## 📱 Mobile Development (Capacitor)

The mobile experience is powered by **Capacitor 8**.

### Android "Save-and-See" Workflow
The most efficient way to develop for mobile is using **Livereload**:
```bash
# 1. Sync native plugins
npx cap sync android

# 2. Run with Livereload
# Replace [LOCAL_IP] with your machine's IP (e.g. 192.168.1.10)
npx cap run android --livereload --external
```
This points the Android Webview to your Vite dev server, allowing you to debug native features (like Google Auth) with instant UI updates.

### Common Troubleshooting
- **HTTPS/SSL**: Capacitor Webviews sometimes block non-HTTPS traffic to local IPs. Ensure your `android:usesCleartextTraffic` is set to `true` in `AndroidManifest.xml` during development.
- **Plugin Sync**: If you add a new `@capacitor` package, you MUST run `npx cap sync` to update the native project.

---

## 🚢 Deployment & Infrastructure

### 1. Backend: Vercel Functions
The project uses the "Function-as-a-Route" pattern.
- **Routing**: `vercel.json` maps all `/api/*` requests to the `api/api.ts` entry point.
- **Cold Starts**: Since this is a serverless environment, we optimize start times by keeping the `api_internal/lib/firebase-admin.ts` initialization outside the main handler.

### 2. Frontend: Firebase Hosting
Optimized for static assets and global CDN delivery.
```bash
npm run build
firebase deploy --only hosting
```
- **Assets**: All JS/CSS is minified with Terser via Vite for maximum mobile performance.
- **Cache Control**: The `firebase.json` is configured to ensure that `index.html` is never cached (allowing for instant updates), while static assets are cached for 1 year.

---

## 🧪 Consistency & Code Style
- **Type Checking**: Before every PR, run `tsc -b` to ensure all cross-layer types in `/types` are respected.
- **Linting**: We use a strict ESLint configuration to catch potential React hooks dependencies issues (`useEffect` dependency array errors).
