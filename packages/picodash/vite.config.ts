import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: ['src/index.ts', 'src/dashlet.ts', 'src/ui.ts', 'src/advanced.ts', 'src/catalog.ts'],
    dts: { tsgo: true },
    external: [/^@picodash\//],
    exports: false,
    sourcemap: true,
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  fmt: { singleQuote: true, semi: false },
})
