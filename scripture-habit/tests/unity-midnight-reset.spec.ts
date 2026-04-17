import { test, expect } from './fixtures/auth.fixture';

test.describe('Unity Midnight Reset API', () => {
    test.slow();

    test('should reset unity percentage when midnight passes', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // Mirror console logs to terminal for debugging Firestore updates
        page.on('console', msg => {
            if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warning') {
                console.log(`[Browser ${test.info().project.name}] ${msg.text()}`);
            }
        });

        // --- PART 1: Setup test group ---
        console.log('--- Step 1: Setting up test group ---');
        
        const groupName = `Midnight Reset Test ${Date.now()}`;
        const groupId = await page.evaluate(async ({ name }) => {
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
                                        reject(new Error('Firebase auth state change timed out'));
                                    }
                                }, 10000);
                            }
                        } else {
                            attempts++;
                            if (attempts < maxAttempts) {
                                setTimeout(checkAuth, interval);
                            } else {
                                reject(new Error('window.firebaseAuth not available'));
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
                    timeZone: 'UTC',
                    groupName: name,
                    setYesterdayDate: true, // Set dailyActivity to yesterday for reset testing
                    unityPercentage: 100  // Directly set to 100% (skip note posting)
                })
            });
            
            if (!response.ok) throw new Error('Failed to create test group');
            const data = await response.json();
            return data.groupId;
        }, { name: groupName });

        console.log(`Created test group: ${groupId} (Name: ${groupName})`);

        // --- PART 2: Navigate to dashboard (UI calculates unity dynamically) ---
        console.log('--- Step 2: Navigating to dashboard ---');
        
        await page.goto('/en/dashboard');
        await expect(page.getByTestId('sidebar-dashboard')).toBeVisible({ timeout: 30000 });
        
        // Wait for UI to load (unity is calculated client-side, not from stored value)
        await page.waitForTimeout(2000);
        const sidebarUnity = page.getByTestId('sidebar-unity-percentage').first();
        const unityText = await sidebarUnity.innerText();
        console.log(`Initial unity (client-calculated): ${unityText}`);
        // Note: UI recalculates unity from dailyActivity, so initial value may vary

        // --- PART 3: Call reset API directly ---
        console.log('--- Step 3: Calling reset API ---');
        
        const resetResult = await page.evaluate(async (targetGroupId) => {
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
                                        reject(new Error('Firebase auth state change timed out'));
                                    }
                                }, 10000);
                            }
                        } else {
                            attempts++;
                            if (attempts < maxAttempts) {
                                setTimeout(checkAuth, interval);
                            } else {
                                reject(new Error('window.firebaseAuth not available'));
                            }
                        }
                    };
                    checkAuth();
                });
            };

            const user = await waitForAuth() as { getIdToken: () => Promise<string> };
            const idToken = await user.getIdToken();
            
            const response = await fetch('/api/reset-unity-if-midnight', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupId: targetGroupId })
            });

            return await response.json();
        }, groupId);

        console.log('Reset API result:', resetResult);
        expect(resetResult.reset).toBe(true);

        // --- PART 4: Verify unity was reset to 0% ---
        console.log('--- Step 4: Verifying unity reset to 0% ---');
        
        // Use reload instead of goto to maintain Firestore listener connection
        // and avoid stale cached data from a new listener
        await page.reload();
        
        // Wait for hydration to complete
        await page.waitForSelector('[data-testid="sidebar-dashboard"]', { timeout: 30000 });

        // Find the specific group we created in the sidebar
        const specificGroupItem = page.locator(`[data-testid="sidebar-group-item"][data-group-name="${groupName}"]`);
        await expect(specificGroupItem).toBeVisible({ timeout: 15000 });
        
        const targetSidebarUnity = specificGroupItem.getByTestId('sidebar-unity-percentage');
        await expect(targetSidebarUnity).toBeVisible({ timeout: 15000 });
        
        // This should reliably be 0% now - wait for Firestore real-time update
        await expect(targetSidebarUnity).toHaveText('0%', { timeout: 15000 });
        
        const unityAfterReset = await targetSidebarUnity.innerText();
        console.log(`Unity after reset for ${groupName}: ${unityAfterReset}`);
        console.log('Success: Unity percentage reset to 0% in sidebar.');
    });
});
