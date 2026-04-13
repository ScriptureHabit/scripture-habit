import { test, expect } from './fixtures/auth.fixture';

test.describe('Core Note Flow', () => {
  test('should allow a user to take and then edit a note', async ({ authenticatedPage }) => {
    const page = authenticatedPage; // Assign to page to reuse existing commands
    // --- PART 1: CREATE NOTE ---
    const newNoteBtn = page.getByRole('button', { name: 'New Note' });
    await expect(newNoteBtn).toBeVisible();
    await newNoteBtn.click();

    // Fill the form
    await page.getByText('Please choose a category option').click();
    await page.keyboard.type('Book of Mormon');
    await page.keyboard.press('Enter');

    await page.getByLabel('Chapter').fill('1 Nephi 1');
    await page.getByLabel('Comment').fill('Learning about faith and obedience.');

    // Submit
    const submitBtn = page.getByRole('button', { name: 'Post Note' });
    await submitBtn.click();

    // Verify Success Toast
    await expect(page.getByText('Note posted successfully!')).toBeVisible();
    
    // Switch to My Notes view
    await page.getByRole('link', { name: 'My Notes' }).click();
    
    // Verify it appears in My Notes
    const noteCard = page.locator('.note-card').filter({ hasText: '1 Nephi 1' });
    await expect(noteCard).toBeVisible();
    await expect(noteCard).toContainText('Learning about faith and obedience.');

    // --- PART 2: EDIT NOTE ---
    // Click the note card to open detail modal
    await noteCard.click();

    // Click 'Edit' in the detail modal
    const editBtn = page.getByRole('button', { name: 'Edit' });
    await editBtn.click();

    // Modify the chapter and comment
    await page.getByLabel('Chapter').fill('1 Nephi 2');
    await page.getByLabel('Comment').fill('Updated: Faith follows obedience.');

    // Save update
    const updateBtn = page.getByRole('button', { name: 'Update Note' });
    await updateBtn.click();

    // Verify Success Toast
    await expect(page.getByText('Note updated successfully!')).toBeVisible();
    
    // Verify updated values in the list
    await expect(page.getByText('1 Nephi 2')).toBeVisible();
    await expect(page.getByText('Updated: Faith follows obedience.')).toBeVisible();
  });
});
