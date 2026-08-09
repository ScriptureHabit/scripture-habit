import { test, expect } from './fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/** Waits until the dashboard is fully loaded (loading=false AND userData from Firestore is set).
 *  `data-testid="dashboard-ready"` is only rendered by dashboard.tsx after the loading guard passes,
 *  unlike the Sidebar which renders even during the skeleton/loading state. */
const waitForDashboard = (page: Page) =>
  page.waitForSelector('main', { timeout: 30000 });

test.describe('Habit Pace Setup (E2E)', () => {
  test('should show the habit pace modal and save successfully', async ({ authenticatedPage: page }) => {
    // 1. Ensure initial page load & authentication
    await page.goto('/en/dashboard');
    await waitForDashboard(page);

    // 2. Explicitly reset kick threshold and group membership for test user
    await page.callApi('/api/test/reset-kick-threshold', {});

    // 3. Reload page to trigger Firestore snapshot & state update.
    //    Must wait for dashboard-ready (not sidebar-notes) so that userData
    //    is confirmed loaded before we check for the modal.
    await page.reload();
    await waitForDashboard(page);

    // 4. Verify the modal appears
    const modal = page.locator('.leave-modal-overlay');
    await expect(modal).toBeVisible({ timeout: 25000 });

    await expect(modal).toContainText('Set Your Goal!');

    // 5. Select a threshold (e.g., 5 days)
    await page.click('button.auto-kick-day-option-styled:has-text("5")');

    // 6. Click "Next" to go to Step 1
    await page.click('.leave-modal-content button:has-text("Next")');

    // 7. Click "Save"
    await page.click('button:has-text("Save")');

    // 8. Verify Success Screen
    await expect(page.locator('.leave-modal-content')).toContainText('Your target pace is set');

    // 9. Click button to proceed (start with AI partner button or redirect button)
    const redirectBtn = page.getByTestId('start-with-ai-button').or(page.getByTestId('onboarding-guide-redirect-button'));
    await redirectBtn.click();

    // 10. Navigate back to dashboard and verify the modal does not reappear
    await page.goto('/en/dashboard');
    await waitForDashboard(page);
    await expect(page.locator('.leave-modal-overlay')).not.toBeVisible();
  });
});
