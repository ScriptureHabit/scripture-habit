# Technical Troubleshooting & FAQ

This document outlines common environmental and platform-specific issues encountered during the development of **scripture-habit**, particularly regarding the integration of **Capacitor**, **Android Emulation**, and **Firebase Emulators**.

---

## 📱 Mobile & Emulator Connectivity (Host Loopback)

### 1. Connection Refused: `ERR_CONNECTION_REFUSED`
*   **Symptom**: The Android Emulator or a physical device fails to load the Vite server on Livereload (`npx cap run android --livereload`) or fails to hit the local Express backend (port 3001).
*   **The Cause**: `localhost` (or `127.0.0.1`) inside the Android emulator refers to *the emulator itself*, not your host development machine.
*   **The Resolution**:
    1.  **Locate Host IP**: Find your machine's local IP address (e.g., `192.168.1.15`) via `ipconfig` (Windows) or `ifconfig` (Mac/Linux).
    2.  **Configure Vite**: Run the server with external visibility:
        ```bash
        npm run dev -- --host
        ```
    3.  **Update API Endpoint**: In your mobile `.env` or `capacitor.config.ts`, ensure `API_BASE` points directly to the machine's local IP:
        `http://192.168.1.15:3001/api`
    4.  **Emulated Device Bypass**: Alternatively, Android emulators can access the host machine's loopback interface using the special alias IP `10.0.2.2`. 
        `http://10.0.2.2:3001/api` works perfectly in emulator-only configurations.

### 2. Cleartext/HTTP Blocked
*   **Symptom**: Network calls to local development servers fail silently or show `net::ERR_CLEARTEXT_NOT_PERMITTED` in Android Studio logcat.
*   **The Cause**: Starting in Android 9 (API 28), cleartext (unencrypted HTTP) traffic is disabled by default for security.
*   **The Resolution**:
    Ensure the `AndroidManifest.xml` (located under `android/app/src/main/`) explicitly allows cleartext traffic during development:
    ```xml
    <application
        android:usesCleartextTraffic="true"
        ... >
    ```
    > [!WARNING]
    > Remember to remove or disable this config (or use network security configurations) before releasing the production build to the Google Play Store.

---

## 🔐 App Check & Google Authentication

### 1. "Invalid App Check Token" on Local APIs
*   **Symptom**: Backend Express API routes reject local requests from Vite or Emulators with `403 Forbidden: Invalid App Check`.
*   **The Cause**: App Check relies on device integrity providers (Play Integrity, DeviceCheck) which are absent on standard desktop browsers or emulator instances.
*   **The Resolution**:
    1.  **Test Bypass**: Set the environment variable `SKIP_APP_CHECK=true` in `.env.local` or on your local terminal environment. The middleware `verifyAppCheck` in `middleware.ts` automatically ignores missing headers when this flag is enabled.
    2.  **Debug Tokens**: For proper end-to-end emulation, register an App Check Debug Token in the Firebase Console and configure the client SDK:
        ```typescript
        // firebase.ts initialization
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        ```

### 2. Google Sign-in Failures on Native builds
*   **Symptom**: Tapping Google Login on Android triggers a spinner but silently returns to the login screen with code `12500` or `10`.
*   **The Cause**: Google OAuth requires SHA-1 fingerprint registration for the client application. The debug keystore used by Capacitor to build local Android APKs has a unique fingerprint that must be declared in your Firebase Project settings.
*   **The Resolution**:
    1.  **Extract SHA-1**: Run the Gradle signing report tool inside the `android/` directory:
        ```bash
        ./gradlew signingReport
        ```
        Look for the SHA-1 block corresponding to the `debug` variant.
    2.  **Register Fingerprint**: Copy the SHA-1 fingerprint. Go to **Firebase Console > Project Settings > Your Android App**, and add the fingerprint under **SHA certificate fingerprints**.
    3.  **Download updated JSON**: Download the fresh `google-services.json` and replace the existing one in `android/app/`.

---

## 🧪 Firebase Emulator Environment Setup

### 1. Firestore Authentication Context Discrepancy
*   **Symptom**: Unit tests fail or Firestore rules reject operations because the emulator database context does not match the authenticated state.
*   **The Resolution**:
    Always utilize the rules testing utility wrapper in unit tests to initialize an authenticated context:
    ```typescript
    import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
    
    const testEnv = await initializeTestEnvironment({
        projectId: 'scripture-habit-auth',
        firestore: { rules: readFileSync('firestore.rules', 'utf8') }
    });
    
    // Create an authenticated Firestore context
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    ```
