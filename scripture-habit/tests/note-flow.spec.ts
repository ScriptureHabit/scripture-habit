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
  // 6. Navigate to My Notes and verify it appears
  console.log('Navigating to My Notes...');
  const sidebarNotes = page.getByTestId('sidebar-notes');
  await sidebarNotes.waitFor({ state: 'visible' });
  await sidebarNotes.click();

  // Wait for the My Notes view to mount (grid, skeleton, or even empty state)
  // We wait for the note card specifically which is our "success" condition
  const noteCard = page.getByTestId('note-card').filter({ hasText: chapterName });
  
  try {
    // WebKit often needs a moment or a retry for the sidebar click to register 
    // if a modal was just closed (animations).
    await expect(noteCard).toBeVisible({ timeout: 15000 });
  } catch {
    console.log('Note card not found, verifying navigation and retrying click...');
    const myNotesTitle = page.locator('h1', { hasText: 'Scripture Habit' });
    const isMyNotes = await myNotesTitle.isVisible();
    if (!isMyNotes) {
      await sidebarNotes.click({ force: true });
    }
    // Final wait for the note card
    await expect(noteCard).toBeVisible({ timeout: 30000 });
  }

  await expect(noteCard).toContainText(commentText);

  // --- PART 2: EDIT NOTE ---
  // Click the note card to open detail modal
  console.log('Opening note detail...');
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
