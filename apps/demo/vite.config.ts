import tailwindcss from '@tailwindcss/postcss'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  resolve: {
    alias: {
      panel: new URL('../../packages/panel/src/index.ts', import.meta.url).pathname,
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
})
