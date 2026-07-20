import tailwindcss from '@tailwindcss/postcss'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: ['src/index.ts', 'src/advanced.ts'],
    css: {
      transformer: 'postcss',
      postcss: {
        plugins: [tailwindcss()],
      },
    },
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
    sortTailwindcss: {
      functions: ['joinClassNames'],
    },
  },
})
