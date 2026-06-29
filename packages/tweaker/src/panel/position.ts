import type { DockEdge, DockState, Placement } from '../types.js'

export interface PanelPosition {
  x: number
  y: number
}

const edgeThreshold = 24
const panelWidth = 320

export function placementToPosition(
  placement: Placement,
  width: number,
  height: number,
  fallbackPanelWidth = panelWidth,
) {
  const margin = 16
  const right = Math.max(margin, width - fallbackPanelWidth - margin)
  const bottom = Math.max(margin, height - 420)

  switch (placement) {
    case 'top-left':
      return { x: margin, y: margin }
    case 'bottom-left':
      return { x: margin, y: bottom }
    case 'bottom-right':
      return { x: right, y: bottom }
    case 'top-right':
    default:
      return { x: right, y: margin }
  }
}

export function dockToPosition(
  dock: DockState,
  width: number,
  height: number,
  fallbackPanelWidth = panelWidth,
) {
  const maxX = Math.max(0, width - fallbackPanelWidth)
  const maxY = Math.max(0, height - 120)
  let position: PanelPosition

  switch (dock.edge) {
    case 'top':
      position = { x: Math.min(Math.max(0, dock.offset), maxX), y: 0 }
      break
    case 'bottom':
      position = { x: Math.min(Math.max(0, dock.offset), maxX), y: maxY }
      break
    case 'left':
      position = { x: 0, y: Math.min(Math.max(0, dock.offset), maxY) }
      break
    case 'right':
      position = { x: maxX, y: Math.min(Math.max(0, dock.offset), maxY) }
      break
    default:
      position = { x: 0, y: 0 }
  }

  return dock.secondaryEdge ? applyDockEdge(position, dock.secondaryEdge, maxX, maxY) : position
}

function applyDockEdge(position: PanelPosition, edge: DockEdge, maxX: number, maxY: number) {
  switch (edge) {
    case 'top':
      return { ...position, y: 0 }
    case 'bottom':
      return { ...position, y: maxY }
    case 'left':
      return { ...position, x: 0 }
    case 'right':
      return { ...position, x: maxX }
  }
}

export function clampPosition(
  position: PanelPosition,
  element: HTMLElement | null,
  fallbackPanelWidth = panelWidth,
) {
  const width = window.innerWidth
  const height = window.innerHeight
  const rect = element?.getBoundingClientRect()
  const maxX = Math.max(0, width - (rect?.width ?? fallbackPanelWidth))
  const maxY = Math.max(0, height - (rect?.height ?? 120))

  return {
    x: Math.min(Math.max(0, position.x), maxX),
    y: Math.min(Math.max(0, position.y), maxY),
  }
}

export function nearestDock(position: PanelPosition, element: HTMLElement): DockState | null {
  const rect = element.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  // Distance from each panel edge to its matching viewport edge, computed
  // against the user's intended (pre-clamp) position:
  // - Near edges (top/left): distance of the panel's origin from 0.
  // - Far edges (bottom/right): distance of the panel's origin from its maximum
  //   clamped position (maxX/maxY).
  // Vertical auto-docking is only offered when the panel is short enough that
  // its vertical position is a meaningful signal of intent. When a panel
  // occupies most of the viewport it is always clamped into a tiny range, so
  // dragging it reads as "flush with a vertical edge" regardless of where the
  // user aimed; in that case vertical docking is left to the explicit menu
  // actions. Half the viewport is the cutoff.
  const verticalDockingEligible = rect.height * 2 <= viewportHeight
  const maxY = Math.max(0, viewportHeight - rect.height)
  const maxX = Math.max(0, viewportWidth - rect.width)
  const candidates = [
    {
      edge: 'top' as const,
      distance: position.y,
      offset: position.x,
      eligible: verticalDockingEligible,
    },
    {
      edge: 'right' as const,
      distance: maxX - position.x,
      offset: position.y,
      eligible: true,
    },
    {
      edge: 'bottom' as const,
      distance: maxY - position.y,
      offset: position.x,
      eligible: verticalDockingEligible,
    },
    { edge: 'left' as const, distance: position.x, offset: position.y, eligible: true },
  ]
  const distances = candidates
    .filter((entry) => entry.eligible)
    .sort((a, b) => a.distance - b.distance)

  const nearest = distances[0]
  if (!nearest || nearest.distance > edgeThreshold) return null
  const secondary = distances.find(
    (candidate) =>
      candidate.edge !== nearest.edge &&
      edgeAxis(candidate.edge) !== edgeAxis(nearest.edge) &&
      candidate.distance <= edgeThreshold,
  )

  return {
    edge: nearest.edge,
    secondaryEdge: secondary?.edge,
    offset: Math.max(0, nearest.offset),
  }
}

function edgeAxis(edge: DockEdge) {
  return edge === 'top' || edge === 'bottom' ? 'y' : 'x'
}
