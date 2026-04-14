# Agent Instructions for Scripture Habit (Windows)

This project is running on **Windows**. All terminal commands MUST use Windows-specific syntax for `cmd.exe`.

## Command Mapping Rules
- **DO NOT** use `ls`. Use `dir`.
- **DO NOT** use `rm -rf`. Use `rmdir /s /q` for directories or `del` for files.
- **DO NOT** use `cp`. Use `copy` or `xcopy`.
- **DO NOT** use `mv`. Use `move`.
- **DO NOT** use `mkdir -p`. Use `mkdir`.
- **DO NOT** use `/` as path separators in terminal commands. Use `\`.
- **DO NOT** use `cat`. Use `type`.
- **DO NOT** use `touch`. Use `type nul > filename`.

## 🛠️ Technology Stack & Standards
- **Frontend**: React 19, Vite 7, TanStack Query 5, Zustand.
- **Styling**: Vanilla CSS (Modern CSS features, CSS Variables, Flex/Grid). Avoid Tailwind unless explicitly requested.
- **Backend**: Node.js + Express (hosted on Vercel).
- **Database**: Cloud Firestore.
- **State Management**: Prefer Zustand for UI state, TanStack Query for server state.

## 🏗️ Architectural Patterns
- **Logic-Component Split**: ALWAYS move business logic, API calls, and data syncing into custom hooks. Reach for `src/hooks/` for shared logic.
- **Service Layer**: Keep API controllers in `api/` thin. Encapsulate database transactions and business logic in `api_internal/services/`.
- **Type Safety**: Share interfaces between frontend and backend via the `types/` directory. Use Zod (via converters) to normalize Firestore data.

## 🧪 Testing & Reliability
- **E2E Testing**: Use Playwright for critical user flows. Tests reside in `playwright/`.
- **Local Testing**: Always use the Firebase Emulator for testing Auth and Firestore locally.
- **Error Handling**: Use React Error Boundaries and Sentry for monitoring.

## 🎨 UI/UX Guidelines
- **Premium Design**: Use vibrant colors, smooth transitions, and modern typography (Google Fonts).
- **Glassmorphism & Gradients**: Reach for these for a high-end feel.
- **Micro-animations**: Add subtle interactive feedback to all buttons and cards.

## 🛠️ Specialized Roles (Agentic Workflow)
- **QA/Test Agent**: Focus on `playwright/`, `vitest`, and `tsc --noEmit`.
- **Docs Maintainer**: Sync `docs/` with code; maintain `walkthrough.md`.
- **Security Auditor**: `npm audit` and vulnerability resolution.
- **Coding Architect**: Strict TypeScript rules, `no-any`, and component naming conventions.
