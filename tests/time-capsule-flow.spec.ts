import { test, expect } from './fixtures/auth.fixture';

test.describe('Time Capsule (Letter to Future Self) Flow', () => {
  test('should allow a user to write, validate, and seal a Day 10 time capsule letter', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // 1. Verify Unwritten Time Capsule Card is visible on Dashboard
    const unwrittenCard = page.getByTestId('time-capsule-unwritten-card');
    await expect(unwrittenCard).toBeVisible({ timeout: 30000 });

    // 2. Open Time Capsule Modal
    const writeBtn = page.getByTestId('write-capsule-card-btn');
    await expect(writeBtn).toBeVisible();
    await writeBtn.click();

    // 3. Verify Modal Opened and Social Proof Badge is visible
    const modalOverlay = page.getByTestId('time-capsule-modal-overlay');
    await expect(modalOverlay).toBeVisible({ timeout: 15000 });

    const socialProofBadge = page.getByTestId('time-capsule-social-proof');
    await expect(socialProofBadge).toBeVisible();

    const letterInput = page.getByTestId('time-capsule-letter-input');
    const sosInput = page.getByTestId('time-capsule-sos-input');
    const sealBtn = page.getByTestId('seal-time-capsule-btn');

    // 4. Boundary Validation Check: Initially disabled
    await expect(sealBtn).toBeDisabled();

    // 5. Fill valid letter and SOS content
    await letterInput.fill('Congratulations on reaching Day 10! Keep studying scripture every day!');
    await sosInput.fill('Remember your goals and why you started!');

    // 6. Verify Seal Button is enabled and submit
    await expect(sealBtn).toBeEnabled();
    await sealBtn.click();

    // 7. Verify Modal Closes and Sealed Card is displayed on Dashboard
    await expect(modalOverlay).not.toBeVisible({ timeout: 20000 });

    const sealedCard = page.getByTestId('time-capsule-sealed-card');
    await expect(sealedCard).toBeVisible({ timeout: 20000 });
  });
});
