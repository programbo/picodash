import { describe, expect, test } from 'vite-plus/test'
import {
  PANEL_MIN_VISIBLE_HEIGHT,
  fixedPanelRect,
  fixedPanelRetraction,
  panelMaxWidthForBoundary,
  panelParticipatesInSnapping,
  projectPanelGeometry,
} from '../src/geometry/panel-geometry.ts'
import {
  DEFAULT_DETACH_THRESHOLD_MULTIPLIER,
  DEFAULT_SNAP_OFFSET,
  DEFAULT_SNAP_PROXIMITY,
  hybridDockPositionForPointer,
  initialPreferredCoordinatesForPlacement,
  isPanelPlacementFixedLike,
  positionForPanelLayout,
  resolvePicodashPanelPlacementOptions,
  snapPanelPosition,
  type PanelRect,
} from '../src/geometry/panel-snapping.ts'
import {
  floatingPanelMaxWidthForBoundary,
  panelHasCallerConstraint,
  panelUsesBottomConstraint,
  withoutCallerClassNames,
} from '../src/hooks/use-panel-layout.ts'

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

test('uses asymmetric header-aware intent to distinguish hybrid corners from full sides', () => {
  const containerRect: PanelRect = {
    bottom: 900,
    height: 900,
    left: 0,
    right: 1200,
    top: 0,
    width: 1200,
  }
  const panelRect: PanelRect = {
    bottom: 515,
    height: 500,
    left: 16,
    right: 336,
    top: 15,
    width: 320,
  }

  expect(
    hybridDockPositionForPointer({
      containerRect,
      panelRect,
      pointer: { x: 160, y: 15 },
      snapProximity: 16,
    }),
  ).toBe('top-left')
  expect(
    hybridDockPositionForPointer({
      containerRect,
      headerHeight: 40,
      panelRect: { ...panelRect, bottom: 564, top: 64 },
      pointer: { x: 160, y: 64 },
      snapProximity: 16,
    }),
  ).toBe('top-left')
  expect(
    hybridDockPositionForPointer({
      containerRect,
      headerHeight: 40,
      panelRect: { ...panelRect, bottom: 581, top: 81 },
      pointer: { x: 160, y: 81 },
      snapProximity: 16,
    }),
  ).toBe('full-left')
  expect(
    hybridDockPositionForPointer({
      containerRect,
      panelRect: { ...panelRect, bottom: 650, height: 200, top: 450 },
      pointer: { x: 160, y: 451 },
      snapProximity: 16,
    }),
  ).toBe('full-left')
  expect(
    hybridDockPositionForPointer({
      containerRect,
      panelRect: { ...panelRect, bottom: 651, height: 200, top: 451 },
      pointer: { x: 160, y: 451 },
      snapProximity: 16,
    }),
  ).toBe('bottom-left')
})

test('requires the panel side to reach proximity before hybrid dock intent is active', () => {
  const containerRect: PanelRect = {
    bottom: 900,
    height: 900,
    left: 0,
    right: 1200,
    top: 0,
    width: 1200,
  }
  const panelRect: PanelRect = {
    bottom: 300,
    height: 200,
    left: 17,
    right: 337,
    top: 100,
    width: 320,
  }

  expect(
    hybridDockPositionForPointer({
      containerRect,
      panelRect,
      pointer: { x: 160, y: 100 },
      snapProximity: 16,
    }),
  ).toBeNull()
})

test('uses pointer intent to snap an intrinsically over-height hybrid panel vertically', () => {
  const containerRect: PanelRect = {
    bottom: 600,
    height: 600,
    left: 0,
    right: 900,
    top: 0,
    width: 900,
  }
  const panelRect: PanelRect = {
    bottom: 608,
    height: 600,
    left: 290,
    right: 610,
    top: 8,
    width: 320,
  }

  expect(
    hybridDockPositionForPointer({
      containerRect,
      intrinsicHeight: 600,
      panelRect,
      pointer: { x: 450, y: 300 },
      snapProximity: 16,
    }),
  ).toBeNull()
  expect(
    hybridDockPositionForPointer({
      containerRect,
      intrinsicHeight: 900,
      panelRect,
      pointer: { x: 450, y: 599 },
      snapProximity: 16,
    }),
  ).toBe('bottom')
})

test('resolves default and configured placement distances', () => {
  expect(resolvePicodashPanelPlacementOptions(undefined)).toEqual({
    detachThresholdMultiplier: DEFAULT_DETACH_THRESHOLD_MULTIPLIER,
    snapOffset: DEFAULT_SNAP_OFFSET,
    snapProximity: DEFAULT_SNAP_PROXIMITY,
  })
  expect(
    resolvePicodashPanelPlacementOptions({
      detachThresholdMultiplier: 3,
      snapOffset: 24,
      snapProximity: 12,
    }),
  ).toEqual({
    detachThresholdMultiplier: 3,
    snapOffset: 24,
    snapProximity: 12,
  })
  expect(
    resolvePicodashPanelPlacementOptions({
      detachThresholdMultiplier: -1,
      snapOffset: -8,
      snapProximity: -16,
    }),
  ).toEqual({
    detachThresholdMultiplier: 0,
    snapOffset: 0,
    snapProximity: 0,
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

describe('directional viewport snapping', () => {
  test('ignores an incidental bottom contact while moving toward the left edge', () => {
    const snapped = snapPanelPosition({
      baseRect: rect(255, 190, 300, 410),
      containerRect: rect(0, 0, 900, 600),
      options: { gap: 0, viewportDocks: ['left'] },
      position: { x: -255, y: 0 },
    })

    expect(snapped.dock).toEqual({ horizontal: 'left' })
    expect(snapped.position.x).toBe(-255)
  })

  test('does not infer a stationary top attachment while pulling away horizontally', () => {
    const snapped = snapPanelPosition({
      baseRect: rect(0, 0, 300, 402),
      containerRect: rect(0, 0, 900, 600),
      options: { gap: 0, viewportDocks: ['right'] },
      position: { x: 180, y: 0 },
    })

    expect(snapped.dock).toBeNull()
  })

  test('retains an attached edge while the pointer continues outward past the threshold', () => {
    const snapped = snapPanelPosition({
      baseRect: rect(0, 190, 300, 410),
      containerRect: rect(0, 0, 900, 600),
      options: {
        gap: 0,
        retainedViewportDocks: ['left'],
        viewportDocks: ['left'],
      },
      position: { x: -120, y: 0 },
    })

    expect(snapped.dock).toEqual({ horizontal: 'left' })
    expect(snapped.position.x).toBe(0)
  })

  test('keeps peer snapping independent from container attachment', () => {
    const snapped = snapPanelPosition({
      baseRect: rect(100, 100, 200, 100),
      containerRect: rect(0, 0, 900, 600),
      options: { gap: 0, viewportDocks: [] },
      peerRects: [rect(400, 100, 200, 100)],
      position: { x: 100, y: 0 },
    })

    expect(snapped.dock).toBeNull()
    expect(snapped.position).toEqual({ x: 100, y: 0 })
    expect(snapped.snappedX).toBe(true)
  })
})

describe('fixed panel geometry', () => {
  const boundaryRect = rect(120, 80, 640, 480)

  test.each([
    ['top-left', rect(120, 80, 280, 240)],
    ['top', rect(300, 80, 280, 240)],
    ['bottom-left', rect(120, 320, 280, 240)],
    ['bottom', rect(300, 320, 280, 240)],
    ['top-right', rect(480, 80, 280, 240)],
    ['bottom-right', rect(480, 320, 280, 240)],
    ['full-left', rect(120, 80, 280, 240)],
    ['full-right', rect(480, 80, 280, 240)],
    ['middle-left', rect(120, 200, 280, 240)],
    ['middle-right', rect(480, 200, 280, 240)],
  ] as const)('places %s flush with its boundary', (position, expected) => {
    expect(fixedPanelRect({ boundaryRect, height: 240, position, width: 280 })).toEqual(expected)
  })

  test('preserves and contains the horizontal position of top and bottom attachments', () => {
    expect(
      fixedPanelRect({
        boundaryRect,
        height: 240,
        horizontalPosition: 177,
        position: 'top',
        width: 280,
      }).left,
    ).toBe(177)
    expect(
      fixedPanelRect({
        boundaryRect,
        height: 240,
        horizontalPosition: 900,
        position: 'bottom',
        width: 280,
      }).left,
    ).toBe(480)
  })

  test('caps fixed dimensions to the visible boundary', () => {
    expect(
      fixedPanelRect({ boundaryRect, height: 800, position: 'bottom-right', width: 900 }),
    ).toEqual(boundaryRect)
  })

  test.each([
    ['top-left', { x: -280, y: 0 }],
    ['full-left', { x: -280, y: 0 }],
    ['middle-left', { x: -280, y: 0 }],
    ['top-right', { x: 280, y: 0 }],
    ['full-right', { x: 280, y: 0 }],
    ['middle-right', { x: 280, y: 0 }],
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

  test('reserves the floating inset while preserving a stricter caller width', () => {
    expect(floatingPanelMaxWidthForBoundary(240, Number.POSITIVE_INFINITY, 16)).toBe(208)
    expect(floatingPanelMaxWidthForBoundary(240, 200, 16)).toBe(200)
  })
})

test('keeps snapped panels offset while placing docked panels flush', () => {
  const baseRect = rect(100, 80, 160, 120)
  const containerRect = rect(0, 0, 500, 400)

  expect(
    positionForPanelLayout({
      baseRect,
      containerRect,
      layout: {
        placement: {
          disposition: { kind: 'snapped', position: 'top-left' },
          mode: 'floating',
        },
        preferredCoordinates: { x: 120, y: 90 },
      },
    }),
  ).toEqual({ x: -92, y: -72 })
  expect(
    positionForPanelLayout({
      baseRect,
      containerRect,
      snapOffset: 24,
      layout: {
        placement: {
          disposition: { kind: 'snapped', position: 'top-left' },
          mode: 'floating',
        },
        preferredCoordinates: { x: 120, y: 90 },
      },
    }),
  ).toEqual({ x: -76, y: -56 })
  expect(
    positionForPanelLayout({
      baseRect,
      containerRect,
      layout: {
        placement: {
          disposition: { kind: 'docked', position: 'top-left' },
          mode: 'hybrid',
        },
        preferredCoordinates: { x: 120, y: 90 },
      },
    }),
  ).toEqual({ x: -100, y: -80 })
  expect(
    positionForPanelLayout({
      baseRect,
      containerRect,
      layout: {
        placement: { disposition: { kind: 'free' }, mode: 'hybrid' },
        preferredCoordinates: { x: 8, y: 8 },
      },
    }),
  ).toEqual({ x: -92, y: -72 })
})

test('centers the free axis for fresh single-edge snapped placements', () => {
  const baseRect = rect(100, 80, 160, 120)
  const containerRect = rect(20, 30, 500, 400)

  expect(
    initialPreferredCoordinatesForPlacement({
      baseRect,
      containerRect,
      placement: { disposition: { kind: 'snapped', position: 'top' }, mode: 'floating' },
    }),
  ).toEqual({ x: 170, y: 0 })
  expect(
    initialPreferredCoordinatesForPlacement({
      baseRect,
      containerRect,
      placement: { disposition: { kind: 'snapped', position: 'bottom' }, mode: 'floating' },
    }),
  ).toEqual({ x: 170, y: 0 })
  expect(
    initialPreferredCoordinatesForPlacement({
      baseRect,
      containerRect,
      placement: { disposition: { kind: 'snapped', position: 'left' }, mode: 'floating' },
    }),
  ).toEqual({ x: 0, y: 140 })
  expect(
    initialPreferredCoordinatesForPlacement({
      baseRect,
      containerRect,
      placement: { disposition: { kind: 'snapped', position: 'right' }, mode: 'floating' },
    }),
  ).toEqual({ x: 0, y: 140 })
})

test('detects ordinary caller class constraints from their computed-style effect', () => {
  expect(panelHasCallerConstraint(undefined, 'compact-panel', '192px', '584px')).toBe(true)
  expect(panelHasCallerConstraint(undefined, 'compact-panel', '224px', '868px')).toBe(true)
  expect(panelHasCallerConstraint(undefined, 'rounded-lg', '584px', '584px')).toBe(false)
  expect(panelHasCallerConstraint(undefined, undefined, '584px', 'none')).toBe(false)
})

test('keeps inline constraints authoritative and removes only caller classes for a baseline', () => {
  expect(panelHasCallerConstraint(320, undefined, '320px', 'none')).toBe(true)
  expect(panelHasCallerConstraint('12rem', undefined, '192px', 'none')).toBe(true)
  expect(
    withoutCallerClassNames(
      'relative max-h-[calc(100dvh-1rem)] compact-panel rounded-lg',
      'compact-panel rounded-lg',
    ),
  ).toBe('relative max-h-[calc(100dvh-1rem)]')
})

test('derives snapped geometry without overwriting preferred coordinates', () => {
  const layout = {
    placement: {
      disposition: { kind: 'snapped' as const, position: 'bottom-right' as const },
      mode: 'floating' as const,
    },
    preferredCoordinates: { x: 24, y: 32 },
  }
  expect(
    positionForPanelLayout({
      baseRect: rect(0, 0, 100, 80),
      containerRect: rect(50, 20, 500, 300),
      layout,
    }),
  ).toEqual({ x: 442, y: 232 })
  expect(layout.preferredCoordinates).toEqual({ x: 24, y: 32 })
})

test('removes retracted edge-attached panels from peer snapping', () => {
  const fixed = {
    disposition: { kind: 'docked' as const, position: 'full-left' as const },
    mode: 'fixed' as const,
  }
  const freeHybrid = { disposition: { kind: 'free' as const }, mode: 'hybrid' as const }
  const dockedHybrid = {
    disposition: { kind: 'docked' as const, position: 'full-right' as const },
    mode: 'hybrid' as const,
  }
  const snappedHybrid = {
    disposition: { kind: 'snapped' as const, position: 'top' as const },
    mode: 'hybrid' as const,
  }
  expect(panelParticipatesInSnapping(fixed, true)).toBe(false)
  expect(panelParticipatesInSnapping(fixed, false)).toBe(true)
  expect(
    panelParticipatesInSnapping({ disposition: { kind: 'free' }, mode: 'floating' }, true),
  ).toBe(true)
  expect(panelParticipatesInSnapping(freeHybrid, true)).toBe(true)
  expect(panelParticipatesInSnapping(dockedHybrid, true)).toBe(false)
  expect(panelParticipatesInSnapping(dockedHybrid, false)).toBe(true)
  expect(panelParticipatesInSnapping(snappedHybrid, true)).toBe(true)
})

test('treats only docked dispositions as fixed-like surfaces', () => {
  expect(
    isPanelPlacementFixedLike({
      disposition: { kind: 'docked', position: 'full-left' },
      mode: 'fixed',
    }),
  ).toBe(true)
  expect(
    isPanelPlacementFixedLike({
      disposition: { kind: 'docked', position: 'top-left' },
      mode: 'hybrid',
    }),
  ).toBe(true)
  expect(
    isPanelPlacementFixedLike({
      disposition: { kind: 'snapped', position: 'top' },
      mode: 'hybrid',
    }),
  ).toBe(false)
  expect(isPanelPlacementFixedLike({ disposition: { kind: 'free' }, mode: 'hybrid' })).toBe(false)
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
