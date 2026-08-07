import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: ['src/index.ts', 'src/ui.ts'],
    dts: { tsgo: true },
    external: ['react', 'react-dom', /^@picodash\//],
    exports: false,
    sourcemap: true,
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  fmt: { singleQuote: true, semi: false },
})
