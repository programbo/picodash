import tailwindcss from '@tailwindcss/postcss'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@',
        replacement: new URL('./src', import.meta.url).pathname,
      },
      {
        find: /^tweaker\/advanced$/,
        replacement: new URL('../../packages/tweaker/src/advanced.ts', import.meta.url).pathname,
      },
      {
        find: /^tweaker\/ui$/,
        replacement: new URL('../../packages/tweaker/src/components/ui/index.ts', import.meta.url)
          .pathname,
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
})
