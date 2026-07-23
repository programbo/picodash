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

  const duplicateDeclarations = declarations.filter(
    (token, index) => declarations.indexOf(token) !== index,
  )
  expect(
    duplicateDeclarations.every(
      (token) =>
        token.startsWith('--picodash-color-') ||
        token.startsWith('--picodash-radius-') ||
        token.startsWith('--picodash-shadow-'),
    ),
  ).toBe(true)
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

  expect(styles).toContain(":where([data-picodash-theme='dark'])")
  expect(styles).toContain(":where([data-picodash-theme='light'])")
  expect(styles).toMatch(/:where\(\[data-picodash-theme='dark'\]\)[\s\S]*color-scheme:\s*dark/)
  expect(styles).toMatch(/:where\(\[data-picodash-theme='light'\]\)[\s\S]*color-scheme:\s*light/)

  const recipeTokens = [...new Set(publicTokens)].filter(
    (token) =>
      token.startsWith('--picodash-color-') ||
      token === '--picodash-radius-surface' ||
      token === '--picodash-radius-control' ||
      token === '--picodash-shadow-panel' ||
      token === '--picodash-shadow-viewer' ||
      token === '--picodash-shadow-inner',
  )
  for (const theme of ['dark', 'light']) {
    const selector = `:where([data-picodash-theme='${theme}'])`
    const start = styles.indexOf(selector)
    const block = styles.slice(start, styles.indexOf('\n}', start))

    for (const token of recipeTokens) {
      expect(block).toContain(`${token}:`)
    }
  }
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
