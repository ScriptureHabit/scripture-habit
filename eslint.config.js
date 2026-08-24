import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'android', 'backend', 'api', 'public', 'playwright-report', 'test-results', 'scratch', 'docs/.vitepress/dist', 'docs/.vitepress/cache', 'docs/public'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-empty': 'warn',
      // TODO (Roadmap): Upgrade severity to 'error' once all historical transactions 
      // (in groups.ts, message-service.ts, note-service.ts etc.) are fully migrated to runPhasedTransaction.
      // Note: auth.ts and archive-service.ts have been successfully migrated.
      'no-restricted-properties': [
        'warn',
        {
          property: 'runTransaction',
          message: 'Use runPhasedTransaction from api_internal/lib/phased-transaction instead of db.runTransaction to enforce Read-before-Write ordering.'
        }
      ],
    },
  },
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*-test-helpers.ts',
      '**/__mocks__/**/*.ts',
      '**/__mocks__/**/*.tsx'
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-properties': 'off', // Allow raw transaction setups in test modules
    },
  },
  {
    files: ['src/components/**/*.tsx', 'src/components/**/*.ts'],
    ignores: [
      'src/components/**/__tests__/**/*',
      'src/components/**/hooks/**/*',
      // Historical Firebase components debt (to be refactored gradually)
      'src/components/button/delete-group-button.tsx',
      'src/components/dashboard/components/quest-card.tsx',
      'src/components/forgotpassword/forgot-password.tsx',
      'src/components/mynotes/note-detail-modal.tsx',
      'src/components/profile/profile.tsx',
      'src/components/sidebar/sidebar.tsx'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'firebase/auth',
              message: 'Do not import Firebase directly in UI components. Encapsulate data access and auth checking inside custom hooks instead.'
            },
            {
              name: 'firebase/firestore',
              message: 'Do not import Firebase directly in UI components. Encapsulate data access and auth checking inside custom hooks instead.'
            },
            {
              name: 'firebase/storage',
              message: 'Do not import Firebase directly in UI components. Encapsulate data access and auth checking inside custom hooks instead.'
            },
            {
              name: 'firebase/app-check',
              message: 'Do not import Firebase directly in UI components. Encapsulate data access and auth checking inside custom hooks instead.'
            }
          ]
        }
      ]
    }
  }
)
