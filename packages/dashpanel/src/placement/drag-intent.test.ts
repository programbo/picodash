import { describe, expect, it } from 'vite-plus/test'
import { resolveDashPanelHybridDockIntent, resolveDashPanelSnapDragIntent } from './drag-intent.ts'

const boundary = { top: 0, right: 300, bottom: 200, left: 0, width: 300, height: 200 }
const size = { width: 80, height: 40 }

describe('DashPanel pointer drag intent', () => {
  it('attracts a Floating Panel to its exact offset target during the drag', () => {
    expect(
      resolveDashPanelSnapDragIntent({
        boundary,
        detachDistance: 40,
        mode: 'floating',
        position: { x: 10, y: 9 },
        size,
        snapOffset: 8,
        snapProximity: 16,
      }),
    ).toEqual({ kind: 'snapped', position: { x: 8, y: 8 }, target: 'top-left' })
  })

  it('resists an acquired snap until the detach threshold', () => {
    const resisted = resolveDashPanelSnapDragIntent({
      activeTarget: 'top-left',
      boundary,
      detachDistance: 40,
      mode: 'floating',
      position: { x: 28, y: 8 },
      size,
      snapOffset: 8,
      snapProximity: 16,
    })
    expect(resisted.kind).toBe('resisted')
    expect(resisted.position.x).toBeGreaterThan(8)
    expect(resisted.position.x).toBeLessThan(28)
    expect(
      resolveDashPanelSnapDragIntent({
        activeTarget: 'top-left',
        boundary,
        detachDistance: 40,
        mode: 'floating',
        position: { x: 49, y: 8 },
        size,
        snapOffset: 8,
        snapProximity: 16,
      }),
    ).toEqual({ kind: 'free', position: { x: 49, y: 8 } })
  })

  it('limits Hybrid magnetic snaps to top and bottom', () => {
    expect(
      resolveDashPanelSnapDragIntent({
        boundary,
        detachDistance: 40,
        mode: 'hybrid',
        position: { x: 8, y: 8 },
        size,
        snapOffset: 8,
        snapProximity: 16,
      }),
    ).toEqual({ kind: 'free', position: { x: 8, y: 8 } })
  })

  it('maps Hybrid side movement across corner and full-side dock zones', () => {
    const positions = ['top-left', 'full-left', 'bottom-left'] as const
    const panel = { top: 70, right: 82, bottom: 110, left: 2, width: 80, height: 40 }
    const common = {
      boundary,
      isOccupied: () => false,
      panel,
      positions,
      proximity: 16,
      size,
    }
    expect(
      resolveDashPanelHybridDockIntent({ ...common, pointer: { x: 20, y: 20 } })?.position,
    ).toBe('top-left')
    expect(
      resolveDashPanelHybridDockIntent({ ...common, pointer: { x: 20, y: 100 } })?.position,
    ).toBe('full-left')
    expect(
      resolveDashPanelHybridDockIntent({ ...common, pointer: { x: 20, y: 180 } })?.position,
    ).toBe('bottom-left')
  })

  it('distinguishes occupied targets from policy-disabled targets', () => {
    const panel = { top: 2, right: 82, bottom: 42, left: 2, width: 80, height: 40 }
    expect(
      resolveDashPanelHybridDockIntent({
        boundary,
        isOccupied: (position) => position === 'top-left',
        panel,
        pointer: { x: 10, y: 10 },
        positions: ['top-left'],
        proximity: 16,
        size,
      }),
    ).toEqual({ kind: 'blocked', position: 'top-left' })
    expect(
      resolveDashPanelHybridDockIntent({
        boundary,
        isOccupied: () => false,
        panel,
        pointer: { x: 10, y: 10 },
        positions: [],
        proximity: 16,
        size,
      }),
    ).toBeUndefined()
  })
})
