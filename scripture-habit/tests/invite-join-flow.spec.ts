import { test, expect } from './fixtures/auth.fixture';

test.describe('Invitation Join Flow Stability', () => {


  test('should join a group after landing on invite link and logging in', async ({ authenticatedPage, browser }) => {
    test.setTimeout(45000); // 45 seconds
    
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
    await expect(pageA.getByTestId('invite-modal')).toBeVisible();
    
    // Wait for the invite link to actually contain a code (not just the base URL)
    const inviteLinkLocator = pageA.getByTestId('invite-link-url');
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
        const inviteCard = pageB.getByTestId('invite-card');
        await expect(inviteCard).toBeVisible({ timeout: 30000 });
        await expect(pageB.getByTestId('invite-group-name')).toHaveText(groupName, { timeout: 15000 });
        
        // Click join button
        const joinBtn = pageB.getByTestId('invite-join-btn');
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
        // In CI, the modal might not appear due to timing, so handle both cases
        console.log('Checking for Join Success Modal for User B...');
        const successOverlay = pageB.getByTestId('join-success-overlay');
        try {
            await expect(successOverlay).toBeVisible({ timeout: 15000 });
            console.log('Join Success Modal found, closing it...');
            await pageB.click('#join-success-close-btn');
            await expect(successOverlay).not.toBeVisible({ timeout: 10000 });
        } catch {
            console.log('Join Success Modal not visible (may have been auto-closed or skipped in CI). Continuing...');
        }

        console.log('Checking for Habit Pace modal for User B...');
        const paceModalTitle = pageB.getByTestId('habit-pace-modal-title');
        
        // Wait for modal to appear (might take a moment after dashboard load)
        await expect(paceModalTitle).toBeVisible({ timeout: 30000 });
        
        // Step 1: Select pace (default 3 is fine)
        await pageB.click('[data-testid="habit-pace-option-3"]');
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

        await expect(groupItemA.first()).toBeVisible({ timeout: 20000 });
        
        console.log('Group found in User A sidebar. Clicking specifically on the group name...');
        await groupItemA.first().getByTestId('group-name-sidebar').click({ force: true });
        
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
        
        const userBLocator = pageA.getByTestId('member-nickname').filter({ hasText: 'User B' });
        await expect(userBLocator.first()).toBeVisible({ timeout: 20000 });

        console.log('User B verified in User A members list.');
    });

    console.log('Test passed!');
    await contextB.close();
  });

  test('should join a group immediately when already logged in', async ({ authenticatedPage, browser }) => {
    test.setTimeout(45000); // 45 seconds
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
    await expect(pageA.getByTestId('invite-modal')).toBeVisible();
    const inviteLinkLocator = pageA.getByTestId('invite-link-url');
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
        const paceModalTitle = pageB.getByTestId('habit-pace-modal-title');
        await expect(paceModalTitle).toBeVisible({ timeout: 20000 });
        await pageB.click('[data-testid="habit-pace-option-3"]');
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
        const currentUrl = pageB.url();
        if (currentUrl.includes('dashboard')) {
            console.log('[Test B] Already automatically redirected to dashboard. Bypassing join button click.');
        } else {
            console.log('[Test B] Waiting for either auto-redirect or join button visibility...');
            const joinBtn = pageB.getByTestId('invite-join-btn');
            try {
                const outcome = await Promise.race([
                    pageB.waitForURL(/.*dashboard/, { timeout: 15000 }).then(() => 'redirect'),
                    expect(joinBtn).toBeVisible({ timeout: 15000 }).then(() => 'button')
                ]);
                if (outcome === 'button') {
                    console.log('[Test B] Clicking join button...');
                    await joinBtn.click({ timeout: 10000 }).catch(async (e) => {
                        console.log(`[Test B] Retrying join button click: ${e.message}`);
                        await pageB.getByTestId('invite-join-btn').click({ timeout: 10000 });
                    });
                } else {
                    console.log('[Test B] Redirected to dashboard during wait.');
                }
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                console.log('[Test B] Encountered redirect/button timeout, checking URL: ', errMsg);
            }
        }
        
        // Should land on dashboard directly
        await expect(pageB).toHaveURL(/.*dashboard/, { timeout: 20000 });

        // Close the Join Success Modal if it appears
        // In CI, the modal might not appear due to timing, so handle both cases
        console.log('Checking for Join Success Modal for User B...');
        const successOverlay = pageB.getByTestId('join-success-overlay');
        try {
            await expect(successOverlay).toBeVisible({ timeout: 15000 });
            console.log('Join Success Modal found, closing it...');
            await pageB.click('#join-success-close-btn');
            await expect(successOverlay).not.toBeVisible({ timeout: 10000 });
        } catch {
            console.log('Join Success Modal not visible (may have been auto-closed or skipped in CI). Continuing...');
        }
        
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

        const groupItemA = pageA.locator('[data-testid="sidebar-group-item"]').filter({ 
            has: pageA.locator(`[data-group-name="${groupName}"]`) 
        }).or(pageA.locator('[data-testid="sidebar-group-item"]', { hasText: groupName }));

        await expect(groupItemA.first()).toBeVisible({ timeout: 20000 });

        await groupItemA.first().getByTestId('group-name-sidebar').click();
        
        // Wait for ChatHeader to show the correct group name
        await expect(pageA.getByTestId('group-name-title')).toContainText(groupName, { timeout: 30000 });
        
        await expect(pageA.getByTestId('members-button')).toBeVisible({ timeout: 20000 });
        await pageA.getByTestId('members-button').click();
        
        await expect(pageA.getByTestId('member-nickname').filter({ hasText: 'User B' }).first()).toBeVisible({ timeout: 20000 });
        console.log('User B verified in User A members list (Authenticated join).');
    });

    console.log('Authenticated join test passed!');
    await contextB.close();
  });
});

