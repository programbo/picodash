import { defineConfig } from 'vite-plus'
import { reactTestConfig } from '../../test/config.ts'

export default defineConfig({
  test: reactTestConfig,
  pack: {
    entry: {
      index: 'src/index.tsx',
      catalog: 'src/catalog.ts',
      ui: 'src/ui.tsx',
      charts: 'src/charts.tsx',
      style: 'src/style.css',
    },
    dts: { tsgo: true },
    exports: false,
    sourcemap: true,
  },
  fmt: { singleQuote: true, semi: false },
})
