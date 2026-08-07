import { describe, expect, it } from 'vite-plus/test'
import {
  normalizeDashPanelDefaultLayout,
  normalizeDashPanelPlacement,
  normalizeDashPanelPlacementOptions,
  type DashPanelPlacement,
} from './placement.ts'

const snapPositions = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
] as const

const dockPositions = [
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
  'full-left',
  'center-left',
  'full-right',
  'center-right',
  'full-top',
  'center-top',
  'full-bottom',
  'center-bottom',
] as const

function expectDeepFrozen(value: unknown, seen = new Set<object>()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  expect(Object.isFrozen(value)).toBe(true)
  for (const child of Object.values(value)) expectDeepFrozen(child, seen)
}

describe('DashPanel placement algebra', () => {
  it('accepts every canonical snap and dock literal in its permitted modes', () => {
    const placements: unknown[] = [
      { mode: 'floating', disposition: { kind: 'free' } },
      ...snapPositions.map((position) => ({
        mode: 'floating',
        disposition: { kind: 'snapped', position },
      })),
      ...dockPositions.map((position) => ({
        mode: 'fixed',
        disposition: { kind: 'docked', position },
      })),
      { mode: 'hybrid', disposition: { kind: 'free' } },
      { mode: 'hybrid', disposition: { kind: 'snapped', position: 'top' } },
      { mode: 'hybrid', disposition: { kind: 'snapped', position: 'bottom' } },
      ...dockPositions.map((position) => ({
        mode: 'hybrid',
        disposition: { kind: 'docked', position },
      })),
    ]
    for (const value of placements) {
      const normalized = normalizeDashPanelPlacement(value)
      expect(normalized).toEqual(value)
      expectDeepFrozen(normalized)
    }
  })

  it('rejects retired positions, unknown keys, and cross-mode dispositions', () => {
    const invalid: unknown[] = [
      { mode: 'floating', disposition: { kind: 'docked', position: 'top-left' } },
      { mode: 'fixed', disposition: { kind: 'free' } },
      { mode: 'fixed', disposition: { kind: 'snapped', position: 'top' } },
      { mode: 'hybrid', disposition: { kind: 'snapped', position: 'left' } },
      { mode: 'floating', disposition: { kind: 'snapped', position: 'middle-left' } },
      { mode: 'floating', disposition: { kind: 'snapped', position: 'top', extra: true } },
      { mode: 'floating', disposition: { kind: 'free', position: 'top' } },
      { mode: 'unknown', disposition: { kind: 'free' } },
      { mode: 'floating', disposition: { kind: 'unknown' } },
      { mode: 'floating', disposition: { kind: 'snapped' } },
      { mode: 'floating', disposition: { kind: 'free' }, extra: true },
    ]
    for (const value of invalid) expect(() => normalizeDashPanelPlacement(value)).toThrow(TypeError)
  })

  it('normalizes frozen defaults and detached default layouts', () => {
    const placement = normalizeDashPanelPlacement(undefined)
    expect(placement).toEqual({
      mode: 'floating',
      disposition: { kind: 'snapped', position: 'top-right' },
    })
    expectDeepFrozen(placement)
    const layout = normalizeDashPanelDefaultLayout()
    expect(layout).toEqual({ placement })
    expect(layout.placement).not.toBe(placement)
    expectDeepFrozen(layout)
  })

  it('normalizes optional preferred coordinates, including negative finite values', () => {
    const source = {
      placement: { mode: 'hybrid', disposition: { kind: 'free' } },
      preferredPosition: { x: -Infinity, y: 2 },
    }
    expect(() => normalizeDashPanelDefaultLayout(source)).toThrow(TypeError)
    const normalized = normalizeDashPanelDefaultLayout({
      placement: { mode: 'hybrid', disposition: { kind: 'free' } },
      preferredPosition: { x: -12.5, y: 0 },
    })
    expect(normalized.preferredPosition).toEqual({ x: -12.5, y: 0 })
    expectDeepFrozen(normalized)
  })

  it('fills partial placement options and accepts finite non-negative boundaries', () => {
    expect(normalizeDashPanelPlacementOptions()).toEqual({
      snapOffset: 8,
      snapProximity: 16,
      detachDistance: 40,
    })
    expect(normalizeDashPanelPlacementOptions({ snapOffset: 0, detachDistance: 1.5 })).toEqual({
      snapOffset: 0,
      snapProximity: 16,
      detachDistance: 1.5,
    })
    expectDeepFrozen(normalizeDashPanelPlacementOptions({ snapProximity: Number.MAX_VALUE }))
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])
      expect(() => normalizeDashPanelPlacementOptions({ snapOffset: value })).toThrow(TypeError)
  })

  it('rejects hostile records, accessors, symbols, and malformed nested values', () => {
    const symbol = Symbol('unexpected')
    const accessor = {} as Record<string, unknown>
    Object.defineProperty(accessor, 'mode', { get: () => 'floating', enumerable: true })
    const nestedAccessor = { mode: 'floating', disposition: {} as Record<string, unknown> }
    Object.defineProperty(nestedAccessor.disposition, 'kind', {
      get: () => 'free',
      enumerable: true,
    })
    const hostile: unknown[] = [
      null,
      true,
      1,
      'floating',
      [],
      accessor,
      nestedAccessor,
      { mode: 'floating', disposition: { kind: 'free', [symbol]: true } },
      { placement: [], preferredPosition: { x: 1, y: 2 } },
      { placement: { mode: 'floating', disposition: { kind: 'free' } }, preferredPosition: null },
      { snapOffset: {} },
      { snapOffset: 1, unexpected: true },
    ]
    for (const value of hostile) {
      expect(() => normalizeDashPanelPlacement(value)).toThrow(TypeError)
    }
    expect(() => normalizeDashPanelDefaultLayout(hostile[8])).toThrow(TypeError)
    for (const value of hostile.slice(0, 7))
      expect(() => normalizeDashPanelPlacementOptions(value)).toThrow(TypeError)

    const validLayout = { placement: { mode: 'floating', disposition: { kind: 'free' } } }
    expect(() => normalizeDashPanelDefaultLayout({ placement: undefined })).toThrow(TypeError)
    expect(() => normalizeDashPanelDefaultLayout({ ...validLayout, extra: true })).toThrow(
      TypeError,
    )
    expect(() => normalizeDashPanelDefaultLayout({ ...validLayout, [symbol]: true })).toThrow(
      TypeError,
    )
    const layoutAccessor = { ...validLayout } as Record<string, unknown>
    Object.defineProperty(layoutAccessor, 'preferredPosition', { get: () => ({ x: 0, y: 0 }) })
    expect(() => normalizeDashPanelDefaultLayout(layoutAccessor)).toThrow(TypeError)

    expect(() => normalizeDashPanelPlacementOptions({ snapOffset: 0, extra: true })).toThrow(
      TypeError,
    )
    expect(() => normalizeDashPanelPlacementOptions({ snapOffset: 0, [symbol]: true })).toThrow(
      TypeError,
    )
    const optionsAccessor = {} as Record<string, unknown>
    Object.defineProperty(optionsAccessor, 'snapOffset', { get: () => 0, enumerable: true })
    expect(() => normalizeDashPanelPlacementOptions(optionsAccessor)).toThrow(TypeError)
  })

  it('returns a detached normalized clone rather than retaining caller records', () => {
    const source: DashPanelPlacement = {
      mode: 'floating',
      disposition: { kind: 'snapped', position: 'left' },
    }
    const normalized = normalizeDashPanelPlacement(source)
    expect(normalized).not.toBe(source)
    expect(normalized.disposition).not.toBe(source.disposition)
    expectDeepFrozen(normalized)
  })
})
