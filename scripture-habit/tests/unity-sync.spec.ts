import { test, expect } from './fixtures/auth.fixture';

test.describe('Unity Lifecycle (Full Flow)', () => {
    test.slow();
    test.use({ timezoneId: 'UTC' });

    test('should track unity through updates, reloads, and midnight reset', async ({ authenticatedPage: page }) => {
        const browserName = test.info().project.name;
        const groupName = `UnityLifecycle-${browserName}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        
        // --- 1. SETUP: 10 minutes before midnight ---
        const now = new Date();
        const almostMidnight = new Date(now);
        almostMidnight.setUTCHours(23, 50, 0, 0);
        
        console.log('[Test] Navigating to dashboard...');
        await page.goto('/en/dashboard'); 
        await page.waitForLoadState('load');
        
        // Wait for dashboard to stabilize
        await expect(page.getByTestId('sidebar-notes')).toBeVisible({ timeout: 20000 });
        
        console.log('--- Step 1: Seeding group ---');
        const setupResult = await page.setupTestGroup({ 
            groupName, 
            memberCount: 2, 
            timeZone: 'UTC',
            setYesterdayDate: true
        });
        console.log(`[Test] Group seeded: ${setupResult.groupId}`);

        console.log('[Test] Installing mock clock at 23:50...');
        await page.clock.install({ time: almostMidnight.getTime() });

        const groupItem = page.getByTestId('sidebar-group-item').filter({ hasText: groupName });
        const sidebarUnity = groupItem.getByTestId('sidebar-unity-percentage');
        
        await expect(sidebarUnity).toBeVisible({ timeout: 30000 });
        await expect(sidebarUnity).toHaveText('0%');

        // --- 2. UPDATE: Post a note and check real-time update ---
        console.log('--- Step 2: Posting note for real-time update ---');
        await page.getByTestId('new-note-button').click();

        const scriptureSelect = page.getByTestId('new-note-category').locator('input').first();
        await scriptureSelect.fill('Book of Mormon');
        await page.locator('.react-select__option', { hasText: 'Book of Mormon' }).first().click();
        await page.getByTestId('new-note-chapter').fill('Alma 32');
        await page.getByTestId('new-note-comment').fill(`Lifecycle Test ${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
        
        await page.getByTestId('post-note-button').click();
        await expect(page.getByText(/Note posted successfully|投稿/i)).toBeAttached({ timeout: 15000 });
        
        // Unity should update (e.g., to 50% if 1 of 2 members posted)
        await expect(sidebarUnity).not.toHaveText('0%', { timeout: 20000 });
        const updatedUnity = await sidebarUnity.innerText();
        console.log(`Updated Unity: ${updatedUnity}`);

        // --- 3. PERSISTENCE: Reload and verify ---
        console.log('--- Step 3: Verifying persistence on reload ---');
        await page.reload();
        await page.waitForSelector('[data-testid="sidebar-notes"]', { timeout: 30000 });
        
        const groupItemReload = page.getByTestId('sidebar-group-item').filter({ hasText: groupName });
        const sidebarUnityReload = groupItemReload.getByTestId('sidebar-unity-percentage');
        await expect(sidebarUnityReload).toHaveText(updatedUnity);

        // --- 4. NATURAL RESET: Fast forward past midnight ---
        console.log('--- Step 4: Fast forwarding to midnight ---');
        await page.clock.fastForward(15 * 60 * 1000); // +15 mins
        
        // Should reset to 0%
        await expect(sidebarUnityReload).toHaveText('0%', { timeout: 70000 });
        console.log('Natural reset confirmed.');

        // --- 5. API RESET: Verify manual reset capability ---
        console.log('--- Step 5: Testing manual reset API ---');
        // We need to trigger some activity again first
        await page.setupTestGroup({ 
            groupName: groupName + "-API", 
            memberCount: 1, 
            unityPercentage: 100,
            setYesterdayDate: true // Make it "yesterday" so API reset will trigger
        });

        const apiGroupItem = page.getByTestId('sidebar-group-item').filter({ hasText: groupName + "-API" });
        const apiGroupUnity = apiGroupItem.getByTestId('sidebar-unity-percentage');
        
        // Wait for it to show
        await expect(apiGroupUnity).toBeVisible({ timeout: 20000 });

        // Call reset API directly
        const result = await page.callApi('/api/groups/reset-unity-if-midnight', { 
            groupId: await apiGroupItem.getAttribute('data-group-id') 
        });
        expect(result.reset).toBe(true);

        await page.reload();
        await expect(apiGroupItem.getByTestId('sidebar-unity-percentage')).toHaveText('0%', { timeout: 20000 });
        console.log('API-triggered reset confirmed.');
    });
});
