import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: { index: 'src/index.ts', browser: 'src/browser.ts', cli: 'src/cli.ts' },
    dts: { tsgo: true },
    exports: false,
    sourcemap: true,
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  fmt: { singleQuote: true, semi: false },
})
