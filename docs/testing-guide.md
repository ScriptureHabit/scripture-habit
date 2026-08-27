# Testing Guide

This document outlines unit, integration, and end-to-end testing strategies used to verify functionality in Scripture Habit.

---

## 1. Firestore Security Rules Testing

Uses `@firebase/rules-unit-testing` to verify database access controls and authorization logic.

- **Location**: `api_internal/rules.test.ts`
- **Command**:
  ```bash
  npm run test:rules
  ```

---

## 2. Frontend Hook Unit Testing

Validates custom React hook behaviors (time resets, caching) using Vitest and `@testing-library/react`.

- **Location**: `src/hooks/__tests__/*.test.ts`
- **Command**:
  ```bash
  npm test
  ```

---

## 3. Backend API Integration Testing

Executes Express route handlers against live local Firebase Emulators to verify validation, auth tokens, and transactions.

- **Location**: `api_internal/*.integration.test.ts`
- **Command**:
  ```bash
  npm run test:internal
  ```

---

## 4. AI Prompt Snapshot Testing

Detects accidental regressions in prompt templates sent to Gemini via snapshot assertions.

- **Location**: `api_internal/ai_integration.test.ts`
- **Command**:
  ```bash
  npm run test:internal
  ```

---

## 5. End-to-End Testing (Playwright)

Simulates complete user flows (signup, note submission, group messaging) across real browser environments.

- **Location**: `tests/*.spec.ts`
- **Command**:
  ```bash
  npm run test:e2e
  ```
  *(Spins up Vite, Express, and Firebase emulators automatically)*

- **Interactive Debug UI**:
  ```bash
  npx playwright test --ui
  ```

---

## 6. Firestore Read Count Assertions

Verifies per-operation document read counts to prevent N+1 query regressions and control database costs.

- **Location**: `api_internal/firestore-read-count.integration.test.ts`
- **Command**:
  ```bash
  npm run test:internal -- firestore-read-count.integration.test.ts
  ```

---

## 7. Related Documentation

- [Development & Setup Guide](./development-guide.md)
- [CI/CD & Maintenance Automation](./cicd-maintenance-automation.md)
- [Troubleshooting & FAQ](./troubleshooting.md)
