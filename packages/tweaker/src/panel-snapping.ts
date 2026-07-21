import { projectPanelGeometry } from './panel-geometry.js'
import type {
  TweakerPanelBoundary,
  TweakerPanelCorner,
  TweakerPanelDefaultPlacement,
  TweakerPanelPlacement,
  TweakerPanelSnapPosition,
} from './tweaker-panel-types.js'

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
  placement?: TweakerPanelPlacement
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
export const FLOATING_PLACEMENT_INSET = 16

export function normalizeTweakerPanelPlacement(
  placement: TweakerPanelDefaultPlacement = 'top-right',
): TweakerPanelPlacement {
  return typeof placement === 'string' ? { mode: 'floating', position: placement } : placement
}

export function dockForSnapPosition(position: TweakerPanelSnapPosition): PanelDock {
  switch (position) {
    case 'top-left':
      return { horizontal: 'left', vertical: 'top' }
    case 'top':
      return { vertical: 'top' }
    case 'top-right':
      return { horizontal: 'right', vertical: 'top' }
    case 'right':
      return { horizontal: 'right' }
    case 'bottom-right':
      return { horizontal: 'right', vertical: 'bottom' }
    case 'bottom':
      return { vertical: 'bottom' }
    case 'bottom-left':
      return { horizontal: 'left', vertical: 'bottom' }
    case 'left':
      return { horizontal: 'left' }
  }
}

export function snapPositionForDock(
  dock: PanelDock | null | undefined,
): TweakerPanelSnapPosition | null {
  if (!dock) return null
  if (dock.horizontal === 'left' && dock.vertical === 'top') return 'top-left'
  if (dock.horizontal === 'right' && dock.vertical === 'top') return 'top-right'
  if (dock.horizontal === 'right' && dock.vertical === 'bottom') return 'bottom-right'
  if (dock.horizontal === 'left' && dock.vertical === 'bottom') return 'bottom-left'
  return dock.horizontal ?? dock.vertical ?? null
}

export function placementForPanelLayout(
  layout: PanelLayout | undefined,
  defaultPlacement: TweakerPanelDefaultPlacement = 'top-right',
): TweakerPanelPlacement {
  if (layout?.placement) return layout.placement
  const snapPosition = snapPositionForDock(layout?.dock)
  if (snapPosition) return { mode: 'magnetic', position: snapPosition }
  return layout ? { mode: 'floating' } : normalizeTweakerPanelPlacement(defaultPlacement)
}

export function resolveTweakerPanelBoundary(
  boundary: TweakerPanelBoundary | null | undefined,
  fallback?: TweakerPanelBoundary | null,
): Element | null {
  if (boundary === null) return null
  if (boundary === undefined) return resolveBoundaryValue(fallback)
  return resolveBoundaryValue(boundary) ?? resolveBoundaryValue(fallback)
}

export function rectForPanelBoundary(boundary: Element | null): PanelRect {
  const viewport = viewportRect()
  return boundary ? intersectPanelRects(rectFromElement(boundary), viewport) : viewport
}

export function positionForFloatingCorner(
  position: TweakerPanelCorner,
  panelRect: Pick<PanelRect, 'height' | 'width'>,
  boundaryRect: PanelRect,
  inset = FLOATING_PLACEMENT_INSET,
): PanelPosition {
  return {
    x: position.endsWith('left')
      ? boundaryRect.left + inset
      : boundaryRect.right - inset - panelRect.width,
    y: position.startsWith('top')
      ? boundaryRect.top + inset
      : boundaryRect.bottom - inset - panelRect.height,
  }
}

export function intersectPanelRects(left: PanelRect, right: PanelRect): PanelRect {
  const intersectionLeft = Math.max(left.left, right.left)
  const intersectionTop = Math.max(left.top, right.top)
  const intersectionRight = Math.max(intersectionLeft, Math.min(left.right, right.right))
  const intersectionBottom = Math.max(intersectionTop, Math.min(left.bottom, right.bottom))
  return {
    bottom: intersectionBottom,
    height: intersectionBottom - intersectionTop,
    left: intersectionLeft,
    right: intersectionRight,
    top: intersectionTop,
    width: intersectionRight - intersectionLeft,
  }
}

export function viewportRect(): PanelRect {
  const hasViewport = typeof window !== 'undefined' && typeof document !== 'undefined'
  const width = hasViewport ? document.documentElement.clientWidth : 0
  const height = hasViewport ? document.documentElement.clientHeight : 0
  return { bottom: height, height, left: 0, right: width, top: 0, width }
}

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

  const placement = layout.placement
  const fixed = placement?.mode === 'fixed'
  const dock =
    placement?.mode === 'magnetic' || placement?.mode === 'fixed'
      ? dockForSnapPosition(placement.position)
      : (layout.dock ?? null)
  const inset = fixed ? 0 : SNAP_GAP
  const targetLeft =
    dock?.horizontal === 'left'
      ? containerRect.left + inset
      : dock?.horizontal === 'right'
        ? containerRect.right - inset - baseRect.width
        : layout.x
  const targetTop =
    dock?.vertical === 'top'
      ? containerRect.top + inset
      : dock?.vertical === 'bottom'
        ? containerRect.bottom - inset - baseRect.height
        : fixed
          ? containerRect.top
          : layout.y

  return {
    x: targetLeft - baseRect.left,
    y: targetTop - baseRect.top,
  }
}

function resolveBoundaryValue(boundary: TweakerPanelBoundary | null | undefined): Element | null {
  if (!boundary) return null
  if ('current' in boundary) return boundary.current
  return boundary
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
