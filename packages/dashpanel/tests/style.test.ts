import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

const stylesheetPath = fileURLToPath(new URL('../src/style.css', import.meta.url))

describe('DashPanel stylesheet contract', () => {
  it('restores the original dense Panel surface recipe through shared tokens', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    const panelRule = css.match(/\.picodash-dashpanel\s*\{([^}]*)\}/s)?.[1]

    expect(panelRule).not.toContain('isolation: isolate;')
    expect(panelRule).toContain('background: var(--picodash-color-surface);')
    expect(panelRule).toContain(
      'background: color-mix(in oklab, var(--picodash-color-surface) 72%, transparent);',
    )
    expect(panelRule).toContain('backdrop-filter: blur(calc(2 * var(--picodash-blur-surface)));')
    expect(css).toMatch(
      /\.picodash-dashpanel\s*\{[^}]*border:\s*var\(--picodash-border-width-thin\)[^}]*background:\s*var\(--picodash-color-surface\);[^}]*background:\s*color-mix\(in oklab,\s*var\(--picodash-color-surface\)\s+72%,\s*transparent\);[^}]*backdrop-filter:\s*blur\(calc\(2 \* var\(--picodash-blur-surface\)\)\);[^}]*box-shadow:/s,
    )
    expect(css).not.toContain('.picodash-dashpanel::before')
    expect(css).toMatch(
      /\.picodash-dashpanel\s*>\s*\[data-slot='dash-header'\]\s*\{[^}]*box-sizing:\s*border-box;[^}]*border-block-end:[^}]*padding:/s,
    )
    expect(css).toMatch(
      /\.picodash-dashpanel\s*>\s*\[data-slot='dash-header'\]\s+h2\s*\{[^}]*font-size:\s*var\(--picodash-font-size-xl\);[^}]*font-weight:\s*var\(--picodash-font-weight-semibold\);/s,
    )
    expect(css).toMatch(
      /\[data-slot='dash-header'\]\s+\[data-slot='button'\]\[data-icon-only\]\s*\{[^}]*inline-size:\s*var\(--picodash-control-height-sm\);[^}]*block-size:\s*var\(--picodash-control-height-sm\);/s,
    )
    expect(css).toMatch(
      /\[data-slot='button'\]\[data-icon-only\]\s*>\s*svg\s*\{[^}]*display:\s*block;[^}]*inline-size:\s*var\(--picodash-icon-sm\);[^}]*block-size:\s*var\(--picodash-icon-sm\);/s,
    )
    expect(css).not.toContain("[data-slot='button']::before")
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)[\s\S]*\[data-slot='button'\]\[data-icon-only\]\s*\{[^}]*min-inline-size:\s*44px;[^}]*min-block-size:\s*44px;/s,
    )
  })

  it('keeps allocated Panel content constrained beneath a reachable header', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toMatch(/\.picodash-dashpanel\s*\{[^}]*display:\s*flex;/s)
    expect(css).toMatch(/\.picodash-dashpanel\s*\{[^}]*flex-direction:\s*column;/s)
    expect(css).toMatch(/\[data-slot='dash-header'\]\s*\{[^}]*flex:\s*none;/s)
    expect(css).toMatch(
      /\[data-picodash-panel-body\]\s*\{[^}]*min-block-size:\s*0;[^}]*overflow:\s*auto;/s,
    )
  })

  it('matches action padding and removes radii from boundary-contacting corners', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toMatch(
      /dash-header-actions[^}]*dash-header-trailing[^}]*padding-inline-end:\s*var\(--picodash-space-1\);/s,
    )
    expect(css).toMatch(
      /picodash-dashpanel\[data-picodash-boundary-contact~='top'\][^}]*border-top-left-radius:\s*0;[^}]*border-top-right-radius:\s*0;/s,
    )
    expect(css).toMatch(
      /data-picodash-panel-dock-preview[^}]*data-picodash-boundary-contact~='right'[^}]*border-top-right-radius:\s*0;[^}]*border-bottom-right-radius:\s*0;/s,
    )
    expect(css).not.toMatch(/data-picodash-dock-position='(?:top|bottom|full|center)/)
    expect(css).not.toMatch(/border-(?:start|end)-(?:start|end)-radius/)
    expect(css).toMatch(
      /picodash-dashpanel\[data-picodash-boundary-contact~='left'\][^}]*border-top-left-radius:\s*0;[^}]*border-bottom-left-radius:\s*0;/s,
    )
    expect(css).toMatch(
      /data-picodash-panel-reveal\]\[data-picodash-boundary-contact~='top'\][^}]*data-slot='button'[^}]*border-top-left-radius:\s*0;[^}]*border-top-right-radius:\s*0;/s,
    )
    expect(css).toMatch(
      /data-picodash-panel-reveal\]\[data-picodash-boundary-contact~='left'\][^}]*data-slot='button'[^}]*border-top-left-radius:\s*0;[^}]*border-bottom-left-radius:\s*0;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-panel-reveal\]\s*\{[^}]*z-index:\s*calc\(var\(--picodash-layer-raised\) \+ 1\);/s,
    )
  })

  it('makes the non-interactive header a drag surface while preserving button gestures', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toMatch(
      />\s*\[data-slot='dash-header'\]\s*\{[^}]*cursor:\s*grab;[^}]*touch-action:\s*none;/s,
    )
    expect(css).toMatch(
      /\[data-slot='dash-header'\]\s+\[data-slot='button'\]\s*\{[^}]*touch-action:\s*manipulation;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-panel-move-handle\]\s*\{[^}]*position:\s*absolute;[^}]*inline-size:\s*1px;[^}]*clip-path:\s*inset\(50%\);/s,
    )
  })

  it('retracts docked Panels with compositor-only motion and disables it for reduced motion', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toMatch(/--picodash-panel-snap-duration:\s*160ms;/)
    expect(css).toMatch(/--picodash-panel-snap-easing:\s*cubic-bezier\(/)
    expect(css).toMatch(/--picodash-panel-snap-bounce:\s*0\.06;/)
    expect(css).toMatch(/--picodash-panel-detach-duration:\s*140ms;/)
    expect(css).toMatch(/--picodash-panel-detach-easing:\s*cubic-bezier\(/)
    expect(css).toMatch(/--picodash-panel-detach-bounce:\s*0\.04;/)
    expect(css).toMatch(
      /\.picodash-dashpanel\[data-picodash-dock-position\]\s*\{[^}]*transition:[^}]*transform[^}]*opacity/s,
    )
    expect(css).not.toMatch(/transition:[^;}]*block-size/)
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.picodash-dashpanel\[data-picodash-dock-position\]\s*\{[^}]*transition:\s*none;/s,
    )
    expect(css).not.toMatch(
      /\.picodash-dashpanel\[data-picodash-dock-position\]\s*\{[^}]*(?:inset|left|top|right|bottom|width|height)\s*:/s,
    )
    expect(css).toMatch(
      /\[data-picodash-panel-dock-preview\]\s*\{[^}]*will-change:\s*transform, opacity;/s,
    )
    expect(css).toMatch(
      /data-picodash-dock-allocation-motion='true'\]\s*\{[^}]*transform-origin:\s*top left;[^}]*transition:\s*none;[^}]*will-change:\s*transform;/s,
    )
    expect(css).not.toMatch(/\[data-picodash-panel-dock-preview\]\s*\{[^}]*transition:/s)
    expect(css).toMatch(/data-picodash-dragging='true'\]\s*\{[^}]*transition:\s*none;/s)
  })

  it('rotates collapse and dock arrows with the shared theme motion', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toMatch(
      /data-picodash-collapse-chevron[^}]*data-picodash-arrow-direction[^}]*transition:\s*transform var\(--picodash-duration-fast\) var\(--picodash-easing-out\);/s,
    )
    expect(css).toMatch(
      /data-picodash-collapse-chevron\]\[data-expanded='true'\]\s*\{[^}]*transform:\s*rotate\(90deg\);/s,
    )
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*data-picodash-collapse-chevron[^}]*transition:\s*none;/s,
    )
  })
})
