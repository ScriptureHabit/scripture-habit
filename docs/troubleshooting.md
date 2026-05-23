# Technical Troubleshooting & FAQ

This document explains how to fix common environment and platform issues when developing **scripture-habit**, especially with **Capacitor**, **Android Emulators**, and **Firebase Emulators**.

---

## Mobile & Emulator Connectivity

### 1. Connection Refused: `ERR_CONNECTION_REFUSED`
*   **Symptom**: The Android Emulator or a physical device fails to load the Vite server on Livereload (`npx cap run android --livereload`) or fails to hit the local Express backend (port 3001).
*   **Cause**: `localhost` (or `127.0.0.1`) inside the Android emulator refers to the emulator itself, not your host development machine.
*   **Solution**:
    1.  **Locate Host IP**: Find your machine's local IP address (e.g., `192.168.1.15`) using `ipconfig` (Windows) or `ifconfig` (Mac/Linux).
    2.  **Configure Vite**: Run the Vite server with external access enabled:
        ```bash
        npm run dev -- --host
        ```
    3.  **Update API Endpoint**: In your mobile `.env` or `capacitor.config.ts`, make sure `API_BASE` points to your machine's IP address:
        `http://192.168.1.15:3001/api`
    4.  **Emulator Alternative**: Android emulators can access the host machine using the special IP `10.0.2.2`. For example, `http://10.0.2.2:3001/api` works when running on an emulator.

### 2. Cleartext/HTTP Blocked
*   **Symptom**: Network calls to local development servers fail silently or show `net::ERR_CLEARTEXT_NOT_PERMITTED` in Android Studio logcat.
*   **Cause**: Starting in Android 9 (API 28), cleartext (unencrypted HTTP) traffic is disabled by default.
*   **Solution**:
    Allow cleartext traffic in your debug configuration. Add `android:usesCleartextTraffic="true"` to your `AndroidManifest.xml` (in `android/app/src/main/`):
    ```xml
    <application
        android:usesCleartextTraffic="true"
        ... >
    ```
    > [!WARNING]
    > Remove this setting before deploying the production build to the Google Play Store.

---

## App Check & Google Authentication

### 1. "Invalid App Check Token" on Local APIs
*   **Symptom**: Backend Express API routes reject local requests from Vite or Emulators with `403 Forbidden: Invalid App Check`.
*   **Cause**: App Check requires device integrity providers (like Play Integrity or DeviceCheck) which are not available in standard web browsers or emulators.
*   **Solution**:
    1.  **Bypass in Development**: Set `SKIP_APP_CHECK=true` in your local environment variables. The `verifyAppCheck` middleware in `middleware.ts` will skip validation when this flag is enabled.
    2.  **Use Debug Tokens**: To test App Check, register a debug token in the Firebase Console and configure the client SDK:
        ```typescript
        // firebase.ts initialization
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        ```

### 2. Google Sign-in Failures on Native builds
*   **Symptom**: Tapping Google Login on Android triggers a spinner but silently returns to the login screen with code `12500` or `10`.
*   **Cause**: Google OAuth requires the SHA-1 fingerprint of the signing key. The debug keystore used by Capacitor has a fingerprint that must be registered in your Firebase project settings.
*   **Solution**:
    1.  **Extract SHA-1**: Run the Gradle signing report tool inside the `android/` directory:
        ```bash
        ./gradlew signingReport
        ```
        Look for the SHA-1 block corresponding to the `debug` variant.
    2.  **Register Fingerprint**: Copy the SHA-1 fingerprint. Go to **Firebase Console > Project Settings > Your Android App**, and add the fingerprint under **SHA certificate fingerprints**.
    3.  **Update Configuration**: Download the new `google-services.json` from Firebase and replace the file in `android/app/`.

---

## Firebase Emulator Environment Setup

### 1. Firestore Authentication Context Discrepancy
*   **Symptom**: Unit tests fail or Firestore rules reject operations because the emulator database context does not match the authenticated state.
*   **Solution**:
    Use `@firebase/rules-unit-testing` in your tests to create an authenticated context:
    ```typescript
    import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
    
    const testEnv = await initializeTestEnvironment({
        projectId: 'scripture-habit-auth',
        firestore: { rules: readFileSync('firestore.rules', 'utf8') }
    });
    
    // Create an authenticated Firestore context
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    ```
