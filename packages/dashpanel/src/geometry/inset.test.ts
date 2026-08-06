import { describe, expect, it } from 'vite-plus/test'
import {
  insetDashPanelRect,
  resolveDashPanelBoundaryInset,
  type DashPanelRectEdges,
  type ResolvedDashPanelBoundaryInset,
} from './inset.ts'

const expectInset = (value: ResolvedDashPanelBoundaryInset) => {
  expect(Object.keys(value)).toEqual(['top', 'right', 'bottom', 'left'])
  expect(Object.getPrototypeOf(value)).toBe(Object.prototype)
  expect(Object.isFrozen(value)).toBe(true)
}

describe('DashPanel boundary inset algebra', () => {
  it('expands every accepted shorthand into a frozen detached record', () => {
    const cases: Array<[unknown, ResolvedDashPanelBoundaryInset]> = [
      [8, { top: 8, right: 8, bottom: 8, left: 8 }],
      [[2, 4], { top: 2, right: 4, bottom: 2, left: 4 }],
      [[1, 3, 5], { top: 1, right: 3, bottom: 5, left: 3 }],
      [[1, 2, 3, 4], { top: 1, right: 2, bottom: 3, left: 4 }],
      [-0, { top: 0, right: 0, bottom: 0, left: 0 }],
      [[-0, 0, -0, 0], { top: 0, right: 0, bottom: 0, left: 0 }],
    ]
    for (const [input, expected] of cases) {
      const resolved = resolveDashPanelBoundaryInset(input as never)
      expect(resolved).toEqual(expected)
      expectInset(resolved)
      expect(Object.is(resolved.top, -0)).toBe(false)
    }

    const source = [1, 2, 3, 4]
    const resolved = resolveDashPanelBoundaryInset(source as never)
    source[0] = 99
    expect(resolved.top).toBe(1)
    expect(resolved).not.toBe(source)
  })

  it('selects Panel, then Provider, then zero before validating', () => {
    expect(resolveDashPanelBoundaryInset(undefined)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })
    expect(resolveDashPanelBoundaryInset(undefined, [1, 2])).toEqual({
      top: 1,
      right: 2,
      bottom: 1,
      left: 2,
    })
    expect(resolveDashPanelBoundaryInset(0, [10, 20])).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })
    expect(() => resolveDashPanelBoundaryInset(null as never, [10, 20])).toThrow(TypeError)
    expect(() => resolveDashPanelBoundaryInset([1] as never, [10, 20])).toThrow(TypeError)
    expect(() => resolveDashPanelBoundaryInset(undefined, null as never)).toThrow(TypeError)
    expect(() => resolveDashPanelBoundaryInset(undefined, [1, Number.NaN] as never)).toThrow(
      TypeError,
    )
  })

  it('rejects every invalid inset form without an invalid fallback', () => {
    const invalid: unknown[] = [
      null,
      true,
      '8',
      new Number(8),
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      [],
      [8],
      [8, 16, 24, 32, 40],
      [8, undefined],
      [8, '16'],
      [8, null],
      [8, Number.NaN],
      [8, Number.POSITIVE_INFINITY],
    ]
    for (const value of invalid) {
      expect(() => resolveDashPanelBoundaryInset(value as never)).toThrow(TypeError)
      expect(() => resolveDashPanelBoundaryInset(value as never, 4)).toThrow(TypeError)
      expect(() => resolveDashPanelBoundaryInset(undefined, value as never)).toThrow(TypeError)
    }

    const sparse = Array<number>(2)
    sparse[1] = 1
    expect(() => resolveDashPanelBoundaryInset(sparse as never)).toThrow(TypeError)
  })

  it('snapshots tuple members once while propagating getter failures', () => {
    let reads = 0
    const tuple = [1, 2, 3, 4] as unknown as number[]
    Object.defineProperty(tuple, 0, {
      enumerable: true,
      configurable: true,
      get: () => {
        reads += 1
        return 1
      },
    })
    const resolved = resolveDashPanelBoundaryInset(tuple as never)
    expect(resolved.top).toBe(1)
    expect(reads).toBe(1)

    const failure = new Error('inset getter failed')
    const failing = [1, 2] as unknown as number[]
    Object.defineProperty(failing, 1, {
      get: () => {
        throw failure
      },
      enumerable: true,
    })
    expect(() => resolveDashPanelBoundaryInset(failing as never)).toThrow(failure)
  })

  it('insets normal, negative-origin, and zero-area rectangles with stale dimensions ignored', () => {
    const rect = {
      top: 10,
      right: 110,
      bottom: 210,
      left: 5,
      width: 999,
      height: -1,
    }
    const inset = resolveDashPanelBoundaryInset([1, 2, 3, 4] as never)
    const result = insetDashPanelRect(rect, inset)
    expect(result).toEqual({ top: 11, right: 108, bottom: 207, left: 9, width: 99, height: 196 })
    expect(Object.keys(result)).toEqual(['top', 'right', 'bottom', 'left', 'width', 'height'])
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(Object.isFrozen(result)).toBe(true)
    expect(insetDashPanelRect({ top: -20, right: 30, bottom: 40, left: -10 }, inset)).toEqual({
      top: -19,
      right: 28,
      bottom: 37,
      left: -6,
      width: 34,
      height: 56,
    })
    expect(insetDashPanelRect({ top: 4, right: 4, bottom: 4, left: 4 }, inset)).toEqual({
      top: 4,
      right: 4,
      bottom: 4,
      left: 4,
      width: 0,
      height: 0,
    })
  })

  it('keeps every overconstrained axis coherent with top and left precedence', () => {
    const cases: Array<[DashPanelRectEdges, ResolvedDashPanelBoundaryInset, DashPanelRectEdges]> = [
      [
        { top: 0, right: 100, bottom: 100, left: 0 },
        { top: 0, right: 0, bottom: 0, left: 150 },
        { top: 0, right: 100, bottom: 100, left: 100 },
      ],
      [
        { top: 0, right: 100, bottom: 100, left: 0 },
        { top: 0, right: 150, bottom: 0, left: 0 },
        { top: 0, right: 0, bottom: 100, left: 0 },
      ],
      [
        { top: 0, right: 100, bottom: 100, left: 0 },
        { top: 150, right: 0, bottom: 0, left: 0 },
        { top: 100, right: 100, bottom: 100, left: 0 },
      ],
      [
        { top: 0, right: 100, bottom: 100, left: 0 },
        { top: 0, right: 0, bottom: 150, left: 0 },
        { top: 0, right: 100, bottom: 0, left: 0 },
      ],
      [
        { top: 0, right: 100, bottom: 100, left: 0 },
        { top: 150, right: 150, bottom: 150, left: 150 },
        { top: 100, right: 100, bottom: 100, left: 100 },
      ],
    ]
    for (const [rect, inset, expected] of cases) {
      const result = insetDashPanelRect(rect, inset)
      expect(result).toMatchObject(expected)
      expect(result.width).toBe(result.right - result.left)
      expect(result.height).toBe(result.bottom - result.top)
      expect(result.width).toBeGreaterThanOrEqual(0)
      expect(result.height).toBeGreaterThanOrEqual(0)
    }
  })

  it('rejects missing, wrong, nonfinite, inverted, and infinite-span rectangles', () => {
    const inset = resolveDashPanelBoundaryInset(1)
    const invalid: unknown[] = [
      null,
      [],
      {},
      { top: 0, right: 1, bottom: 1 },
      { top: 0, right: '1', bottom: 1, left: 0 },
      { top: 0, right: 1, bottom: Number.NaN, left: 0 },
      { top: 0, right: Number.POSITIVE_INFINITY, bottom: 1, left: 0 },
      { top: 1, right: 0, bottom: 1, left: 1 },
      { top: 0, right: 1, bottom: -1, left: 0 },
      { top: 0, right: Number.MAX_VALUE, bottom: 1, left: -Number.MAX_VALUE },
    ]
    for (const rect of invalid)
      expect(() => insetDashPanelRect(rect as never, inset)).toThrow(TypeError)
  })

  it('accepts inherited edge getters, snapshots each edge once, and propagates throws', () => {
    const reads = { top: 0, right: 0, bottom: 0, left: 0 }
    const proto = {
      get top() {
        reads.top += 1
        return -10
      },
      get right() {
        reads.right += 1
        return 20
      },
      get bottom() {
        reads.bottom += 1
        return 30
      },
      get left() {
        reads.left += 1
        return -5
      },
    }
    const rect = Object.create(proto) as DashPanelRectEdges
    const result = insetDashPanelRect(rect, resolveDashPanelBoundaryInset(2))
    expect(result).toMatchObject({ top: -8, right: 18, bottom: 28, left: -3 })
    expect(reads).toEqual({ top: 1, right: 1, bottom: 1, left: 1 })

    const failure = new Error('rect getter failed')
    const failing = Object.create({
      get top() {
        throw failure
      },
    }) as DashPanelRectEdges
    expect(() => insetDashPanelRect(failing, resolveDashPanelBoundaryInset(0))).toThrow(failure)
  })
})
