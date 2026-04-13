# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: note-flow.spec.ts >> Core Note Flow >> should allow a user to take and then edit a note
- Location: tests\note-flow.spec.ts:27:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'New Note' })
    - locator resolved to <button class="new-note-btn cta-btn">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="leave-modal-overlay">…</div> intercepts pointer events
  - retrying click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="cookie-consent-banner">…</div> intercepts pointer events
  - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="leave-modal-overlay">…</div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="leave-modal-overlay">…</div> intercepts pointer events
  8 × retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="cookie-consent-banner">…</div> intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="notif-modal-overlay">…</div> intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="notif-modal-overlay">…</div> intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="notif-modal-overlay">…</div> intercepts pointer events
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="cookie-consent-banner">…</div> intercepts pointer events
  2 × retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="notif-modal-overlay">…</div> intercepts pointer events
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
  - element was detached from the DOM, retrying

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]: 🙏
    - heading "Something went wrong" [level=1] [ref=e5]
    - paragraph [ref=e6]: We apologize for the inconvenience. A report has been sent to our team, and we are working to fix this.
    - button "Reload Application" [ref=e7] [cursor=pointer]
    - generic [ref=e8]: "ReferenceError: Can't find variable: user"
  - paragraph [ref=e9]: Running in emulator mode. Do not use with production credentials.
  - iframe [ref=e10]:
    
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
  24 |     await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });
  25 |   });
  26 | 
  27 |   test('should allow a user to take and then edit a note', async ({ page }) => {
  28 |     // --- PART 1: CREATE NOTE ---
  29 |     const newNoteBtn = page.getByRole('button', { name: 'New Note' });
  30 |     await expect(newNoteBtn).toBeVisible();
> 31 |     await newNoteBtn.click();
     |                      ^ Error: locator.click: Test timeout of 60000ms exceeded.
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