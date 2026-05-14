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
    console.log('Filling login form...');
    const emailInput = page.getByTestId('login-email');
    const passwordInput = page.getByTestId('login-password');
    const submitBtn = page.getByTestId('login-submit');

    await emailInput.waitFor({ state: 'visible', timeout: 20000 });
    await emailInput.fill(sharedEmail);
    await passwordInput.fill(password);
    
    // Ensure button is visible and stable before clicking
    await submitBtn.waitFor({ state: 'visible', timeout: 20000 });
    await submitBtn.click();
  };

  // 2. Try Login First (Robustness for persistent emulators)
  console.log('Attempting initial login check...');
  await page.goto('/en/login');
  
  // Wait for either login form or already logged in (dashboard)
  try {
    await Promise.race([
      page.waitForSelector('[data-testid="login-email"]', { timeout: 15000 }),
      page.waitForURL(/.*dashboard/, { timeout: 15000 })
    ]);
  } catch {
    console.log('Neither login form nor dashboard appeared quickly, proceeding anyway...');
  }

  if (page.url().includes('dashboard')) {
    console.log('Already logged in detected.');
  } else {
    try {
      await fillLoginForm();
      // Wait for success or error
      await Promise.race([
        page.waitForURL(/.*dashboard/, { timeout: 15000 }),
        page.waitForSelector('[data-testid="login-error"]', { timeout: 10000 })
      ]);
    } catch {
      console.log('Initial login attempt failed or timed out, will try Signup flow.');
    }
  }

  // 3. Handle Signup if not yet on dashboard
  if (!page.url().includes('dashboard')) {
    console.log('Not on dashboard, attempting Signup...');
    await page.goto('/en/signup');
    
    // Check if we were redirected to dashboard (already logged in)
    if (page.url().includes('dashboard')) {
      console.log('Redirected to dashboard from signup page.');
    } else {
      await page.waitForSelector('[data-testid="signup-nickname"]', { timeout: 20000 });
      await page.getByTestId('signup-nickname').fill('Shared Tester');
      await page.getByTestId('signup-email').fill(sharedEmail);
      await page.getByTestId('signup-password').fill(password);
      await page.getByTestId('signup-submit').waitFor({ state: 'visible' });
      await page.getByTestId('signup-submit').click();
      
      // Wait for either success (redirect to login or dashboard) or error
      await Promise.race([
        page.waitForURL(/.*login/, { timeout: 30000 }),
        page.waitForURL(/.*dashboard/, { timeout: 30000 }),
        page.waitForSelector('[data-testid="signup-error"]', { timeout: 15000 })
      ]);

      const currentUrl = page.url();
      if (currentUrl.includes('signup')) {
        const errorVisible = await page.getByTestId('signup-error').isVisible().catch(() => false);
        if (errorVisible) {
          console.log('Signup error detected, trying login as fallback...');
          await page.goto('/en/login');
          await fillLoginForm();
        }
      } else if (currentUrl.includes('login')) {
        console.log('Signup redirected to login, completing login...');
        await fillLoginForm();
      }
    }
    
    // Handle Firebase emulator email verification if stuck
    if (!page.url().includes('dashboard')) {
      console.log('Still not on dashboard, attempting verification/login fallback...');
      try {
        const emulatorCheck = await fetch('http://127.0.0.1:9099/').then(() => true).catch(() => false);
        if (emulatorCheck) {
          await page.goto('http://127.0.0.1:9099/emulator/action?mode=verifyEmail&lang=en&oobCode=test');
          await page.waitForTimeout(1000);
        }
      } catch {
        // Emulator check is best-effort
      }
      
      await page.goto('/en/login');
      if (!page.url().includes('dashboard')) {
        await fillLoginForm();
      }
    }

    // Final wait for dashboard to ensure we are logged in
    console.log('Waiting for final dashboard navigation...');
    await page.waitForURL(/.*dashboard/, { timeout: 60000 });
  }

    // 4. Cleanup: Ensure shared tester has 0 groups and English language before any tests start
    // This prevents hitting the 4-group limit and ensures consistent language starting state
    try {
      // We use evaluate to ensure we have the auth token from the browser context
      const cleanupResult = await page.evaluate(async () => {
        const auth = (window as unknown as { firebaseAuth?: { currentUser?: { getIdToken: () => Promise<string> } } }).firebaseAuth;
        if (!auth?.currentUser) return { success: false, error: 'Not logged in' };
        
        try {
          const token = await auth.currentUser.getIdToken();
          
          // Reset groups
          const groupRes = await fetch('/api/test/leave-all-groups', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          // Reset language to English
          await fetch('/api/auth/update-profile', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ language: 'en' })
          });
          
          if (!groupRes.ok) {
            const text = await groupRes.text();
            return { success: false, status: groupRes.status, error: text };
          }
          return await groupRes.json();
        } catch (e) {
          return { success: false, error: (e as Error).message };
        }
      });

      if (cleanupResult.success !== false) {
        console.log('Cleanup successful (Groups reset, Language set to EN):', cleanupResult.message || 'Complete.');
      } else {
        console.warn('Cleanup partial failure:', cleanupResult.error);
      }
    } catch (e) {
      console.warn('Cleanup execution failed (best effort):', e);
    }

  // 5. State save
  await page.context().storageState({ path: authFile });
});
