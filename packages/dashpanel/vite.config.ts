import { defineConfig } from 'vite-plus'

export default defineConfig({
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
