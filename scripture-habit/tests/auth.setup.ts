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
  await page.waitForSelector('[data-testid="login-email"]', { timeout: 20000 });
  await fillLoginForm();

  // 3. Handle Login redirect or fallback to Signup
  try {
    // Wait for either success (dashboard) or known failure (error message)
    await Promise.race([
      page.waitForURL(/.*dashboard/, { timeout: 15000 }),
      page.waitForSelector('[data-testid="login-error"]', { timeout: 10000 })
    ]);
    
    if (page.url().includes('dashboard')) {
      console.log('Initial login successful.');
    } else {
      throw new Error('Login error message detected');
    }
  } catch (e) {
    console.log('Login failed or timed out, attempting Signup...');
    // Login failed, let's signup
    await page.goto('/en/signup');
    await page.waitForSelector('[data-testid="signup-nickname"]', { timeout: 20000 });
    await page.getByTestId('signup-nickname').fill('Shared Tester');
    await page.getByTestId('signup-email').fill(sharedEmail);
    await page.getByTestId('signup-password').fill(password);
    await page.getByTestId('signup-submit').click({ force: true });
    
    // Wait for either success or error
    await Promise.race([
      page.waitForURL(/.*login/, { timeout: 40000 }),
      page.waitForURL(/.*dashboard/, { timeout: 40000 }),
      page.waitForSelector('[data-testid="signup-error"]', { timeout: 20000 })
    ]);

    const currentUrl = page.url();
    const errorVisible = await page.getByTestId('signup-error').isVisible().catch(() => false);

    if (errorVisible) {
      const errorText = await page.getByTestId('signup-error').innerText();
      console.log('Signup error detected:', errorText, '. Retrying final login...');
      await page.goto('/en/login');
      await page.waitForSelector('[data-testid="login-email"]', { timeout: 20000 });
      await fillLoginForm();
    } else if (currentUrl.includes('login')) {
      console.log('Signup succeeded, moving to login form...');
      await page.waitForSelector('[data-testid="login-email"]', { timeout: 20000 });
      await fillLoginForm();
    } else if (currentUrl.includes('signup')) {
      // Still on signup but no error visible? Possible timeout.
      console.log('Still on signup page, forcing jump to login...');
      await page.goto('/en/login');
      await page.waitForSelector('[data-testid="login-email"]', { timeout: 20000 });
      await fillLoginForm();
    }
    
    // Final wait for dashboard
    console.log('Waiting for dashboard navigation...');
    await page.waitForURL(/.*dashboard/, { timeout: 60000 });
    console.log('Authentication setup complete.');
  }

  // 4. Verification and state save
  await page.context().storageState({ path: authFile });
});
