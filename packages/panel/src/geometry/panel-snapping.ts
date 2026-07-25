import { projectPanelGeometry } from './panel-geometry.js'
import type {
  PicodashPanelBoundary,
  PicodashPanelCorner,
  PicodashPanelDefaultPlacement,
  PicodashPanelPlacement,
  PicodashPanelSnapPosition,
} from '../state/panel/picodash-panel-types.js'

export interface PanelPosition {
  x: number
  y: number
}

export interface PanelDock {
  horizontal?: 'left' | 'right'
  vertical?: 'bottom' | 'top'
}

export type PanelDockEdge = 'bottom' | 'left' | 'right' | 'top'

export interface PanelLayout extends PanelPosition {
  dock?: PanelDock | null
  placement?: PicodashPanelPlacement
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
  retainedViewportDocks?: readonly PanelDockEdge[]
  threshold?: number
  viewportDocks?: readonly PanelDockEdge[]
}

export interface PanelSnapResult {
  dock: PanelDock | null
  position: PanelPosition
  snappedX: boolean
  snappedY: boolean
}

export interface MagneticSnapIntentInput {
  containerRect: PanelRect
  panelHeight: number
  panelRect: PanelRect
  pointer: PanelPosition
  threshold?: number
}

export const SNAP_GAP = 8
export const SNAP_THRESHOLD = 16
export const FLOATING_PLACEMENT_INSET = 16

export function normalizePicodashPanelPlacement(
  placement: PicodashPanelDefaultPlacement = 'top-right',
): PicodashPanelPlacement {
  return typeof placement === 'string' ? { mode: 'floating', position: placement } : placement
}

export function isPanelPlacementEdgeAttached(
  placement: PicodashPanelPlacement,
): placement is
  | { mode: 'magnetic'; position: PicodashPanelSnapPosition }
  | Extract<PicodashPanelPlacement, { mode: 'fixed' }> {
  return (
    placement.mode === 'fixed' ||
    (placement.mode === 'magnetic' && placement.position !== undefined)
  )
}

export function isPanelPlacementFixedLike(placement: PicodashPanelPlacement): placement is
  | Extract<PicodashPanelPlacement, { mode: 'fixed' }>
  | {
      mode: 'magnetic'
      position: Exclude<PicodashPanelSnapPosition, 'bottom' | 'top'>
    } {
  return (
    placement.mode === 'fixed' ||
    (placement.mode === 'magnetic' &&
      placement.position !== undefined &&
      placement.position !== 'top' &&
      placement.position !== 'bottom')
  )
}

export function dockForSnapPosition(position: PicodashPanelSnapPosition): PanelDock {
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
): PicodashPanelSnapPosition | null {
  if (!dock) return null
  if (dock.horizontal === 'left' && dock.vertical === 'top') return 'top-left'
  if (dock.horizontal === 'right' && dock.vertical === 'top') return 'top-right'
  if (dock.horizontal === 'right' && dock.vertical === 'bottom') return 'bottom-right'
  if (dock.horizontal === 'left' && dock.vertical === 'bottom') return 'bottom-left'
  return dock.horizontal ?? dock.vertical ?? null
}

export function magneticSnapPositionForPointer({
  containerRect,
  panelHeight,
  panelRect,
  pointer,
  threshold = SNAP_THRESHOLD,
}: MagneticSnapIntentInput): PicodashPanelSnapPosition | null {
  const horizontal = horizontalSnapIntent(panelRect, containerRect, pointer, threshold)
  const pointerVertical = verticalPointerIntent(
    pointer,
    containerRect,
    Math.min(containerRect.height / 3, panelHeight),
  )
  if (horizontal && pointerVertical) {
    return snapPositionForDock({ horizontal, vertical: pointerVertical })
  }
  if (horizontal) return horizontal

  const panelIsOverHeight = panelHeight >= containerRect.height - threshold
  const vertical = panelIsOverHeight
    ? pointerVertical
    : verticalSnapIntent(panelRect, containerRect, pointer, threshold)
  return vertical ?? null
}

export function placementForPanelLayout(
  layout: PanelLayout | undefined,
  defaultPlacement: PicodashPanelDefaultPlacement = 'top-right',
): PicodashPanelPlacement {
  if (layout?.placement) return layout.placement
  const snapPosition = snapPositionForDock(layout?.dock)
  if (snapPosition) return { mode: 'magnetic', position: snapPosition }
  return layout ? { mode: 'floating' } : normalizePicodashPanelPlacement(defaultPlacement)
}

export function resolvePicodashPanelBoundary(
  boundary: PicodashPanelBoundary | null | undefined,
  fallback?: PicodashPanelBoundary | null,
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
  position: PicodashPanelCorner,
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
  const attachedPlacement =
    placement && isPanelPlacementEdgeAttached(placement) ? placement : undefined
  const dock = attachedPlacement
    ? dockForSnapPosition(attachedPlacement.position)
    : (layout.dock ?? null)
  const inset = attachedPlacement ? 0 : SNAP_GAP
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

function resolveBoundaryValue(boundary: PicodashPanelBoundary | null | undefined): Element | null {
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
  const viewportDocks = new Set(
    options?.viewportDocks ?? (['bottom', 'left', 'right', 'top'] as const),
  )
  const retainedViewportDocks = new Set(options?.retainedViewportDocks)
  const xCandidates: SnapCandidate[] = []
  if (viewportDocks.has('left')) {
    xCandidates.push({
      delta: containerRect.left + gap - candidateRect.left,
      dock: 'left',
      retained: retainedViewportDocks.has('left'),
      viewport: true,
    })
  }
  if (viewportDocks.has('right')) {
    xCandidates.push({
      delta: containerRect.right - gap - candidateRect.right,
      dock: 'right',
      retained: retainedViewportDocks.has('right'),
      viewport: true,
    })
  }
  const yCandidates: SnapCandidate[] = []
  if (viewportDocks.has('top')) {
    yCandidates.push({
      delta: containerRect.top + gap - candidateRect.top,
      dock: 'top',
      retained: retainedViewportDocks.has('top'),
      viewport: true,
    })
  }
  if (viewportDocks.has('bottom')) {
    yCandidates.push({
      delta: containerRect.bottom - gap - candidateRect.bottom,
      dock: 'bottom',
      retained: retainedViewportDocks.has('bottom'),
      viewport: true,
    })
  }

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
  const directionalViewportDocks = options?.viewportDocks !== undefined
  const safeLeft = containerRect.left + gap
  const safeRight = containerRect.right - gap
  const safeTop = containerRect.top + gap
  if (
    (xSnap?.viewport && xSnap.dock === 'left') ||
    (!directionalViewportDocks && almostEqual(projection.rect.left, safeLeft))
  ) {
    dock.horizontal = 'left'
  } else if (
    (xSnap?.viewport && xSnap.dock === 'right') ||
    (!directionalViewportDocks && almostEqual(projection.rect.right, safeRight))
  ) {
    dock.horizontal = 'right'
  }
  if (
    (ySnap?.viewport && ySnap.dock === 'top') ||
    (!directionalViewportDocks && almostEqual(projection.rect.top, safeTop))
  ) {
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
  dock?: PanelDockEdge
  retained?: boolean
  viewport?: boolean
}

function nearestCandidateWithinThreshold(candidates: SnapCandidate[], threshold: number) {
  let nearest: SnapCandidate | null = null

  for (const candidate of candidates) {
    if (!candidate.retained && Math.abs(candidate.delta) > threshold) continue
    if (nearest === null || Math.abs(candidate.delta) < Math.abs(nearest.delta)) {
      nearest = candidate
    }
  }

  return nearest
}

function horizontalSnapIntent(
  panelRect: PanelRect,
  containerRect: PanelRect,
  pointer: PanelPosition,
  threshold: number,
): PanelDock['horizontal'] {
  const nearLeft = panelRect.left <= containerRect.left + threshold
  const nearRight = panelRect.right >= containerRect.right - threshold
  if (nearLeft && nearRight) {
    return pointer.x <= containerRect.left + containerRect.width / 2 ? 'left' : 'right'
  }
  if (nearLeft) return 'left'
  if (nearRight) return 'right'
  return undefined
}

function verticalSnapIntent(
  panelRect: PanelRect,
  containerRect: PanelRect,
  pointer: PanelPosition,
  threshold: number,
): PanelDock['vertical'] {
  const nearTop = panelRect.top <= containerRect.top + threshold
  const nearBottom = panelRect.bottom >= containerRect.bottom - threshold
  if (nearTop && nearBottom) {
    return pointer.y <= containerRect.top + containerRect.height / 2 ? 'top' : 'bottom'
  }
  if (nearTop) return 'top'
  if (nearBottom) return 'bottom'
  return undefined
}

function verticalPointerIntent(
  pointer: PanelPosition,
  containerRect: PanelRect,
  zone: number,
): PanelDock['vertical'] {
  const distanceFromTop = pointer.y - containerRect.top
  const distanceFromBottom = containerRect.bottom - pointer.y
  if (distanceFromTop <= zone && distanceFromTop <= distanceFromBottom) return 'top'
  if (distanceFromBottom <= zone) return 'bottom'
  return undefined
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
