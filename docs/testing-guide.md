# Testing Guide

This document explains the testing strategies and patterns used in the scripture-habit project to ensure application reliability.

---

## 1. Firestore Security Rules
We use `@firebase/rules-unit-testing` to verify that our security rules protect user data and enforce business logic.

- **Location**: `api_internal/rules.test.ts`
- **How to run** (Recommended):
  ```bash
  npm run test:internal
  ```
  *(Or run manually for a single file)*:
  ```bash
  firebase emulators:exec --project scripture-habit-auth "npx vitest api_internal/rules.test.ts"
  ```
- **Key Patterns**:
  - Test both authorized and unauthorized access.
  - Verify list queries with appropriate filters (rules often require specific filters).
  - Test nested collections and social features (Cheers and Reports).

---

## 2. Frontend Hook Testing
Core hook logic (such as date-based resets or metadata fetching) is tested using Vitest and `@testing-library/react`.

- **Location**: `src/hooks/__tests__/*.test.ts`
- **How to run**:
  ```bash
  npm test
  ```
- **Key Patterns**:
  - Use `vi.useFakeTimers()` to test time-sensitive logic.
  - Mock external dependencies (like `safeStorage` or `fetch`) to isolate hook logic.
  - Verify state transitions and side effects.

---

## 3. API Integration Testing
API routes are tested against live Firebase Emulators to ensure authentication, validation, and database transactions work correctly.

- **Location**: `api_internal/*.integration.test.ts`
- **How to run** (Recommended for all internal tests):
  ```bash
  npm run test:internal
  ```
  *(Or run manually for a single file)*:
  ```bash
  firebase emulators:exec --project scripture-habit-auth "npx vitest api_internal/groups.integration.test.ts"
  ```
- **Key Patterns**:
  - Mock `verifyIdToken` to simulate different user states.
  - Use the Admin SDK to set up initial state in Firestore.
  - Test error cases (400 for validation, 403 for permissions, 404 for missing resources).

---

## 4. AI Prompt Regression Testing
We use snapshot testing to verify the exact prompt text sent to Gemini.

- **Location**: `api_internal/ai_integration.test.ts`
- **How to run** (Recommended):
  ```bash
  npm run test:internal
  ```
  *(Or run manually)*:
  ```bash
  firebase emulators:exec --project scripture-habit-auth "npx vitest api_internal/ai_integration.test.ts"
  ```
- **Key Patterns**:
  - Mock `axios.post` to intercept the prompt sent to the Gemini API.
  - Use `expect(prompt).toMatchSnapshot()` to detect unexpected changes in prompt templates.
  - Verify that dynamic content (scripture references, languages) is correctly injected.

---

## 5. E2E Testing (Playwright)
The project uses **Playwright** to run end-to-end (E2E) tests for core user workflows.

- **Location**: `tests/*.spec.ts`
- **How to run**:
  ```bash
  npm run test:e2e
  ```
  *Note: This command automatically starts the Vite dev server, Express backend, and Firebase emulators using Playwright's `webServer` configuration.*

### 5.1 Global Authentication Setup (`auth.setup.ts`)
To speed up tests and avoid signing in repeatedly, we use Playwright **Global Setup** to save and reuse session state:
1. **Tester Account Setup**: The setup script launches Chromium and targets `shared-tester@example.com` (password: `password123`).
2. **Auto-signup Fallback**: The script attempts to sign in. If the user does not exist in the emulator, it creates a new account via `/en/signup` and navigates to the `/dashboard`.
3. **State Cleanup**: After signing in, the script calls `/api/test/leave-all-groups` to leave any active groups and resets the language to English (`en`). This ensures every test starts with a clean account state.
4. **Session Export**: The authenticated state is saved to `playwright/.auth/user.json`. Other tests use this file to start in a logged-in state, skipping the sign-in step.

### 5.2 Advanced E2E Debugging
To debug E2E tests, you can use Playwright's built-in tools:
* **Interactive UI Mode**: Opens a visual interface to step through tests, inspect the DOM, and view network activity:
  ```bash
  npx playwright test --ui
  ```
* **HTML Trace Viewer**: If a test fails on CI, Playwright generates a trace report. You can open it using:
  ```bash
  npx playwright show-report
  ```

---

## 6. CI/CD Integration
All tests run automatically on GitHub Actions via `.github/workflows/ci.yml` on every push and pull request (Lint, Vitest, API Integration, and Playwright E2E).

Ensure that `SKIP_APP_CHECK=true` is set in the test environment to bypass App Check during automated tests.

---

## 7. Firestore Read Count Regression Testing

To mathematically enforce optimal Firestore read counts and lock optimization states forever, we run dedicated read count assertions.

- **Location**: `api_internal/firestore-read-count.integration.test.ts`
- **How to run**:
  ```bash
  npm run test:internal -- firestore-read-count.integration.test.ts
  ```
- **Key Patterns**:
  - Uses Vitest spies to verify transaction and document reference read counts.
  - Mathematically asserts exact expected reads (e.g. 0 re-reads inside transaction loops).
  - Complemented by an automatic, transparent read budget tracker inside [TestSetup](final-project/scripture-habit/api_internal/test-setup.ts) that reports a collection-level breakdown of reads for every emulated test suite.

