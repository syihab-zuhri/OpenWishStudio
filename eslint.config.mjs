import base from './packages/config/eslint.config.mjs'
import nextPlugin from '@next/eslint-plugin-next'

/**
 * Single config for the whole workspace, at the root on purpose.
 *
 * ESLint 9 walks up from the current directory to find its config, so this one
 * file serves `eslint .` run from the root (lint-staged does this, passing
 * absolute paths) and from inside any package. Per-package config files would
 * be invisible to a root-level run, which is exactly how the pre-commit hook
 * broke.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export default [
  ...base,
  {
    // Keep the plugin declaration global. Next's build-time detector resolves
    // the config file itself (not an app source file) under ESLint 9.
    plugins: { '@next/next': nextPlugin },
  },
  {
    // Next.js rules only apply to the Next app; other packages have no `pages`
    // or `app` directory for them to reason about.
    files: ['apps/web/**/*.{ts,tsx}'],
    settings: {
      // Without this the rule probes <repo-root>/pages and warns on every run,
      // because the Next app lives one level down in a workspace.
      next: { rootDir: 'apps/web' },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
]
