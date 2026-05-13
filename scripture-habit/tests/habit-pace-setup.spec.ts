import { test, expect } from './fixtures/auth.fixture';

test.describe('Habit Pace Setup (E2E)', () => {
  test('should show the habit pace modal and save successfully', async ({ authenticatedPage: page }) => {
    // 1. Ensure we are on the dashboard
    await page.goto('/en/dashboard');
    await page.waitForSelector('[data-testid="sidebar-notes"]', { timeout: 30000 });
    
    // 2. Create a test group
    await page.setupTestGroup({ groupName: 'E2E Habit Pace Group' });
    
    // 3. Reset the user's kick threshold status
    await page.callApi('/api/test/reset-kick-threshold', {});
    
    // 4. Reload to trigger the dashboard mount logic
    await page.reload();
    await page.waitForSelector('[data-testid="sidebar-notes"]', { timeout: 30000 });

    // 5. Verify the modal appears
    // Correct selector from DashboardModals.tsx is .leave-modal-overlay
    const modal = page.locator('.leave-modal-overlay');
    await expect(modal).toBeVisible({ timeout: 15000 });
    
    // The title text comes from groupChat.autoKickInitTitle
    // Let's use a part of the text if possible, or just expect it's visible
    await expect(modal).toContainText('Habit Pace'); // translation key or text

    // 6. Select a threshold (e.g., 5 days)
    // Correct class is .auto-kick-day-option-styled
    await page.click('button.auto-kick-day-option-styled:has-text("5")');

    // 7. Click "Next" to go to Step 1
    // The button has text from groupChat.next
    await page.click('.leave-modal-content button:has-text("Next")');

    // 8. Enter the confirmation number
    await page.fill('input.auto-kick-confirm-input-styled', '5');

    // 9. Click "Save"
    await page.click('button:has-text("Save")');

    // 10. Verify Success Screen
    await expect(page.locator('.leave-modal-content')).toContainText('Habit pace set');

    // 11. Verify the modal closes automatically (after delay)
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // 12. Final Verification: should not reappear
    await page.reload();
    await page.waitForSelector('[data-testid="sidebar-notes"]', { timeout: 30000 });
    await page.waitForTimeout(2000); 
    await expect(page.locator('.leave-modal-overlay')).not.toBeVisible();
  });
});
