import { test, expect } from './fixtures/auth.fixture';

test.describe('Invitation Join Flow Stability', () => {
  test('should join a group after landing on invite link and logging in', async ({ authenticatedPage, browser }) => {
    test.setTimeout(240000); // 4 minutes
    
    // 1. Create a group as User A (Shared Tester) to get an invite code
    const timestamp = Date.now();
    const groupName = `Join Flow Test ${timestamp}`;
    const pageA = authenticatedPage;
    const userBEmail = `userb-${timestamp}@example.com`;
    const userBPassword = 'Password123!';
    
    console.log('User A creating group...');
    await pageA.goto('/en/group-form');
    await pageA.fill('[data-testid="group-name-input"]', groupName);
    await pageA.click('[data-testid="create-group-submit"]');
    await pageA.waitForURL(/.*dashboard/);
    
    // Get the invite link from the modal
    await expect(pageA.locator('.invite-modal')).toBeVisible();
    const inviteLink = await pageA.locator('.invite-link-url').innerText();
    console.log('Generated Invite Link:', inviteLink);
    
    // 2. Now act as User B who is NOT logged in
    const contextB = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const pageB = await contextB.newPage();
    
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
        await joinBtn.click();
        
        // Should land on welcome page (since not logged in)
        await pageB.waitForURL(/.*welcome/, { timeout: 15000 });
        
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
        console.log('Checking for Habit Pace modal for User B...');
        const paceModalTitle = pageB.locator('.auto-kick-init-title-styled');
        
        // Wait for modal to appear (might take a moment after dashboard load)
        await expect(paceModalTitle).toBeVisible({ timeout: 30000 });
        
        // Step 1: Select pace (default 3 is fine)
        await pageB.click('.modal-btn.primary:has-text("Next")');
        
        // Step 2: Confirmation
        const confirmInput = pageB.locator('.auto-kick-confirm-input-styled');
        await expect(confirmInput).toBeVisible();
        await confirmInput.fill('3');
        
        // Step 3: Save
        await pageB.click('.modal-btn.primary:has-text("Save")');
        
        // Modal should disappear
        await expect(paceModalTitle).not.toBeVisible({ timeout: 15000 });
    });

    await test.step('Verify group appears for both users', async () => {
        console.log('Verifying group in User B sidebar...');
        // Verify User B sees the group in sidebar
        const groupItemB = pageB.locator('.sidebar-group-item', { hasText: groupName });
        await expect(groupItemB).toBeVisible({ timeout: 30000 });

        // Verify User A (Owner) sees User B in member list
        console.log('Verifying User B in User A members list...');
        await pageA.bringToFront();
        await pageA.reload(); // Force sync
        
        // Click on the group in sidebar
        const groupItemA = pageA.locator('.sidebar-group-item', { hasText: groupName });
        await groupItemA.click();
        
        // Open members list
        const membersBtn = pageA.locator('button:has-text("Members")');
        await expect(membersBtn).toBeVisible({ timeout: 20000 });
        await membersBtn.click();
        
        // Check for User B's nickname
        await expect(pageA.locator('text=User B')).toBeVisible({ timeout: 20000 });
    });

    console.log('Test passed!');
    await contextB.close();
  });
});
