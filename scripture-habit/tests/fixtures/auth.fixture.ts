/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, Page } from '@playwright/test';

type AuthFixtures = {
  authenticatedPage: Page;
  uniqueEmail: string;
};

export const test = base.extend<AuthFixtures>({
  // Provide a unique email for each test to ensure fresh state
  uniqueEmail: async ({}, use) => {
    await use(`test-${Date.now()}@example.com`);
  },

  // Provide a pre-authenticated page to the test
  authenticatedPage: async ({ page, uniqueEmail }, use) => {
    // PRE-INIT: Set localStorage flags and DISABLE ANIMATIONS
    await page.addInitScript(() => {
        window.localStorage.setItem('cookieConsent', 'true');
        window.localStorage.setItem('lastNotifPrompt', Date.now().toString());

        // Force disable all CSS animations and transitions (set to near-zero to allow event firing)
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

    // 1. Navigate to signup
    await page.goto('/en/signup');
    
    // 2. Fill Signup Form
    await page.getByLabel('Nickname').fill('E2E Tester');
    await page.getByLabel('Email Address').fill(uniqueEmail);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click({ force: true });
    
    // 3. Handle Login redirect
    await page.waitForURL(/.*login/, { timeout: 60000 });
    await page.getByLabel('Email Address').fill(uniqueEmail);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Log In', exact: true }).click({ force: true });
    
    // 4. Verification of arrival at dashboard
    // No onboarding modals should appear now for @example.com users
    await page.waitForURL(/.*dashboard/, { timeout: 90000 });
    
    // 5. Provide the authenticated page to the test
    await use(page);
  },
});

export { expect } from '@playwright/test';
