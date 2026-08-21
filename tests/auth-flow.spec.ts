import { test, expect } from '@playwright/test';
import {
  generateTestData,
  disableAnimationsScript,
  fillSignupForm,
  performLogin,
  waitForDashboardLoad,
} from './helpers/test-helpers';

/**
 * Authentication & Onboarding Flow Tests
 * Verifies the entry point (Landing Page), navigation to Welcome,
 * and the end-to-end flow of user signup and login.
 */
test.describe('Auth & Onboarding Flow', () => {
  // Use clean storage state for auth flow tests
  test.use({ 
    storageState: { cookies: [], origins: [] },
    viewport: { width: 1280, height: 1200 }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(disableAnimationsScript);
    await page.goto('/');
  });

  test('should navigate from landing to signup via welcome page', async ({ page }) => {
    // 1. Landing Page
    await expect(page.getByRole('heading', { name: 'Scripture Habit', level: 1 })).toBeVisible();
    const ctaButton = page.locator('.secondary-cta').first();
    await ctaButton.click();

    // 2. Welcome Page
    await expect(page).toHaveURL(/\/welcome\/?$/);
    await expect(page.getByRole('heading', { name: 'Scripture Habit', level: 1 })).toBeVisible();
    
    // Check for login/signup buttons
    const signupButton = page.locator('.auth-buttons').getByRole('button', { name: 'Sign Up' });
    await expect(signupButton).toBeVisible();
    await signupButton.click();

    // 3. Signup Page
    await expect(page).toHaveURL(/\/signup\/?$/);
  });

  test('should complete full email signup and profile initialization flow', async ({ page }) => {
    const { email, nickname } = generateTestData();

    // Signup
    await page.goto('/en/signup');
    await fillSignupForm(page, nickname, email);

    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator('.Toastify__toast, [role="alert"]')).toContainText(/Verification email sent/i, { timeout: 15000 });

    // Login
    await performLogin(page, email);

    // Verify dashboard
    await waitForDashboardLoad(page, nickname);
    
    const streakCard = page.locator('.streak-card');
    await expect(streakCard.locator('.number')).toHaveText('0');
  });

  test('should handle language switching on welcome page', async ({ page }) => {
    await page.goto('/en/welcome');

    const jaButton = page.getByRole('button', { name: '日本語' });
    await jaButton.click();

    await expect(page).toHaveURL(/\/ja\/welcome\/?$/);
    await expect(jaButton).toHaveClass(/active/);
  });
});
