import { defineConfig } from 'vite-plus'
import { reactTestConfig } from '../../test/config.ts'

export default defineConfig({
  test: reactTestConfig,
  pack: {
    entry: ['src/index.ts', 'src/react.ts', 'src/integration.ts', 'src/web-storage.ts'],
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
