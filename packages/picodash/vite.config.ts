import { defineConfig } from 'vite-plus'
import { reactTestConfig } from '../../test/config.ts'

export default defineConfig({
  test: reactTestConfig,
  pack: {
    entry: ['src/index.ts', 'src/ui.ts'],
    dts: { generator: 'tsgo' },
    external: ['react', 'react-dom', /^@picodash\//],
    exports: false,
    sourcemap: true,
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  fmt: { singleQuote: true, semi: false },
})
