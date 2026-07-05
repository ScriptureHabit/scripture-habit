/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Force Emulator environment variables before importing firebase-admin
process.env.GCLOUD_PROJECT = 'scripture-habit-auth';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { test as base, Page } from '@playwright/test';
import { db } from '../../api_internal/lib/firebase-admin.js';

type TestHelpers = {
  setupTestGroup: (params: { groupName: string; memberCount?: number; timeZone?: string; setYesterdayDate?: boolean; unityPercentage?: number }) => Promise<{ groupId: string }>;
  callApi: (endpoint: string, body: Record<string, unknown>) => Promise<any>;
};

type AuthFixtures = {
  authenticatedPage: Page & TestHelpers;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // 1. Create a completely isolated random user via Firebase Auth Emulator API
    const timestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const email = `e2e-user-${timestamp}@example.com`;
    const password = 'Password123!';
    const nickname = `E2E Tester ${timestamp}`;

    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    const apiKey = 'AIzaSyCBgfSff0SJ6Rg1tGmU2z4MBccGMrA2jbM';

    // SignUp request
    const authUrl = `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
    const signupRes = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    if (!signupRes.ok) {
      const errText = await signupRes.text();
      throw new Error(`Failed to create emulator test user in fixture: ${errText}`);
    }
    const userData = await signupRes.json();
    const uid = userData.localId;
    const idToken = userData.idToken;
    const refreshToken = userData.refreshToken;

    // Create matching Firestore user document to satisfy "User not found" checks
    try {
      await db.collection('users').doc(uid).set({
        email,
        nickname,
        hasFcmToken: false,
        createdAt: new Date().toISOString(),
        language: 'en',
        groupIds: [],
        hasSeenWelcomeStory: true,
        hasSetKickThreshold: true,
        kickThreshold: 3
      });
      await db.collection('users').doc(uid).collection('private').doc('tokens').set({
        fcmTokens: []
      });
      console.log(`[AuthFixture] Successfully seeded Firestore document for: ${email}`);
    } catch (dbErr) {
      console.error(`[AuthFixture] Failed to seed user document in Firestore:`, dbErr);
    }

    // Set display name in Emulator Auth
    const updateUrl = `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`;
    const updateRes = await fetch(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        displayName: nickname,
        photoUrl: '',
        returnSecureToken: true
      })
    });
    if (!updateRes.ok) {
      console.warn('[AuthFixture] Warning: Failed to set display name in Emulator Auth.');
    }

    // 2. Initialize browser state (Wipe cookie consent banners, disable animations)
    await page.addInitScript(() => {
        window.localStorage.setItem('cookieConsent', 'true');
        window.localStorage.setItem('lastNotifPrompt', Date.now().toString());

        const style = document.createElement('style');
        style.innerHTML = `
          *, *::before, *::after {
            transition-duration: 0.001s !important;
            animation-duration: 0.001s !important;
            transition-delay: 0s !important;
            animation-delay: 0s !important;
          }
        `;
        document.head.appendChild(style);
    });

    // 3. Inject Firebase Auth State directly to browser's IndexedDB (bypassing UI login page)
    console.log(`[AuthFixture] Injecting auth state for isolated user: ${email}`);
    // Navigate to welcome page first to ensure origin is stable and loaded
    await page.goto('/en/welcome');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(async (state) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('firebaseLocalStorageDb', 1);
        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
            db.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
          }
        };
        request.onsuccess = (event: any) => {
          const db = event.target.result;
          const tx = db.transaction('firebaseLocalStorage', 'readwrite');
          const store = tx.objectStore('firebaseLocalStorage');
          const record = {
            fbase_key: state.keyName,
            value: {
              uid: state.uid,
              email: state.email,
              emailVerified: true,
              displayName: state.nickname,
              isAnonymous: false,
              photoURL: "",
              providerData: [
                {
                  providerId: "password",
                  uid: state.uid,
                  displayName: state.nickname,
                  email: state.email,
                  phoneNumber: null,
                  photoURL: ""
                }
              ],
              stsTokenManager: {
                refreshToken: state.refreshToken,
                accessToken: state.idToken,
                expirationTime: 2524608000000 // Fixed future timestamp (Year 2050) to prevent clock mock skew issues
              },
              createdAt: Date.now().toString(),
              lastLoginAt: Date.now().toString(),
              apiKey: state.apiKey,
              appName: "[DEFAULT]"
            }
          };
          const putRequest = store.put(record);
          putRequest.onerror = () => reject(new Error('Failed to write auth state to IndexedDB'));
          
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(new Error('IndexedDB Transaction failed'));
        };
        request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      });
    }, {
      apiKey,
      keyName: `firebase:authUser:${apiKey}:[DEFAULT]`,
      uid,
      email,
      nickname,
      idToken,
      refreshToken
    });

    // 4. Navigate to dashboard (Should mount directly as authenticated)
    await page.goto('/en/dashboard');
    await page.waitForURL(/.*dashboard/, { timeout: 30000 });
    
    await page.waitForSelector('.dashboard-skeleton', { state: 'detached', timeout: 30000 }).catch(() => {
        console.log('[AuthFixture] Dashboard skeleton did not appear or timed out waiting for detachment. Continuing...');
    });

    await page.waitForSelector('[data-testid="sidebar-notes"]', { timeout: 20000 });

    // --- API CALLING HELPERS ---
    const callApi = async (endpoint: string, body: Record<string, unknown>) => {
      const getIDToken = async () => {
        return await page.evaluate(async () => {
          const waitForAuth = () => {
            return new Promise((resolve, reject) => {
              let attempts = 0;
              const checkAuth = () => {
                const auth = (window as any).firebaseAuth;
                if (auth && auth.currentUser) {
                  resolve(auth.currentUser);
                } else if (attempts++ > 40) {
                  reject(new Error('Firebase auth timeout in helper'));
                } else {
                  setTimeout(checkAuth, 500);
                }
              };
              checkAuth();
            });
          };
          const user = await waitForAuth() as { getIdToken: () => Promise<string> };
          return await user.getIdToken();
        });
      };

      let idToken: string;
      try {
        idToken = await getIDToken();
      } catch (err: any) {
        if (err.message.includes('Execution context was destroyed')) {
          await page.waitForLoadState('load');
          idToken = await getIDToken();
        } else {
          throw err;
        }
      }

      const response = await page.request.post(endpoint, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        data: body
      });

      if (!response.ok()) {
        const errorText = await response.text();
        throw new Error(`API Error (${endpoint}): ${response.status()} ${errorText}`);
      }
      return await response.json();
    };

    const setupTestGroup = async (params: { groupName: string; memberCount?: number; timeZone?: string; setYesterdayDate?: boolean; unityPercentage?: number }) => {
      return await callApi('/api/test/setup-test-group', params);
    };

    const pageWithHelpers = Object.assign(page, { setupTestGroup, callApi });

    await use(pageWithHelpers as Page & TestHelpers);

    // Dynamic cleanups are not needed because each test uses a completely isolated temporary user.
  },
});

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';
