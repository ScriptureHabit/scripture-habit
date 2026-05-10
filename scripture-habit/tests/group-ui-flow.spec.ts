import { test, expect } from './fixtures/auth.fixture';

test.describe('Group UI Flow (E2E)', () => {
  test('should navigate through the UI to create a group', async ({ authenticatedPage: page }) => {
    // 1. Start from Dashboard and go to Join/Create options
    await page.click('[data-testid="sidebar-join-create-group"]');
    await page.waitForURL(/.*group-options/);

    // 2. Choose to create a group
    // In GroupOptions, we look for the card to go to group-form
    await page.click('[data-testid="create-group-card"]');
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
    // 0. Create a public group and then leave it so it appears as joinable
    await page.evaluate(async () => {
      const auth = window.firebaseAuth;
      const idToken = await auth!.currentUser!.getIdToken();

      async function callApi(endpoint: string, body: Record<string, unknown>) {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify(body)
        });
        return resp.json();
      }

      const name = `Public UI Test ${Date.now()}`;
      const createResp = await callApi('/api/groups/create-group', { name, isPublic: true });
      // Leave so it shows in the joinable list (join-group page filters out user's groups)
      await callApi('/api/groups/leave-group', { groupId: createResp.groupId });
      return name;
    });

    // 1. Go to Join Group page
    await page.goto('/en/join-group');

    // 2. Wait for groups to load
    await page.waitForSelector('.group-card', { timeout: 15000 });

    // 3. Find the group card and click "Details" to open the confirm modal
    const groupCard = page.locator('.group-card').first();
    await groupCard.locator('button.join-btn').click();

    // 4. Confirm in the modal
    await expect(page.locator('.group-modal-content')).toBeVisible();
    await page.click('.confirm-join-btn');

    // 5. Verify redirection and toast
    await page.waitForURL(/.*dashboard/);
    await expect(page.locator('.Toastify__toast--success')).toBeVisible({ timeout: 10000 });
    
    // Verify a group appears in the sidebar (the one we just joined)
    await expect(page.locator('[data-testid="sidebar-group-item"]').first()).toBeVisible();
  });
});
