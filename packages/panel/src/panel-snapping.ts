export interface PanelPosition {
  x: number
  y: number
}

export interface PanelDock {
  horizontal?: 'left' | 'right'
  vertical?: 'bottom' | 'top'
}

export interface PanelLayout extends PanelPosition {
  dock?: PanelDock | null
}

export interface PanelRect {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

export interface PanelSnapOptions {
  gap?: number
  threshold?: number
}

export interface PanelSnapResult {
  dock: PanelDock | null
  position: PanelPosition
  snappedX: boolean
  snappedY: boolean
}

export const SNAP_GAP = 8
export const SNAP_THRESHOLD = 16

export function rectFromElement(element: Element): PanelRect {
  const rect = element.getBoundingClientRect()
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  }
}

export function offsetRect(rect: PanelRect, position: PanelPosition): PanelRect {
  return {
    bottom: rect.bottom + position.y,
    height: rect.height,
    left: rect.left + position.x,
    right: rect.right + position.x,
    top: rect.top + position.y,
    width: rect.width,
  }
}

export function baseRectFromDisplayedRect(
  displayedRect: PanelRect,
  displayedPosition: PanelPosition,
): PanelRect {
  return offsetRect(displayedRect, { x: -displayedPosition.x, y: -displayedPosition.y })
}

export function clampPanelPosition(
  position: PanelPosition,
  baseRect: PanelRect,
  containerRect: PanelRect,
): PanelPosition {
  const minX = containerRect.left - baseRect.left
  const maxX = containerRect.right - baseRect.right
  const minY = containerRect.top - baseRect.top
  const maxY = containerRect.bottom - baseRect.bottom

  return {
    x: clamp(position.x, Math.min(minX, maxX), Math.max(minX, maxX)),
    y: clamp(position.y, Math.min(minY, maxY), Math.max(minY, maxY)),
  }
}

export function positionForPanelLayout({
  baseRect,
  containerRect,
  layout,
}: {
  baseRect: PanelRect
  containerRect: PanelRect
  layout: PanelLayout | undefined
}): PanelPosition {
  if (!layout) return { x: 0, y: 0 }

  const dock = layout.dock ?? null
  const targetLeft =
    dock?.horizontal === 'left'
      ? containerRect.left + SNAP_GAP
      : dock?.horizontal === 'right'
        ? containerRect.right - SNAP_GAP - baseRect.width
        : layout.x
  const targetTop =
    dock?.vertical === 'top'
      ? containerRect.top + SNAP_GAP
      : dock?.vertical === 'bottom'
        ? containerRect.bottom - SNAP_GAP - baseRect.height
        : layout.y

  return {
    x: targetLeft - baseRect.left,
    y: targetTop - baseRect.top,
  }
}

export function snapPanelPosition({
  baseRect,
  containerRect,
  options,
  peerRects,
  position,
}: {
  baseRect: PanelRect
  containerRect: PanelRect
  options?: PanelSnapOptions
  peerRects?: PanelRect[]
  position: PanelPosition
}): PanelSnapResult {
  const gap = options?.gap ?? SNAP_GAP
  const threshold = options?.threshold ?? SNAP_THRESHOLD
  const candidateRect = offsetRect(baseRect, position)
  const xCandidates = [
    containerRect.left + gap - candidateRect.left,
    containerRect.right - gap - candidateRect.right,
  ]
  const yCandidates = [
    containerRect.top + gap - candidateRect.top,
    containerRect.bottom - gap - candidateRect.bottom,
  ]

  for (const peerRect of peerRects ?? []) {
    xCandidates.push(
      peerRect.left - candidateRect.left,
      peerRect.left - candidateRect.right,
      peerRect.right - candidateRect.left,
      peerRect.right - candidateRect.right,
    )
    yCandidates.push(
      peerRect.top - candidateRect.top,
      peerRect.top - candidateRect.bottom,
      peerRect.bottom - candidateRect.top,
      peerRect.bottom - candidateRect.bottom,
    )
  }

  const xDelta = nearestDeltaWithinThreshold(xCandidates, threshold)
  const yDelta = nearestDeltaWithinThreshold(yCandidates, threshold)
  const snapped = {
    x: position.x + (xDelta ?? 0),
    y: position.y + (yDelta ?? 0),
  }
  const clampedPosition = clampPanelPosition(snapped, baseRect, insetRect(containerRect, gap))

  return {
    dock: dockForPosition(clampedPosition, baseRect, insetRect(containerRect, gap)),
    position: clampedPosition,
    snappedX: xDelta !== null,
    snappedY: yDelta !== null,
  }
}

function dockForPosition(
  position: PanelPosition,
  baseRect: PanelRect,
  containerRect: PanelRect,
): PanelDock | null {
  const rect = offsetRect(baseRect, position)
  const dock: PanelDock = {}

  if (almostEqual(rect.left, containerRect.left)) {
    dock.horizontal = 'left'
  } else if (almostEqual(rect.right, containerRect.right)) {
    dock.horizontal = 'right'
  }

  if (almostEqual(rect.top, containerRect.top)) {
    dock.vertical = 'top'
  } else if (almostEqual(rect.bottom, containerRect.bottom)) {
    dock.vertical = 'bottom'
  }

  return dock.horizontal || dock.vertical ? dock : null
}

function insetRect(rect: PanelRect, inset: number): PanelRect {
  return {
    bottom: rect.bottom - inset,
    height: Math.max(rect.height - inset * 2, 0),
    left: rect.left + inset,
    right: rect.right - inset,
    top: rect.top + inset,
    width: Math.max(rect.width - inset * 2, 0),
  }
}

function nearestDeltaWithinThreshold(deltas: number[], threshold: number) {
  let nearest: number | null = null

  for (const delta of deltas) {
    if (Math.abs(delta) > threshold) continue
    if (nearest === null || Math.abs(delta) < Math.abs(nearest)) {
      nearest = delta
    }
  }

  return nearest
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function almostEqual(left: number, right: number) {
  return Math.abs(left - right) < 0.5
}
