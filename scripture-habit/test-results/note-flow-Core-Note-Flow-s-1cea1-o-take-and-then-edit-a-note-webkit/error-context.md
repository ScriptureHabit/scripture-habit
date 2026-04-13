# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: note-flow.spec.ts >> Core Note Flow >> should allow a user to take and then edit a note
- Location: tests\note-flow.spec.ts:4:3

# Error details

```
Test timeout of 60000ms exceeded while setting up "authenticatedPage".
```

```
Error: page.waitForURL: Test timeout of 60000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - heading "Log In" [level=2] [ref=e6]
        - generic [ref=e7]: Please log in or sign up using your default browser (Chrome, Safari, etc.). In-app browsers like LINE, Messenger, or Instagram may prevent login due to security restrictions.
        - button "Log in with Google" [ref=e8] [cursor=pointer]:
          - img [ref=e9]
          - text: Log in with Google
        - button "Log in with GitHub" [ref=e11] [cursor=pointer]:
          - img [ref=e12]
          - text: Log in with GitHub
        - generic [ref=e15]: OR
        - generic [ref=e16]:
          - generic [ref=e17]:
            - generic [ref=e18]: Email Address
            - textbox "Email Address" [active] [ref=e19]:
              - /placeholder: ""
          - generic [ref=e20]:
            - generic [ref=e21]: Password
            - textbox "Password" [ref=e22]:
              - /placeholder: ""
          - link "Forgot your password?" [ref=e24]:
            - /url: /forgot-password
          - button "Log In" [ref=e25] [cursor=pointer]
        - paragraph [ref=e27]:
          - text: Don't have an account?
          - link "Sign Up" [ref=e28]:
            - /url: /signup
      - contentinfo [ref=e29]:
        - generic [ref=e30]:
          - generic [ref=e31]:
            - generic [ref=e32] [cursor=pointer]: Privacy Policy
            - generic [ref=e33]: •
            - generic [ref=e34] [cursor=pointer]: Terms of Service
            - generic [ref=e35]: •
            - generic [ref=e36] [cursor=pointer]: Legal Disclosure
          - generic [ref=e37]: © 2026 Scripture Habit
    - region "Notifications Alt+T"
  - paragraph [ref=e38]: Running in emulator mode. Do not use with production credentials.
  - iframe [ref=e39]:
    
```

# Test source

```ts
  1  | /* eslint-disable react-hooks/rules-of-hooks */
  2  | import { test as base, Page } from '@playwright/test';
  3  | 
  4  | type AuthFixtures = {
  5  |   authenticatedPage: Page;
  6  |   uniqueEmail: string;
  7  | };
  8  | 
  9  | export const test = base.extend<AuthFixtures>({
  10 |   // Provide a unique email for each test to ensure fresh state
  11 |   uniqueEmail: async ({}, use) => {
  12 |     await use(`test-${Date.now()}@example.com`);
  13 |   },
  14 | 
  15 |   // Provide a pre-authenticated page to the test
  16 |   authenticatedPage: async ({ page, uniqueEmail }, use) => {
  17 |     // PRE-INIT: Set localStorage flags and DISABLE ANIMATIONS
  18 |     await page.addInitScript(() => {
  19 |         window.localStorage.setItem('cookieConsent', 'true');
  20 |         window.localStorage.setItem('lastNotifPrompt', Date.now().toString());
  21 | 
  22 |         // Force disable all CSS animations and transitions (set to near-zero to allow event firing)
  23 |         const style = document.createElement('style');
  24 |         style.innerHTML = `
  25 |           *, *::before, *::after {
  26 |             transition-duration: 0.001s !important;
  27 |             animation-duration: 0.001s !important;
  28 |             transition-delay: 0s !important;
  29 |             animation-delay: 0s !important;
  30 |           }
  31 |         `;
  32 |         document.head.appendChild(style);
  33 |     });
  34 | 
  35 |     // 1. Navigate to signup
  36 |     await page.goto('/en/signup');
  37 |     
  38 |     // 2. Fill Signup Form
  39 |     await page.getByLabel('Nickname').fill('E2E Tester');
  40 |     await page.getByLabel('Email Address').fill(uniqueEmail);
  41 |     await page.getByLabel('Password').fill('password123');
  42 |     await page.getByRole('button', { name: 'Sign Up', exact: true }).click({ force: true });
  43 |     
  44 |     // 3. Handle Login redirect
  45 |     await page.waitForURL(/.*login/, { timeout: 60000 });
  46 |     await page.getByLabel('Email Address').fill(uniqueEmail);
  47 |     await page.getByLabel('Password').fill('password123');
  48 |     await page.getByRole('button', { name: 'Log In', exact: true }).click({ force: true });
  49 |     
  50 |     // 4. Verification of arrival at dashboard
  51 |     // No onboarding modals should appear now for @example.com users
> 52 |     await page.waitForURL(/.*dashboard/, { timeout: 90000 });
     |                ^ Error: page.waitForURL: Test timeout of 60000ms exceeded.
  53 |     
  54 |     // 5. Provide the authenticated page to the test
  55 |     await use(page);
  56 |   },
  57 | });
  58 | 
  59 | export { expect } from '@playwright/test';
  60 | 
```