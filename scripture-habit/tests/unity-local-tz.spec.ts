import { test, expect } from './fixtures/auth.fixture';

test.describe('Unity Percentage Synchronization (Local Timezone: Asia/Tokyo)', () => {
    test.slow();
    
    // Skip this test in CI environments unless the timezone is explicitly configured to Asia/Tokyo
    const isTokyoTimezone = process.env.TZ === 'Asia/Tokyo' || Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Tokyo';
    test.skip(!!process.env.CI && !isTokyoTimezone, 'Skipped on CI unless TZ=Asia/Tokyo env is present');

    test.use({ timezoneId: 'Asia/Tokyo' });

    test('should reset at midnight JST when group is set to Asia/Tokyo', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // Mirror console logs to terminal for easier debugging
        page.on('console', msg => {
            if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warning') {
                console.log(`[Browser ${test.info().project.name}] ${msg.text()}`);
            }
        });

        // --- PART 1: Setup test group with Asia/Tokyo timezone ---
        console.log('--- Step 1: Setting up test group in Asia/Tokyo ---');
        
        const groupName = `JST Unity Test ${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        
        const { groupId } = await page.setupTestGroup({
            groupName,
            timeZone: 'Asia/Tokyo',
            memberCount: 1
        });

        console.log(`Created group ${groupId} with Asia/Tokyo timezone.`);

        // Navigate to dashboard
        await page.goto('/en/dashboard');
        await expect(page.getByTestId('sidebar-dashboard')).toBeVisible({ timeout: 30000 });

        // --- PART 2: Verify unity logic in Asia/Tokyo ---
        console.log('--- Step 2: Posting note to verify unity calculation ---');
        
        const groupItem = page.getByTestId('sidebar-group-item').filter({ hasText: groupName });
        const sidebarUnity = groupItem.getByTestId('sidebar-unity-percentage');
        
        await expect(sidebarUnity).toBeVisible({ timeout: 20000 });
        
        // Initial state should be 0%
        await expect(sidebarUnity).toHaveText('0%', { timeout: 10000 });

        // Post a note
        await page.getByTestId('new-note-button').click();
        
        const scriptureSelect = page.getByTestId('new-note-category').locator('input').first();
        await scriptureSelect.click({ force: true });
        await page.keyboard.type('Book of Mormon');
        await page.locator('.react-select__option', { hasText: 'Book of Mormon' }).first().click();
        await page.getByTestId('new-note-chapter').fill('1 Nephi 1');
        await page.getByTestId('new-note-comment').fill('Tokyo Unity Test');
        
        await page.getByTestId('post-note-button').click();
        await expect(page.getByText(/Note posted successfully|投稿/i)).toBeVisible({ timeout: 15000 });
        
        // Reload to ensure fresh Firestore data (especially for WebKit)
        console.log('Reloading page to ensure unity update is visible...');
        await page.reload();
        await expect(page.getByTestId('sidebar-dashboard')).toBeVisible({ timeout: 30000 });
        
        // Re-locate the group item after reload
        const refreshedGroupItem = page.getByTestId('sidebar-group-item').filter({ hasText: groupName });
        const refreshedSidebarUnity = refreshedGroupItem.getByTestId('sidebar-unity-percentage');
        await expect(refreshedSidebarUnity).toBeVisible({ timeout: 15000 });
        
        // Verify unity changed to 100%
        console.log('Waiting for unity to reflect note post...');
        await expect(refreshedSidebarUnity).toHaveText('100%', { timeout: 30000 });

        // --- PART 3: MIDNIGHT JST CROSSING ---
        console.log('--- Step 3: Fast forwarding 6 minutes past JST midnight ---');
        
        // Fast forward 6 minutes to cross midnight (was at 23:55:00)
        await page.clock.fastForward(6 * 60 * 1000); 
        console.log('Clock fast forwarded 6m to 00:01 JST.');

        // IMPORTANT: Trigger server-side reset after clock change
        // The mock clock only affects the client, so we need to tell the server to reset
        console.log('Triggering server-side midnight reset...');
        const resetResult = await page.callApi('/api/groups/reset-unity-if-midnight', { groupId });
        console.log('Reset API result:', resetResult);

        // Re-locate the group item after clock change for final verification
        const finalGroupItem = page.getByTestId('sidebar-group-item').filter({ hasText: groupName });
        const finalSidebarUnity = finalGroupItem.getByTestId('sidebar-unity-percentage');
        await expect(finalSidebarUnity).toBeVisible({ timeout: 15000 });
        
        // Verify unity resets to 0% in sidebar
        // The server reset updates Firestore, which triggers the sidebar update
        console.log(`Waiting for ${groupName} unity reset to 0%...`);
        await expect(finalSidebarUnity).toHaveText('0%', { timeout: 60000 });
        
        console.log('Success: Unity percentage reset to 0% at JST midnight.');
    });
});
