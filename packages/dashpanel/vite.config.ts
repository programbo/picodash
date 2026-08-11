import { defineConfig } from 'vite-plus'
import { reactTestConfig } from '../../test/config.ts'

export default defineConfig({
  test: reactTestConfig,
  pack: {
    entry: { index: 'src/index.tsx', integration: 'src/integration.tsx', style: 'src/style.css' },
    dts: { tsgo: true },
    exports: false,
    sourcemap: true,
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: { singleQuote: true, semi: false },
})
