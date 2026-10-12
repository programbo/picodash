import { describe, expect, it } from 'vite-plus/test'
import { transitionHelpOverlay, type HelpOverlaySnapshot } from '../src/help-overlay.ts'

describe('help overlay ownership', () => {
  it('keeps the newest owner and its layer through stale close and unmount events', () => {
    const a = Symbol('a')
    const b = Symbol('b')
    const idle: HelpOverlaySnapshot = { activeOwner: null, layers: new Map() }
    const first = transitionHelpOverlay(idle, { type: 'OPEN', owner: a, layer: 401 })
    const second = transitionHelpOverlay(first, { type: 'OPEN', owner: b, layer: 402 })
    expect(transitionHelpOverlay(second, { type: 'CLOSE', owner: a })).toBe(second)
    const unmounted = transitionHelpOverlay(second, { type: 'UNMOUNT', owner: a })
    expect(unmounted.activeOwner).toBe(b)
    expect(unmounted.layers.has(a)).toBe(false)
    const returned = transitionHelpOverlay(unmounted, { type: 'OPEN', owner: a, layer: 403 })
    expect(returned.activeOwner).toBe(a)
    expect(returned.layers.get(a)).toBe(403)
    expect(transitionHelpOverlay(returned, { type: 'CLOSE', owner: a }).activeOwner).toBeNull()
  })
})
