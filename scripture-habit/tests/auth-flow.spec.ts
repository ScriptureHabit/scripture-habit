import { test, expect } from '@playwright/test';

/**
 * Authentication & Onboarding Flow Tests
 * Verifies the entry point (Landing Page), navigation to Welcome,
 * and the end-to-end flow of user signup and login.
 */
test.describe('Auth & Onboarding Flow', () => {
  // Use a completely unauthenticated context for auth flow tests
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate from landing to signup via welcome page', async ({ page }) => {
    // 1. Landing Page
    await expect(page.getByRole('heading', { name: 'Scripture Habit', level: 1 })).toBeVisible();
    const ctaButton = page.getByRole('button', { name: 'Start Now' });
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
    const timestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const testEmail = `testuser-${timestamp}@example.com`;
    const nickname = `Tester-${timestamp}`;
    const password = 'Password123!';

    await page.goto('/en/signup');
    await page.getByTestId('signup-nickname').fill(nickname);
    await page.getByTestId('signup-email').fill(testEmail);
    await page.getByTestId('signup-password').fill(password);
    await page.getByTestId('signup-submit').click();

    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.getByText(/Verification email sent/i)).toBeVisible();

    // Navigate back to Login and perform login
    await page.goto('/en/login');
    await page.getByTestId('login-email').fill(testEmail);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();

    // Wait for auth state to propagate and redirect to dashboard
    // In CI, this can take longer due to network latency
    await page.waitForFunction(() => {
      const auth = (window as any).firebaseAuth;
      return auth && auth.currentUser !== null;
    }, { timeout: 30000 }).catch(() => {
      // If waitForFunction fails, continue anyway - the URL check below will catch the issue
      console.log('Auth state check timed out, continuing with URL check...');
    });

    // Verify Dashboard landing with increased timeout for CI
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 30000 });
    await expect(page.getByTestId('dashboard-skeleton')).not.toBeVisible({ timeout: 60000 });
    await expect(page.getByText(nickname)).toBeVisible();
    
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
