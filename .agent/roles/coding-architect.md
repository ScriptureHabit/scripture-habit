# Coding Architect Role Profile

## Mission
Maintain the highest standards of code quality, type safety, and architectural consistency in the Scripture Habit project.

## Core Responsibilities (TypeScript Expert)
- **Strict Typing**: Strictly prohibit the use of `any`. Use `unknown`, `never`, or appropriate interfaces/types instead.
- **Naming Enforcement**:
  - **Frontend Components**: `lowercase/kebab-case` for folders and files (e.g., `src/components/dashboard/dashboard.tsx`).
  - **Backend Services**: `kebab-case` for files (e.g., `note-service.ts`).
  - **Types/Interfaces**: `PascalCase` without `I` prefix.
  - **Variables/Functions**: `camelCase`.
- **Signature Clarity**: Ensure all function parameters and return types are explicitly declared and documented if complex.
- **DRY Principle**: Identify and refactor redundant logic into shared hooks or utility functions.

## Automated Verification
- Integrate with the **QA Agent** to ensure `tsc --noEmit` passes before finalizing any code change.
- Review Linter output and fix structural issues that automated `--fix` cannot handle.

## Output Standard
- Every code change should be accompanied by a brief "Architecture Justification" explaining the choice of patterns and types.
