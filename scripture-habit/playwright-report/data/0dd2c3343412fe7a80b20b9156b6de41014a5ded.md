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
    21 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div class="leave-modal-overlay">…</div> intercepts pointer events
     - retrying click action
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
       - <div class="leave-modal-overlay">…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div class="leave-modal-overlay">…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - generic [ref=e6]: Scripture Habit
          - generic [ref=e7]:
            - generic [ref=e8] [cursor=pointer]:
              - img [ref=e9]
              - generic [ref=e11]: Dashboard
            - generic [ref=e12] [cursor=pointer]:
              - img [ref=e13]
              - generic [ref=e15]: My Notes
            - generic [ref=e16] [cursor=pointer]:
              - img [ref=e17]
              - generic [ref=e19]: Profile
            - generic [ref=e20]:
              - generic [ref=e21]:
                - text: My Groups
                - generic [ref=e22]: (0/4)
              - generic [ref=e23] [cursor=pointer]:
                - img [ref=e24]
                - generic [ref=e26]: Join/Create Group
            - generic [ref=e27] [cursor=pointer]:
              - img [ref=e28]
              - generic [ref=e30]: Development Story
        - generic [ref=e32]:
          - generic [ref=e34]:
            - heading "Scripture Habit" [level=2] [ref=e35]
            - paragraph [ref=e36]:
              - text: Welcome back,
              - strong [ref=e37]: E2E Tester
              - text: "!"
              - button "Edit Profile" [ref=e38] [cursor=pointer]:
                - img [ref=e39]
          - generic [ref=e41]:
            - generic [ref=e42]:
              - heading "Streak" [level=3] [ref=e43]
              - generic [ref=e44]:
                - generic [ref=e45]: "0"
                - generic [ref=e46]: days
            - generic [ref=e47]:
              - heading "Level" [level=3] [ref=e48]
              - generic [ref=e49]:
                - generic [ref=e50]: "1"
                - generic [ref=e51]: Lv
          - generic [ref=e53]:
            - generic [ref=e54] [cursor=pointer]:
              - img "Scripture Habit Mascot - Your guide to daily study" [ref=e56]
              - paragraph [ref=e58]: Have you read today? Let's study together!
            - generic [ref=e60]:
              - paragraph [ref=e61]: Would you like to study scriptures with everyone?
              - link "Join/Create a Group" [ref=e62] [cursor=pointer]:
                - /url: /group-options
                - button "Join/Create a Group" [ref=e63]
            - generic [ref=e64] [cursor=pointer]:
              - blockquote [ref=e65]: "\"Wherefore, he that preacheth and he that receiveth, understand one another, and both are edified and rejoice together.\""
              - paragraph [ref=e66]: — Jesus Christ (Doctrine and Covenants 50:22)
              - generic [ref=e68]: ...
          - generic [ref=e69]:
            - generic [ref=e71]:
              - heading "Today's 'Come, Follow Me'" [level=3] [ref=e72]
              - generic [ref=e73]:
                - paragraph [ref=e74]: 2026-04-13
                - link "Exodus 14:1-14" [ref=e76] [cursor=pointer]:
                  - /url: https://www.churchofjesuschrist.org/study/scriptures/ot/ex/14?lang=eng&id=p1-p14#p1
            - generic [ref=e77]:
              - paragraph [ref=e78]: Would you like to share what you learned today?
              - button "New Note" [ref=e79] [cursor=pointer]:
                - img [ref=e80]
                - text: New Note
      - generic [ref=e83]:
        - heading "Your Personal Habit Pace" [level=2] [ref=e84]
        - paragraph [ref=e85]: "To help you build a consistent habit, Scripture Habit has an auto-pause rule. If you don't post for a few days, you'll be automatically removed to keep things active. Choose your personal pace below:"
        - generic [ref=e86]:
          - button "3 days" [ref=e87] [cursor=pointer]
          - button "5 days" [ref=e88] [cursor=pointer]
          - button "7 days" [ref=e89] [cursor=pointer]
        - button "Next" [ref=e90] [cursor=pointer]
      - contentinfo [ref=e91]:
        - generic [ref=e92]:
          - generic [ref=e93]:
            - generic [ref=e94] [cursor=pointer]: Privacy Policy
            - generic [ref=e95]: •
            - generic [ref=e96] [cursor=pointer]: Terms of Service
            - generic [ref=e97]: •
            - generic [ref=e98] [cursor=pointer]: Legal Disclosure
          - generic [ref=e99]: © 2026 Scripture Habit
    - region "Notifications Alt+T"
    - generic [ref=e101]:
      - paragraph [ref=e102]:
        - text: We use cookies to improve your experience and analyze traffic. By continuing to use this site, you agree to our use of cookies.
        - link "Privacy Policy" [ref=e103] [cursor=pointer]:
          - /url: /privacy
      - button "Accept" [ref=e104] [cursor=pointer]
  - paragraph [ref=e105]: Running in emulator mode. Do not use with production credentials.
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