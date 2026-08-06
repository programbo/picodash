import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: {
      index: 'src/index.tsx',
      style: 'src/style.css',
    },
    dts: { tsgo: true },
    exports: false,
    sourcemap: true,
  },
  fmt: { singleQuote: true, semi: false },
})
