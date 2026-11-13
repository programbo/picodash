import { describe, expect, it } from 'vite-plus/test'
import {
  DASH_PANEL_RESIZE_TARGETS,
  normalizeDashPanelContentConstraints,
  normalizeDashPanelContentMetrics,
  normalizeDashPanelResize,
  resolveDashPanelDimension,
  resolveDashPanelSizing,
} from './constraints.ts'
import { resizeDashPanelRect, resolveDashPanelResizeTargets } from './resize.ts'
import type { DashPanelPlacement } from '../placement/placement.ts'
import type { DashPanelResizeTarget } from './types.ts'

const free = { mode: 'floating', disposition: { kind: 'free' } } as const
const boundary = { left: 0, top: 0, right: 800, bottom: 600 }
const start = { left: 200, top: 150, right: 500, bottom: 350 }
const minimum = { width: 100, height: 80 }
const maximum = { width: 800, height: 600 }

describe('DashPanel sizing policy', () => {
  it('resolves the documented length grammar against the boundary and owner root font', () => {
    expect(resolveDashPanelDimension(12.5, { available: 600 })).toBe(12.5)
    expect(resolveDashPanelDimension('12.5px', { available: 600 })).toBe(12.5)
    expect(resolveDashPanelDimension('25%', { available: 600 })).toBe(150)
    expect(resolveDashPanelDimension('12rem', { available: 600, rootFontSize: 20 })).toBe(240)
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1])
      expect(() => resolveDashPanelDimension(value, { available: 600 })).toThrow(TypeError)
    expect(() => resolveDashPanelDimension('-1px', { available: 600 })).toThrow(TypeError)
  })

  it('preserves manual intent while a boundary/allocation constrains its rendered size', () => {
    const policy = {
      preferred: { width: 360, height: 320 },
      manual: { width: 600, height: 500 },
      minWidth: 240,
      maxWidth: 720,
      minHeight: 160,
      maxHeight: 800,
    }
    const small = resolveDashPanelSizing({ ...policy, boundary: { width: 300, height: 250 } })
    expect(small.desired).toEqual({ width: 600, height: 500 })
    expect(small.resolved).toEqual({ width: 300, height: 250 })
    expect(small.source).toEqual({ width: 'manual', height: 'manual' })
    expect(small.constraints).toEqual([
      { axis: 'width', code: 'boundary', limit: 300 },
      { axis: 'height', code: 'boundary', limit: 250 },
    ])
    const large = resolveDashPanelSizing({ ...policy, boundary: { width: 900, height: 700 } })
    expect(large.resolved).toEqual({ width: 600, height: 500 })
    expect(large.constraints).toEqual([])
    expect(
      resolveDashPanelSizing({
        ...policy,
        boundary: { width: 900, height: 700 },
        allocation: { height: 200 },
      }).constraints,
    ).toContainEqual({ axis: 'height', code: 'allocation', limit: 200 })
  })

  it('keeps automatic height independent of a width-only override', () => {
    for (const height of [180, 500, 120]) {
      const resolved = resolveDashPanelSizing({
        preferred: { width: 360, height },
        manual: { width: 480 },
        boundary: { width: 900, height: 700 },
      })
      expect(resolved.resolved).toEqual({ width: 480, height })
      expect(resolved.source).toEqual({ width: 'manual', height: 'preferred' })
    }
  })

  it('intersects content and explicit bounds without persisting the measurements', () => {
    const result = resolveDashPanelSizing({
      preferred: { width: 360, height: 320 },
      manual: { width: 600, height: 500 },
      boundary: { width: 900, height: 700 },
      minWidth: 200,
      maxHeight: 600,
      shellMinimum: { width: 120, height: 40 },
      contentConstraints: { minWidth: true, maxHeight: true },
      contentMetrics: { minWidth: 650, maxHeight: 450 },
    })
    expect(result.resolved).toEqual({ width: 650, height: 450 })
    expect(result.desired).toEqual({ width: 600, height: 500 })
    expect(result.constraints).toEqual([
      { axis: 'width', code: 'content_minimum', limit: 650 },
      { axis: 'height', code: 'content_maximum', limit: 450 },
    ])
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.constraints[0])).toBe(true)
  })

  it('reports missing content metrics and relaxes impossible minima without changing desired size', () => {
    const result = resolveDashPanelSizing({
      preferred: { width: 600, height: 500 },
      boundary: { width: 200, height: 100 },
      minWidth: 300,
      shellMinimum: { height: 120 },
      contentConstraints: { minWidth: true, maxHeight: true },
    })
    expect(result.desired).toEqual({ width: 600, height: 500 })
    expect(result.minimum).toEqual({ width: 200, height: 100 })
    expect(result.requestedMinimum).toEqual({ width: 300, height: 120 })
    expect(result.resolved).toEqual({ width: 200, height: 100 })
    expect(result.constraints).toContainEqual({ axis: 'width', code: 'measurement_unavailable' })
    expect(result.constraints).toContainEqual({
      axis: 'height',
      code: 'minimum_unavailable',
      limit: 100,
    })
    expect(() =>
      resolveDashPanelSizing({
        preferred: { width: 360, height: 320 },
        boundary: { width: 900, height: 700 },
        minWidth: 500,
        maxWidth: 400,
      }),
    ).toThrow(TypeError)
  })

  it('handles dynamic mixed-unit conflicts and equal bounds deterministically', () => {
    const result = resolveDashPanelSizing({
      preferred: { width: 400, height: 300 },
      boundary: { width: 400, height: 700 },
      minWidth: 300,
      maxWidth: '50%',
      minHeight: 200,
      maxHeight: 200,
    })
    expect(result.minimum.width).toBe(200)
    expect(result.maximum.width).toBe(200)
    expect(result.constraints).toContainEqual({
      axis: 'width',
      code: 'minimum_unavailable',
      limit: 200,
    })
    expect(
      resolveDashPanelResizeTargets({
        placement: free,
        minimum: result.minimum,
        maximum: result.maximum,
      }),
    ).toEqual([])
  })

  it('normalizes options and metrics without accepting accessor or unknown-key authority', () => {
    expect(normalizeDashPanelResize()).toEqual({
      handles: 'auto',
      targets: DASH_PANEL_RESIZE_TARGETS,
    })
    expect(normalizeDashPanelResize(false)).toBe(false)
    expect(normalizeDashPanelResize({ handles: 'always', targets: ['se', 'n'] })).toEqual({
      handles: 'always',
      targets: ['n', 'se'],
    })
    expect(() => normalizeDashPanelResize({ targets: ['n', 'n'] })).toThrow(TypeError)
    const metrics = { minWidth: 200, maxHeight: 500 }
    const normalized = normalizeDashPanelContentMetrics(metrics)
    metrics.minWidth = 1
    expect(normalized?.minWidth).toBe(200)
    expect(Object.isFrozen(normalized)).toBe(true)
    let getterCalls = 0
    expect(() =>
      normalizeDashPanelContentConstraints({
        get minWidth() {
          getterCalls += 1
          return true
        },
      }),
    ).toThrow(TypeError)
    expect(getterCalls).toBe(0)
    expect(() => normalizeDashPanelContentMetrics({ minWidth: -1 })).toThrow(TypeError)
  })
})

describe('DashPanel resize geometry', () => {
  it('preserves the opposite edge/corner for all eight free targets', () => {
    const expected: Record<DashPanelResizeTarget, readonly [number, number, number, number]> = {
      n: [200, 170, 500, 350],
      ne: [200, 170, 530, 350],
      e: [200, 150, 530, 350],
      se: [200, 150, 530, 370],
      s: [200, 150, 500, 370],
      sw: [230, 150, 500, 370],
      w: [230, 150, 500, 350],
      nw: [230, 170, 500, 350],
    }
    for (const target of DASH_PANEL_RESIZE_TARGETS) {
      const result = resizeDashPanelRect({
        start,
        target,
        delta: { x: 30, y: 20 },
        boundary,
        minimum,
        maximum,
        placement: free,
      })
      expect([result.rect.left, result.rect.top, result.rect.right, result.rect.bottom]).toEqual(
        expected[target],
      )
      expect(Object.isFrozen(result.rect)).toBe(true)
      expect(result.diff.x).toBe(result.rect.left - start.left)
    }
  })

  it('never crosses edges and stops against min/max and the anchored boundary', () => {
    const shrunk = resizeDashPanelRect({
      start,
      target: 'nw',
      delta: { x: 999, y: 999 },
      boundary,
      minimum,
      maximum,
      placement: free,
    })
    expect(shrunk.rect).toEqual({
      left: 400,
      right: 500,
      top: 270,
      bottom: 350,
      width: 100,
      height: 80,
    })
    expect(shrunk.requested.width).toBe(0)
    expect(shrunk.requested.height).toBe(0)
    const grown = resizeDashPanelRect({
      start,
      target: 'nw',
      delta: { x: -999, y: -999 },
      boundary,
      minimum,
      maximum,
      placement: free,
    })
    expect(grown.rect).toEqual({
      left: 0,
      right: 500,
      top: 0,
      bottom: 350,
      width: 500,
      height: 350,
    })
    const limited = resizeDashPanelRect({
      start,
      target: 'se',
      delta: { x: 999, y: 999 },
      boundary,
      minimum,
      maximum: { width: 450, height: 300 },
      placement: free,
    })
    expect(limited.rect.width).toBe(450)
    expect(limited.rect.height).toBe(300)
  })

  it('filters every anchored placement and full-dock allocation-owned axis', () => {
    const cases: readonly [DashPanelPlacement, readonly DashPanelResizeTarget[]][] = [
      [
        { mode: 'floating', disposition: { kind: 'snapped', position: 'top-left' } },
        ['e', 'se', 's'],
      ],
      [
        { mode: 'floating', disposition: { kind: 'snapped', position: 'top' } },
        ['e', 'se', 's', 'sw', 'w'],
      ],
      [
        { mode: 'floating', disposition: { kind: 'snapped', position: 'right' } },
        ['n', 's', 'sw', 'w', 'nw'],
      ],
      [
        { mode: 'fixed', disposition: { kind: 'docked', position: 'bottom-right' } },
        ['n', 'w', 'nw'],
      ],
      [
        { mode: 'fixed', disposition: { kind: 'docked', position: 'center-left' } },
        ['n', 'ne', 'e', 'se', 's'],
      ],
      [{ mode: 'fixed', disposition: { kind: 'docked', position: 'full-left' } }, ['e']],
      [{ mode: 'fixed', disposition: { kind: 'docked', position: 'full-right' } }, ['w']],
      [{ mode: 'fixed', disposition: { kind: 'docked', position: 'full-top' } }, ['s']],
      [{ mode: 'fixed', disposition: { kind: 'docked', position: 'full-bottom' } }, ['n']],
    ]
    for (const [placement, targets] of cases)
      expect(resolveDashPanelResizeTargets({ placement })).toEqual(targets)
    expect(resolveDashPanelResizeTargets({ placement: free, available: false })).toEqual([])
    expect(resolveDashPanelResizeTargets({ placement: free, resize: false })).toEqual([])
    expect(
      resolveDashPanelResizeTargets({
        placement: free,
        minimum: { width: 300, height: 80 },
        maximum: { width: 300, height: 600 },
      }),
    ).toEqual(['n', 's'])
  })

  it('mirrors centered-axis movement and limits it symmetrically at the boundary', () => {
    const placement = {
      mode: 'floating',
      disposition: { kind: 'snapped', position: 'top' },
    } as const
    const result = resizeDashPanelRect({
      start,
      target: 'e',
      delta: { x: 30, y: 0 },
      boundary,
      minimum,
      maximum,
      placement,
    })
    expect(result.rect).toEqual({
      left: 170,
      top: 150,
      right: 530,
      bottom: 350,
      width: 360,
      height: 200,
    })
    expect(result.diff).toEqual({ x: -30, y: 0, width: 60, height: 0 })
    const blocked = resizeDashPanelRect({
      start,
      target: 'ne',
      delta: { x: 30, y: 30 },
      boundary,
      minimum,
      maximum,
      placement,
    })
    expect(blocked.rect).toEqual({ ...start, width: 300, height: 200 })
    expect(blocked.axes).toEqual([])
  })

  it('starts from a projected rectangle and changes only the deliberately manipulated axis', () => {
    const projected = { left: 0, top: 0, right: 300, bottom: 250 }
    const result = resizeDashPanelRect({
      start: projected,
      target: 'e',
      delta: { x: 20, y: 200 },
      boundary: { left: 0, top: 0, right: 340, bottom: 250 },
      minimum,
      maximum,
      placement: free,
    })
    expect(result.rect).toEqual({
      left: 0,
      top: 0,
      right: 320,
      bottom: 250,
      width: 320,
      height: 250,
    })
    expect(result.axes).toEqual(['width'])
    expect(result.diff).toEqual({ x: 0, y: 0, width: 20, height: 0 })
    const unchanged = resizeDashPanelRect({
      start: projected,
      target: 'e',
      delta: { x: 0, y: 0 },
      boundary,
      minimum,
      maximum,
      placement: free,
    })
    expect(unchanged.diff).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  it('preserves finite contained geometry and anchors across a bounded generated boundary model', () => {
    const lengths = [0, 0.125, 1, 12.5, 99.75, 320, 799.5]
    const deltas = [-1_000, -0.25, 0, 0.5, 1_000]
    const centered = {
      mode: 'floating',
      disposition: { kind: 'snapped', position: 'top' },
    } as const
    const tolerance = 1e-8
    for (const width of lengths) {
      for (const height of lengths) {
        const modelBoundary = {
          left: -17.25,
          right: -17.25 + width,
          top: 3.5,
          bottom: 3.5 + height,
        }
        const modelStart = {
          left: modelBoundary.left + width * 0.2,
          right: modelBoundary.left + width * 0.8,
          top: modelBoundary.top + height * 0.2,
          bottom: modelBoundary.top + height * 0.8,
        }
        const startWidth = modelStart.right - modelStart.left
        const startHeight = modelStart.bottom - modelStart.top
        for (const declaredMinimum of [0, 1_000]) {
          const limits = resolveDashPanelSizing({
            preferred: { width: startWidth, height: startHeight },
            boundary: { width, height },
            minWidth: declaredMinimum,
            minHeight: declaredMinimum,
          })
          for (const delta of deltas) {
            for (const target of DASH_PANEL_RESIZE_TARGETS) {
              const result = resizeDashPanelRect({
                start: modelStart,
                boundary: modelBoundary,
                target,
                delta: { x: delta, y: -delta },
                minimum: limits.minimum,
                maximum: limits.maximum,
                placement: free,
              })
              const rect = result.rect
              for (const value of Object.values(rect)) expect(Number.isFinite(value)).toBe(true)
              expect(rect.width).toBeGreaterThanOrEqual(0)
              expect(rect.height).toBeGreaterThanOrEqual(0)
              expect(rect.left).toBeGreaterThanOrEqual(modelBoundary.left - tolerance)
              expect(rect.right).toBeLessThanOrEqual(modelBoundary.right + tolerance)
              expect(rect.top).toBeGreaterThanOrEqual(modelBoundary.top - tolerance)
              expect(rect.bottom).toBeLessThanOrEqual(modelBoundary.bottom + tolerance)
              if (target.includes('w')) expect(rect.right).toBeCloseTo(modelStart.right, 8)
              else if (target.includes('e')) expect(rect.left).toBeCloseTo(modelStart.left, 8)
              else {
                expect(rect.left).toBe(modelStart.left)
                expect(rect.right).toBe(modelStart.right)
              }
              if (target.includes('n')) expect(rect.bottom).toBeCloseTo(modelStart.bottom, 8)
              else if (target.includes('s')) expect(rect.top).toBeCloseTo(modelStart.top, 8)
              else {
                expect(rect.top).toBe(modelStart.top)
                expect(rect.bottom).toBe(modelStart.bottom)
              }
            }
            const symmetric = resizeDashPanelRect({
              start: modelStart,
              boundary: modelBoundary,
              target: 'e',
              delta: { x: delta, y: 0 },
              minimum: limits.minimum,
              maximum: limits.maximum,
              placement: centered,
            }).rect
            expect(symmetric.left + symmetric.right).toBeCloseTo(
              modelStart.left + modelStart.right,
              8,
            )
            expect(symmetric.top).toBe(modelStart.top)
            expect(symmetric.bottom).toBe(modelStart.bottom)
          }
        }
      }
    }
  })

  it('keeps a full dock allocation-owned axis unavailable and its manual preference dormant', () => {
    const manual = { width: 350, height: 500 }
    const docked = resolveDashPanelSizing({
      preferred: { width: 300, height: 250 },
      manual,
      boundary: { width: 800, height: 600 },
      allocation: { height: 125 },
    })
    expect(docked.desired.height).toBe(500)
    expect(docked.resolved.height).toBe(125)
    expect(docked.source.height).toBe('manual')
    expect(
      resolveDashPanelResizeTargets({
        placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-left' } },
        minimum: docked.minimum,
        maximum: docked.maximum,
      }),
    ).toEqual(['e'])
    expect(
      resolveDashPanelSizing({
        preferred: { width: 300, height: 250 },
        manual,
        boundary: { width: 800, height: 600 },
      }).resolved.height,
    ).toBe(500)
  })
})
