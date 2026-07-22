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
              find: /^tweaker\/style\.css$/,
              replacement: new URL('../../packages/tweaker/src/styles.css', import.meta.url)
                .pathname,
            },
            {
              find: /^tweaker\/ui$/,
              replacement: new URL('../../packages/tweaker/src/ui.ts', import.meta.url).pathname,
            },
          ]
        : []),
      {
        find: /^tweaker\/advanced$/,
        replacement: new URL('../../packages/tweaker/src/advanced.ts', import.meta.url).pathname,
      },
      {
        find: /^tweaker$/,
        replacement: new URL('../../packages/tweaker/src/index.ts', import.meta.url).pathname,
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
        dependsOn: ['tweaker#build'],
      },
    },
  },
}))
