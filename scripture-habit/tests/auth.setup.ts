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

  // 2. Try Login First (Robustness for persistent emulators)
  await page.goto('/en/login');
  await page.getByLabel('Email Address').fill(sharedEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click({ force: true });

  // 3. If login fails (we stay on login or see error), try Signup
  try {
    // Wait for redirect to dashboard
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });
  } catch (e) {
    console.log('Login failed or timed out, attempting Signup...');
    // Login failed, let's signup
    await page.goto('/en/signup');
    await page.getByLabel('Nickname').fill('Shared Tester');
    await page.getByLabel('Email Address').fill(sharedEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click({ force: true });
    
    // Follow redirect to login (if the app does that after signup)
    await page.waitForURL(/.*login/, { timeout: 15000 });
    await page.getByLabel('Email Address').fill(sharedEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log In', exact: true }).click({ force: true });
    
    // Final wait for dashboard
    await page.waitForURL(/.*dashboard/, { timeout: 30000 });
  }

  // 4. Verification and state save
  await page.context().storageState({ path: authFile });
});
