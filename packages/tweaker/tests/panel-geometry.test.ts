import { describe, expect, test } from 'vite-plus/test'
import {
  PANEL_MIN_VISIBLE_HEIGHT,
  fixedPanelRect,
  fixedPanelRetraction,
  panelMaxWidthForBoundary,
  panelParticipatesInSnapping,
  projectPanelGeometry,
} from '../src/panel-geometry.ts'
import { snapPanelPosition, type PanelRect } from '../src/panel-snapping.ts'
import {
  nonFixedPanelMaxWidthForBoundary,
  panelHasCallerConstraint,
  panelUsesBottomConstraint,
} from '../src/use-panel-layout.ts'

test('detects bottom constraints with Typed OM and legacy computed-style fallback', () => {
  expect(
    panelUsesBottomConstraint({
      computedBottom: '165px',
      computedTop: '32px',
      typedBottom: 'auto',
    }),
  ).toBe(false)
  expect(
    panelUsesBottomConstraint({
      computedBottom: '16px',
      computedTop: '620px',
      typedBottom: '16px',
      typedTop: 'auto',
    }),
  ).toBe(true)
  expect(
    panelUsesBottomConstraint({
      computedBottom: '16px',
      computedTop: '32px',
      typedBottom: '16px',
      typedTop: '32px',
    }),
  ).toBe(false)
  expect(
    panelUsesBottomConstraint({
      computedBottom: '16px',
      computedTop: 'auto',
    }),
  ).toBe(true)
  expect(
    panelUsesBottomConstraint({
      computedBottom: '165px',
      computedTop: '32px',
    }),
  ).toBe(false)
})

test('projects a custom bottom inset independently from the other bounds', () => {
  const projection = projectPanelGeometry({
    anchor: 'bottom',
    baseRect: {
      bottom: 180,
      height: 180,
      left: 564,
      right: 884,
      top: 0,
      width: 320,
    },
    bottomInset: 80,
    containerRect: {
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
    },
    intrinsicHeight: 180,
    position: { x: 0, y: 0 },
  })

  expect(projection.rect).toMatchObject({
    bottom: 520,
    left: 564,
    right: 884,
  })
})

test('honors a bottom inset larger than half the container', () => {
  const projection = projectPanelGeometry({
    anchor: 'bottom',
    baseRect: {
      bottom: 24,
      height: 24,
      left: 16,
      right: 56,
      top: 0,
      width: 40,
    },
    bottomInset: 60,
    containerRect: {
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
    },
    inset: 16,
    intrinsicHeight: 24,
    position: { x: 0, y: 0 },
  })

  expect(projection.rect.bottom).toBe(40)
})

describe('panel geometry projection', () => {
  test('leaves a fitting panel at its requested position', () => {
    const projection = projectPanelGeometry({
      anchor: 'top',
      baseRect: rect(100, 80, 160, 120),
      containerRect: rect(0, 0, 500, 400),
      position: { x: 20, y: 30 },
    })

    expect(projection.position).toEqual({ x: 20, y: 30 })
    expect(projection.rect).toEqual(rect(120, 110, 160, 120))
    expect(projection.availableHeight).toBe(282)
  })

  test('preserves the dragged top and restores height continuously when moving upward', () => {
    const input = {
      anchor: 'top' as const,
      baseRect: rect(80, 40, 180, 360),
      containerRect: rect(0, 0, 500, 400),
      intrinsicHeight: 360,
      position: { x: 0, y: 0 },
    }
    const low = projectPanelGeometry({ ...input, position: { x: 0, y: 240 } })
    const middle = projectPanelGeometry({ ...input, position: { x: 0, y: 160 } })
    const high = projectPanelGeometry({ ...input, position: { x: 0, y: 40 } })

    expect(low.rect.top).toBe(280)
    expect(middle.rect.top).toBe(200)
    expect(high.rect.top).toBe(80)
    expect([low.rect.height, middle.rect.height, high.rect.height]).toEqual([112, 192, 312])
  })

  test('uses explicit top and bottom anchors', () => {
    const baseRect = rect(100, 100, 160, 220)
    const containerRect = rect(0, 0, 500, 400)
    const top = projectPanelGeometry({
      anchor: 'top',
      baseRect,
      containerRect,
      position: { x: 0, y: 80 },
    })
    const bottom = projectPanelGeometry({
      anchor: 'bottom',
      baseRect,
      containerRect,
      position: { x: 0, y: 80 },
    })

    expect(top.rect.top).toBe(180)
    expect(top.rect.bottom).toBe(392)
    expect(bottom.rect.top).toBe(172)
    expect(bottom.rect.bottom).toBe(392)
  })

  test('constrains expansion without moving an undocked top', () => {
    const common = {
      anchor: 'top' as const,
      baseRect: rect(64, 210, 200, 100),
      containerRect: rect(0, 0, 500, 400),
      position: { x: 0, y: 0 },
    }
    const collapsed = projectPanelGeometry({ ...common, intrinsicHeight: 100 })
    const expanded = projectPanelGeometry({ ...common, intrinsicHeight: 300 })

    expect(collapsed.rect).toEqual(rect(64, 210, 200, 100))
    expect(expanded.rect.top).toBe(collapsed.rect.top)
    expect(expanded.rect.bottom).toBe(392)
    expect(expanded.rect.height).toBe(182)
  })

  test('grows a bottom-docked panel upward after expansion', () => {
    const common = {
      anchor: 'bottom' as const,
      baseRect: rect(64, 284, 200, 100),
      containerRect: rect(0, 0, 500, 400),
      position: { x: 0, y: 0 },
    }
    const collapsed = projectPanelGeometry({ ...common, intrinsicHeight: 100 })
    const expanded = projectPanelGeometry({ ...common, intrinsicHeight: 260 })

    expect(collapsed.rect.bottom).toBe(392)
    expect(expanded.rect.bottom).toBe(392)
    expect(expanded.rect.top).toBe(132)
  })

  test('handles small and non-zero-origin containers', () => {
    const projection = projectPanelGeometry({
      anchor: 'top',
      baseRect: rect(0, 0, 30, 50),
      containerRect: rect(40, 70, 10, 20),
      position: { x: 100, y: 100 },
    })

    expect(projection.rect.top).toBe(78)
    expect(projection.rect.bottom).toBe(82)
    expect(projection.rect.height).toBe(4)
    expect(projection.position.x).toBe(45)
  })

  test('keeps at least the header visible when the viewport has room', () => {
    const projection = projectPanelGeometry({
      anchor: 'top',
      baseRect: rect(20, 20, 180, 300),
      containerRect: rect(0, 0, 500, 400),
      position: { x: 0, y: 1_000 },
    })

    expect(projection.rect.top).toBe(392 - PANEL_MIN_VISIBLE_HEIGHT)
    expect(projection.rect.height).toBe(PANEL_MIN_VISIBLE_HEIGHT)
  })

  test('keeps horizontal clamping and does not infer bottom docking from containment', () => {
    const snapped = snapPanelPosition({
      baseRect: rect(100, 40, 160, 360),
      containerRect: rect(0, 0, 500, 400),
      position: { x: 1_000, y: 240 },
    })

    expect(snapped.position).toEqual({ x: 232, y: 240 })
    expect(snapped.dock).toEqual({ horizontal: 'right' })
    expect(snapped).not.toHaveProperty('height')
    expect(snapped).not.toHaveProperty('availableHeight')
  })
})

describe('fixed panel geometry', () => {
  const boundaryRect = rect(120, 80, 640, 480)

  test.each([
    ['top-left', rect(120, 80, 280, 240)],
    ['bottom-left', rect(120, 320, 280, 240)],
    ['top-right', rect(480, 80, 280, 240)],
    ['bottom-right', rect(480, 320, 280, 240)],
    ['left', rect(120, 80, 280, 240)],
    ['right', rect(480, 80, 280, 240)],
  ] as const)('places %s flush with its boundary', (position, expected) => {
    expect(fixedPanelRect({ boundaryRect, height: 240, position, width: 280 })).toEqual(expected)
  })

  test('caps fixed dimensions to the visible boundary', () => {
    expect(
      fixedPanelRect({ boundaryRect, height: 800, position: 'bottom-right', width: 900 }),
    ).toEqual(boundaryRect)
  })

  test.each([
    ['top-left', { x: -280, y: 0 }],
    ['left', { x: -280, y: 0 }],
    ['top-right', { x: 280, y: 0 }],
    ['right', { x: 280, y: 0 }],
    ['bottom-left', { x: -280, y: 240 }],
    ['bottom-right', { x: 280, y: 240 }],
  ] as const)('retracts %s through its docked edge', (position, expected) => {
    expect(fixedPanelRetraction(position, { height: 240, width: 280 })).toEqual(expected)
  })
})

describe('boundary width constraints', () => {
  test('caps a panel to a narrower custom boundary', () => {
    expect(panelMaxWidthForBoundary(240, 480)).toBe(240)
    expect(panelMaxWidthForBoundary(240, Number.POSITIVE_INFINITY)).toBe(240)
  })

  test('preserves a stricter caller maximum width', () => {
    expect(panelMaxWidthForBoundary(480, 220)).toBe(220)
  })

  test('reserves both safe insets for a non-fixed panel', () => {
    expect(nonFixedPanelMaxWidthForBoundary(240, Number.POSITIVE_INFINITY)).toBe(224)
    expect(nonFixedPanelMaxWidthForBoundary(240, 200)).toBe(200)
  })
})

test('detects caller constraints only on the requested fixed panel axis', () => {
  expect(panelHasCallerConstraint(undefined, 'max-h-48 text-sm', 'height')).toBe(true)
  expect(panelHasCallerConstraint(undefined, 'max-h-48 text-sm', 'width')).toBe(false)
  expect(panelHasCallerConstraint(undefined, 'max-w-56 text-sm', 'width')).toBe(true)
  expect(panelHasCallerConstraint(undefined, 'max-w-56 text-sm', 'height')).toBe(false)
  expect(panelHasCallerConstraint(undefined, 'rounded-lg bg-black/80', 'height')).toBe(false)
  expect(panelHasCallerConstraint(undefined, 'rounded-lg bg-black/80', 'width')).toBe(false)
})

test('detects variant, important, arbitrary, and inline fixed panel constraints', () => {
  expect(panelHasCallerConstraint(undefined, 'md:max-h-48', 'height')).toBe(true)
  expect(panelHasCallerConstraint(undefined, 'hover:!max-w-56', 'width')).toBe(true)
  expect(panelHasCallerConstraint(undefined, '[max-height:12rem]', 'height')).toBe(true)
  expect(panelHasCallerConstraint(undefined, 'lg:[max-width:24rem]', 'width')).toBe(true)
  expect(panelHasCallerConstraint(320, undefined, 'width')).toBe(true)
  expect(panelHasCallerConstraint('12rem', undefined, 'height')).toBe(true)
})

test('removes only retracted fixed panels from peer snapping', () => {
  expect(panelParticipatesInSnapping({ mode: 'fixed', position: 'left' }, true)).toBe(false)
  expect(panelParticipatesInSnapping({ mode: 'fixed', position: 'left' }, false)).toBe(true)
  expect(panelParticipatesInSnapping({ mode: 'floating' }, true)).toBe(true)
  expect(panelParticipatesInSnapping({ mode: 'magnetic', position: 'right' }, true)).toBe(true)
})

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
