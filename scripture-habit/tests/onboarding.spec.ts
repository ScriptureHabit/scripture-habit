import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the root, which should redirect to the default language (e.g., /en)
    await page.goto('/');
  });

  test('should render the landing page', async ({ page }) => {
    // Check if the hero title is visible
    await expect(page.getByText('Where LDS Scripture Study Becomes a Habit of Joy')).toBeVisible();
    
    // Check if the CTA button is visible
    const ctaButton = page.getByRole('button', { name: 'Start Now' });
    await expect(ctaButton).toBeVisible();

    // Accessibility check
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('.firebase-emulator-warning')
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should navigate to the welcome page when CTA is clicked', async ({ page }) => {
    const ctaButton = page.getByRole('button', { name: 'Start Now' });
    await ctaButton.click();

    // Verify it navigates to /welcome (with language prefix)
    await expect(page).toHaveURL(/\/welcome\/?$/);
    
    // Verify welcome page content (using level: 1 to distinguish from other potential matches)
    await expect(page.getByRole('heading', { name: 'Scripture Habit', level: 1 })).toBeVisible();
  });

  test('should switch language on the welcome page', async ({ page }) => {
    // Go directly to welcome page
    await page.goto('/en/welcome');

    // Click Japanese language button
    const jaButton = page.getByRole('button', { name: '日本語' });
    await jaButton.click();

    // Verify URL changed to /ja/welcome
    await expect(page).toHaveURL(/\/ja\/welcome\/?$/);

    // Verify button state
    await expect(jaButton).toHaveClass(/active/);
  });

  test('should show login and signup buttons on the welcome page', async ({ page }) => {
    await page.goto('/en/welcome');

    // Use specific buttons in the auth section
    const loginButton = page.locator('.auth-buttons').getByRole('button', { name: 'Log in' });
    const signupButton = page.locator('.auth-buttons').getByRole('button', { name: 'Sign Up' });

    await expect(loginButton).toBeVisible();
    await expect(signupButton).toBeVisible();

  });
});
