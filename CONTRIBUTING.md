# Contributing to Scripture Habit

Thank you for your interest in contributing to Scripture Habit. We welcome contributions from developers, designers, translators, and users of all experience levels.

---

## Ways to Contribute

1. **Reporting Bugs**: Open an issue using the Bug Report template, describing the problem, reproduction steps, and environment.
2. **Suggesting Enhancements**: Open an issue describing the feature, its motivation, and proposed user experience.
3. **Improving Translations**: Review existing translations for natural phrasing, or add new language files in `scripture-habit/src/locales/`.
4. **Improving Documentation**: Fix typos, add explanations, or improve developer guides in the `docs/` folder.
5. **Writing Code**: Pick up an existing issue (especially issues labeled `good first issue`) or propose a pull request for a bug fix or feature.

---

## Development Setup

### Prerequisites

- **Node.js**: 24.x or higher
- **npm**: 10.x or higher
- **Git**

### Getting Started

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/<your-username>/scripture-habit.git
   cd scripture-habit
   ```

2. **Navigate to the application folder and install dependencies**:
   ```bash
   cd scripture-habit
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

---

## Testing & Quality Checks

Before submitting changes, ensure all tests and type checks pass:

```bash
# Run unit tests (Vitest)
npm test

# Run all verification checks (i18n check, message types, FCM usage, and TypeScript compiler)
npm run check:all

# Run linter
npm run lint

# Build production bundle to verify types and assets
npm run build
```

---

## Making Changes

### Branch Naming

Create a feature branch from `main` using descriptive names:
- `feat/feature-name` (new features)
- `fix/bug-description` (bug fixes)
- `docs/update-guide` (documentation updates)
- `i18n/language-name` (translations)

### Commit Conventions

We follow Conventional Commits:
- `feat: add spanish audio playback support`
- `fix: correct streak reset calculation for utc offsets`
- `docs: update setup instructions in README`
- `chore: update dependency versions`

### Pull Request Process

1. Push your branch to your GitHub fork.
2. Open a Pull Request against the `main` branch of the upstream repository.
3. Fill out the Pull Request template detailing what was changed, why, and how to verify.
4. Ensure all automated GitHub Actions CI checks pass.
5. A maintainer will review your pull request and provide feedback.

---

## Adding or Updating Translations

Translations are located under `scripture-habit/src/locales/`:
- `en.ts` (Master translation file)
- `es.ts`, `ja.ts`, `ko.ts`, `pt.ts`, `sw.ts`, `th.ts`, `tl.ts`, `vi.ts`, `zho.ts`
- Book name translations: `scripture-habit/src/locales/books/`

When adding or updating translations:
1. Ensure all keys present in `en.ts` exist in the target language file.
2. Run `npm run check:i18n` to verify full translation key coverage.

---

## Code of Conduct

Please note that this project is released with a [Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project, you agree to abide by its terms.
