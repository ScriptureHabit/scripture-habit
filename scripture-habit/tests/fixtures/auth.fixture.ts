/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, Page } from '@playwright/test';

type AuthFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  // Provide a pre-authenticated page to the test
  authenticatedPage: async ({ page }, use) => {
    // 1. Set localStorage flags and DISABLE ANIMATIONS
    // Note: We Re-apply these because storageState might not capture everything 
    // or we want them fresh for every test execution.
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
    // Since storageState is loaded, this should stay on dashboard
    await page.goto('/en/dashboard');
    
    // 3. Simple verification that we are indeed logged in
    // This serves as a health check for the storageState
    await page.waitForURL(/.*dashboard/, { timeout: 30000 });
    
    // 4. Provide the authenticated page to the test
    await use(page);
  },
});

export { expect } from '@playwright/test';
