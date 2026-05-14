/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test as base, Page } from '@playwright/test';

type TestHelpers = {
  setupTestGroup: (params: { groupName: string; memberCount?: number; timeZone?: string; setYesterdayDate?: boolean; unityPercentage?: number }) => Promise<{ groupId: string }>;
  callApi: (endpoint: string, body: Record<string, unknown>) => Promise<unknown>;
};

type AuthFixtures = {
  authenticatedPage: Page & TestHelpers;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // 1. Set localStorage flags and DISABLE ANIMATIONS
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

    // 2. Navigate to dashboard
    await page.goto('/en/dashboard');
    await page.waitForURL(/.*dashboard/, { timeout: 30000 });
    
    await page.waitForSelector('.dashboard-skeleton', { state: 'detached', timeout: 30000 }).catch(() => {
        console.log('[AuthFixture] Dashboard skeleton did not appear or timed out waiting for detachment. Continuing...');
    });

    await page.waitForSelector('[data-testid="sidebar-notes"]', { timeout: 20000 });

    // --- HELPER METHODS ---

    const callApi = async (endpoint: string, body: Record<string, unknown>) => {
      return await page.evaluate(async ({ endpoint, body }) => {
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
        const idToken = await user.getIdToken();
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error (${endpoint}): ${response.status} ${errorText}`);
        }
        return await response.json();
      }, { endpoint, body });
    };

    const setupTestGroup = async (params: { groupName: string; memberCount?: number; timeZone?: string; setYesterdayDate?: boolean; unityPercentage?: number }) => {
      return await callApi('/api/test/setup-test-group', params);
    };

    // Attach helpers to page object for convenience
    const pageWithHelpers = Object.assign(page, { setupTestGroup, callApi });

    await use(pageWithHelpers as Page & TestHelpers);

    // 4. Cleanup: Leave all groups after each test
    // This ensures User A (Shared Tester) starts each test with a clean slate
    try {
      await pageWithHelpers.callApi('/api/test/leave-all-groups', {});
      // console.log('[AuthFixture] Automatic post-test cleanup successful.');
    } catch (e) {
      console.warn('[AuthFixture] Automatic post-test cleanup failed (best effort):', e);
    }
  },
});

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';
