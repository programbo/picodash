import { describe, expect, it } from 'vite-plus/test'
import {
  classifyDashPanelPlacement,
  DASH_PANEL_DOCK_POSITIONS,
  resolvePanelDockPositions,
  resolveProviderDockPositions,
  type DashPanelPlacementAvailability,
} from './dock-policy.ts'
import type { DashPanelDockPosition, DashPanelPlacement } from './placement.ts'

const canonical = [...DASH_PANEL_DOCK_POSITIONS]

describe('DashPanel dock-position policy', () => {
  it('uses the canonical order and enables every provider position by default', () => {
    const resolved = resolveProviderDockPositions()
    expect(resolved).toEqual(canonical)
    expect(resolved).not.toBe(DASH_PANEL_DOCK_POSITIONS)
    expect(Object.isFrozen(DASH_PANEL_DOCK_POSITIONS)).toBe(true)
    expect(Object.isFrozen(resolved)).toBe(true)
  })

  it('deduplicates arbitrary input order and preserves explicit empty policy', () => {
    const resolved = resolveProviderDockPositions([
      'center-bottom',
      'top-left',
      'center-bottom',
      'full-left',
      'top-left',
    ])
    expect(resolved).toEqual(['top-left', 'full-left', 'center-bottom'])
    expect(resolveProviderDockPositions([])).toEqual([])
    expect(Object.isFrozen(resolveProviderDockPositions([]))).toBe(true)
  })

  it('inherits the provider maximum and permits only narrowing', () => {
    const provider = resolveProviderDockPositions(['full-right', 'top-left', 'center-left'])
    const inherited = resolvePanelDockPositions(provider)
    expect(inherited).toEqual(['top-left', 'center-left', 'full-right'])
    expect(inherited).not.toBe(provider)
    expect(resolvePanelDockPositions(provider, ['full-right', 'top-left', 'top-left'])).toEqual([
      'top-left',
      'full-right',
    ])
    expect(resolvePanelDockPositions(provider, [])).toEqual([])
    expect(() => resolvePanelDockPositions(provider, ['center-right'])).toThrow(TypeError)
  })

  it('rejects unknown or malformed runtime position values synchronously', () => {
    const invalid: unknown[] = [
      null,
      {},
      'top-left',
      [Symbol('position')],
      ['middle-left'],
      ['top-left', 1],
    ]
    for (const value of invalid) {
      expect(() => resolveProviderDockPositions(value as never)).toThrow(TypeError)
      expect(() => resolvePanelDockPositions(DASH_PANEL_DOCK_POSITIONS, value as never)).toThrow(
        TypeError,
      )
    }
    expect(() => resolvePanelDockPositions(['middle-left'] as never)).toThrow(TypeError)
  })

  it('classifies floating and permitted hybrid placements as available', () => {
    const positions = resolveProviderDockPositions(['top-left'])
    const available: DashPanelPlacement[] = [
      { mode: 'floating', disposition: { kind: 'free' } },
      { mode: 'floating', disposition: { kind: 'snapped', position: 'left' } },
      { mode: 'hybrid', disposition: { kind: 'free' } },
      { mode: 'hybrid', disposition: { kind: 'snapped', position: 'top' } },
      { mode: 'hybrid', disposition: { kind: 'snapped', position: 'bottom' } },
      { mode: 'fixed', disposition: { kind: 'docked', position: 'top-left' } },
      { mode: 'hybrid', disposition: { kind: 'docked', position: 'top-left' } },
    ]
    for (const placement of available) {
      const result = classifyDashPanelPlacement(placement, positions)
      expect(result).toEqual({ status: 'available' })
      expect(Object.isFrozen(result)).toBe(true)
    }
  })

  it('marks disabled fixed and hybrid dock targets dormant and re-enables them', () => {
    const placement: DashPanelPlacement = {
      mode: 'fixed',
      disposition: { kind: 'docked', position: 'full-right' },
    }
    const disabled = classifyDashPanelPlacement(placement, ['top-left'])
    expect(disabled).toEqual({
      status: 'dormant',
      reason: 'position_disabled',
      position: 'full-right',
    })
    expect(Object.isFrozen(disabled)).toBe(true)
    expect(classifyDashPanelPlacement(placement, ['full-right'])).toEqual({ status: 'available' })
  })

  it('isolates outputs from mutable input arrays and does not mutate placement inputs', () => {
    const input = ['center-right', 'top-left'] as DashPanelDockPosition[]
    const resolved = resolveProviderDockPositions(input)
    input[0] = 'full-top'
    input.push('bottom-left')
    expect(resolved).toEqual(['top-left', 'center-right'])

    const placement: DashPanelPlacement = {
      mode: 'hybrid',
      disposition: { kind: 'docked', position: 'center-right' },
    }
    const result: DashPanelPlacementAvailability = classifyDashPanelPlacement(placement, resolved)
    expect(result).toEqual({ status: 'available' })
    expect(placement).toEqual({
      mode: 'hybrid',
      disposition: { kind: 'docked', position: 'center-right' },
    })
  })
})
