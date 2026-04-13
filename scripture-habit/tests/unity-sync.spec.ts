import { test, expect } from './fixtures/auth.fixture';

test.describe('Unity Percentage Synchronization', () => {
    test.slow(); // This test involves clock manipulation and multiple navigations

    test('should update unity in real-time and reset at midnight', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // --- PART 1: ENSURE GROUP EXISTS (Optimized via Seed API) ---
        console.log('--- Step 1: Ensuring test group exists via API ---');
        
        // Use the authenticated page to call our internal test seeding API
        // This is MUCH faster and more reliable than UI-based creation.
        await page.evaluate(async () => {
            const waitForAuth = () => {
                return new Promise((resolve) => {
                    const auth = window.firebaseAuth;
                    if (auth?.currentUser) {
                        return resolve(auth.currentUser);
                    }
                    const unsubscribe = auth?.onAuthStateChanged((user) => {
                        if (user) {
                            unsubscribe?.();
                            resolve(user);
                        }
                    });
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
                }
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
        // If it was 0%, it should now be > 0%
        console.log('Verifying unity percentage changed in real-time...');
        if (initialText === '0%') {
            await expect(page.getByTestId('sidebar-unity-percentage').first()).not.toHaveText('0%', { timeout: 30000 });
        } else if (initialText !== '100%') {
            await expect(page.getByTestId('sidebar-unity-percentage').first()).not.toHaveText(initialText, { timeout: 30000 });
        }
        const updatedText = await page.getByTestId('sidebar-unity-percentage').first().innerText();
        console.log(`Updated Unity after post: ${updatedText}`);

        // --- PART 3: MIDNIGHT RESET TEST ---
        console.log('--- Step 3: Testing midnight reset via clock mocking ---');
        
        const now = new Date();
        const almostMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 50);
        
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
