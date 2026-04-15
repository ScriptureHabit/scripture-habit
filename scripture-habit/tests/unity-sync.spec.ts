import { test, expect } from './fixtures/auth.fixture';

test.describe('Unity Percentage Synchronization', () => {
    test.slow();
    test.use({ timezoneId: 'UTC' });

    test('should update unity in real-time and reset at midnight', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // --- PART 1: ENSURE GROUP EXISTS (Optimized via Seed API) ---
        console.log('--- Step 1: Ensuring test group exists via API ---');
        
        // Use the authenticated page to call our internal test seeding API
        // This is MUCH faster and more reliable than UI-based creation.
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
            if (!idToken) throw new Error('Could not find Firebase auth token in browser context');
            
            const response = await fetch('/api/test/setup-test-group', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    memberCount: 2, // Create group with 2 members for 0% -> 50% unity testing
                    groupName: `Unity Sync Test Group ${Date.now()}` // Unique name to ensure fresh group
                })
            });
            
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to seed test group: ${error}`);
            }
            return await response.json();
        });

        // Navigate to dashboard to ensure we see the seeded group
        await page.goto('/en/dashboard');
        
        // Wait for dashboard to load
        await expect(page.getByTestId('sidebar-dashboard')).toBeVisible({ timeout: 30000 });
        
        // Ensure the unity percentage element in the sidebar is visible
        const sidebarUnity = page.getByTestId('sidebar-unity-percentage').first();
        await expect(sidebarUnity).toBeVisible({ timeout: 30000 });


        const initialText = await sidebarUnity.innerText();
        console.log(`Initial Unity: ${initialText}`);

        // --- PART 2: REAL-TIME UPDATE TEST ---
        console.log('--- Step 2: Posting a note to trigger unity update ---');
        const newNoteBtn = page.getByTestId('new-note-button');
        await expect(newNoteBtn).toBeVisible({ timeout: 15000 });
        await newNoteBtn.click();

        // Select category
        console.log('Selecting category in note form...');
        await page.getByTestId('new-note-category').locator('input').first().click({ force: true });
        await page.keyboard.type('Book of Mormon');
        await page.keyboard.press('Enter');

        await page.getByTestId('new-note-chapter').fill('Alma 32');
        await page.getByTestId('new-note-comment').fill(`Unity Test ${Date.now()}`);
        
        const postBtn = page.getByTestId('post-note-button');
        await postBtn.click();

        // Verify success toast
        console.log('Waiting for note post success...');
        await expect(page.getByText(/successfully/)).toBeVisible({ timeout: 30000 });
        
        // Verify unity percentage update
        console.log('Verifying unity percentage after posting note...');
        
        // Wait a moment for potential updates
        await page.waitForTimeout(2000);
        
        const sidebarUpdatedText = await page.getByTestId('sidebar-unity-percentage').first().innerText();
        console.log(`Sidebar Unity after post: ${sidebarUpdatedText} (was ${initialText})`);

        // --- PART 2b: VERIFY SIDEBAR AND CHAT HEADER SYNC ---
        console.log('--- Step 2b: Verifying Sidebar and Chat Header unity values match ---');
        
        // Click on the first group to open chat
        const firstGroup = page.getByTestId('sidebar-group-item').first();
        await firstGroup.click();
        
        // Wait for chat header to be visible
        await expect(page.getByTestId('chat-header-unity')).toBeVisible({ timeout: 15000 });
        
        // Get Chat Header unity value
        const chatHeaderUnityText = await page.getByTestId('chat-header-unity').innerText();
        console.log(`Chat Header Unity: ${chatHeaderUnityText}`);
        
        // Extract numeric percentage from both values (Chat Header may include emoji)
        const sidebarNumeric = parseInt(sidebarUpdatedText.trim().replace('%', ''), 10);
        const chatHeaderNumeric = parseInt(chatHeaderUnityText.trim().replace(/[^0-9]/g, ''), 10);
        
        // Verify Sidebar and Chat Header numeric values match
        expect(sidebarNumeric).toBe(chatHeaderNumeric);
        
        console.log(`Success: Sidebar (${sidebarNumeric}%) and Chat Header (${chatHeaderNumeric}%) unity values are synchronized!`);
        
        // Navigate back to dashboard for the midnight reset test
        await page.goto('/en/dashboard');
        await expect(page.getByTestId('sidebar-dashboard')).toBeVisible({ timeout: 30000 });

        // --- PART 3: MIDNIGHT RESET TEST ---
        console.log('--- Step 3: Testing midnight reset via clock mocking ---');
        
        // Use a fixed UTC date for consistent testing regardless of current date/time
        const almostMidnight = new Date('2024-01-01T23:59:50Z');
        
        await page.clock.install({ time: almostMidnight });
        console.log(`Clock installed and set to: ${almostMidnight.toLocaleString()}`);

        // Wait for UI to settle at "late night"
        await page.waitForTimeout(3000);
        
        // Fast forward 120 seconds to cross midnight and ensure multiple interval cycles pass
        await page.clock.fastForward('00:02:00');
        console.log('Clock fast forwarded 120s past midnight.');
        
        // Wait a bit for React to process the state change
        await page.waitForTimeout(5000);

        // Verify unity reset to 0%
        // The useToday hook should trigger a re-render
        console.log('Waiting for unity reset to 0%...');
        await expect(page.getByTestId('sidebar-unity-percentage').first()).toHaveText('0%', { timeout: 60000 });
        console.log('Success: Unity percentage reset to 0% at midnight.');
    });
});
