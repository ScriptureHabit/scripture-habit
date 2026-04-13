# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: note-flow.spec.ts >> Core Note Flow >> should allow a user to take and then edit a note
- Location: tests\note-flow.spec.ts:27:3

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /.*dashboard/
Received string:  "http://localhost:5173/en/login"
Timeout: 15000ms

Call log:
  - Expect "toHaveURL" with timeout 15000ms
    18 × unexpected value "http://localhost:5173/en/login"

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
              - text: password123
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
    - region "Notifications Alt+T":
      - alert [ref=e39]:
        - img [ref=e41]
        - generic [ref=e43]:
          - generic [ref=e44]: A new version is available.
          - button "Refresh to Update" [ref=e45] [cursor=pointer]
    - generic [ref=e49]:
      - paragraph [ref=e50]:
        - text: We use cookies to improve your experience and analyze traffic. By continuing to use this site, you agree to our use of cookies.
        - link "Privacy Policy" [ref=e51]:
          - /url: /privacy
      - button "Accept" [ref=e52] [cursor=pointer]
  - paragraph [ref=e53]: Running in emulator mode. Do not use with production credentials.
  - iframe [ref=e54]:
    
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Core Note Flow', () => {
  4  |   let uniqueEmail: string;
  5  | 
  6  |   test.beforeEach(async ({ page }) => {
  7  |     // 1. Navigate to signup
  8  |     await page.goto('/en/signup');
  9  |     uniqueEmail = `test-${Date.now()}@example.com`;
  10 |     
  11 |     // 2. Fill Signup Form
  12 |     await page.getByLabel('Nickname').fill('E2E Tester');
  13 |     await page.getByLabel('Email Address').fill(uniqueEmail);
  14 |     await page.getByLabel('Password').fill('password123');
  15 |     await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
  16 |     
  17 |     // 3. Handle Login redirect
  18 |     await expect(page).toHaveURL(/.*login/);
  19 |     await page.getByLabel('Email Address').fill(uniqueEmail);
  20 |     await page.getByLabel('Password').fill('password123');
  21 |     await page.getByRole('button', { name: 'Log In', exact: true }).click();
  22 |     
  23 |     // 4. Verification of arrival at dashboard
> 24 |     await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  25 |   });
  26 | 
  27 |   test('should allow a user to take and then edit a note', async ({ page }) => {
  28 |     // --- PART 1: CREATE NOTE ---
  29 |     const newNoteBtn = page.getByRole('button', { name: 'New Note' });
  30 |     await expect(newNoteBtn).toBeVisible();
  31 |     await newNoteBtn.click();
  32 | 
  33 |     // Fill the form
  34 |     await page.getByText('Please choose a category option').click();
  35 |     await page.keyboard.type('Book of Mormon');
  36 |     await page.keyboard.press('Enter');
  37 | 
  38 |     await page.getByLabel('Chapter').fill('1 Nephi 1');
  39 |     await page.getByLabel('Comment').fill('Learning about faith and obedience.');
  40 | 
  41 |     // Submit
  42 |     const submitBtn = page.getByRole('button', { name: 'Post Note' });
  43 |     await submitBtn.click();
  44 | 
  45 |     // Verify Success Toast
  46 |     await expect(page.getByText('Note posted successfully!')).toBeVisible();
  47 |     
  48 |     // Switch to My Notes view
  49 |     await page.getByRole('link', { name: 'My Notes' }).click();
  50 |     
  51 |     // Verify it appears in My Notes
  52 |     const noteCard = page.locator('.note-card').filter({ hasText: '1 Nephi 1' });
  53 |     await expect(noteCard).toBeVisible();
  54 |     await expect(noteCard).toContainText('Learning about faith and obedience.');
  55 | 
  56 |     // --- PART 2: EDIT NOTE ---
  57 |     // Click the note card to open detail modal
  58 |     await noteCard.click();
  59 | 
  60 |     // Click 'Edit' in the detail modal
  61 |     const editBtn = page.getByRole('button', { name: 'Edit' });
  62 |     await editBtn.click();
  63 | 
  64 |     // Modify the chapter and comment
  65 |     await page.getByLabel('Chapter').fill('1 Nephi 2');
  66 |     await page.getByLabel('Comment').fill('Updated: Faith follows obedience.');
  67 | 
  68 |     // Save update
  69 |     const updateBtn = page.getByRole('button', { name: 'Update Note' });
  70 |     await updateBtn.click();
  71 | 
  72 |     // Verify Success Toast
  73 |     await expect(page.getByText('Note updated successfully!')).toBeVisible();
  74 |     
  75 |     // Verify updated values in the list
  76 |     await expect(page.getByText('1 Nephi 2')).toBeVisible();
  77 |     await expect(page.getByText('Updated: Faith follows obedience.')).toBeVisible();
  78 |   });
  79 | });
  80 | 
```