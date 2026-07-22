import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vite-plus/test'

const packageDirectory = fileURLToPath(new URL('..', import.meta.url))
const sourceDirectory = join(packageDirectory, 'src')
const stylesPath = join(sourceDirectory, 'styles.css')
const readmePath = join(packageDirectory, 'README.md')
const tokenPattern = /--(?:_)?picodash-[a-z0-9-]+/g
const declarationPattern = /(--(?:_)?picodash-[a-z0-9-]+)\s*:/g
const componentFamilies = [
  'alignment',
  'button',
  'chrome',
  'dialog',
  'dropzone',
  'feature',
  'gradient',
  'group',
  'input',
  'media',
  'menu',
  'range',
  'reorder',
  'row',
  'segmented',
  'select',
  'slider',
  'switch',
  'tooltip',
  'vector',
  'viewer',
  'xy',
]

test('resolves the shadcn stylesheet through its package', () => {
  const styles = readFileSync(stylesPath, 'utf8')

  expect(styles).toContain("@import 'shadcn/tailwind.css'")
  expect(styles).not.toContain('node_modules/shadcn')
})

test('keeps the public theme contract declared, used, documented, and semantic', () => {
  const sourceFiles = filesBelow(sourceDirectory).filter((path) =>
    ['.css', '.ts', '.tsx'].includes(extname(path)),
  )
  const source = sourceFiles.map((path) => readFileSync(path, 'utf8')).join('\n')
  const styles = readFileSync(stylesPath, 'utf8')
  const readme = readFileSync(readmePath, 'utf8')
  const declarations = [...styles.matchAll(declarationPattern)].map((match) => match[1])
  const declaredTokens = new Set(declarations)
  const referencedTokens = new Set(source.match(tokenPattern) ?? [])
  const publicTokens = declarations.filter((token) => !token.startsWith('--_picodash-'))

  expect(declarations.length).toBe(declaredTokens.size)
  expect([...referencedTokens].filter((token) => !declaredTokens.has(token))).toEqual([])

  for (const token of declaredTokens) {
    expect(source.match(new RegExp(escapeRegExp(token), 'g'))?.length ?? 0).toBeGreaterThan(1)
  }

  expect(
    publicTokens.filter(
      (token) =>
        token !== '--picodash-panel-width' &&
        token !== '--picodash-field-surface-min-height' &&
        componentFamilies.some((family) => token.startsWith(`--picodash-${family}-`)),
    ),
  ).toEqual([])

  expect(publicTokens.filter((token) => !readme.includes(`\`${token}\``))).toEqual([])
})

function filesBelow(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? filesBelow(path) : path
  })
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
