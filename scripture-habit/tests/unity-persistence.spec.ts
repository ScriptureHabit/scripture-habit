import { test, expect } from './fixtures/auth.fixture';

test.describe('Unity Persistence (Reload Robustness)', () => {
    test.slow();
    test.use({ timezoneId: 'Asia/Tokyo' }); // Use JST to ensure timezone-aware logic is tested

    test('should maintain 100% unity after posting and reloading', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // Mirror console logs to terminal for easier debugging
        page.on('console', msg => {
            if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warning') {
                console.log(`[Browser ${test.info().project.name}] ${msg.text()}`);
            }
        });

        // Enable debug logging in the browser
        await page.addInitScript(() => {
            localStorage.setItem('debugUnity', 'true');
        });

        // --- PRE-STEP: INITIALIZE GROUP ---
        const browserName = test.info().project.name;
        const groupName = `Persistence-${browserName}-${Date.now()}`;
        
        console.log(`--- Step 1: Creating group "${groupName}" via Test API ---`);
        await page.evaluate(async (name) => {
            const waitForAuthToken = () => {
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    const check = async () => {
                        const auth = (window as any).firebaseAuth;
                        if (auth && auth.currentUser) {
                            try {
                                const token = await auth.currentUser.getIdToken();
                                resolve(token);
                            } catch (e) {
                                reject(e);
                            }
                        } else if (attempts++ > 40) {
                            reject('Auth token not found after 20s');
                        } else {
                            setTimeout(check, 500);
                        }
                    };
                    check();
                });
            };

            const idToken = (await waitForAuthToken()) as string;
            const response = await fetch('/api/test/setup-test-group', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    memberCount: 1, // Only this user
                    groupName: name,
                    timeZone: 'Asia/Tokyo'
                })
            });
            
            if (!response.ok) throw new Error('Failed to seed test group');
            return await response.json();
        }, groupName);

        // Find the specific group in the sidebar
        // Use data-group-name attribute to be resilient to auto-translation of the display text
        const sidebarGroup = page.locator(`[data-testid="sidebar-group-item"][data-group-name="${groupName}"]`);
        const sidebarUnity = sidebarGroup.getByTestId('sidebar-unity-percentage');

        console.log(`--- Step 2: Checking sidebar presence for "${groupName}" ---`);
        try {
            await expect(sidebarGroup).toBeVisible({ timeout: 15000 });
            await expect(sidebarUnity).toBeVisible({ timeout: 15000 });
        } catch (e) {
            await page.screenshot({ path: 'debug-sidebar-fail.png' });
            throw e;
        }

        console.log(`Checking real-time update to 100%...`);
        // Wait for it to reach 100% (the backend should have calculated this)
        await expect(sidebarUnity).toHaveText('100%', { timeout: 20000 });
        
        // --- STEP 2: POST A NOTE ---
        console.log('--- Step 2: Posting a note to reach 100% ---');
        await sidebarGroup.click();
        await page.getByTestId('new-note-button').click();

        const scriptureSelect = page.getByTestId('new-note-category').locator('input').first();
        await scriptureSelect.click({ force: true });
        await page.keyboard.type('Book of Mormon');
        await page.locator('.react-select__option', { hasText: 'Book of Mormon' }).first().click();
        await page.getByTestId('new-note-chapter').fill('1 Nephi 1');
        await page.getByTestId('new-note-comment').fill(`Persistence Test ${Date.now()}`);
        
        const postButton = page.getByTestId('post-note-button');
        await expect(postButton).toBeEnabled();
        await postButton.click();

        // Wait for success and 100% update
        await expect(page.getByText('Note posted successfully!')).toBeVisible({ timeout: 15000 });
        
        // Check real-time update
        console.log('Checking real-time update to 100%...');
        await expect(sidebarUnity).toHaveText('100%', { timeout: 20000 });
        
        // --- STEP 3: RELOAD AND VERIFY PERSISTENCE ---
        console.log('--- Step 3: Reloading page to verify persistence ---');
        await page.reload();
        
        // Wait for hydration to complete
        await page.waitForSelector('[data-testid="sidebar-notes"]', { timeout: 30000 });
        
        // Re-locate the group item after reload
        const groupItemAfter = page.getByTestId('sidebar-group-item').filter({ hasText: groupName });
        const sidebarUnityAfter = groupItemAfter.getByTestId('sidebar-unity-percentage');
        
        console.log('Verifying unity percentage stays at 100% after reload...');
        
        // CRITICAL CHECK: This verifies that:
        // 1. Backend persisted '100%' in group.unityPercentage
        // 2. Frontend enrichGroupUnity prioritized this value over empty metadata
        await expect(sidebarUnityAfter).toHaveText('100%', { timeout: 20000 });
        
        console.log('Success: Unity 100% persisted correctly after reload.');
    });
});
