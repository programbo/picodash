import { describe, expect, it } from 'vite-plus/test'
import {
  dockDashPanelRect,
  normalizeDashPanelRect,
  projectDashPanelPosition,
  projectDashPanelRect,
  snapDashPanelRect,
  snapDashPanelTargets,
} from './placement-geometry.ts'

const boundary = { top: 10, left: 20, right: 220, bottom: 160 }
const size = { width: 60, height: 40 }

describe('DashPanel placement geometry', () => {
  it('projects free rectangles and oversized dimensions into a coherent boundary', () => {
    expect(
      projectDashPanelRect({ top: -10, left: -20, right: 280, bottom: 220 }, boundary),
    ).toEqual({
      top: 10,
      left: 20,
      right: 220,
      bottom: 160,
      width: 200,
      height: 150,
    })
    expect(projectDashPanelPosition({ x: 500, y: -1 }, size, boundary)).toEqual({
      x: 160,
      y: 10,
    })
  })

  it('handles zero-area boundaries and freezes detached results', () => {
    const result = projectDashPanelRect(
      { top: 4, left: 5, right: 20, bottom: 30 },
      { top: 10, left: 10, right: 10, bottom: 10 },
    )
    expect(result).toEqual({ top: 10, left: 10, right: 10, bottom: 10, width: 0, height: 0 })
    expect(Object.isFrozen(result)).toBe(true)
    const source = { top: 1, left: 2, right: 10, bottom: 11 }
    const normalized = normalizeDashPanelRect(source)
    source.left = 99
    expect(normalized.left).toBe(2)
  })

  it('places all snap targets with the separate inward offset', () => {
    expect(snapDashPanelRect('top-left', boundary, size, 8)).toEqual({
      top: 18,
      left: 28,
      right: 88,
      bottom: 58,
      width: 60,
      height: 40,
    })
    expect(snapDashPanelRect('bottom-right', boundary, size, 8)).toEqual({
      top: 112,
      left: 152,
      right: 212,
      bottom: 152,
      width: 60,
      height: 40,
    })
    const targets = snapDashPanelTargets(boundary, size, 8)
    expect(Object.keys(targets)).toEqual([
      'top-left',
      'top',
      'top-right',
      'right',
      'bottom-right',
      'bottom',
      'bottom-left',
      'left',
    ])
    expect(Object.isFrozen(targets)).toBe(true)
  })

  it('produces flush docks and applies side allocation caps', () => {
    expect(dockDashPanelRect('full-left', boundary, size)).toEqual({
      top: 10,
      left: 20,
      right: 80,
      bottom: 160,
      width: 60,
      height: 150,
    })
    expect(dockDashPanelRect('center-right', boundary, size, { allocation: 50 })).toEqual({
      top: 65,
      left: 160,
      right: 220,
      bottom: 105,
      width: 60,
      height: 40,
    })
    expect(dockDashPanelRect('bottom-left', boundary, size, { allocation: 25 })).toEqual({
      top: 135,
      left: 20,
      right: 80,
      bottom: 160,
      width: 60,
      height: 25,
    })
    expect(dockDashPanelRect('full-left', boundary, size, { allocation: 100, offset: 50 })).toEqual(
      {
        top: 60,
        left: 20,
        right: 80,
        bottom: 160,
        width: 60,
        height: 100,
      },
    )
    expect(dockDashPanelRect('full-top', boundary, size)).toEqual({
      top: 10,
      left: 20,
      right: 220,
      bottom: 50,
      width: 200,
      height: 40,
    })
    expect(
      dockDashPanelRect('full-top', boundary, size, {
        inlineAllocation: 140,
        inlineOffset: 30,
      }),
    ).toEqual({
      top: 10,
      right: 190,
      bottom: 50,
      left: 50,
      width: 140,
      height: 40,
    })
  })

  it('rejects hostile rectangles, sizes, offsets, and positions', () => {
    expect(() =>
      projectDashPanelRect({ top: 0, left: 0, right: Number.NaN, bottom: 1 }, boundary),
    ).toThrow(TypeError)
    expect(() => snapDashPanelRect('top', boundary, { width: -1, height: 1 }, 0)).toThrow(TypeError)
    expect(() => snapDashPanelRect('top', boundary, size, Number.POSITIVE_INFINITY)).toThrow(
      TypeError,
    )
    expect(() => dockDashPanelRect('center-left', boundary, size, { allocation: -1 })).toThrow(
      TypeError,
    )
  })
})
