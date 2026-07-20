import { SNAP_GAP, type PanelPosition, type PanelRect } from './panel-snapping.js'

export type PanelVerticalAnchor = 'bottom' | 'top'

export interface PanelGeometryProjection {
  availableHeight: number
  position: PanelPosition
  rect: PanelRect
}

export const PANEL_MIN_VISIBLE_HEIGHT = 37

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
  const topInset = Math.min(nonNegative(inset), nonNegative(rect.height) / 2)
  const normalizedBottomInset = Math.min(nonNegative(bottomInset), nonNegative(rect.height) / 2)
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
