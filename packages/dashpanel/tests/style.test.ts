import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

const stylesheetPath = fileURLToPath(new URL('../src/style.css', import.meta.url))

describe('DashPanel stylesheet contract', () => {
  it('keeps allocated Panel content constrained beneath a reachable header', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toMatch(/\.picodash-dashpanel\s*\{[^}]*display:\s*flex;/s)
    expect(css).toMatch(/\.picodash-dashpanel\s*\{[^}]*flex-direction:\s*column;/s)
    expect(css).toMatch(/\[data-slot='dash-header'\]\s*\{[^}]*flex:\s*none;/s)
    expect(css).toMatch(
      /\[data-picodash-panel-body\]\s*\{[^}]*min-block-size:\s*0;[^}]*overflow:\s*auto;/s,
    )
  })

  it('reserves touch gestures for the Panel move handle', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toMatch(/\[data-picodash-panel-move-handle\]\s*\{[^}]*touch-action:\s*none;/s)
  })
})
