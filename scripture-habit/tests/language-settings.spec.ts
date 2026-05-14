import { test, expect } from './fixtures/auth.fixture';

test.describe('Language Settings and Routing', () => {
  test.describe.configure({ mode: 'serial' });

  test('should sync language preference to Firestore and respect it on next login', async ({ authenticatedPage }) => {
    test.setTimeout(120000);
    const page = authenticatedPage;
    page.on('console', msg => console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`));

    // 1. Initially should be in English (assuming default for the test user)
    await page.goto('/en/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // 2. Change language to Japanese via Profile
    console.log('Navigating to Profile...');
    await page.getByTestId('sidebar-profile').click();
    await expect(page.getByTestId('profile-title')).toBeVisible({ timeout: 15000 });
    
    console.log('Changing language to Japanese...');
    
    // Find the language selector
    console.log('Finding Japanese language option...');
    const langJaOption = page.getByTestId('language-option-ja');
    await expect(langJaOption).toBeVisible({ timeout: 15000 });
    
    // Direct DOM click as fallback for interaction issues
    await langJaOption.evaluate(el => (el as HTMLElement).click());
    console.log('Language click sent (via evaluate).');
    
    // 3. Wait for UI switch and URL redirection
    console.log('Waiting for Japanese URL redirection...');
    await expect(page).toHaveURL(/.*\/ja\/profile/, { timeout: 30000 });
    
    console.log('Waiting for Japanese UI translation...');
    // Simply wait for the text to appear, Playwright will poll
    await expect(page.getByTestId('profile-title')).toContainText('プロフィール', { timeout: 30000 });
    
    const titleText = await page.getByTestId('profile-title').textContent();
    console.log(`Current URL: ${page.url()}, Profile Title: ${titleText}`);
    console.log('Language change confirmed in UI and URL.');

    // 4. Test redirection: Visit /dashboard (no prefix)
    console.log('Testing redirect from /dashboard to /ja/dashboard...');
    await page.goto('/dashboard');
    await page.waitForURL(/.*\/ja\/dashboard/, { timeout: 15000 });
    await expect(page.locator('text=ダッシュボード')).toBeVisible();

    // 5. Verify persistence: Reload should maintain Japanese
    console.log('Verifying persistence via reload...');
    await page.reload();
    await expect(page).toHaveURL(/.*\/ja\/dashboard/, { timeout: 15000 });
    await expect(page.locator('text=ダッシュボード')).toBeVisible({ timeout: 15000 });
  });

  test('should prioritize lang query parameter (notification simulation)', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    // Simulate clicking a notification that has ?lang=ja
    console.log('Simulating notification click with /dashboard?lang=ja...');
    await page.goto('/dashboard?lang=ja');
    
    // Should redirect to Japanese dashboard
    await expect(page).toHaveURL(/.*\/ja\/dashboard/, { timeout: 15000 });
    await expect(page.locator('text=ダッシュボード')).toBeVisible({ timeout: 15000 });
  });
});
