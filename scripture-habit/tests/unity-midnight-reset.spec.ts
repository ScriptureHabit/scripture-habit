import { test, expect } from './fixtures/auth.fixture';

test.describe('Unity Midnight Reset API', () => {
    test.slow();

    test('should reset unity percentage when midnight passes', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // --- PART 1: Setup test group ---
        console.log('--- Step 1: Setting up test group ---');
        
        const groupId = await page.evaluate(async () => {
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
                    groupName: `Midnight Reset Test ${Date.now()}`,
                    setYesterdayDate: true, // Set dailyActivity to yesterday for reset testing
                    unityPercentage: 100  // Directly set to 100% (skip note posting)
                })
            });
            
            if (!response.ok) throw new Error('Failed to create test group');
            const data = await response.json();
            return data.groupId;
        });

        console.log(`Created test group: ${groupId}`);

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
        
        // Wait for Firestore update to propagate
        await page.waitForTimeout(2000);
        
        // Navigate back to dashboard to refresh
        await page.goto('/en/dashboard');
        await expect(page.getByTestId('sidebar-dashboard')).toBeVisible({ timeout: 30000 });
        
        const unityAfterReset = await page.getByTestId('sidebar-unity-percentage').first().innerText();
        console.log(`Unity after reset: ${unityAfterReset}`);
        expect(unityAfterReset.trim()).toBe('0%');
        
        console.log('Success: Unity percentage was reset to 0%');
    });
});
