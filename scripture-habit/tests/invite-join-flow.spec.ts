import { test, expect, Page } from './fixtures/auth.fixture';

test.describe('Invitation Join Flow Stability', () => {
  const listMembers = async (page: Page, label: string) => {
      const nicknames = await page.getByTestId('member-nickname').all();
      console.log(`--- Members List (${label}) ---`);
      for (const n of nicknames) {
          console.log(`  - Nickname: "${await n.innerText()}"`);
      }
      if (nicknames.length === 0) console.log('  (No members found in modal)');
      console.log('-------------------------------');
  };

  test('should join a group after landing on invite link and logging in', async ({ authenticatedPage, browser }) => {
    test.setTimeout(120000); // 2 minutes
    
    // 1. Create a group as User A (Shared Tester) to get an invite code
    const timestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const groupName = `Join Flow Test ${timestamp}`;
    const pageA = authenticatedPage;
    const userBEmail = `userb-${timestamp}@test.local`;
    const userBPassword = 'Password123!';
    
    console.log('User A cleaning up old groups...');
    await pageA.callApi('/api/test/leave-all-groups', {});

    console.log('User A creating group...');
    await pageA.goto('/en/group-form');

    await pageA.fill('[data-testid="group-name-input"]', groupName);
    const submitBtn = pageA.locator('[data-testid="create-group-submit"]');
    await submitBtn.waitFor({ state: 'visible' });
    await submitBtn.click();
    await pageA.waitForURL(/.*dashboard/);
    
    // Get the invite link from the modal
    await expect(pageA.locator('.invite-modal')).toBeVisible();
    
    // Wait for the invite link to actually contain a code (not just the base URL)
    const inviteLinkLocator = pageA.locator('.invite-link-url');
    await expect(inviteLinkLocator).not.toHaveText(/join\/\?/, { timeout: 10000 });
    
    const inviteLink = await inviteLinkLocator.innerText();
    console.log('Generated Invite Link:', inviteLink);
    
    // Force reload to clear modal and ensure clean state
    console.log('Reloading User A to clear modal...');
    await pageA.reload();
    await pageA.waitForLoadState('load');
    
    // 2. Now act as User B who is NOT logged in
    const contextB = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const pageB = await contextB.newPage();
    
    // Disable animations for User B's context to prevent click flakiness
    await pageB.addInitScript(() => {
        const style = document.createElement('style');
        style.innerHTML = `
          *, *::before, *::after {
            transition-duration: 0.001s !important;
            animation-duration: 0.001s !important;
            transition-delay: 0s !important;
            animation-delay: 0s !important;
          }
        `;
        document.head.appendChild(style);
    });
    
    await test.step('User B opens invite link and signs up', async () => {
        console.log('User B navigating to invite link:', inviteLink);
        await pageB.goto(inviteLink);
        
        // Wait for invite card
        const inviteCard = pageB.locator('.invite-card');
        await expect(inviteCard).toBeVisible({ timeout: 30000 });
        await expect(pageB.locator('.group-name')).toHaveText(groupName, { timeout: 15000 });
        
        // Click join button
        const joinBtn = pageB.locator('.join-btn');
        await expect(joinBtn).toBeVisible();
        console.log('Clicking join button as guest...');
        await joinBtn.click();
        
        console.log('Waiting for redirect to welcome/signup...');
        // Should land on welcome page (since not logged in)
        await pageB.waitForURL(/.*welcome|.*signup/, { timeout: 30000 });
        console.log('User B current URL:', pageB.url());
        
        // Navigate to signup
        console.log('Navigating to signup for User B...');
        await pageB.goto('/en/signup');
        await pageB.getByTestId('signup-nickname').fill('User B');
        await pageB.getByTestId('signup-email').fill(userBEmail);
        await pageB.getByTestId('signup-password').fill(userBPassword);
        await pageB.getByTestId('signup-submit').click();
        
        // After signup, the app redirects to /login for email verification
        console.log('Waiting for login redirect after signup...');
        await pageB.waitForURL(/.*login/, { timeout: 30000 });
        
        // Log in as User B
        console.log('Logging in as User B...');
        await pageB.getByTestId('login-email').fill(userBEmail);
        await pageB.getByTestId('login-password').fill(userBPassword);
        await pageB.getByTestId('login-submit').click();

        // Now wait for dashboard redirect
        console.log('Waiting for dashboard redirect for User B...');
        await expect(pageB).toHaveURL(/.*dashboard/, { timeout: 40000 });
    });

    await test.step('User B handles Habit Pace modal', async () => {
        // First close the Join Success modal that overlay the screen
        console.log('Closing Join Success Modal for User B...');
        const successOverlay = pageB.locator('.join-success-overlay');
        await expect(successOverlay).toBeVisible({ timeout: 25000 });
        await pageB.click('#join-success-close-btn');
        await expect(successOverlay).not.toBeVisible({ timeout: 15000 });

        console.log('Checking for Habit Pace modal for User B...');
        const paceModalTitle = pageB.locator('.auto-kick-init-title-styled');
        
        // Wait for modal to appear (might take a moment after dashboard load)
        await expect(paceModalTitle).toBeVisible({ timeout: 30000 });
        
        // Step 1: Select pace (default 3 is fine)
        await pageB.click('[data-testid="habit-pace-next-button"]');
        
        // Step 2: Confirmation
        const confirmInput = pageB.locator('[data-testid="habit-pace-confirm-input"]');
        await expect(confirmInput).toBeVisible({ timeout: 15000 });
        await confirmInput.fill('3');
        
        // Step 3: Save
        await pageB.click('[data-testid="habit-pace-save-button"]');
        
        // Modal should disappear
        await expect(paceModalTitle).not.toBeVisible({ timeout: 15000 });
    });

    await test.step('Verify group appears for both users', async () => {
        console.log('Verifying group in User B sidebar...');
        const groupItemB = pageB.locator('[data-testid="sidebar-group-item"]').filter({ 
            has: pageB.locator(`[data-group-name="${groupName}"]`) 
        }).or(pageB.locator('[data-testid="sidebar-group-item"]', { hasText: groupName }));
        
        await expect(groupItemB.first()).toBeVisible({ timeout: 30000 });

        console.log('Switching to User A (Owner) to verify member list...');
        await pageA.bringToFront();
        console.log('User A Current URL:', pageA.url());

        // Debug: List all groups currently in User A's sidebar
        const listGroups = async (label: string) => {
            const groups = await pageA.locator('[data-testid="sidebar-group-item"]').all();
            console.log(`--- Sidebar Groups (${label}) ---`);
            for (const g of groups) {
                const nameAttr = await g.getAttribute('data-group-name');
                const text = await g.innerText();
                console.log(`  - Attr: "${nameAttr}", Text: "${text.replace(/\n/g, ' ')}"`);
            }
            if (groups.length === 0) console.log('  (No groups found)');
            console.log('-------------------------------');
        };

        await listGroups('Initial');

        const groupItemA = pageA.locator('[data-testid="sidebar-group-item"]').filter({ 
            has: pageA.locator(`[data-group-name="${groupName}"]`) 
        }).or(pageA.locator('[data-testid="sidebar-group-item"]', { hasText: groupName }));

        // Try to find it, if not visible after 10s, try one reload
        try {
            await expect(groupItemA.first()).toBeVisible({ timeout: 10000 });
        } catch {
            console.log('Group not found after 10s, attempting fallback reload...');
            await pageA.reload();
            await pageA.waitForLoadState('load');
            await listGroups('After Reload');
            await expect(groupItemA.first()).toBeVisible({ timeout: 20000 });
        }
        
        console.log('Group found in User A sidebar. Clicking specifically on the group name...');
        await groupItemA.first().locator('.group-name-sidebar').click({ force: true });
        
        // Wait for ChatHeader to show the correct group name
        console.log(`Waiting for group title "${groupName}" in header...`);
        const headerTitle = pageA.getByTestId('group-name-title');
        await expect(headerTitle).toContainText(groupName, { timeout: 30000 });
        
        console.log('Waiting for Members button (increased timeout)...');
        const membersBtn = pageA.getByTestId('members-button').first();
        await expect(membersBtn).toBeVisible({ timeout: 40000 });
        console.log('Members button visible. Clicking...');
        await membersBtn.click({ force: true });
        
        console.log('Verifying User B nickname in members list...');
        
        await pageA.waitForTimeout(5000);
        await listMembers(pageA, 'Initial Modal Open');

        const userBLocator = pageA.getByTestId('member-nickname').filter({ hasText: 'User B' });

        try {
            await expect(userBLocator.first()).toBeVisible({ timeout: 10000 });
        } catch {
            console.log('User B not found in members list after 10s. Attempting fallback reload and re-navigating...');
            await pageA.reload();
            await pageA.waitForLoadState('load');
            
            // Re-navigate to group
            const groupItemA = pageA.locator('[data-testid="sidebar-group-item"]').filter({ 
                has: pageA.locator(`[data-group-name="${groupName}"]`) 
            }).or(pageA.locator('[data-testid="sidebar-group-item"]', { hasText: groupName }));
            await groupItemA.first().locator('.group-name-sidebar').click();
            
            // Wait for ChatHeader to show the correct group name
            await expect(pageA.getByTestId('group-name-title')).toContainText(groupName, { timeout: 30000 });
            
            await expect(pageA.getByTestId('members-button')).toBeVisible({ timeout: 20000 });
            await pageA.getByTestId('members-button').click();
            
            await pageA.waitForTimeout(4000);
            await listMembers(pageA, 'After Reload and Re-navigation');
            await expect(userBLocator.first()).toBeVisible({ timeout: 20000 });
        }

        console.log('User B verified in User A members list.');
    });

    console.log('Test passed!');
    await contextB.close();
  });

  test('should join a group immediately when already logged in', async ({ authenticatedPage, browser }) => {
    test.setTimeout(120000); // 2 minutes
    const timestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const groupName = `Auth Join Test ${timestamp}`;
    const pageA = authenticatedPage;
    const userBEmail = `userb-auth-${timestamp}@test.local`;
    const userBPassword = 'Password123!';

    // 1. User A creates group
    console.log('User A creating group...');
    await pageA.goto('/en/group-form');
    await pageA.fill('[data-testid="group-name-input"]', groupName);
    await pageA.click('[data-testid="create-group-submit"]');
    await pageA.waitForURL(/.*dashboard/);
    await expect(pageA.locator('.invite-modal')).toBeVisible();
    const inviteLinkLocator = pageA.locator('.invite-link-url');
    // Wait for the actual code to appear (prevents race where modal shows before code is hydrated)
    await expect(inviteLinkLocator).not.toHaveText(/join\/\?/, { timeout: 15000 });
    const inviteLink = await inviteLinkLocator.innerText();
    console.log('Generated Invite Link:', inviteLink);
    
    // Force reload to clear modal and ensure clean state
    console.log('Reloading User A to clear modal...');
    await pageA.reload();
    await pageA.waitForLoadState('load');

    // 2. User B (authenticated) visits invite link
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    
    // Disable animations for User B's context to prevent click flakiness
    await pageB.addInitScript(() => {
        const style = document.createElement('style');
        style.innerHTML = `
          *, *::before, *::after {
            transition-duration: 0.001s !important;
            animation-duration: 0.001s !important;
            transition-delay: 0s !important;
            animation-delay: 0s !important;
          }
        `;
        document.head.appendChild(style);
    });
    
    await test.step('User B signs up and logs in first', async () => {
        console.log('User B signing up...');
        await pageB.goto('/en/signup');
        await pageB.getByTestId('signup-nickname').fill('User B');
        await pageB.getByTestId('signup-email').fill(userBEmail);
        await pageB.getByTestId('signup-password').fill(userBPassword);
        await pageB.getByTestId('signup-submit').click();
        
        await pageB.waitForURL(/.*login/);
        console.log('User B logging in...');
        await pageB.getByTestId('login-email').fill(userBEmail);
        await pageB.getByTestId('login-password').fill(userBPassword);
        await pageB.getByTestId('login-submit').click();
        await expect(pageB).toHaveURL(/.*dashboard/, { timeout: 30000 });

        // Handle Habit Pace modal for new User B
        const paceModalTitle = pageB.locator('.auto-kick-init-title-styled');
        await expect(paceModalTitle).toBeVisible({ timeout: 20000 });
        await pageB.click('[data-testid="habit-pace-next-button"]');
        await pageB.locator('[data-testid="habit-pace-confirm-input"]').fill('3');
        await pageB.click('[data-testid="habit-pace-save-button"]');
        await expect(paceModalTitle).not.toBeVisible();
    });

    await test.step('User B joins via invite link while logged in', async () => {
        console.log('User B (logged in) visiting invite link:', inviteLink);
        await pageB.goto(inviteLink);
        
        // Since User B is already logged in, the page might automatically redirect to dashboard.
        // We wait for either the dashboard redirect to complete, OR we click the join button if it is visible.
        await Promise.race([
            pageB.waitForURL(/.*dashboard/, { timeout: 20000 }),
            (async () => {
                const joinBtn = pageB.locator('.join-btn');
                try {
                    await joinBtn.waitFor({ state: 'visible', timeout: 5000 });
                    await joinBtn.click().catch(() => {});
                } catch {
                    console.log('Join button not visible or already redirected');
                }
            })()
        ]);
        
        // Should land on dashboard directly
        await expect(pageB).toHaveURL(/.*dashboard/, { timeout: 20000 });

        // Close the Join Success Modal
        console.log('Closing Join Success Modal for User B...');
        const successOverlay = pageB.locator('.join-success-overlay');
        await expect(successOverlay).toBeVisible({ timeout: 25000 });
        await pageB.click('#join-success-close-btn');
        await expect(successOverlay).not.toBeVisible({ timeout: 15000 });
        
        console.log('Verifying group in User B sidebar...');
        const groupItemB = pageB.locator('[data-testid="sidebar-group-item"]').filter({ 
            has: pageB.locator(`[data-group-name="${groupName}"]`) 
        }).or(pageB.locator('[data-testid="sidebar-group-item"]', { hasText: groupName }));
        
        await expect(groupItemB.first()).toBeVisible({ timeout: 30000 });
        console.log('Group found in User B sidebar.');
    });

    await test.step('Verify sync for Owner', async () => {
        console.log('Switching to User A (Owner) to verify member list...');
        await pageA.bringToFront();
        
        await pageA.bringToFront();

        const groupItemA = pageA.locator('[data-testid="sidebar-group-item"]').filter({ 
            has: pageA.locator(`[data-group-name="${groupName}"]`) 
        }).or(pageA.locator('[data-testid="sidebar-group-item"]', { hasText: groupName }));

        // Fallback reload if not found
        try {
            await expect(groupItemA.first()).toBeVisible({ timeout: 10000 });
        } catch {
            console.log('Group not found in User A sidebar. Reloading...');
            await pageA.reload();
            await pageA.waitForLoadState('load');
        }

        await groupItemA.first().locator('.group-name-sidebar').click();
        
        // Wait for ChatHeader to show the correct group name
        await expect(pageA.getByTestId('group-name-title')).toContainText(groupName, { timeout: 30000 });
        
        await expect(pageA.getByTestId('members-button')).toBeVisible({ timeout: 20000 });
        await pageA.getByTestId('members-button').click();
        
        await pageA.waitForTimeout(5000);
        await listMembers(pageA, 'Second Test - Owner View');
        
        await expect(pageA.getByTestId('member-nickname').filter({ hasText: 'User B' }).first()).toBeVisible({ timeout: 20000 });
        console.log('User B verified in User A members list (Authenticated join).');
    });

    console.log('Authenticated join test passed!');
    await contextB.close();
  });
});

