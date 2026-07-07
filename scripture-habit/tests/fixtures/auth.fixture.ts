/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Force Emulator environment variables before importing firebase-admin
process.env.GCLOUD_PROJECT = 'scripture-habit-auth';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { test as base, Page } from '@playwright/test';
import { db, admin } from '../../api_internal/lib/firebase-admin.js';

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
    const apiKey = process.env.VITE_FIREBASE_API_KEY || 'demo-api-key';

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

    // Set display name and ensure emailVerified on the emulator user
    try {
      await admin.auth().updateUser(uid, {
        displayName: nickname,
        photoURL: '',
        emailVerified: true
      });
      console.log(`[AuthFixture] Verified emulator auth user for ${email}`);
    } catch (authErr) {
      console.warn('[AuthFixture] Warning: Failed to update emulator auth user via admin SDK.', authErr);
    }

    // 2. Initialize browser state (Wipe cookie consent banners & disable animations)
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
        if (document.head) {
          document.head.appendChild(style);
        } else if (document.documentElement) {
          document.documentElement.appendChild(style);
        }
    });

    // Native network interception to propagate fake time from page.clock to backend API calls
    await page.route('**/api/**', async (route) => {
        const request = route.request();
        
        let browserTime: number;
        try {
            // Respect page.clock mock times by evaluating Date.now() inside browser context
            browserTime = await page.evaluate(() => Date.now());
        } catch {
            // Context might be destroyed during navigation; fallback to Node time safely
            browserTime = Date.now();
        }
        
        const headers = {
            ...request.headers(),
            'x-test-system-time': browserTime.toString()
        };
        
        await route.continue({ headers });
    });

    page.on('console', (msg) => {
      console.log(`[AuthFixture][browser console] ${msg.type()}: ${msg.text()}`);
    });

    page.on('pageerror', (error) => {
      console.error('[AuthFixture][browser pageerror]', error);
    });

    // 3. Perform a standard UI login (highly robust)
    console.log(`[AuthFixture] Logging in via UI for isolated user: ${email}`);
    console.log('[AuthFixture] navigating to login page', { target: '/en/login' });
    await page.goto('/en/login');
    await page.waitForLoadState('load');

    await page.fill('[data-testid="login-email"]', email);
    await page.fill('[data-testid="login-password"]', password);
    console.log('[AuthFixture] submitting login form', { email });
    await page.click('[data-testid="login-submit"]');

    // 4. Wait for dashboard redirect and stabilization
    console.log('[AuthFixture] waiting for dashboard redirect from', await page.url());
    try {
      await page.waitForURL(/.*dashboard/, { timeout: 30000 });
      console.log('[AuthFixture] dashboard redirect reached', await page.url());
    } catch (err) {
      console.error('[AuthFixture] waitForURL dashboard failed', err, { currentUrl: await page.url() });
      throw err;
    }
    
    await page.waitForSelector('.dashboard-skeleton', { state: 'detached', timeout: 30000 }).catch(() => {
        console.log('[AuthFixture] Dashboard skeleton did not appear or timed out waiting for detachment. Continuing...');
    });

    await page.waitForSelector('[data-testid="sidebar-notes"]', { timeout: 30000 });

    // --- API CALLING HELPERS ---
    const callApi = async (endpoint: string, body: Record<string, unknown>) => {
      const getIDToken = async () => {
        return await page.evaluate(async () => {
          const waitForAuth = () => {
            return new Promise((resolve, reject) => {
              const checkAuth = () => {
                const auth = (window as any).firebaseAuth;
                if (!auth) return false;

                if (auth.currentUser) {
                  resolve(auth.currentUser);
                  return true;
                }

                const unsubscribe = auth.onAuthStateChanged((user: any) => {
                  if (user) {
                    unsubscribe();
                    clearTimeout(timeoutId);
                    resolve(user);
                  }
                });

                const timeoutId = setTimeout(() => {
                  unsubscribe();
                  reject(new Error('Firebase auth timeout waiting for currentUser via onAuthStateChanged'));
                }, 20000);

                return true;
              };

              if (!checkAuth()) {
                let attempts = 0;
                const interval = setInterval(() => {
                  if (checkAuth() || attempts++ > 40) {
                    clearInterval(interval);
                    if (attempts > 40) {
                      reject(new Error('Firebase auth object not found on window (timeout)'));
                    }
                  }
                }, 100);
              }
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

      const browserTime = await page.evaluate(() => Date.now());

      const response = await page.request.post(endpoint, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
          'x-test-system-time': browserTime.toString()
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
