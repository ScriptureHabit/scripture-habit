import { test, expect } from './fixtures/auth.fixture';

test.describe('Core Note Flow', () => {
  test('should allow a user to take and then edit a note', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const testId = Date.now().toString().slice(-6);
    const chapterName = `1 Nephi 1 (Test ${testId})`;
    const commentText = `Learning about faith and obedience. ID: ${testId}`;
    const updatedChapter = `1 Nephi 2 (Updated ${testId})`;
    const updatedComment = `Updated: Faith follows obedience. ID: ${testId}`;

    // --- PART 1: CREATE NOTE ---
    const newNoteBtn = page.getByTestId('new-note-button');
    await expect(newNoteBtn).toBeVisible();
    await newNoteBtn.click();

    // Fill the form
    await page.getByTestId('new-note-category').locator('input').first().click({ force: true });
    await page.keyboard.type('Book of Mormon');
    await page.keyboard.press('Enter');

    await page.getByTestId('new-note-chapter').fill(chapterName);
    await page.getByTestId('new-note-comment').fill(commentText);

    // Submit
    const submitBtn = page.getByTestId('post-note-button');
    await submitBtn.click();

    // Verify Success Toast and wait for modal to close
    await expect(page.getByText('Note posted successfully!')).toBeVisible();
    await expect(page.locator('.ModalOverlay')).not.toBeVisible();
    
    // Switch to My Notes view
    const myNotesLink = page.getByTestId('sidebar-notes');
    await myNotesLink.waitFor({ state: 'visible' });
    
    // In WebKit, sometimes the first click might not trigger correctly due to modal animations
    await myNotesLink.click({ force: true });
    
    // Ensure data is loaded
    await page.waitForLoadState('networkidle');

    // Fallback: if not visible after click, try again after a short delay
    const notesGrid = page.locator('.notes-grid');
    try {
      await notesGrid.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      console.log('Retrying My Notes click for WebKit...');
      await myNotesLink.click({ force: true });
      await page.waitForLoadState('networkidle');
    }

    await notesGrid.waitFor({ state: 'visible', timeout: 30000 });
    
    // Verify it appears in My Notes
    const noteCard = page.locator('.note-card').filter({ hasText: chapterName });
    await expect(noteCard).toBeVisible({ timeout: 20000 });
    await expect(noteCard).toContainText(commentText);

    // --- PART 2: EDIT NOTE ---
    // Click the note card to open detail modal
    await noteCard.click();

    // Click 'Edit' in the detail modal
    const editBtn = page.getByRole('button', { name: 'Edit' });
    await editBtn.click();

    // Modify the chapter and comment
    await page.getByTestId('new-note-chapter').fill(updatedChapter);
    await page.getByTestId('new-note-comment').fill(updatedComment);

    // Save update
    const updateBtn = page.getByTestId('update-note-button');
    await updateBtn.click();

    // Verify Success Toast
    const toastUpdate = page.getByText('Note updated successfully!');
    await expect(toastUpdate).toBeVisible({ timeout: 15000 });
    
    // Verify updated values in the list
    await expect(page.getByText(updatedChapter)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(updatedComment)).toBeVisible({ timeout: 15000 });
  });
});
