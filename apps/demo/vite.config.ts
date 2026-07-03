import tailwindcss from '@tailwindcss/postcss'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      panel: new URL('../../packages/panel/src/index.ts', import.meta.url).pathname,
    },
    dedupe: ['react', 'react-dom'],
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
})
