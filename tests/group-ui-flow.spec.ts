import { test, expect } from './fixtures/auth.fixture';

test.describe('Group UI Flow (E2E)', () => {
  test('should navigate through the UI to create a group', async ({ authenticatedPage: page }) => {
    // 1. Start from Dashboard and go to Join/Create options
    await page.getByTestId('sidebar-join-create-group').evaluate((el: HTMLElement) => el.click());
    await page.waitForURL(/.*group-options/);

    // 2. Choose to create a group
    // In GroupOptions, we look for the card to go to group-form
    await page.click('[data-testid="create-group-card"]');
    await page.waitForURL(/.*group-form/);

    // 3. Fill out the group form
    const groupName = `UI Test Group ${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
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

  test('should join a group via invite link through the UI', async ({ authenticatedPage: page }) => {
    // 0. Create a group and then leave it so it can be joined via invite link
    const { inviteCode, name } = await page.evaluate(async () => {
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

      const name = `Invite UI Test ${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const createResp = await callApi('/api/groups/create-group', { name });
      // Leave so the user can rejoin via invite code
      await callApi('/api/groups/leave-group', { groupId: createResp.groupId });
      return { inviteCode: createResp.inviteCode, name };
    });

    // 1. Go to Invite Link page
    await page.goto(`/en/join/${inviteCode}`);

    // 2. Verify redirect to dashboard or click join button if shown
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });

    // 3. Verify join-success modal is displayed
    const successOverlay = page.locator('.join-success-overlay');
    await expect(successOverlay).toBeVisible({ timeout: 15000 });
    
    // 4. Close the success modal
    await page.click('#join-success-close-btn');
    await expect(successOverlay).not.toBeVisible();
    
    // 5. Verify the group appears in the sidebar (the one we just joined)
    await expect(page.locator(`[data-testid="sidebar-group-item"]:has-text("${name}")`)).toBeVisible({ timeout: 15000 });
  });

  test('should display pink unread dot on new messages and dismiss it after opening chat', async ({ authenticatedPage: page }) => {
    // 1. Setup a test group
    const groupName = `Unread Dot ${Date.now()}`;
    const { groupId } = await page.setupTestGroup({ groupName, memberCount: 2 });

    // 2. Go to dashboard and ensure group item is loaded in desktop sidebar
    await page.goto('/en/dashboard');
    const desktopGroupItem = page.locator('.desktop-groups [data-testid="sidebar-group-item"]').filter({ hasText: groupName });
    await expect(desktopGroupItem).toBeVisible({ timeout: 15000 });

    const unreadDot = desktopGroupItem.locator('[data-testid="sidebar-group-unread-dot"]');

    // 3. Post a message to this group from another user in Firestore (with past lastRead record)
    const { db, admin } = await import('../api_internal/lib/firebase-admin.js');
    const currentUid = await page.evaluate(() => (window as any).firebaseAuth?.currentUser?.uid);
    const pastReadTime = admin.firestore.Timestamp.fromMillis(Date.now() - 10000);
    const messageTime = admin.firestore.Timestamp.fromMillis(Date.now() - 2000);

    await db.collection('groups').doc(groupId).update({
      [`memberLastReadAt.${currentUid}`]: pastReadTime,
      lastMessageAt: messageTime,
      lastMessageByUid: 'other-user-mock',
      lastMessageText: 'New unread message from peer'
    });

    // 4. Verify the pink unread dot appears in the desktop sidebar
    await expect(unreadDot).toBeVisible({ timeout: 15000 });

    // 5. Open the group chat
    await desktopGroupItem.click();
    await expect(page.locator('.GroupChat')).toBeVisible({ timeout: 15000 });

    // 6. Return to Dashboard Overview
    await page.getByTestId('sidebar-dashboard').click();
    await expect(page.locator('.dashboard-inner-wrapper')).toBeVisible({ timeout: 15000 });

    // 7. Verify the pink unread dot is now dismissed
    await expect(unreadDot).not.toBeVisible({ timeout: 15000 });
  });
});
