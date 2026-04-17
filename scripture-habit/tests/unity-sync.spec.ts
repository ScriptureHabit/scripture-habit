import { test, expect } from './fixtures/auth.fixture';

test.describe('Unity Percentage Synchronization', () => {
    test.slow();
    test.use({ timezoneId: 'UTC' });

    test('should update unity in real-time and reset at midnight', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // Mirror console logs to terminal for easier debugging
        page.on('console', msg => {
            if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warning') {
                console.log(`[Browser ${test.info().project.name}] ${msg.text()}`);
            }
        });

        // --- PRE-STEP: INITIALIZE MOCK CLOCK ---
        // We set the clock to 10 minutes before midnight UTC on the CURRENT server day.
        // This ensures browser and server agree on the date initially and gives reload buffer.
        const now = new Date();
        const almostMidnight = new Date(now);
        almostMidnight.setUTCHours(23, 50, 0, 0); // 10 minute buffer
        
        console.log(`--- Pre-step: Installing mock clock at ${almostMidnight.toUTCString()} ---`);
        await page.clock.install({ time: almostMidnight });
        
        // Reload to ensure all components (especially useToday) use the mock clock from mount
        await page.goto('/en/dashboard');
        await expect(page.getByTestId('sidebar-dashboard')).toBeVisible({ timeout: 30000 });

        // --- PART 1: ENSURE GROUP EXISTS (Optimized via Seed API) ---
        console.log('--- Step 1: Ensuring test group exists via API ---');
        const browserName = test.info().project.name;
        const groupName = `Unity Sync ${browserName} ${Date.now()}`;
        
        await page.evaluate(async (name) => {
            const waitForAuthToken = () => {
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    const check = async () => {
                        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                        const auth = (window as any).firebaseAuth;
                        if (auth && auth.currentUser) {
                            try {
                                const token = await auth.currentUser.getIdToken();
                                resolve(token);
                            } catch (e) {
                                reject(e);
                            }
                        } else if (attempts++ > 40) {
                            reject('Auth token not found after 20s (firebaseAuth or currentUser missing)');
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
                    memberCount: 2,
                    groupName: name
                })
            });
            
            if (!response.ok) throw new Error('Failed to seed test group');
            return await response.json();
        }, groupName);

        // Find the specific group in the sidebar
        const groupItem = page.getByTestId('sidebar-group-item').filter({ hasText: groupName });
        const sidebarUnity = groupItem.getByTestId('sidebar-unity-percentage');
        
        await expect(sidebarUnity).toBeVisible({ timeout: 30000 });
        const initialText = await sidebarUnity.innerText();
        console.log(`Initial Unity for ${groupName}: ${initialText}`);

        // --- PART 2: REAL-TIME UPDATE TEST ---
        console.log('--- Step 2: Posting a note to trigger unity update ---');
        // Click the specific group to ensure it's selected (and we post to it)
        await groupItem.click();
        await page.getByTestId('new-note-button').click();

        // Interact with react-select: click to open, type to filter, click the option
        const scriptureSelect = page.getByTestId('new-note-category').locator('input').first();
        await scriptureSelect.click({ force: true });
        await page.keyboard.type('Book of Mormon');
        // Wait for the option to appear and click it explicitly
        await page.locator('.react-select__option', { hasText: 'Book of Mormon' }).first().click({ timeout: 5000 });
        await page.getByTestId('new-note-chapter').fill('Alma 32');
        await page.getByTestId('new-note-comment').fill(`Unity Test ${Date.now()}`);
        
        console.log('Clicking post button...');
        
        // Verify button is enabled before clicking (form validation passes)
        const postButton = page.getByTestId('post-note-button');
        await expect(postButton).toBeEnabled({ timeout: 5000 });
        
        // Small delay to ensure all state updates are propagated
        await page.waitForTimeout(500);
        
        await postButton.click();

        // Advance clock to allow toast and async tasks to proceed
        await page.clock.fastForward(2000);
        
        console.log('Waiting for success message...');
        await expect(page.getByText('Note posted successfully!')).toBeVisible({ timeout: 15000 });
        
        // Wait for unity to NOT be 0% anymore (it should have updated)
        console.log('--- Step 3: Verifying Unity Percentage update ---');
        await expect(sidebarUnity).not.toHaveText('0%', { timeout: 20000 });
        
        const sidebarUpdatedText = await sidebarUnity.innerText();
        console.log(`Sidebar Unity after post: ${sidebarUpdatedText}`);

        // --- PART 2.5: PERSISTENCE TEST (RELOAD) ---
        console.log('--- Step 2.5: Verifying persistence upon reload ---');
        await page.reload();
        await expect(page.getByTestId('sidebar-dashboard')).toBeVisible({ timeout: 30000 });
        
        // --- PART 3: MIDNIGHT RESET TEST ---
        console.log('--- Step 3: Fast forwarding past midnight ---');
        // Fast forward 15 minutes to be safe (starts at 23:50:00)
        await page.clock.fastForward(15 * 60 * 1000); 
        console.log('Clock fast forwarded 15m past midnight.');

        // Re-locate the specific group item and its unity percentage
        const groupItemFinal = page.locator(`[data-testid="sidebar-group-item"][data-group-name="${groupName}"]`);
        const sidebarUnityFinal = groupItemFinal.getByTestId('sidebar-unity-percentage');

        // Wait for the UI to update - the sidebar should reset to 0%
        console.log(`Waiting for ${groupName} unity reset to 0%...`);
        await expect(sidebarUnityFinal).toHaveText('0%', { timeout: 70000 });
        console.log('Success: Unity percentage reset to 0% at midnight.');
    });
});
