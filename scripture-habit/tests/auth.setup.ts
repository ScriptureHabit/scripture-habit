import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const sharedEmail = 'shared-tester@example.com';
  const password = 'password123';

  // 1. Initial setup to avoid recurring prompts
  await page.addInitScript(() => {
    window.localStorage.setItem('cookieConsent', 'true');
    window.localStorage.setItem('lastNotifPrompt', Date.now().toString());
  });

  // Helper for login form filling
  const fillLoginForm = async () => {
    await page.getByTestId('login-email').fill(sharedEmail);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click({ force: true });
  };

  // 2. Try Login First (Robustness for persistent emulators)
  console.log('Attempting initial login...');
  await page.goto('/en/login');
  await fillLoginForm();

  // 3. Handle Login redirect or fallback to Signup
  try {
    // Wait for redirect to dashboard
    await page.waitForURL(/.*dashboard/, { timeout: 30000 });
    console.log('Login successful.');
  } catch {
    console.log('Login failed or timed out, attempting Signup...');
    // Login failed, let's signup
    await page.goto('/en/signup');
    await page.getByTestId('signup-nickname').fill('Shared Tester');
    await page.getByTestId('signup-email').fill(sharedEmail);
    await page.getByTestId('signup-password').fill(password);
    await page.getByTestId('signup-submit').click({ force: true });
    
    // Wait for either:
    // 1. Redirect to login (Success)
    // 2. Redirect to dashboard (Success)
    // 3. Error message (Already exists)
    // Use Promise.race to handle high latency
    await Promise.race([
      page.waitForURL(/.*login/, { timeout: 40000 }).catch(() => {}),
      page.waitForURL(/.*dashboard/, { timeout: 40000 }).catch(() => {}),
      page.waitForSelector('[data-testid="signup-error"]', { timeout: 15000 }).catch(() => {})
    ]);

    const currentUrl = page.url();
    const errorVisible = await page.getByTestId('signup-error').isVisible().catch(() => false);

    if (errorVisible || currentUrl.includes('signup')) {
      console.log('Signup appeared to fail or user exists. Retrying final login...');
      await page.goto('/en/login');
      await fillLoginForm();
    } else if (currentUrl.includes('login')) {
      console.log('Signup succeeded, filling login form...');
      await fillLoginForm();
    }
    
    // Final wait for dashboard
    await page.waitForURL(/.*dashboard/, { timeout: 60000 });
    console.log('Authentication setup complete.');
  }

  // 4. Verification and state save
  await page.context().storageState({ path: authFile });
});
