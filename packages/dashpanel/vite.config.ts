import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/postcss'
import { parse, type Parser } from 'postcss'
import { defineConfig } from 'vite-plus'

const shadcnStylesheet = fileURLToPath(import.meta.resolve('shadcn/tailwind.css')).replaceAll(
  '\\',
  '/',
)
const styleEntryPoint = fileURLToPath(new URL('./style.css', import.meta.url))
const resolveShadcnStylesheet: Parser = (css, options) =>
  parse(css.toString().replaceAll("'shadcn/tailwind.css'", `'${shadcnStylesheet}'`), options)

export default defineConfig({
  pack: {
    entry: ['src/index.tsx', 'src/advanced.ts', 'src/ui.ts', 'src/catalog.ts'],
    css: {
      transformer: 'postcss',
      postcss: {
        parser: resolveShadcnStylesheet,
        plugins: [tailwindcss()],
      },
    },
    dts: { tsgo: true },
    exports: true,
    sourcemap: true,
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    settings: { tailwindcss: { entryPoint: styleEntryPoint } },
  },
  fmt: { singleQuote: true, semi: false },
})
