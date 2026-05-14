import { test, expect } from './fixtures/auth.fixture';

test.describe('Language Settings and Routing', () => {
  test('should sync language preference to Firestore and respect it on next login', async ({ authenticatedPage, browser }) => {
    test.setTimeout(120000);
    const page = authenticatedPage;

    // 1. Initially should be in English (assuming default for the test user)
    await page.goto('/en/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // 2. Change language to Japanese via Profile
    console.log('Changing language to Japanese...');
    await page.goto('/en/profile');
    
    // Find the language selector
    const langJaOption = page.getByTestId('language-option-ja');
    await expect(langJaOption).toBeVisible();
    await langJaOption.click();
    
    // UI should switch to Japanese
    await expect(page.locator('text=プロフィール')).toBeVisible({ timeout: 15000 });
    console.log('Language changed to Japanese in UI.');

    // 3. Wait a moment for Firestore sync to complete
    await page.waitForTimeout(2000);

    // 4. Test redirection: Visit /dashboard (no prefix)
    console.log('Testing redirect from /dashboard to /ja/dashboard...');
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/ja\/dashboard/, { timeout: 15000 });
    await expect(page.locator('text=ダッシュボード')).toBeVisible();

    // 5. Verify persistence: Close and reopen in a fresh context with same storage state
    // (Playwright's authenticatedPage usually handles this, but let's be explicit)
    const storage = await page.context().storageState();
    const newContext = await browser.newContext({ storageState: storage });
    const newPage = await newContext.newPage();
    
    console.log('Verifying persistence in new session...');
    await newPage.goto('/dashboard');
    await expect(newPage).toHaveURL(/.*\/ja\/dashboard/);
    await expect(newPage.locator('text=ダッシュボード')).toBeVisible();

    await newContext.close();
  });

  test('should prioritize lang query parameter (notification simulation)', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    // Assume user is currently in English
    await page.goto('/en/dashboard');
    
    // Simulate clicking a notification that has ?lang=ja
    console.log('Simulating notification click with ?lang=ja...');
    await page.goto('/?lang=ja');
    
    // Should redirect to Japanese dashboard
    await expect(page).toHaveURL(/.*\/ja\//, { timeout: 15000 });
    await expect(page.locator('text=ダッシュボード')).toBeVisible();
  });
});
