import { Page, expect } from '@playwright/test';

/**
 * Test data constants
 */
export const TEST_PASSWORD = 'Password123!';
export const AUTH_WAIT_TIMEOUT = 2000;
export const DASHBOARD_REDIRECT_TIMEOUT = 45000;
export const DASHBOARD_LOAD_TIMEOUT = 60000;

/**
 * Generate unique test user data
 */
export function generateTestData() {
  const timestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  return {
    email: `testuser-${timestamp}@test.local`,
    nickname: `Tester-${timestamp}`,
    timestamp,
  };
}

/**
 * Disable animations for stable testing
 */
export function disableAnimationsScript() {
  return `
    window.localStorage.setItem('cookieConsent', 'true');
    window.localStorage.setItem('lastNotifPrompt', Date.now().toString());
    window.localStorage.setItem('hasSeenWelcomeStory', 'true');

    const style = document.createElement('style');
    style.innerHTML = \`
      *, *::before, *::after {
        transition-duration: 0.001s !important;
        animation-duration: 0.001s !important;
        transition-delay: 0s !important;
        animation-delay: 0s !important;
      }
    \`;
    const injectStyle = () => {
      const parent = document.head || document.documentElement;
      if (parent) {
        parent.appendChild(style);
      } else {
        setTimeout(injectStyle, 10);
      }
    };
    injectStyle();
  `;
}

/**
 * Fill signup form
 */
export async function fillSignupForm(
  page: Page,
  nickname: string,
  email: string,
  password: string = TEST_PASSWORD
) {
  await page.getByTestId('signup-nickname').fill(nickname);
  await page.getByTestId('signup-email').fill(email);
  await page.getByTestId('signup-password').fill(password);
  await page.getByTestId('signup-submit').click();
}

/**
 * Fill login form
 */
export async function fillLoginForm(
  page: Page,
  email: string,
  password: string = TEST_PASSWORD
) {
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
}

/**
 * Perform login with error handling
 */
export async function performLogin(
  page: Page,
  email: string,
  password: string = TEST_PASSWORD
) {
  await page.waitForLoadState('networkidle');
  await page.getByTestId('login-submit').waitFor({ state: 'visible', timeout: 10000 });
  
  await fillLoginForm(page, email, password);
  await page.getByTestId('login-submit').click();
  
  // Wait for auth to process
  await page.waitForTimeout(AUTH_WAIT_TIMEOUT);
  
  // Check if still on login page (indicating auth failure)
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    const errorElement = page.locator('[data-testid*="error"], .error, [role="alert"]').first();
    const hasError = await errorElement.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasError) {
      const errorText = await errorElement.textContent();
      throw new Error(`Login failed: ${errorText}`);
    }
    
    throw new Error(`Login failed: Still on login page after click. URL: ${currentUrl}`);
  }
  
  // Wait for dashboard redirect
  await page.waitForURL(/.*\/dashboard/, { timeout: DASHBOARD_REDIRECT_TIMEOUT });
}

/**
 * Wait for dashboard to fully load
 */
export async function waitForDashboardLoad(page: Page, nickname: string) {
  await expect(page.getByTestId('dashboard-skeleton')).not.toBeVisible({ timeout: DASHBOARD_LOAD_TIMEOUT });
  await expect(page.getByText(nickname)).toBeVisible();
}
