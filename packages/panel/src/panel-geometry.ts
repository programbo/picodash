import { SNAP_GAP, type PanelPosition, type PanelRect } from './panel-snapping.js'
import type { PicodashPanelFixedPosition, PicodashPanelPlacement } from './picodash-panel-types.js'

export type PanelVerticalAnchor = 'bottom' | 'top'

export interface PanelGeometryProjection {
  availableHeight: number
  position: PanelPosition
  rect: PanelRect
}

export const PANEL_MIN_VISIBLE_HEIGHT = 37

export function panelParticipatesInSnapping(placement: PicodashPanelPlacement, collapsed: boolean) {
  return placement.mode !== 'fixed' || !collapsed
}

export function panelMaxWidthForBoundary(boundaryWidth: number, callerMaxWidth: number) {
  const normalizedCallerMaxWidth = Number.isFinite(callerMaxWidth)
    ? nonNegative(callerMaxWidth)
    : Number.POSITIVE_INFINITY
  return Math.min(nonNegative(boundaryWidth), normalizedCallerMaxWidth)
}

export function fixedPanelRect({
  boundaryRect,
  height,
  position,
  width,
}: {
  boundaryRect: PanelRect
  height: number
  position: PicodashPanelFixedPosition
  width: number
}): PanelRect {
  const appliedWidth = Math.min(nonNegative(width), boundaryRect.width)
  const appliedHeight = Math.min(nonNegative(height), boundaryRect.height)
  const left =
    position.endsWith('right') || position === 'right'
      ? boundaryRect.right - appliedWidth
      : boundaryRect.left
  const top = position.startsWith('bottom') ? boundaryRect.bottom - appliedHeight : boundaryRect.top

  return {
    bottom: top + appliedHeight,
    height: appliedHeight,
    left,
    right: left + appliedWidth,
    top,
    width: appliedWidth,
  }
}

export function fixedPanelRetraction(
  position: PicodashPanelFixedPosition,
  rect: Pick<PanelRect, 'height' | 'width'>,
): PanelPosition {
  switch (position) {
    case 'bottom-left':
      return { x: -rect.width, y: rect.height }
    case 'bottom-right':
      return { x: rect.width, y: rect.height }
    case 'right':
    case 'top-right':
      return { x: rect.width, y: 0 }
    case 'left':
    case 'top-left':
      return { x: -rect.width, y: 0 }
  }
}

export function projectPanelGeometry({
  anchor,
  baseRect,
  bottomInset,
  containerRect,
  inset = SNAP_GAP,
  intrinsicHeight = baseRect.height,
  minimumHeight = PANEL_MIN_VISIBLE_HEIGHT,
  position,
}: {
  anchor: PanelVerticalAnchor
  baseRect: PanelRect
  bottomInset?: number
  containerRect: PanelRect
  inset?: number
  intrinsicHeight?: number
  minimumHeight?: number
  position: PanelPosition
}): PanelGeometryProjection {
  const bounds = safeBounds(containerRect, inset, bottomInset)
  const height = Math.min(nonNegative(intrinsicHeight), bounds.height)
  const minimumVisibleHeight = Math.min(nonNegative(minimumHeight), height)
  const desiredLeft = baseRect.left + position.x
  const left = clampBetweenEitherOrder(desiredLeft, bounds.left, bounds.right - baseRect.width)

  let top: number
  if (anchor === 'bottom') {
    top = bounds.bottom - height
  } else {
    const desiredTop = baseRect.top + position.y
    top = clampBetweenEitherOrder(desiredTop, bounds.top, bounds.bottom - minimumVisibleHeight)
  }

  const availableHeight = Math.max(bounds.bottom - top, 0)
  const projectedHeight = Math.min(height, availableHeight)
  const projectedPosition = {
    x: left - baseRect.left,
    y: top - baseRect.top,
  }

  return {
    availableHeight,
    position: projectedPosition,
    rect: {
      bottom: top + projectedHeight,
      height: projectedHeight,
      left,
      right: left + baseRect.width,
      top,
      width: baseRect.width,
    },
  }
}

export function rectWithHeight(rect: PanelRect, height: number): PanelRect {
  const normalizedHeight = nonNegative(height)
  return {
    ...rect,
    bottom: rect.top + normalizedHeight,
    height: normalizedHeight,
  }
}

function safeBounds(rect: PanelRect, inset: number, bottomInset = inset) {
  const horizontalInset = Math.min(nonNegative(inset), nonNegative(rect.width) / 2)
  const height = nonNegative(rect.height)
  const topInset = Math.min(nonNegative(inset), height / 2)
  const normalizedBottomInset =
    bottomInset === inset
      ? topInset
      : Math.min(nonNegative(bottomInset), Math.max(height - topInset, 0))
  const left = rect.left + horizontalInset
  const right = rect.right - horizontalInset
  const top = rect.top + topInset
  const bottom = rect.bottom - normalizedBottomInset

  return {
    bottom,
    height: Math.max(bottom - top, 0),
    left,
    right,
    top,
  }
}

function clampBetweenEitherOrder(value: number, first: number, second: number) {
  return Math.min(Math.max(value, Math.min(first, second)), Math.max(first, second))
}

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0
}
