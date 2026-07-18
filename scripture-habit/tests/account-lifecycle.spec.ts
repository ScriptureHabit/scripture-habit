import { test, expect } from './fixtures/auth.fixture';
import { disableAnimationsScript } from './helpers/test-helpers';

/**
 * Account Lifecycle E2E Test
 * Verifies the full journey: Signup -> Onboarding -> Profile Update -> Account Deletion
 */
test.describe('Account Lifecycle', () => {
  // Ensure we start with a clean state (not logged in)
  test.use({ 
    storageState: { cookies: [], origins: [] },
    viewport: { width: 1280, height: 1200 }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(disableAnimationsScript());
  });

  test('should handle full user lifecycle: signup, onboarding, profile update, and deletion', async ({ page }) => {
    test.setTimeout(120000);
    const timestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const testEmail = `lifecycle-${timestamp}@test.local`;
    const initialNickname = `Newbie-${timestamp}`;
    const updatedNickname = `Hero-${timestamp}`;
    const password = 'Password123!';
    const lang = 'en';

    // 1. SIGNUP
    console.log(`[Lifecycle] Starting signup for ${testEmail}`);
    await page.goto('/en/signup');
    await page.getByTestId('signup-nickname').fill(initialNickname);
    await page.getByTestId('signup-email').fill(testEmail);
    await page.getByTestId('signup-password').fill(password);
    await page.getByTestId('signup-submit').click();

    // Should redirect to login with verification message
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.getByText(/Verification email sent/i)).toBeVisible();

    // 2. LOGIN
    console.log(`[Lifecycle] Logging in as ${testEmail}`);
    await page.getByTestId('login-email').fill(testEmail);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    await page.waitForSelector('[data-testid="sidebar-notes"]', { timeout: 30000 });

    // 2.3 WAIT FOR SKELETON TO DISAPPEAR (Ensures data load complete)
    console.log('[Lifecycle] Waiting for dashboard loading skeleton to disappear');
    const skeleton = page.getByTestId('dashboard-skeleton');
    await expect(skeleton).not.toBeVisible({ timeout: 60000 });



    // 3. ONBOARDING (Habit Pace Setup)
    // The Habit Pace modal should appear automatically for new users
    console.log('[Lifecycle] Waiting for Habit Pace onboarding modal');
    const paceOption4 = page.getByTestId('habit-pace-option-4');
    await expect(paceOption4).toBeVisible({ timeout: 30000 });
    await paceOption4.click({ force: true });
    await page.getByTestId('habit-pace-next-button').click();

    // Confirm step
    await page.getByTestId('habit-pace-save-button').click();

    // Modal should close (wait for it to detach or for dashboard content to be interactive)
    await expect(page.getByTestId('habit-pace-save-button')).not.toBeVisible();
    
    // Verify we are on the dashboard and nickname is visible
    await expect(page.getByText(initialNickname)).toBeVisible();

    // 3. Modify profile
    console.log('[Lifecycle] Modifying profile');
    await page.goto(`/${lang}/profile`);
    
    console.log(`[Lifecycle] Updating profile nickname to: ${updatedNickname}`);
    
    const nicknameInput = page.getByTestId('profile-nickname-input');
    await expect(nicknameInput).toBeVisible();
    
    // Ensure input is ready and focused
    await nicknameInput.scrollIntoViewIfNeeded();
    await nicknameInput.fill(updatedNickname);
    
    // Verify input value
    await expect(nicknameInput).toHaveValue(updatedNickname);
    
    const saveButton = page.getByTestId('profile-save-button');
    await expect(saveButton).toBeEnabled();
    
    console.log('[Lifecycle] Clicking Save button');
    await saveButton.click();
    console.log('[Lifecycle] Save button clicked');

    // Wait for success toast with longer timeout and more flexible selector
    console.log('[Lifecycle] Waiting for profile update success toast');
    const successToast = page.getByText(/Profile updated successfully/i);
    await expect(successToast).toBeVisible({ timeout: 45000 });
    console.log('[Lifecycle] Profile update success toast detected');
    console.log('[Lifecycle] Profile updated successfully');

    // 5. ACCOUNT DELETION
    console.log('[Lifecycle] Starting account deletion flow');
    // Click delete account link (using the testid we added)
    await page.getByTestId('delete-account-button').click({ force: true });

    // Modal appears
    const deleteConfirmInput = page.getByTestId('delete-confirm-nickname-input');
    await expect(deleteConfirmInput).toBeVisible();
    await deleteConfirmInput.fill(updatedNickname);

    const confirmDeleteBtn = page.getByTestId('confirm-delete-account-button');
    await expect(confirmDeleteBtn).toBeEnabled();
    await confirmDeleteBtn.click();

    // Should redirect to welcome or landing page
    console.log('[Lifecycle] Waiting for redirection after deletion');
    await expect(page).toHaveURL(/.*\/(welcome|en)\/?$/);
    
    // Verify we are actually logged out (can't see dashboard)
    await page.goto('/en/dashboard');
    await expect(page).not.toHaveURL(/.*dashboard/);
    await expect(page).toHaveURL(/\/welcome|\/login/);
    
    console.log('[Lifecycle] Test completed successfully');
  });

});
