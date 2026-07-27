import base from '../../packages/config/eslint.config.mjs'
import nextPlugin from '@next/eslint-plugin-next'

export default [
  ...base,
  {
    plugins: { '@next/next': nextPlugin },
  },
  {
    files: ['**/*.{ts,tsx}'],
    settings: { next: { rootDir: '.' } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
]
