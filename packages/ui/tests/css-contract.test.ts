import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

const stylesheetPath = fileURLToPath(new URL('../style.css', import.meta.url))
const configPath = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
const packagePath = fileURLToPath(new URL('../package.json', import.meta.url))

const expectedTokens = [
  ...[
    'canvas',
    'surface',
    'surface-raised',
    'surface-muted',
    'text',
    'text-strong',
    'text-muted',
    'border',
    'control-border',
    'well',
    'focus',
    'accent',
    'accent-text',
    'success',
    'info',
    'warning',
    'alert',
    'danger',
    'overlay',
    'data-1',
    'data-2',
    'data-3',
    'data-4',
    'data-5',
  ].map((name) => `--picodash-color-${name}`),
  ...['0-5', '1', '1-5', '2', '2-5', '3', '4', '5'].map((name) => `--picodash-space-${name}`),
  '--picodash-font-family',
  ...['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'].map((name) => `--picodash-font-size-${name}`),
  ...['light', 'normal', 'medium', 'semibold'].map((name) => `--picodash-font-weight-${name}`),
  ...['none', 'tight', 'normal', 'relaxed'].map((name) => `--picodash-line-height-${name}`),
  ...['normal', 'wide'].map((name) => `--picodash-letter-spacing-${name}`),
  ...['xs', 'sm', 'md', 'lg'].map((name) => `--picodash-control-height-${name}`),
  ...['xs', 'sm', 'md', 'lg'].map((name) => `--picodash-icon-${name}`),
  '--picodash-radius-control',
  '--picodash-radius-surface',
  '--picodash-border-width-thin',
  ...['disabled', 'disabled-soft', 'muted', 'subtle'].map((name) => `--picodash-opacity-${name}`),
  ...['sm', 'md', 'elevated', 'inner'].map((name) => `--picodash-shadow-${name}`),
  ...['surface', 'overlay'].map((name) => `--picodash-blur-${name}`),
  '--picodash-duration-fast',
  '--picodash-easing-out',
  ...['raised', 'drag', 'tooltip', 'popover', 'menu', 'dialog'].map(
    (name) => `--picodash-layer-${name}`,
  ),
]

const colorTokens = expectedTokens.filter((token) => token.startsWith('--picodash-color-'))

function selectorBody(css: string, selector: string) {
  const start = css.indexOf(selector)
  expect(start).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

describe('@picodash/ui stylesheet contract', () => {
  it('owns exactly the accepted 79 public token names', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    const names = new Set(css.match(/--picodash-[a-z0-9-]+/g) ?? [])
    expect(names).toEqual(new Set(expectedTokens))
    expect(names.size).toBe(79)
  })

  it('defines complete built-in color recipes and resets custom colors', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    const generic = selectorBody(css, ':where([data-picodash-theme])')
    const dark = selectorBody(css, ":where([data-picodash-theme='dark'])")
    const light = selectorBody(css, ":where([data-picodash-theme='light'])")
    for (const token of colorTokens) {
      expect(generic).toContain(`${token}: initial`)
      expect(dark).toMatch(new RegExp(`${token.replaceAll('-', '\\-')}\\s*:`))
      expect(light).toMatch(new RegExp(`${token.replaceAll('-', '\\-')}\\s*:`))
    }
    expect(dark).toContain('color-scheme: dark')
    expect(light).toContain('color-scheme: light')
  })

  it('publishes independent theme and density selectors without retired names', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    const retired = [
      '--picodash-color-control',
      '--picodash-font-light',
      '--picodash-line-normal',
      '--picodash-tracking-wide',
      '--picodash-border-thin',
      '--picodash-ease-out',
      '--picodash-layer-select',
      '--picodash-shadow-panel',
      '--picodash-shadow-viewer',
      '--picodash-layer-viewer',
    ]
    for (const name of retired) {
      expect(css).not.toMatch(new RegExp(`${name.replaceAll('-', '\\-')}\\s*:`))
    }
    expect(css).toContain("[data-picodash-density='regular']")
    expect(css).toContain("[data-picodash-density='compact']")
    expect(css).not.toContain('display: contents')
  })

  it('uses an explicit stylesheet build entry and package subpath', async () => {
    const config = await readFile(configPath, 'utf8')
    const manifest = JSON.parse(await readFile(packagePath, 'utf8')) as {
      exports: Record<string, string>
    }
    expect(config).toContain("style: 'style.css'")
    expect(config).toContain("index: 'src/index.tsx'")
    expect(manifest.exports).toEqual({
      '.': './dist/index.mjs',
      './package.json': './package.json',
      './style.css': './dist/style.css',
    })
  })

  it('defines the accepted AlertDialog structural slots', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    for (const slot of [
      'overlay',
      'modal',
      'content',
      'header',
      'footer',
      'media',
      'title',
      'description',
    ]) {
      expect(css).toContain(`[data-slot='alert-dialog-${slot}']`)
    }
  })

  it('defines the accepted ActionMenu structural slots without adding tokens', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    for (const slot of [
      'action-menu',
      'action-menu-item',
      'action-submenu',
      'action-menu-separator',
    ]) {
      expect(css).toContain(`[data-slot='${slot}']`)
    }
  })
})
