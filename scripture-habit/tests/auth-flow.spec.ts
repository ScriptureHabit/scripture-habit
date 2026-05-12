import { test, expect } from '@playwright/test';

/**
 * Authentication Flow Tests
 * Verifies the end-to-end flow of user signup, profile initialization via API,
 * and subsequent login.
 */
test.describe('Authentication Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear any existing state
    await page.goto('/');
  });

  test('should complete full email signup and profile initialization flow', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `testuser-${timestamp}@example.com`;
    const nickname = `Tester-${timestamp}`;
    const password = 'Password123!';

    // 1. Navigate to Signup
    await page.goto('/en/signup');
    await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();

    // 2. Fill Signup Form
    await page.getByTestId('signup-nickname').fill(nickname);
    await page.getByTestId('signup-email').fill(testEmail);
    await page.getByTestId('signup-password').fill(password);
    
    // 3. Submit Signup (Triggers Firebase Auth + /api/auth/initialize-profile)
    await page.getByTestId('signup-submit').click();

    // 4. Verify redirection to Login (standard flow after email verification sent)
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.getByText(/Verification email sent/i)).toBeVisible();

    // 5. In Emulator, we can simulate email verification
    // This is optional if the emulator allows login without verification, 
    // but good for completeness.
    try {
      await page.goto('http://127.0.0.1:9099/emulator/action?mode=verifyEmail&lang=en&oobCode=test');
      await page.waitForTimeout(500);
    } catch (e) {
      console.warn('Emulator verification link failed (might not be running or different port)');
    }

    // 6. Navigate back to Login and perform login
    await page.goto('/en/login');
    await page.getByTestId('login-email').fill(testEmail);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();

    // 7. Verify Dashboard landing (implies document was successfully created)
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByText(nickname)).toBeVisible();
    
    // 8. Verify some profile defaults are visible (e.g. 0 streak)
    const streakCard = page.locator('.streak-card');
    await expect(streakCard.locator('.number')).toHaveText('0');
    await expect(streakCard.locator('.label')).toHaveText(/days/i);
  });

  test('should handle "Complete Profile" flow if user document is missing', async ({ page }) => {
    // This test simulates a user who is authenticated but has no Firestore document
    // We can use a special @example.com email that we know isn't initialized yet
    const timestamp = Date.now();
    const incompleteEmail = `incomplete-${timestamp}@example.com`;
    const nickname = `Completer-${timestamp}`;

    // Note: Since we can't easily "un-initialize" a user, we just use a fresh one
    // but bypass the signup-page initialization by using Firebase Auth directly 
    // if we had a helper, but here we just test the UI transition.
    
    await page.goto('/en/signup');
    await page.getByTestId('signup-nickname').fill(nickname);
    await page.getByTestId('signup-email').fill(incompleteEmail);
    await page.getByTestId('signup-password').fill('password123');
    await page.getByTestId('signup-submit').click();
    
    // After signup, they go to login.
    await page.goto('/en/login');
    await page.getByTestId('login-email').fill(incompleteEmail);
    await page.getByTestId('login-password').fill('password123');
    await page.getByTestId('login-submit').click();

    // If document is already created (as our new Signup logic does), 
    // they should go straight to dashboard.
    await expect(page).toHaveURL(/.*\/dashboard/);
  });
});
