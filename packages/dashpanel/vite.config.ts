import { defineConfig } from 'vite-plus'
import { reactTestConfig } from '../../test/config.ts'

export default defineConfig({
  test: reactTestConfig,
  pack: {
    entry: {
      index: 'src/index.tsx',
      integration: 'src/integration.tsx',
      style: 'src/style.css',
      'resize-handles': 'src/resize-handles.css',
    },
    dts: { generator: 'tsgo' },
    exports: false,
    css: { splitting: true },
    sourcemap: true,
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: { singleQuote: true, semi: false },
})
