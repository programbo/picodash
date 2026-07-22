import tailwindcss from '@tailwindcss/postcss'
import { defineConfig } from 'vite-plus'

export default defineConfig(({ command }) => ({
  resolve: {
    alias: [
      {
        find: '@',
        replacement: new URL('./src', import.meta.url).pathname,
      },
      ...(command === 'serve'
        ? [
            {
              find: /^@picodash\/panel\/style\.css$/,
              replacement: new URL('../../packages/panel/src/styles.css', import.meta.url).pathname,
            },
            {
              find: /^@picodash\/panel\/ui$/,
              replacement: new URL('../../packages/panel/src/ui.ts', import.meta.url).pathname,
            },
          ]
        : []),
      {
        find: /^@picodash\/panel\/advanced$/,
        replacement: new URL('../../packages/panel/src/advanced.ts', import.meta.url).pathname,
      },
      {
        find: /^@picodash\/panel$/,
        replacement: new URL('../../packages/panel/src/index.ts', import.meta.url).pathname,
      },
    ],
    dedupe: ['react', 'react-dom'],
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  run: {
    tasks: {
      'build-package-consumer': {
        cache: false,
        command: 'tsc -p tsconfig.build.json && vp build',
        dependsOn: ['@picodash/panel#build'],
      },
    },
  },
}))
