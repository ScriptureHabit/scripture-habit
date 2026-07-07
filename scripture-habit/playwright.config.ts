import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 1,
  /* Configure parallel workers dynamically */
  workers: process.env.CI ? 2 : undefined,
  
  timeout: 90000,
  expect: {
    timeout: 20000,
  },
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://127.0.0.1:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Enforce English locale for consistent E2E testing */
    locale: 'en-US',
    /* Enforce consistent timezone for test consistency */
    timezoneId: 'Asia/Tokyo',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: process.env.CI 
        ? 'cross-env VITE_USE_FIREBASE_EMULATOR=true npm run preview -- --host 127.0.0.1 --port 5173'
        : 'cross-env VITE_USE_FIREBASE_EMULATOR=true npm run dev -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120000,
    },
    {
      command: 'cross-env SKIP_AI=true SKIP_APP_CHECK=true FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 GCLOUD_PROJECT=scripture-habit-auth npm run server > backend_test.log 2>&1',
      url: 'http://127.0.0.1:5000/api/health',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120000,
    },
    // Firebase Emulator - only for local development (CI already starts emulator)
    ...(process.env.CI ? [] : [{
      command: 'npx firebase emulators:start --only auth,firestore --project scripture-habit-auth',
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: true,
      stdout: 'pipe' as const,
      stderr: 'pipe' as const,
    }]),
  ],
});
