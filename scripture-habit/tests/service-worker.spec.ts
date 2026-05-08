import { test, expect } from '@playwright/test';

test.describe('Service Worker Stability', () => {
  test('should not throw TypeError on unsupported URL schemes (e.g. chrome-extension)', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait for the service worker to register and be ready
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        // Manually register because the app disables it when navigator.webdriver is true
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          await navigator.serviceWorker.register('/sw.js');
        }
        await navigator.serviceWorker.ready;
      }
    });

    // Simulate a request that an extension might make (unsupported scheme)
    await page.evaluate(() => {
      // Using a try-catch because the fetch itself will fail due to the scheme,
      // but we want to ensure the Service Worker's internal logic doesn't throw a global error.
      fetch('chrome-extension://abcdefghijklmnopqrstuvwxyz/test.js').catch(() => {
        // Ignore network failure, we are checking for SW runtime errors in the console
      });
      
      // Also try a data URI which is common for small icons/placeholders
      fetch('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==').catch(() => {});
    });

    // Wait for any asynchronous SW tasks to complete
    await page.waitForTimeout(2000);

    // Verify that the specific "Failed to execute 'put' on 'Cache'" error is NOT present
    const putErrors = consoleErrors.filter(err => 
      err.includes("Failed to execute 'put' on 'Cache'") || 
      err.includes("Request scheme 'chrome-extension' is unsupported")
    );

    expect(putErrors, 'Service Worker should not log "Cache.put" errors for unsupported schemes').toHaveLength(0);
  });
});
