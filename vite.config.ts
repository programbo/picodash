import { defineConfig } from 'vite-plus'
import { reactTestConfig } from './test/config.ts'

const workspaceCwd = process.cwd().replaceAll('\\', '/')
const tailwindEntryPoints = workspaceCwd.endsWith('/packages/ui')
  ? [{ files: '**', use: 'style.css' }]
  : workspaceCwd.endsWith('/packages/dashpanel')
    ? [{ files: '**', use: 'style.css' }]
    : workspaceCwd.endsWith('/packages/dashlist')
      ? [{ files: '**', use: 'src/style.css' }]
      : workspaceCwd.endsWith('/apps/web')
        ? [{ files: '**', use: 'src/style.css' }]
        : workspaceCwd.endsWith('/apps/lab')
          ? [{ files: '**', use: 'src/style.css' }]
          : [
              { files: 'packages/dashpanel/**', use: 'packages/dashpanel/style.css' },
              { files: 'packages/dashlist/**', use: 'packages/dashlist/src/style.css' },
              { files: 'packages/picodash/**', use: 'packages/picodash/style.css' },
              { files: 'apps/web/**', use: 'apps/web/src/style.css' },
              { files: '**', use: 'apps/web/src/style.css' },
            ]

export default defineConfig({
  test: reactTestConfig,
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    ignorePatterns: ['apps/web/next-env.d.ts', 'apps/lab/next-env.d.ts', '**/test-results/**'],
    singleQuote: true,
    semi: false,
    sortTailwindcss: {
      functions: ['clsx', 'cn', 'wtMerge'],
    },
  },
  lint: {
    ignorePatterns: ['evaluations/**'],
    jsPlugins: [
      { name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' },
      { name: 'tailwindcss', specifier: 'oxlint-tailwindcss' },
    ],
    settings: {
      tailwindcss: {
        entryPoint: tailwindEntryPoints,
      },
    },
    rules: {
      'tailwindcss/enforce-canonical': 'warn',
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
})
