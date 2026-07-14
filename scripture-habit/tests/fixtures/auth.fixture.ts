/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Force Emulator environment variables before importing firebase-admin
process.env.GCLOUD_PROJECT = 'scripture-habit-auth';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { test as base, Page } from '@playwright/test';
import { db, admin } from '../../api_internal/lib/firebase-admin.js';
import { disableAnimationsScript } from '../helpers/test-helpers';

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
        emailVerified: true
      });
      console.log(`[AuthFixture] Verified emulator auth user for ${email}`);
    } catch (authErr) {
      console.warn('[AuthFixture] Warning: Failed to update emulator auth user via admin SDK.', authErr);
    }

    // 2. Initialize browser state (Wipe cookie consent banners & disable animations)
    await page.addInitScript(disableAnimationsScript());

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

    // 3. Sign in directly and navigate to Dashboard
    console.log(`[AuthFixture] Signing in directly via Firebase auth for isolated user: ${email}`);
    await page.goto('/en/login');
    await page.waitForLoadState('load');
    await page.waitForFunction(() => !!(window as any).firebaseAuthHelpers, null, { timeout: 30000 });

    await page.evaluate(async ({ email, password }) => {
      const auth = (window as any).firebaseAuth;
      const helpers = (window as any).firebaseAuthHelpers;
      if (!auth || !helpers) {
        throw new Error('Firebase auth helpers are not available in browser context.');
      }
      await helpers.signInWithEmailAndPassword(auth, email, password);
      // Also wait for the auth state to propagate before continuing
      await new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged((user: any) => {
            if (user) {
                unsubscribe();
                resolve(user);
            }
        });
      });
    }, { email, password });

    // 4. Manually navigate to dashboard and wait for stabilization
    console.log('[AuthFixture] Sign-in successful, forcing navigation to dashboard.');
    await page.goto('/en/dashboard', { waitUntil: 'load' });
    
    try {
      await page.waitForURL(/.*dashboard/, { timeout: 30000 });
      console.log('[AuthFixture] Successfully navigated to dashboard URL.');
    } catch (err) {
      console.error('[AuthFixture] Failed to navigate to dashboard URL', err, { currentUrl: await page.url() });
      throw err;
    }
    
    // 5. Wait for page to be stable
    await page.waitForSelector('.dashboard-skeleton', { state: 'detached', timeout: 30000 });
    await page.waitForSelector('[data-testid="sidebar-notes"]', { timeout: 30000 });
    console.log('[AuthFixture] Fixture setup complete.');


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
        let errorDetails: string;
        try {
          const errorJson = await response.json();
          errorDetails = JSON.stringify(errorJson, null, 2);
        } catch {
          // If response is not JSON, fall back to plain text
          errorDetails = await response.text();
        }
        console.error(`[AuthFixture][API Error] ${endpoint} failed with status ${response.status()}:\n${errorDetails}`);
        throw new Error(`API Error (${endpoint}): ${response.status()} - ${errorDetails.substring(0, 200)}...`); // Truncate for brevity in error message
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
