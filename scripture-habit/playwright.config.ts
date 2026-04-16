import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 1,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  
  timeout: 90000,
  expect: {
    timeout: 20000,
  },
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Only run WebKit on local machines to save CI resources and avoid flakiness
    ...(process.env.CI ? [] : [
      {
        name: 'webkit',
        use: { 
          ...devices['Desktop Safari'],
          storageState: 'playwright/.auth/user.json',
        },
        dependencies: ['setup'],
      },
    ]),
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'cross-env VITE_USE_FIREBASE_EMULATOR=true npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'cross-env SKIP_APP_CHECK=true FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 GCLOUD_PROJECT=scripture-habit-auth npm run server',
      url: 'http://localhost:5000/api/health',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    // Firebase Emulator - only for local development (CI already starts emulator)
    ...(process.env.CI ? [] : [{
      command: 'npx firebase emulators:start --only auth,firestore --project scripture-habit-auth',
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: false,
      stdout: 'pipe' as const,
      stderr: 'pipe' as const,
    }]),
  ],
});
