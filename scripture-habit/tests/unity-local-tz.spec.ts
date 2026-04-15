import { test, expect } from './fixtures/auth.fixture';

test.describe('Unity Percentage Synchronization (Local Timezone: Asia/Tokyo)', () => {
    test.slow();
    
    // Skip this test in CI environments to focus on local dev verification as requested
    test.skip(!!process.env.CI, 'This test is for local timezone verification only');

    test.use({ timezoneId: 'Asia/Tokyo' });

    test('should reset at midnight JST when group is set to Asia/Tokyo', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // --- PART 1: SETUP TEST GROUP WITH ASIA/TOKYO ---
        console.log('--- Step 1: Setting up test group with Asia/Tokyo timezone ---');
        
        await page.evaluate(async () => {
            // Helper to wait for Firebase Auth to be ready and user to be signed in
            const waitForAuth = () => {
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    const maxAttempts = 20; // Try for up to 10 seconds (20 * 500ms)
                    const interval = 500;

                    const checkAuth = () => {
                        const auth = window.firebaseAuth;
                        if (auth) {
                            if (auth.currentUser) {
                                resolve(auth.currentUser);
                            } else {
                                // Auth object exists, but user not yet current. Wait for state change.
                                const unsubscribe = auth.onAuthStateChanged((user) => {
                                    if (user) {
                                        unsubscribe?.();
                                        resolve(user);
                                    }
                                });
                                // Add a timeout for onAuthStateChanged in case it never fires
                                setTimeout(() => {
                                    if (!auth.currentUser) {
                                        unsubscribe?.(); // Clean up listener
                                        reject(new Error('Firebase auth state change timed out after 10s.'));
                                    }
                                }, 10000);
                            }
                        } else {
                            // window.firebaseAuth is not yet available, retry
                            attempts++;
                            if (attempts < maxAttempts) {
                                console.log(`window.firebaseAuth not yet available, retrying... (attempt ${attempts}/${maxAttempts})`);
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
                    timeZone: 'Asia/Tokyo',
                    memberCount: 2, // 2 members for meaningful unity testing (0% -> 50%)
                    groupName: `JST Unity Test ${Date.now()}` // Unique name for fresh group
                })
            });
            
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to seed test group: ${error}`);
            }
            return await response.json();
        });

        await page.goto('/en/dashboard');
        await expect(page.getByTestId('sidebar-dashboard')).toBeVisible({ timeout: 30000 });
        
        const sidebarUnity = page.getByTestId('sidebar-unity-percentage').first();
        await expect(sidebarUnity).toBeVisible({ timeout: 30000 });

        // --- PART 2: TRIGGER UNITY ---
        console.log('--- Step 2: Posting note ---');
        const newNoteBtn = page.getByTestId('new-note-button');
        await expect(newNoteBtn).toBeVisible();
        await newNoteBtn.click();

        await page.getByTestId('new-note-category').locator('input').first().click({ force: true });
        await page.keyboard.type('Book of Mormon');
        await page.keyboard.press('Enter');
        await page.getByTestId('new-note-chapter').fill('Moroni 10');
        await page.getByTestId('new-note-comment').fill(`JST Test ${Date.now()}`);
        await page.getByTestId('post-note-button').click();

        await expect(page.getByText(/successfully/)).toBeVisible();
        
        // Verify unity changed to 100%
        // Note: The dummy member joined today, so they're excluded from denominator.
        // Only the posting user is eligible, resulting in 100% (1/1).
        await expect(sidebarUnity).toHaveText('100%', { timeout: 30000 });
        console.log('Verified: Unity is 100% (only posting member is eligible)');

        // --- PART 3: MIDNIGHT JST CROSSING ---
        console.log('--- Step 3: Fast forwarding past JST midnight ---');
        
        // 2024-05-20 00:00:00 JST is 2024-05-19 15:00:00 UTC
        // We start at 23:59:50 JST
        const almostMidnightJST = new Date('2024-05-19T14:59:50Z');
        
        await page.clock.install({ time: almostMidnightJST });
        console.log(`Clock JST: ${almostMidnightJST.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);

        await page.waitForTimeout(2000);
        
        // Fast forward 2 minutes to cross midnight JST
        await page.clock.fastForward('00:02:00');
        console.log('Clock fast forwarded 120s past JST midnight.');
        
        await page.waitForTimeout(5000);

        // Verify unity reset to 0%
        console.log('Verifying unity reset to 0% at JST midnight...');
        await expect(sidebarUnity).toHaveText('0%', { timeout: 60000 });
    });
});
