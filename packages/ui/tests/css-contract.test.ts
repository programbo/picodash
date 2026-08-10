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

function declarations(body: string) {
  return Object.fromEntries(
    [...body.matchAll(/(--picodash-[a-z0-9-]+|min-(?:block|inline)-size)\s*:\s*([^;]+);/g)].map(
      ([, name, value]) => [name, value.trim()],
    ),
  )
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

  it('keeps the regular recipe and applies only the current verified compact geometry groups', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    const regular = declarations(selectorBody(css, ':where([data-picodash-theme])'))
    expect(regular).toMatchObject({
      '--picodash-space-0-5': '0.125rem',
      '--picodash-space-1': '0.25rem',
      '--picodash-space-1-5': '0.375rem',
      '--picodash-space-2': '0.5rem',
      '--picodash-space-2-5': '0.625rem',
      '--picodash-space-3': '0.75rem',
      '--picodash-space-4': '1rem',
      '--picodash-space-5': '1.25rem',
      '--picodash-font-size-xs': '0.5625rem',
      '--picodash-font-size-sm': '0.625rem',
      '--picodash-font-size-md': '0.6875rem',
      '--picodash-font-size-lg': '0.75rem',
      '--picodash-font-size-xl': '0.875rem',
      '--picodash-font-size-2xl': '1.25rem',
      '--picodash-font-size-3xl': '1.5rem',
      '--picodash-line-height-none': '1em',
      '--picodash-line-height-tight': '1.1em',
      '--picodash-line-height-normal': '1.25em',
      '--picodash-line-height-relaxed': '1.5em',
      '--picodash-control-height-xs': '1.5rem',
      '--picodash-control-height-sm': '1.75rem',
      '--picodash-control-height-md': '2rem',
      '--picodash-control-height-lg': '2.25rem',
      '--picodash-icon-xs': '0.75rem',
      '--picodash-icon-sm': '0.875rem',
      '--picodash-icon-md': '1rem',
      '--picodash-icon-lg': '1.25rem',
    })
    const compact = declarations(selectorBody(css, ":where([data-picodash-density='compact'])"))
    expect(compact).toEqual({
      '--picodash-space-0-5': '0.125rem',
      '--picodash-space-1': '0.1875rem',
      '--picodash-space-1-5': '0.25rem',
      '--picodash-space-2': '0.375rem',
      '--picodash-space-2-5': '0.5rem',
      '--picodash-space-3': '0.625rem',
      '--picodash-space-4': '0.75rem',
      '--picodash-space-5': '1rem',
      '--picodash-font-size-xs': '0.5625rem',
      '--picodash-font-size-sm': '0.625rem',
      '--picodash-font-size-md': '0.6875rem',
      '--picodash-font-size-lg': '0.75rem',
      '--picodash-font-size-xl': '0.8125rem',
      '--picodash-font-size-2xl': '1.125rem',
      '--picodash-font-size-3xl': '1.375rem',
      '--picodash-line-height-none': '1em',
      '--picodash-line-height-tight': '1.05em',
      '--picodash-line-height-normal': '1.2em',
      '--picodash-line-height-relaxed': '1.4em',
      '--picodash-control-height-xs': '1.25rem',
      '--picodash-control-height-sm': '1.5rem',
      '--picodash-control-height-md': '1.75rem',
      '--picodash-control-height-lg': '2rem',
      '--picodash-icon-xs': '0.625rem',
      '--picodash-icon-sm': '0.75rem',
      '--picodash-icon-md': '0.875rem',
      '--picodash-icon-lg': '1rem',
    })
    expect(compact).not.toHaveProperty('--picodash-font-family')
    expect(compact).not.toHaveProperty('--picodash-font-weight-normal')
    expect(compact).not.toHaveProperty('--picodash-letter-spacing-normal')
    expect(compact).not.toHaveProperty('--picodash-radius-control')
    expect(compact).not.toHaveProperty('--picodash-color-text')
    expect(compact).not.toHaveProperty('--picodash-shadow-sm')
    expect(compact).not.toHaveProperty('--picodash-duration-fast')
  })

  it('keeps UI-owned coarse-pointer controls at 44px in both axes', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    const start = css.indexOf('@media (pointer: coarse)')
    expect(start).toBeGreaterThanOrEqual(0)
    expect(start).toBeGreaterThan(css.indexOf('min-block-size: var(--picodash-control-height-sm)'))
    const media = css.slice(start, css.indexOf('\n}', start) + 2)
    expect(media).toContain("[data-slot='button']")
    expect(media).toContain("[data-slot='action-menu-item']")
    expect(media).toContain("[data-slot='action-submenu']")
    expect(media).toContain('min-block-size: 44px;')
    expect(media).toContain('min-inline-size: 44px;')
    expect(media).not.toContain('::before')
    expect(media).not.toContain('::after')
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

  it('defines the Tooltip slot and decorative token-styled arrow', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toContain("[data-slot='tooltip']")
    expect(css).toContain('.picodash-tooltip-arrow)::after')
    expect(css).toContain('var(--picodash-color-surface-raised)')
  })
})
