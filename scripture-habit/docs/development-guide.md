# Development & Environment Guide

This guide provides everything you need to set up the development environment, run the application locally, and deploy it to production.

---

## 🛠️ Environment Setup

### Root `.env` (Project Wide)
You need a `.env` file in the root directory with the following variables:

```bash
# Firebase Frontend Config
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...

# AI & API
GEMINI_API_KEY=...
```

### Firebase Service Account
For backend operations (Express API), a Firebase Service Account JSON is required. Ensure your environment has the necessary permissions to call `admin.initializeApp()`.

---

## 💻 Development Workflow

### 1. Local Web Development
To run the frontend with Hot Module Replacement (HMR):
```bash
npm install
npm run dev
```
The app will be available at `http://localhost:5173`.

### 2. Local API Development
The backend is a Node.js Express server. To run it locally:
```bash
npm run server
```

### 3. Mobile Development (Capacitor + Android)
The app uses Capacitor to wrap the web build for Android.
- **Sync web code to native**:
  ```bash
  npm run build
  npx cap copy android
  ```
- **LiveReload (Development on device)**:
  We recommend using Vite's server and pointing the Capacitor bridge to your local IP:
  ```bash
  npx cap run android --livereload --external
  ```

---

## 🚢 Deployment

### Frontend (Firebase Hosting)
The frontend is deployed to Firebase Hosting.
```bash
npm run build
firebase deploy --only hosting
```

### Backend API (Vercel)
The Express API (root `api/` folder) is designed to be deployed as a Vercel Serverless Function.
- **Config**: See `vercel.json` for routing and environment configuration.
- **Deployment**: Automatic via GitHub integration or `vercel deploy`.

---

## 🛡️ Database & Security

### Security Rules
Before deployment, always verify the security rules:
```bash
firebase deploy --only firestore:rules
```
The rules are located in `firestore.rules` and enforce:
- **Email Verification**: Required for social interactions (groups/chat).
- **AppCheck**: Required for all write operations to prevent non-app traffic.
- **Read-Only Data**: Most collections are writable only via the Admin SDK (API) for strict business logic enforcement.

---

## 🧪 Testing

The project uses **Vitest** for unit testing.
```bash
npm run test
```
Tests are located alongside the components or in specified `__tests__` directories.
