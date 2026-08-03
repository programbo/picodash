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
    entry: {
      index: 'src/index.ts',
      dashlet: 'src/dashlet.ts',
      ui: 'src/ui.ts',
      style: 'style.css',
    },
    css: {
      transformer: 'postcss',
      postcss: {
        parser: resolveShadcnStylesheet,
        plugins: [tailwindcss()],
      },
    },
    dts: { tsgo: true },
    exports: false,
    sourcemap: true,
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    settings: { tailwindcss: { entryPoint: styleEntryPoint } },
  },
  fmt: { singleQuote: true, semi: false },
})
