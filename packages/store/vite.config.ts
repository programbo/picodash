import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: ['src/index.ts'],
    dts: {
      tsgo: true,
    },
    exports: true,
    sourcemap: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    singleQuote: true,
    semi: false,
  },
})
