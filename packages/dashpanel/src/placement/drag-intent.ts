import {
  dockDashPanelRect,
  snapDashPanelTargets,
  type DashPanelPoint,
  type DashPanelSize,
} from '../geometry/placement-geometry.ts'
import type { DashPanelRect } from '../geometry/inset.ts'
import type { DashPanelDockPosition, DashPanelSnapPosition } from './placement.ts'

export type DashPanelSnapDragIntent =
  | {
      readonly kind: 'free'
      readonly position: DashPanelPoint
    }
  | {
      readonly kind: 'snapped' | 'resisted'
      readonly position: DashPanelPoint
      readonly target: DashPanelSnapPosition
    }

export interface DashPanelHybridDockIntent {
  readonly position: DashPanelDockPosition
  readonly rect: DashPanelRect
}

const floatingSnapPositions: readonly DashPanelSnapPosition[] = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
]

function snapPositionsForMode(mode: 'floating' | 'hybrid'): readonly DashPanelSnapPosition[] {
  return mode === 'hybrid' ? ['top', 'bottom'] : floatingSnapPositions
}

function relativeTarget(rect: DashPanelRect, boundary: DashPanelRect): DashPanelPoint {
  return { x: rect.left - boundary.left, y: rect.top - boundary.top }
}

function distance(left: DashPanelPoint, right: DashPanelPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function smoothstep(value: number): number {
  const progress = Math.min(Math.max(value, 0), 1)
  return progress * progress * (3 - 2 * progress)
}

/**
 * Resolves the displayed position for one pointer sample. An acquired target
 * remains active until detachDistance, while the Panel progressively catches
 * up with the pointer between snapProximity and detachDistance.
 */
export function resolveDashPanelSnapDragIntent({
  activeTarget,
  boundary,
  detachDistance,
  mode,
  position,
  size,
  snapOffset,
  snapProximity,
}: {
  readonly activeTarget?: DashPanelSnapPosition
  readonly boundary: DashPanelRect
  readonly detachDistance: number
  readonly mode: 'floating' | 'hybrid'
  readonly position: DashPanelPoint
  readonly size: DashPanelSize
  readonly snapOffset: number
  readonly snapProximity: number
}): DashPanelSnapDragIntent {
  const targets = snapDashPanelTargets(boundary, size, snapOffset)
  const allowedTargets = snapPositionsForMode(mode)
  const retainedTarget =
    activeTarget !== undefined && allowedTargets.includes(activeTarget) ? activeTarget : undefined

  if (retainedTarget !== undefined) {
    const targetPosition = relativeTarget(targets[retainedTarget], boundary)
    const targetDistance = distance(position, targetPosition)
    const releaseDistance = Math.max(snapProximity, detachDistance)
    if (targetDistance < releaseDistance) {
      if (targetDistance <= snapProximity || releaseDistance === snapProximity)
        return { kind: 'snapped', position: targetPosition, target: retainedTarget }

      const progress = smoothstep(
        (targetDistance - snapProximity) / (releaseDistance - snapProximity),
      )
      return {
        kind: 'resisted',
        position: {
          x: targetPosition.x + (position.x - targetPosition.x) * progress,
          y: targetPosition.y + (position.y - targetPosition.y) * progress,
        },
        target: retainedTarget,
      }
    }
  }

  let nearestTarget: DashPanelSnapPosition | undefined
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const candidate of allowedTargets) {
    const candidatePosition = relativeTarget(targets[candidate], boundary)
    const candidateDistance = distance(position, candidatePosition)
    if (candidateDistance <= snapProximity && candidateDistance < nearestDistance) {
      nearestTarget = candidate
      nearestDistance = candidateDistance
    }
  }

  if (nearestTarget === undefined) return { kind: 'free', position }
  return {
    kind: 'snapped',
    position: relativeTarget(targets[nearestTarget], boundary),
    target: nearestTarget,
  }
}

function horizontalDockEdge(
  panel: DashPanelRect,
  boundary: DashPanelRect,
  pointer: DashPanelPoint,
  proximity: number,
): 'left' | 'right' | undefined {
  const nearLeft = panel.left <= boundary.left + proximity
  const nearRight = panel.right >= boundary.right - proximity
  if (nearLeft && nearRight)
    return pointer.x <= boundary.left + boundary.width / 2 ? 'left' : 'right'
  if (nearLeft) return 'left'
  if (nearRight) return 'right'
  return undefined
}

/**
 * Resolves the six spatial Hybrid drag zones from the prototype: four corners
 * and the two full sides. A center-side target is used only when its full-side
 * counterpart is disabled. Other canonical docks remain available from the
 * placement menu, where their intent is unambiguous.
 */
export function resolveDashPanelHybridDockIntent({
  boundary,
  isOccupied,
  panel,
  pointer,
  positions,
  proximity,
  size,
}: {
  readonly boundary: DashPanelRect
  readonly isOccupied: (position: DashPanelDockPosition) => boolean
  readonly panel: DashPanelRect
  readonly pointer: DashPanelPoint
  readonly positions: readonly DashPanelDockPosition[]
  readonly proximity: number
  readonly size: DashPanelSize
}): DashPanelHybridDockIntent | undefined {
  const edge = horizontalDockEdge(panel, boundary, pointer, proximity)
  if (edge === undefined) return undefined

  const verticalProgress =
    boundary.height === 0 ? 0.5 : (pointer.y - boundary.top) / boundary.height
  const candidate: DashPanelDockPosition =
    verticalProgress <= 0.25
      ? edge === 'left'
        ? 'top-left'
        : 'top-right'
      : verticalProgress >= 0.75
        ? edge === 'left'
          ? 'bottom-left'
          : 'bottom-right'
        : positions.includes(edge === 'left' ? 'full-left' : 'full-right')
          ? edge === 'left'
            ? 'full-left'
            : 'full-right'
          : edge === 'left'
            ? 'center-left'
            : 'center-right'

  if (!positions.includes(candidate) || isOccupied(candidate)) return undefined
  return { position: candidate, rect: dockDashPanelRect(candidate, boundary, size) }
}
