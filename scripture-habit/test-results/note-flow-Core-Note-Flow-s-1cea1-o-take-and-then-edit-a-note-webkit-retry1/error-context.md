# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: note-flow.spec.ts >> Core Note Flow >> should allow a user to take and then edit a note
- Location: tests\note-flow.spec.ts:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.note-card').filter({ hasText: '1 Nephi 1' })
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 20000ms
  - waiting for locator('.note-card').filter({ hasText: '1 Nephi 1' })

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
            - heading "Scripture Habit" [level=1] [ref=e35]
            - paragraph [ref=e36]: Note Collection
          - generic [ref=e37] [cursor=pointer]:
            - generic [ref=e38]:
              - img "Scripture Habit Mascot - Your guide to daily study" [ref=e39]
              - generic [ref=e40]: ✨
            - paragraph [ref=e42]: Let's reflect on your learning this week!
          - generic [ref=e45]:
            - button "✨ Generate Weekly Recap" [disabled] [ref=e47]:
              - generic [ref=e48]:
                - img [ref=e49]
                - generic [ref=e51]: ✨ Generate Weekly Recap
            - generic [ref=e53] [cursor=pointer]:
              - img [ref=e55]
              - generic [ref=e57]: Letter Box
          - generic [ref=e58]:
            - generic [ref=e59]:
              - img [ref=e60]
              - textbox "Search notes..." [ref=e62]
            - generic [ref=e63]:
              - button "See All" [ref=e64] [cursor=pointer]
              - button "Old Testament" [ref=e65] [cursor=pointer]
              - button "New Testament" [ref=e66] [cursor=pointer]
              - button "Book of Mormon" [ref=e67] [cursor=pointer]
              - button "Doctrine and Covenants" [ref=e68] [cursor=pointer]
              - button "Pearl of Great Price" [ref=e69] [cursor=pointer]
              - button "Ordinances and Proclamations" [ref=e70] [cursor=pointer]
              - button "General Conference" [ref=e71] [cursor=pointer]
              - button "BYU Speeches" [ref=e72] [cursor=pointer]
              - button "Other" [ref=e73] [cursor=pointer]
      - contentinfo [ref=e105]:
        - generic [ref=e106]:
          - generic [ref=e107]:
            - generic [ref=e108] [cursor=pointer]: Privacy Policy
            - generic [ref=e109]: •
            - generic [ref=e110] [cursor=pointer]: Terms of Service
            - generic [ref=e111]: •
            - generic [ref=e112] [cursor=pointer]: Legal Disclosure
          - generic [ref=e113]: © 2026 Scripture Habit
    - region "Notifications Alt+T"
  - paragraph [ref=e114]: Running in emulator mode. Do not use with production credentials.
  - iframe [ref=e115]:
    
```

# Test source

```ts
  1  | import { test, expect } from './fixtures/auth.fixture';
  2  | 
  3  | test.describe('Core Note Flow', () => {
  4  |   test('should allow a user to take and then edit a note', async ({ authenticatedPage }) => {
  5  |     const page = authenticatedPage; // Assign to page to reuse existing commands
  6  |     // --- PART 1: CREATE NOTE ---
  7  |     const newNoteBtn = page.getByRole('button', { name: 'New Note' });
  8  |     await expect(newNoteBtn).toBeVisible();
  9  |     await newNoteBtn.click();
  10 | 
  11 |     // Fill the form
  12 |     // Using force: true because react-select's input container often intercepts clicks on the placeholder
  13 |     await page.getByText('Please choose a category option').click({ force: true });
  14 |     await page.keyboard.type('Book of Mormon');
  15 |     await page.keyboard.press('Enter');
  16 | 
  17 |     await page.getByLabel('Chapter').fill('1 Nephi 1');
  18 |     await page.getByLabel('Comment').fill('Learning about faith and obedience.');
  19 | 
  20 |     // Submit
  21 |     const submitBtn = page.getByRole('button', { name: 'Post Note' });
  22 |     await submitBtn.click();
  23 | 
  24 |     // Verify Success Toast and wait for modal to close
  25 |     await expect(page.getByText('Note posted successfully!')).toBeVisible();
  26 |     await expect(page.locator('.ModalOverlay')).not.toBeVisible();
  27 |     
  28 |     // Switch to My Notes view
  29 |     await page.getByText('My Notes').click();
  30 |     
  31 |     // Verify it appears in My Notes
  32 |     const noteCard = page.locator('.note-card').filter({ hasText: '1 Nephi 1' });
> 33 |     await expect(noteCard).toBeVisible();
     |                            ^ Error: expect(locator).toBeVisible() failed
  34 |     await expect(noteCard).toContainText('Learning about faith and obedience.');
  35 | 
  36 |     // --- PART 2: EDIT NOTE ---
  37 |     // Click the note card to open detail modal
  38 |     await noteCard.click();
  39 | 
  40 |     // Click 'Edit' in the detail modal
  41 |     const editBtn = page.getByRole('button', { name: 'Edit' });
  42 |     await editBtn.click();
  43 | 
  44 |     // Modify the chapter and comment
  45 |     await page.getByLabel('Chapter').fill('1 Nephi 2');
  46 |     await page.getByLabel('Comment').fill('Updated: Faith follows obedience.');
  47 | 
  48 |     // Save update
  49 |     const updateBtn = page.getByRole('button', { name: 'Update Note' });
  50 |     await updateBtn.click();
  51 | 
  52 |     // Verify Success Toast
  53 |     const toast = page.getByText('Note updated successfully!');
  54 |     await toast.waitFor({ state: 'visible', timeout: 15000 });
  55 |     await expect(toast).toBeVisible();
  56 |     
  57 |     // Verify updated values in the list
  58 |     await expect(page.getByText('1 Nephi 2')).toBeVisible();
  59 |     await expect(page.getByText('Updated: Faith follows obedience.')).toBeVisible();
  60 |   });
  61 | });
  62 | 
```