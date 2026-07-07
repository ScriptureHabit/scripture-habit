import { test, expect } from './fixtures/auth.fixture';

test.describe('Visual Regression Testing (VRT)', () => {
  test('should match dashboard visual screenshot baseline', async ({ authenticatedPage: page }) => {
    // 1. Ensure we are on the dashboard
    await page.goto('/en/dashboard');
    
    // 2. Wait for stability (sidebar notes visible and skeleton detached)
    await page.waitForSelector('[data-testid="sidebar-notes"]', { timeout: 30000 });
    await page.waitForSelector('.dashboard-skeleton', { state: 'detached', timeout: 30000 }).catch(() => {});
    
    // 3. Take screenshot and compare with baseline.
    // Mask out dynamic or fluctuating elements to avoid test flakiness across runs.
    await expect(page).toHaveScreenshot('dashboard-main.png', {
      maxDiffPixels: 5000, // Account for small browser antialiasing and GPU gradient differences
      mask: [
        page.locator('.welcome-text'),
        page.locator('.dashboard-stats'),
        page.locator('.quest-card'),
        page.locator('.streak-calendar-container'),
        page.locator('.groups-section'),
        page.locator('[data-testid="sidebar-notes"]'),
        page.locator('.reading-plan-section')
      ]
    });
  });
});
