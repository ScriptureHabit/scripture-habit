# Testing Guide

This document outlines the testing strategies and patterns used in the Scripture Habit project to ensure reliability across the stack.

## 1. Firestore Security Rules
We use `@firebase/rules-unit-testing` to verify that our security rules correctly protect user data and enforce business logic.

- **Location**: `api_internal/rules.test.ts`
- **How to run** (Recommended):
  ```bash
  npm run test:internal
  ```
  *(Or execute manually targeting a single file)*:
  ```bash
  firebase emulators:exec --project scripture-habit-auth "npx vitest api_internal/rules.test.ts"
  ```
- **Key Patterns**:
  - Test both authorized and unauthorized access.
  - Verify list queries with appropriate filters (security rules often require matching filters).
  - Test nested collections and social features (Cheers/Reports).

## 2. Frontend Hook Testing
Critical business logic in hooks (like date-based resets or metadata fetching) is tested using Vitest and `@testing-library/react`.

- **Location**: `src/hooks/__tests__/*.test.ts`
- **How to run**:
  ```bash
  npm test
  ```
- **Key Patterns**:
  - Use `vi.useFakeTimers()` to test time-sensitive logic.
  - Mock external dependencies (like `safeStorage` or `fetch`) to isolate hook logic.
  - Verify state transitions and side effects.

## 3. API Integration Testing
Core API routes are tested against live Firebase Emulators to ensure authentication, validation, and database transactions work correctly.

- **Location**: `api_internal/*.integration.test.ts`
- **How to run** (Recommended for all internal tests):
  ```bash
  npm run test:internal
  ```
  *(Or execute manually targeting a single file)*:
  ```bash
  firebase emulators:exec --project scripture-habit-auth "npx vitest api_internal/groups.integration.test.ts"
  ```
- **Key Patterns**:
  - Mock `verifyIdToken` to simulate different user states.
  - Use the Admin SDK to setup initial state in Firestore.
  - Test error cases (400 for validation, 403 for permissions, 404 for missing resources).

## 4. AI Prompt Regression Testing
Since AI prompts are critical and easily broken by small changes, we use snapshot testing to verify the exact prompt text sent to Gemini.

- **Location**: `api_internal/ai_integration.test.ts`
- **How to run** (Recommended):
  ```bash
  npm run test:internal
  ```
  *(Or execute manually)*:
  ```bash
  firebase emulators:exec --project scripture-habit-auth "npx vitest api_internal/ai_integration.test.ts"
  ```
- **Key Patterns**:
  - Mock `axios.post` to intercept the prompt sent to the Gemini API.
  - Use `expect(prompt).toMatchSnapshot()` to detect unexpected changes in prompt templates.
  - Verify that dynamic content (scripture references, languages) is correctly injected.

## 5. E2E Testing (Playwright)
The project utilizes **Playwright** to execute robust, browser-level end-to-end (E2E) integration tests across essential client-server user journeys.

- **Location**: `tests/*.spec.ts`
- **How to run** (Local development with automated setup):
  ```bash
  npm run test:e2e
  ```
  *Note: This command runs the Vite dev server, Express backend, and the required Firebase Auth/Firestore emulator instances automatically using Playwright's `webServer` orchestra.*

### 5.1 Global Authentication Setup (`auth.setup.ts`)
To maximize test execution speed and avoid redundant auth forms, we implement Playwright **Global Setup** to capture and reuse browser cookies/storage:
1. **Tester Account Isolation**: The setup script launches Chromium and targets `shared-tester@example.com` (password: `password123`).
2. **Auto-heal / Sign-up Fallback**: It attempts a clean sign-in first. If the user doesn't exist (e.g., cold emulator memory), it navigates to `/en/signup`, registers the credentials, handles any dynamic Firebase Auth verification redirections, and forces navigation to the `/dashboard`.
3. **State Anonymization & Integrity Prep**: Once logged in, the browser context invokes dynamic fetch hooks to the backend `/api/test/leave-all-groups` endpoint, leaving all joined active groups and resetting the profile interface locale to English (`en`). This ensures every E2E spec starts from a clean, consistent slate.
4. **State Storage Export**: The final logged-in state is saved to `playwright/.auth/user.json`. Sub-test specs automatically read this local state to run as an authenticated user without repeating the signup flow.

### 5.2 Advanced E2E Debugging
E2E tests can be tricky to debug. Playwright provides built-in visual instruments:
* **Interactive UI Mode**: Launches a rich, visual desktop client to step through test code, inspect DOM snapshots, and review active network calls in real time:
  ```bash
  npx playwright test --ui
  ```
* **HTML Trace Viewer**: If a test fails in headless mode (or on CI), Playwright exports an HTML report with trace steps. Open the generated report using:
  ```bash
  npx playwright show-report
  ```

---

## 6. CI/CD Integration
All tests are integrated into `.github/workflows/ci.yml`. Any push or pull request triggers the full test suite (Lint ➔ Vitest ➔ API Integration ➔ Playwright E2E ➔ Vercel CD).

Ensure that `SKIP_APP_CHECK=true` is set in the test environment to bypass App Check during automated tests.
