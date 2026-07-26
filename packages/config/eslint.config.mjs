import js from '@eslint/js'
import globals from 'globals'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Framework-agnostic base. Next.js rules live in apps/web/eslint.config.mjs so
 * that non-Next packages are not told to go looking for a `pages` directory.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  {
    // Build scripts and config files: plain ESM running under Node, so they get
    // Node globals but none of the TypeScript tooling.
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // TypeScript's compiler already reports undefined identifiers, and it
      // understands the ambient DOM/Node types ESLint cannot see. Leaving
      // no-undef on produced 133 false positives here — `process`, `URL`,
      // `localStorage`, `React`, every DOM interface. Turning it off for TS is
      // the typescript-eslint project's own recommendation.
      'no-undef': 'off',

      // `_`-prefixed names are deliberate discards, including the destructuring
      // omit idiom (`const { a: _omitted, ...rest } = obj`).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Vitest injects these; the suites run with `globals: true`.
    files: ['**/*.{test,spec}.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
]
