import { defineConfig } from 'vite-plus'

const workspaceCwd = process.cwd().replaceAll('\\', '/')
const tailwindEntryPoints = workspaceCwd.endsWith('/packages/panel')
  ? [{ files: '**', use: 'src/styles.css' }]
  : workspaceCwd.endsWith('/apps/web')
    ? [{ files: '**', use: 'src/style.css' }]
    : workspaceCwd.endsWith('/apps/lab')
      ? [{ files: '**', use: '../web/src/style.css' }]
      : [
          { files: 'packages/panel/**', use: 'packages/panel/src/styles.css' },
          { files: 'apps/web/**', use: 'apps/web/src/style.css' },
          { files: '**', use: 'apps/web/src/style.css' },
        ]

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    ignorePatterns: ['apps/web/next-env.d.ts', 'apps/lab/next-env.d.ts'],
    singleQuote: true,
    semi: false,
    sortTailwindcss: {
      functions: ['clsx', 'cn', 'wtMerge'],
    },
  },
  lint: {
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
