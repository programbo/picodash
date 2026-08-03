import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: ['src/index.tsx'],
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
    settings: {
      tailwindcss: {
        entryPoint: './src/styles.css',
      },
    },
  },
  fmt: {
    singleQuote: true,
    semi: false,
  },
})
