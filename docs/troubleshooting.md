# Technical Troubleshooting & FAQ

This document explains how to resolve common development, platform, and operational issues when working with **scripture-habit**.

---

## 1. Port Conflicts (8080, 9099, 5000)

* **Symptom**: `npm run dev:all` or `npm run emulators` fails with:
  ```text
  Port 8080 is already in use by another process
  Port 9099 is already in use by another process
  ```
* **Cause**: Previous Node.js or Firebase emulator processes did not terminate cleanly upon exit (common on Windows and macOS).
* **Solution**:
  Release the reserved ports with `kill-port`:
  ```bash
  npx kill-port 8080 9099 5000 5173
  ```
  Then re-launch the dev environment:
  ```bash
  npm run dev:all
  ```

---

## 2. Firebase Emulator Java Prerequisite

* **Symptom**: `firebase emulators:start` fails with `Java runtime not found` or exits immediately.
* **Cause**: Cloud Firestore and Cloud Functions emulators run as Java JAR applications and require Java SE Development Kit (JDK) 11 or higher.
* **Solution**:
  1. Verify Java version:
     ```bash
     java -version
     ```
  2. Install OpenJDK 17 or 21 (e.g., via `winget install Microsoft.OpenJDK.21`, `brew install openjdk@21`, or Eclipse Temurin).
  3. Ensure `JAVA_HOME` is exported in your shell environment.

---

## 3. App Check & Local Authentication

* **Symptom**: Backend Express API routes reject local requests from Vite or Emulators with `403 Forbidden: Invalid App Check`.
* **Cause**: App Check relies on hardware attestation providers (Play Integrity, DeviceCheck) unavailable in standard web browsers or local emulators.
* **Solution**:
  1. **Bypass in Development**: Ensure `SKIP_APP_CHECK=true` is set in your `.env.local` or environment. The `verifyAppCheck` middleware in `middleware.ts` automatically skips verification.
  2. **Debug Token Verification**: When testing App Check behavior locally, register a debug token in the Firebase Console and configure the client SDK:
     ```typescript
     // firebase.ts initialization
     self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
     ```

---

## 4. PWA & Service Worker in Local Development

* **Symptom**: Changes to `sw.ts` or push notification event handlers are not taking effect during `npm run dev`.
* **Cause**: Vite PWA plugin disables the Service Worker by default in development mode to prevent stale asset caching during rapid Hot Module Replacement (HMR).
* **Solution**:
  Start Vite with the PWA development flag enabled:
  ```bash
  npm run dev:pwa
  ```
  Or launch with:
  ```bash
  cross-env VITE_ENABLE_SW_IN_DEV=true vite
  ```

---

## 5. Vercel Serverless Function Cold Starts & API Warmup

* **Symptom**: First API request after a period of inactivity experiences a 1.5–2.5 second latency spike.
* **Cause**: Vercel Serverless Functions spin down during idle periods. Re-initializing the Express container and Firebase Admin connection takes time.
* **Mitigation**:
  The application utilizes a lightweight pre-warming hook:
  ```typescript
  import { useApiWarmupOnMount } from '../../utils/api-warmup';

  // In NewNote, SignupForm, Dashboard:
  useApiWarmupOnMount();
  ```
  This fires an asynchronous, low-priority `GET /api/health` request upon mounting high-intent modal workflows, ensuring the serverless instance is warm before the user submits data.

---

## 6. Unit Testing Firestore Security Rules

* **Symptom**: Unit tests fail or Firestore rules reject operations because the emulator database context does not match the authenticated state.
* **Solution**:
  Use `@firebase/rules-unit-testing` to instantiate an authenticated test context:
  ```typescript
  import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
  import { readFileSync } from 'fs';

  const testEnv = await initializeTestEnvironment({
      projectId: 'scripture-habit-auth',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });

  // Create an authenticated Firestore context
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  ```
