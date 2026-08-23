## Description
*Provide a concise summary of the changes introduced by this Pull Request. Include relevant background context, architectural rationale, and goals.*

## Related Issues
- Fixes # (issue number)
- Closes # (issue number)

## Proposed Changes
*Briefly list the file modifications and new modules:*
- **Frontend**: e.g., Updated note sharing styles
- **Backend / API**: e.g., Refactored cron route early returns
- **Database / Schema**: e.g., Added hasFcmToken validator rule

## Contribution Checklist
- [ ] My code follows the project's coding standards and style guidelines.
- [ ] I have verified all modifications compile cleanly without warnings.
- [ ] I have written unit/integration tests covering the new logic (or adjusted existing tests).
- [ ] All existing and new automated tests passed successfully (`npm run test` / `npm run test:internal`).
- [ ] I have verified the changes locally using the Firebase Emulator suite and the seeder script.
- [ ] I have updated corresponding documentation in `docs/` and `docs/ja/` (if applicable).

## How to Test
*Detail the precise steps required to verify your contribution:*
1. Start the local emulator: `npx firebase emulators:start`
2. Seed the sandbox: `npm run db:seed`
3. Run internal API integrations: `npm run test:internal`
4. Confirm expected behavior: *Describe the specific behavior to watch for.*

## Screenshots / Visual Demos
*If your change impacts the user interface, please attach screenshots, recordings, or visual walk-throughs below:*

---
*Thank you for contributing to Scripture Habit!*
