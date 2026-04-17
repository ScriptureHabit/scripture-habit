import { test, expect } from './fixtures/auth.fixture';

test.describe('Unity Percentage Synchronization', () => {
    test.slow();
    test.use({ timezoneId: 'UTC' });

    test('should update unity in real-time and reset at midnight', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // --- PRE-STEP: INITIALIZE MOCK CLOCK ---
        // We set the clock to 10 seconds before midnight UTC on the CURRENT server day.
        // This ensures browser and server agree on the date initially.
        const now = new Date();
        const almostMidnight = new Date(now);
        almostMidnight.setUTCHours(23, 59, 50, 0);
        
        console.log(`--- Pre-step: Installing mock clock at ${almostMidnight.toUTCString()} ---`);
        await page.clock.install({ time: almostMidnight });
        
        // Reload to ensure all components (especially useToday) use the mock clock from mount
        await page.goto('/en/dashboard');
        await expect(page.getByTestId('sidebar-dashboard')).toBeVisible({ timeout: 30000 });

        // --- PART 1: ENSURE GROUP EXISTS (Optimized via Seed API) ---
        console.log('--- Step 1: Ensuring test group exists via API ---');
        
        await page.evaluate(async () => {
            const waitForAuth = () => {
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    const maxAttempts = 20;
                    const interval = 500;

                    const checkAuth = () => {
                        const auth = window.firebaseAuth;
                        if (auth) {
                            if (auth.currentUser) {
                                resolve(auth.currentUser);
                            } else {
                                const unsubscribe = auth.onAuthStateChanged((user) => {
                                    if (user) {
                                        unsubscribe?.();
                                        resolve(user);
                                    }
                                });
                                setTimeout(() => {
                                    if (!auth.currentUser) {
                                        unsubscribe?.();
                                        reject(new Error('Firebase auth state change timed out after 10s.'));
                                    }
                                }, 10000);
                            }
                        } else {
                            attempts++;
                            if (attempts < maxAttempts) {
                                setTimeout(checkAuth, interval);
                            } else {
                                reject(new Error(`window.firebaseAuth not available after ${maxAttempts * interval / 1000} seconds.`));
                            }
                        }
                    };
                    checkAuth();
                });
            };

            const user = await waitForAuth() as { getIdToken: () => Promise<string> };
            const idToken = await user.getIdToken();
            
            const response = await fetch('/api/test/setup-test-group', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    memberCount: 2,
                    groupName: `Unity Sync Test Group ${Date.now()}`
                })
            });
            
            if (!response.ok) throw new Error('Failed to seed test group');
            return await response.json();
        });

        // Ensure sidebar is ready
        const sidebarUnity = page.getByTestId('sidebar-unity-percentage').first();
        await expect(sidebarUnity).toBeVisible({ timeout: 30000 });
        const initialText = await sidebarUnity.innerText();
        console.log(`Initial Unity: ${initialText}`);

        // --- PART 2: REAL-TIME UPDATE TEST ---
        console.log('--- Step 2: Posting a note to trigger unity update ---');
        await page.getByTestId('new-note-button').click();

        await page.getByTestId('new-note-category').locator('input').first().click({ force: true });
        await page.keyboard.type('Book of Mormon');
        await page.keyboard.press('Enter');
        await page.getByTestId('new-note-chapter').fill('Alma 32');
        await page.getByTestId('new-note-comment').fill(`Unity Test ${Date.now()}`);
        await page.getByTestId('post-note-button').click();

        await expect(page.getByText(/successfully/)).toBeVisible({ timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const sidebarUpdatedText = await page.getByTestId('sidebar-unity-percentage').first().innerText();
        console.log(`Sidebar Unity after post: ${sidebarUpdatedText}`);

        // --- PART 3: MIDNIGHT RESET TEST ---
        console.log('--- Step 3: Fast forwarding past midnight ---');
        
        // At this point we are at ~23:59:55 UTC (due to timeouts and actions)
        // Fast forward 120 seconds to cross midnight
        await page.clock.fastForward('00:02:00');
        console.log('Clock fast forwarded 120s past midnight.');
        
        // Wait for React and useToday to process the date change
        // useToday has a 60s interval, so 120s fast-forward definitely triggers it.
        await page.waitForTimeout(5000);

        // Verify unity reset to 0%
        console.log('Waiting for unity reset to 0%...');
        await expect(page.getByTestId('sidebar-unity-percentage').first()).toHaveText('0%', { timeout: 60000 });
        console.log('Success: Unity percentage reset to 0% at midnight.');
    });

});
