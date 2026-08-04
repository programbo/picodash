import { expect, test } from 'vite-plus/test'

import { fixedPanelRect } from './panel-geometry.ts'
import {
  clampPanelPosition,
  hybridDockPositionForPointer,
  insetPanelRect,
  positionForPanelLayout,
  resolvePicodashPanelBoundaryInset,
  snapPanelPosition,
  type PanelRect,
} from './panel-snapping.ts'

const rawBoundary = rect(0, 0, 320, 300)

test('resolves every CSS shorthand form', () => {
  expect(resolvePicodashPanelBoundaryInset(4)).toEqual({
    bottom: 4,
    left: 4,
    right: 4,
    top: 4,
  })
  expect(resolvePicodashPanelBoundaryInset([4, 8])).toEqual({
    bottom: 4,
    left: 8,
    right: 8,
    top: 4,
  })
  expect(resolvePicodashPanelBoundaryInset([4, 8, 12])).toEqual({
    bottom: 12,
    left: 8,
    right: 8,
    top: 4,
  })
  expect(resolvePicodashPanelBoundaryInset([4, 8, 12, 16])).toEqual({
    bottom: 12,
    left: 16,
    right: 8,
    top: 4,
  })
})

test('inherits the provider inset while explicit zero clears it', () => {
  const providerInset = [64, 16, 48, 16] as const
  expect(resolvePicodashPanelBoundaryInset(undefined, providerInset)).toEqual({
    bottom: 48,
    left: 16,
    right: 16,
    top: 64,
  })
  expect(resolvePicodashPanelBoundaryInset(0, providerInset)).toEqual({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  })
})

test('normalizes invalid sides and prevents the effective boundary from inverting', () => {
  const inset = resolvePicodashPanelBoundaryInset([-1, Number.POSITIVE_INFINITY, 400, 500])
  expect(inset).toEqual({ bottom: 400, left: 500, right: 0, top: 0 })
  expect(insetPanelRect(rawBoundary, inset)).toEqual({
    bottom: 0,
    height: 0,
    left: 320,
    right: 320,
    top: 0,
    width: 0,
  })
})

test('contains free placement at the effective boundary without snap offset padding', () => {
  const boundary = effectiveBoundary()
  const baseRect = rect(0, 0, 100, 80)
  const result = snapPanelPosition({
    baseRect,
    containerRect: boundary,
    options: { gap: 8, threshold: 0 },
    position: { x: 0, y: 0 },
  })

  expect(result.dock).toBeNull()
  expect(result.position).toEqual({ x: 16, y: 64 })
})

test('keeps docks flush while snapped placement adds snap offset', () => {
  const boundary = effectiveBoundary()
  const baseRect = rect(0, 0, 100, 80)
  const snapped = snapPanelPosition({
    baseRect,
    containerRect: boundary,
    options: { gap: 8, threshold: 0 },
    position: { x: 24, y: 72 },
  })
  const docked = fixedPanelRect({
    boundaryRect: boundary,
    height: 80,
    position: 'bottom-right',
    width: 100,
  })

  expect(snapped.dock).toEqual({ horizontal: 'left', vertical: 'top' })
  expect(snapped.position).toEqual({ x: 24, y: 72 })
  expect(docked).toEqual(rect(204, 172, 100, 80))
})

test('measures snap proximity from the offset target', () => {
  const boundary = effectiveBoundary()
  const baseRect = rect(100, 0, 100, 80)
  const atThreshold = snapPanelPosition({
    baseRect,
    containerRect: boundary,
    options: { gap: 8, threshold: 16, viewportDocks: ['top'] },
    position: { x: 0, y: 88 },
  })
  const beyondThreshold = snapPanelPosition({
    baseRect,
    containerRect: boundary,
    options: { gap: 8, threshold: 16, viewportDocks: ['top'] },
    position: { x: 0, y: 89 },
  })

  expect(atThreshold.dock).toEqual({ vertical: 'top' })
  expect(atThreshold.position.y).toBe(72)
  expect(beyondThreshold.dock).toBeNull()
  expect(beyondThreshold.position.y).toBe(89)
})

test('uses the effective boundary as the persisted coordinate origin after resize', () => {
  const baseRect = rect(0, 0, 100, 80)
  const layout = {
    placement: { disposition: { kind: 'free' }, mode: 'floating' },
    preferredCoordinates: { x: 220, y: 180 },
  } as const
  const expanded = positionForPanelLayout({
    baseRect,
    containerRect: effectiveBoundary(),
    layout,
  })
  const resizedBoundary = insetPanelRect(
    rect(0, 0, 240, 220),
    resolvePicodashPanelBoundaryInset([64, 16, 48, 16]),
  )
  const resized = clampPanelPosition(
    positionForPanelLayout({ baseRect, containerRect: resizedBoundary, layout }),
    baseRect,
    resizedBoundary,
  )

  expect(expanded).toEqual({ x: 236, y: 244 })
  expect(resized).toEqual({ x: 124, y: 92 })
})

test('targets Hybrid docks at the effective edge and vertical snaps at the offset line', () => {
  const boundary = effectiveBoundary()
  expect(
    hybridDockPositionForPointer({
      containerRect: boundary,
      panelRect: rect(30, 120, 100, 80),
      pointer: { x: 30, y: 150 },
      snapOffset: 8,
      snapProximity: 16,
    }),
  ).toBe('full-left')
  expect(
    hybridDockPositionForPointer({
      containerRect: boundary,
      panelRect: rect(100, 88, 100, 80),
      pointer: { x: 150, y: 88 },
      snapOffset: 8,
      snapProximity: 16,
    }),
  ).toBe('top')
})

function effectiveBoundary() {
  return insetPanelRect(rawBoundary, resolvePicodashPanelBoundaryInset([64, 16, 48, 16]))
}

function rect(left: number, top: number, width: number, height: number): PanelRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  }
}
