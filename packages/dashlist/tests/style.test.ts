import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

const stylesheetPath = fileURLToPath(new URL('../src/style.css', import.meta.url))

describe('DashList stylesheet contract', () => {
  it('gives native reorder handles a 44 pixel coarse-pointer hit target', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)\s*\{[^}]*\[data-picodash-reorder-handle\]\s*\{[^}]*min-inline-size:\s*44px;[^}]*min-block-size:\s*44px;/s,
    )
  })
})
