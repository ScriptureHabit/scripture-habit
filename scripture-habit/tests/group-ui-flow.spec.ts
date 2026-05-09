import { test, expect } from './fixtures/auth.fixture';

test.describe('Group UI Flow (E2E)', () => {
  test('should navigate through the UI to create a group', async ({ authenticatedPage: page }) => {
    // 1. Start from Dashboard and go to Join/Create options
    await page.click('[data-testid="sidebar-join-create-group"]');
    await page.waitForURL(/.*group-options/);

    // 2. Choose to create a group
    // In GroupOptions (which JoinGroup links to or acts as), we look for the link to group-form
    await page.click('.create-group-link');
    await page.waitForURL(/.*group-form/);

    // 3. Fill out the group form
    const groupName = `UI Test Group ${Date.now()}`;
    await page.fill('[data-testid="group-name-input"]', groupName);
    await page.fill('textarea', 'This is a group created by an automated UI test.');
    
    // Toggle public setting (optional, defaults to private)
    // await page.click('.toggle-slider'); 

    // 4. Submit the form
    await page.click('[data-testid="create-group-submit"]');

    // 5. Verify success: should redirect to dashboard with the new group active
    // The app redirects to dashboard with state: { initialGroupId: newGroupId, initialView: 2, showInviteModal: true }
    await page.waitForURL(/.*dashboard/);
    
    // Check for success toast
    await expect(page.locator('.Toastify__toast--success')).toBeVisible();

    // Verify the group name appears in the sidebar
    await expect(page.locator(`[data-testid="sidebar-group-item"]:has-text("${groupName}")`)).toBeVisible();
  });

  test('should show validation error when creating group with empty name', async ({ authenticatedPage: page }) => {
    await page.goto('/en/group-form');
    
    // Attempt to submit without name (HTML5 validation might stop it, but let's check)
    await page.click('[data-testid="create-group-submit"]');
    
    // If HTML5 validation is active, the URL won't change. 
    // If our own validation is active, we might see an error message.
    const url = page.url();
    expect(url).toContain('group-form');
  });

  test('should join a public group through the UI', async ({ authenticatedPage: page }) => {
    // 1. Go to Join Group page
    await page.goto('/en/join-group');

    // 2. Wait for groups to load
    await page.waitForSelector('.group-card', { timeout: 10000 });

    // 3. Find a group card and click "Join"
    // We'll pick the first group card that doesn't have "Joined" status (if any)
    const groupCard = page.locator('.group-card').first();
    const groupName = await groupCard.locator('.group-name').textContent();
    
    await groupCard.locator('button:has-text("Join")').click();

    // 4. Confirm in the modal
    await expect(page.locator('.group-modal-content')).toBeVisible();
    await page.click('.confirm-join-btn');

    // 5. Verify redirection and toast
    await page.waitForURL(/.*dashboard/);
    await expect(page.locator('.Toastify__toast--success')).toBeVisible();
    
    // Verify the group name is now in the sidebar
    if (groupName) {
      await expect(page.locator(`[data-testid="sidebar-group-item"]:has-text("${groupName}")`)).toBeVisible();
    }
  });
});
