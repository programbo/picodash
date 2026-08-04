import { projectPanelGeometry } from './panel-geometry.js'
import type {
  PicodashPanelBoundary,
  PicodashPanelBoundaryInset,
  PicodashPanelCorner,
  PicodashPanelDefaultPlacement,
  PicodashPanelDockedPosition,
  PicodashPanelHybridDockPosition,
  PicodashPanelPlacement,
  PicodashPanelPlacementOptions,
  PicodashPanelSnappedPosition,
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

export interface PanelLayout {
  placement: PicodashPanelPlacement
  preferredCoordinates: PanelPosition
}

export interface PanelRect {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

export interface ResolvedPicodashPanelBoundaryInset {
  bottom: number
  left: number
  right: number
  top: number
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

export interface HybridDockIntentInput {
  containerRect: PanelRect
  headerHeight?: number
  intrinsicHeight?: number
  panelRect: PanelRect
  pointer: PanelPosition
  snapOffset?: number
  snapProximity?: number
}

export const DEFAULT_SNAP_OFFSET = 8
export const DEFAULT_SNAP_PROXIMITY = 16
export const DEFAULT_DETACH_THRESHOLD_MULTIPLIER = 2.5
export const SNAP_GAP = DEFAULT_SNAP_OFFSET
export const SNAP_THRESHOLD = DEFAULT_SNAP_PROXIMITY
export const DEFAULT_PANEL_PLACEMENT = {
  disposition: { kind: 'snapped', position: 'top-right' },
  mode: 'floating',
} as const satisfies PicodashPanelPlacement

export interface ResolvedPicodashPanelPlacementOptions {
  detachThresholdMultiplier: number
  snapOffset: number
  snapProximity: number
}

export function normalizePicodashPanelPlacement(
  placement: PicodashPanelDefaultPlacement = DEFAULT_PANEL_PLACEMENT,
): PicodashPanelPlacement {
  return placement
}

export function resolvePicodashPanelPlacementOptions(
  options: PicodashPanelPlacementOptions | undefined,
): ResolvedPicodashPanelPlacementOptions {
  return {
    detachThresholdMultiplier: nonNegativeFinite(
      options?.detachThresholdMultiplier,
      DEFAULT_DETACH_THRESHOLD_MULTIPLIER,
    ),
    snapOffset: nonNegativeFinite(options?.snapOffset, DEFAULT_SNAP_OFFSET),
    snapProximity: nonNegativeFinite(options?.snapProximity, DEFAULT_SNAP_PROXIMITY),
  }
}

export function resolvePicodashPanelBoundaryInset(
  inset: PicodashPanelBoundaryInset | undefined,
  fallback: PicodashPanelBoundaryInset = 0,
): ResolvedPicodashPanelBoundaryInset {
  const value = inset ?? fallback
  if (typeof value === 'number') {
    const side = nonNegativeFinite(value, 0)
    return { bottom: side, left: side, right: side, top: side }
  }

  const top = nonNegativeFinite(value[0], 0)
  const right = nonNegativeFinite(value[1], 0)
  const bottom = nonNegativeFinite(value.length >= 3 ? value[2] : value[0], 0)
  const left = nonNegativeFinite(value.length >= 4 ? value[3] : value[1], 0)
  return { bottom, left, right, top }
}

export function isPanelPlacementEdgeAttached(placement: PicodashPanelPlacement) {
  return placement.disposition.kind !== 'free'
}

export function isPanelPlacementFixedLike(placement: PicodashPanelPlacement) {
  return placement.disposition.kind === 'docked'
}

export function placementPosition(placement: PicodashPanelPlacement) {
  return placement.disposition.kind === 'free' ? null : placement.disposition.position
}

export function dockForSnapPosition(
  position: PicodashPanelDockedPosition | PicodashPanelSnappedPosition,
): PanelDock {
  switch (position) {
    case 'top-left':
      return { horizontal: 'left', vertical: 'top' }
    case 'top':
      return { vertical: 'top' }
    case 'top-right':
      return { horizontal: 'right', vertical: 'top' }
    case 'right':
    case 'full-right':
    case 'middle-right':
      return { horizontal: 'right' }
    case 'bottom-right':
      return { horizontal: 'right', vertical: 'bottom' }
    case 'bottom':
      return { vertical: 'bottom' }
    case 'bottom-left':
      return { horizontal: 'left', vertical: 'bottom' }
    case 'left':
    case 'full-left':
    case 'middle-left':
      return { horizontal: 'left' }
  }
}

export function snapPositionForDock(
  dock: PanelDock | null | undefined,
): PicodashPanelSnappedPosition | null {
  if (!dock) return null
  if (dock.horizontal === 'left' && dock.vertical === 'top') return 'top-left'
  if (dock.horizontal === 'right' && dock.vertical === 'top') return 'top-right'
  if (dock.horizontal === 'right' && dock.vertical === 'bottom') return 'bottom-right'
  if (dock.horizontal === 'left' && dock.vertical === 'bottom') return 'bottom-left'
  return dock.horizontal ?? dock.vertical ?? null
}

export function hybridDockPositionForPointer({
  containerRect,
  headerHeight,
  intrinsicHeight,
  panelRect,
  pointer,
  snapOffset = DEFAULT_SNAP_OFFSET,
  snapProximity = DEFAULT_SNAP_PROXIMITY,
}: HybridDockIntentInput): PicodashPanelHybridDockPosition | 'bottom' | 'top' | null {
  const horizontal = horizontalSnapIntent(panelRect, containerRect, pointer, snapProximity)
  if (horizontal) {
    const topIntentEdge =
      containerRect.top + Math.max(snapProximity, (headerHeight ?? snapProximity / 2) * 2)
    if (pointer.y <= topIntentEdge && panelRect.top <= topIntentEdge) {
      return horizontal === 'left' ? 'top-left' : 'top-right'
    }

    const midpoint = containerRect.top + containerRect.height / 2
    if (pointer.y > midpoint && panelRect.top > midpoint && panelRect.bottom >= midpoint) {
      return horizontal === 'left' ? 'bottom-left' : 'bottom-right'
    }

    return horizontal === 'left' ? 'full-left' : 'full-right'
  }

  if (intrinsicHeight !== undefined && intrinsicHeight >= containerRect.height) {
    return verticalPointerIntent(pointer, containerRect, snapOffset, snapProximity) ?? null
  }

  const nearTop = Math.abs(panelRect.top - (containerRect.top + snapOffset)) <= snapProximity
  const nearBottom =
    Math.abs(panelRect.bottom - (containerRect.bottom - snapOffset)) <= snapProximity
  if (nearTop && nearBottom) {
    return verticalPointerIntent(pointer, containerRect, snapOffset, snapProximity) ?? null
  }
  return verticalSnapIntent(panelRect, containerRect, pointer, snapOffset, snapProximity) ?? null
}

export function placementForPanelLayout(
  layout: PanelLayout | undefined,
  defaultPlacement: PicodashPanelDefaultPlacement = DEFAULT_PANEL_PLACEMENT,
): PicodashPanelPlacement {
  return layout?.placement ?? normalizePicodashPanelPlacement(defaultPlacement)
}

export function resolvePicodashPanelBoundary(
  boundary: PicodashPanelBoundary | null | undefined,
  fallback?: PicodashPanelBoundary | null,
): Element | null {
  if (boundary === null) return null
  if (boundary === undefined) return resolveBoundaryValue(fallback)
  return resolveBoundaryValue(boundary) ?? resolveBoundaryValue(fallback)
}

export function rectForPanelBoundary(
  boundary: Element | null,
  inset: ResolvedPicodashPanelBoundaryInset = resolvePicodashPanelBoundaryInset(0),
): PanelRect {
  // Element boundaries are positioned in document flow. Preserve their full
  // rect while scrolling so an element-contained panel follows its host
  // instead of being re-anchored to the visible viewport edge. The host's
  // overflow/clipping rules determine what remains visible on screen.
  return insetPanelRect(boundary ? rectFromElement(boundary) : viewportRect(), inset)
}

export function insetPanelRect(
  rect: PanelRect,
  inset: ResolvedPicodashPanelBoundaryInset,
): PanelRect {
  const left = Math.min(rect.left + inset.left, rect.right)
  const top = Math.min(rect.top + inset.top, rect.bottom)
  const right = Math.max(left, rect.right - inset.right)
  const bottom = Math.max(top, rect.bottom - inset.bottom)
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  }
}

export function positionForFloatingCorner(
  position: PicodashPanelCorner,
  panelRect: Pick<PanelRect, 'height' | 'width'>,
  boundaryRect: PanelRect,
  inset = DEFAULT_SNAP_OFFSET,
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

/**
 * Supplies the initial saved coordinate for a placement that constrains only
 * one axis. A panel with no persisted layout should begin centred along its
 * free axis, while later layouts retain the user's preferred coordinate.
 */
export function initialPreferredCoordinatesForPlacement({
  baseRect,
  containerRect,
  placement,
}: {
  baseRect: PanelRect
  containerRect: PanelRect
  placement: PicodashPanelPlacement
}): PanelPosition {
  if (placement.disposition.kind === 'free') {
    return {
      x: baseRect.left - containerRect.left,
      y: baseRect.top - containerRect.top,
    }
  }

  const edges = dockForSnapPosition(placement.disposition.position)
  return {
    x: edges.horizontal ? 0 : (containerRect.width - baseRect.width) / 2,
    y: edges.vertical ? 0 : (containerRect.height - baseRect.height) / 2,
  }
}

export function positionForPanelLayout({
  baseRect,
  containerRect,
  layout,
  snapOffset = DEFAULT_SNAP_OFFSET,
}: {
  baseRect: PanelRect
  containerRect: PanelRect
  layout: PanelLayout | undefined
  snapOffset?: number
}): PanelPosition {
  if (!layout) return { x: 0, y: 0 }

  const { disposition } = layout.placement
  const preferredLeft = containerRect.left + layout.preferredCoordinates.x
  const preferredTop = containerRect.top + layout.preferredCoordinates.y
  if (disposition.kind === 'free') {
    return { x: preferredLeft - baseRect.left, y: preferredTop - baseRect.top }
  }

  const position = disposition.position
  const inset = disposition.kind === 'snapped' ? snapOffset : 0
  const edges = dockForSnapPosition(position)
  const targetLeft = edges.horizontal
    ? edges.horizontal === 'left'
      ? containerRect.left + inset
      : containerRect.right - inset - baseRect.width
    : preferredLeft
  const targetTop = edges.vertical
    ? edges.vertical === 'top'
      ? containerRect.top + inset
      : containerRect.bottom - inset - baseRect.height
    : position.startsWith('middle')
      ? containerRect.top + (containerRect.height - baseRect.height) / 2
      : disposition.kind === 'docked' && position.startsWith('full')
        ? containerRect.top
        : preferredTop

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
  const snapsToBoundary = Boolean(xSnap?.viewport || ySnap?.viewport)
  const projection = projectPanelGeometry({
    anchor: ySnap?.viewport && ySnap.dock === 'bottom' ? 'bottom' : 'top',
    baseRect,
    containerRect,
    inset: snapsToBoundary ? gap : 0,
    position: snapped,
  })
  const dock: PanelDock = {}
  if (xSnap?.viewport && xSnap.dock === 'left') {
    dock.horizontal = 'left'
  } else if (xSnap?.viewport && xSnap.dock === 'right') {
    dock.horizontal = 'right'
  }
  if (ySnap?.viewport && ySnap.dock === 'top') {
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
  const nearLeft = Math.abs(panelRect.left - containerRect.left) <= threshold
  const nearRight = Math.abs(panelRect.right - containerRect.right) <= threshold
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
  targetInset: number,
  threshold: number,
): PanelDock['vertical'] {
  const nearTop = Math.abs(panelRect.top - (containerRect.top + targetInset)) <= threshold
  const nearBottom = Math.abs(panelRect.bottom - (containerRect.bottom - targetInset)) <= threshold
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
  targetInset: number,
  threshold: number,
): PanelDock['vertical'] {
  const distanceFromTop = Math.abs(pointer.y - (containerRect.top + targetInset))
  const distanceFromBottom = Math.abs(pointer.y - (containerRect.bottom - targetInset))
  if (distanceFromTop <= threshold && distanceFromTop <= distanceFromBottom) return 'top'
  if (distanceFromBottom <= threshold) return 'bottom'
  return undefined
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function matrixValues(serializedValues: string) {
  return serializedValues.split(',').map((value) => Number(value.trim()))
}

function finitePosition(x: number, y: number): PanelPosition {
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : { x: 0, y: 0 }
}

function nonNegativeFinite(value: number | undefined, fallback: number) {
  return value === undefined || !Number.isFinite(value) ? fallback : Math.max(value, 0)
}
