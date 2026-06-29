# Technical Troubleshooting & FAQ

This document explains how to fix common environment and platform issues when developing **scripture-habit**, especially with **Firebase Emulators**.

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
