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
    // 1. Navigate to signup
    await page.goto('/en/signup');
    
    // 2. Fill Signup Form
    await page.getByLabel('Nickname').fill('E2E Tester');
    await page.getByLabel('Email Address').fill(uniqueEmail);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
    
    // 3. Handle Login redirect
    // We import expect dynamically to wait for the URL change properly if needed,
    // actually base.expect works but we'll just wait for the URL pattern.
    await page.waitForURL(/.*login/);
    await page.getByLabel('Email Address').fill(uniqueEmail);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Log In', exact: true }).click();
    
    // 4. Verification of arrival at dashboard
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });
    
    // 5. Provide the authenticated page to the test
    await use(page);
  },
});

export { expect } from '@playwright/test';
