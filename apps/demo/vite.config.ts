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
        find: /^panel\/advanced$/,
        replacement: new URL('../../packages/panel/src/advanced.ts', import.meta.url).pathname,
      },
      {
        find: /^panel$/,
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
})
