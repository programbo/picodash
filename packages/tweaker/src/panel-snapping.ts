import { projectPanelGeometry } from './panel-geometry.js'

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

export function translationFromTransform(transform: string): PanelPosition {
  if (transform === 'none') return { x: 0, y: 0 }

  const matrix3d = /^matrix3d\((.+)\)$/.exec(transform)
  if (matrix3d) {
    const values = matrixValues(matrix3d[1])
    if (values.length === 16) return finitePosition(values[12], values[13])
  }

  const matrix = /^matrix\((.+)\)$/.exec(transform)
  if (matrix) {
    const values = matrixValues(matrix[1])
    if (values.length === 6) return finitePosition(values[4], values[5])
  }

  return { x: 0, y: 0 }
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
  const xCandidates: SnapCandidate[] = [
    {
      delta: containerRect.left + gap - candidateRect.left,
      dock: 'left',
      viewport: true,
    },
    {
      delta: containerRect.right - gap - candidateRect.right,
      dock: 'right',
      viewport: true,
    },
  ]
  const yCandidates: SnapCandidate[] = [
    {
      delta: containerRect.top + gap - candidateRect.top,
      dock: 'top',
      viewport: true,
    },
    {
      delta: containerRect.bottom - gap - candidateRect.bottom,
      dock: 'bottom',
      viewport: true,
    },
  ]

  for (const peerRect of peerRects ?? []) {
    xCandidates.push(
      { delta: peerRect.left - candidateRect.left },
      { delta: peerRect.left - candidateRect.right },
      { delta: peerRect.right - candidateRect.left },
      { delta: peerRect.right - candidateRect.right },
    )
    yCandidates.push(
      { delta: peerRect.top - candidateRect.top },
      { delta: peerRect.top - candidateRect.bottom },
      { delta: peerRect.bottom - candidateRect.top },
      { delta: peerRect.bottom - candidateRect.bottom },
    )
  }

  const xSnap = nearestCandidateWithinThreshold(xCandidates, threshold)
  const ySnap = nearestCandidateWithinThreshold(yCandidates, threshold)
  const snapped = {
    x: position.x + (xSnap?.delta ?? 0),
    y: position.y + (ySnap?.delta ?? 0),
  }
  const projection = projectPanelGeometry({
    anchor: ySnap?.viewport && ySnap.dock === 'bottom' ? 'bottom' : 'top',
    baseRect,
    containerRect,
    inset: gap,
    position: snapped,
  })
  const dock: PanelDock = {}
  const safeLeft = containerRect.left + gap
  const safeRight = containerRect.right - gap
  const safeTop = containerRect.top + gap
  if (almostEqual(projection.rect.left, safeLeft)) {
    dock.horizontal = 'left'
  } else if (almostEqual(projection.rect.right, safeRight)) {
    dock.horizontal = 'right'
  }
  if (almostEqual(projection.rect.top, safeTop)) {
    dock.vertical = 'top'
  } else if (ySnap?.viewport && ySnap.dock === 'bottom') {
    dock.vertical = 'bottom'
  }

  return {
    dock: dock.horizontal || dock.vertical ? dock : null,
    position: projection.position,
    snappedX: xSnap !== null,
    snappedY: ySnap !== null,
  }
}

interface SnapCandidate {
  delta: number
  dock?: 'bottom' | 'left' | 'right' | 'top'
  viewport?: boolean
}

function nearestCandidateWithinThreshold(candidates: SnapCandidate[], threshold: number) {
  let nearest: SnapCandidate | null = null

  for (const candidate of candidates) {
    if (Math.abs(candidate.delta) > threshold) continue
    if (nearest === null || Math.abs(candidate.delta) < Math.abs(nearest.delta)) {
      nearest = candidate
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

function matrixValues(serializedValues: string) {
  return serializedValues.split(',').map((value) => Number(value.trim()))
}

function finitePosition(x: number, y: number): PanelPosition {
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : { x: 0, y: 0 }
}
