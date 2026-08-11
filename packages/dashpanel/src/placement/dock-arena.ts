import { DASH_PANEL_DOCK_POSITIONS } from './dock-policy.ts'
import type { DashPanelDockPosition } from './placement.ts'

export type DashPanelDockSlot =
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left'
  | 'main-left'
  | 'main-right'
  | 'main-top'
  | 'main-bottom'

export interface DashPanelDockOccupant {
  readonly id: string
  readonly position: DashPanelDockPosition
}

export interface DashPanelDockConflict {
  readonly reason: 'dock_occupied'
  readonly occupant: DashPanelDockOccupant
  readonly incumbent: DashPanelDockOccupant
  readonly slot: DashPanelDockSlot
}

export interface DashPanelDockOccupancySnapshot {
  readonly occupants: readonly DashPanelDockOccupant[]
  readonly conflicts: readonly DashPanelDockConflict[]
}

export interface DashPanelDockClaimResult {
  readonly status: 'accepted' | 'rejected'
  readonly occupancy: DashPanelDockOccupancySnapshot
  readonly conflict?: DashPanelDockConflict
}

export type DashPanelDockSide = 'left' | 'right'

export interface DashPanelSideAllocation {
  readonly position: DashPanelDockPosition
  readonly ratio: number
  readonly max: number
  readonly offset: number
}

export interface DashPanelDockSideAllocation {
  readonly side: DashPanelDockSide
  readonly available: number
  readonly allocations: readonly DashPanelSideAllocation[]
  readonly unused: number
}

const POSITION_SET = new Set<DashPanelDockPosition>(DASH_PANEL_DOCK_POSITIONS)
const POSITION_ORDER = new Map(
  DASH_PANEL_DOCK_POSITIONS.map((position, index) => [position, index]),
)

const SLOT_BY_POSITION: Readonly<Record<DashPanelDockPosition, DashPanelDockSlot>> = Object.freeze({
  'top-left': 'top-left',
  'top-right': 'top-right',
  'bottom-right': 'bottom-right',
  'bottom-left': 'bottom-left',
  'full-left': 'main-left',
  'center-left': 'main-left',
  'full-right': 'main-right',
  'center-right': 'main-right',
  'full-top': 'main-top',
  'center-top': 'main-top',
  'full-bottom': 'main-bottom',
  'center-bottom': 'main-bottom',
})

function dockPosition(value: unknown, label: string): DashPanelDockPosition {
  if (typeof value !== 'string' || !POSITION_SET.has(value as DashPanelDockPosition))
    throw new TypeError(`${label} contains an unknown dock position.`)
  return value as DashPanelDockPosition
}

function occupant(value: unknown, index: number): DashPanelDockOccupant {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`DashPanel dock occupant ${index} must be an object.`)
  const candidate = value as Record<string, unknown>
  if (typeof candidate.id !== 'string' || candidate.id.length === 0)
    throw new TypeError(`DashPanel dock occupant ${index} id must be a non-empty string.`)
  return Object.freeze({
    id: candidate.id,
    position: dockPosition(candidate.position, `DashPanel dock occupant ${index}`),
  })
}

export function resolveDashPanelDockSlot(position: DashPanelDockPosition): DashPanelDockSlot {
  const normalized = dockPosition(position, 'DashPanel dock position')
  return SLOT_BY_POSITION[normalized]
}

function sortOccupants(
  occupants: readonly DashPanelDockOccupant[],
): readonly DashPanelDockOccupant[] {
  return Object.freeze(
    [...occupants].sort((a, b) => {
      const order = POSITION_ORDER.get(a.position)! - POSITION_ORDER.get(b.position)!
      return order === 0 ? a.id.localeCompare(b.id) : order
    }),
  )
}

/**
 * Resolves committed leases in order. The first occupant of an exact slot wins;
 * full and center positions on one edge intentionally map to the same slot.
 */
export function resolveDashPanelDockOccupancy(
  values: readonly DashPanelDockOccupant[],
): DashPanelDockOccupancySnapshot {
  if (!Array.isArray(values)) throw new TypeError('DashPanel dock occupants must be an array.')
  const accepted: DashPanelDockOccupant[] = []
  const conflicts: DashPanelDockConflict[] = []
  const slots = new Map<DashPanelDockSlot, DashPanelDockOccupant>()
  const ids = new Set<string>()
  values.forEach((value, index) => {
    const candidate = occupant(value, index)
    if (ids.has(candidate.id))
      throw new TypeError(`DashPanel dock occupant id ${candidate.id} is duplicated.`)
    ids.add(candidate.id)
    const slot = resolveDashPanelDockSlot(candidate.position)
    const incumbent = slots.get(slot)
    if (incumbent !== undefined) {
      conflicts.push(
        Object.freeze({ reason: 'dock_occupied', occupant: candidate, incumbent, slot }),
      )
      return
    }
    slots.set(slot, candidate)
    accepted.push(candidate)
  })
  return Object.freeze({ occupants: sortOccupants(accepted), conflicts: Object.freeze(conflicts) })
}

export function isDashPanelDockOccupied(
  values: readonly DashPanelDockOccupant[],
  position: DashPanelDockPosition,
  exceptId?: string,
): boolean {
  const slot = resolveDashPanelDockSlot(position)
  const snapshot = resolveDashPanelDockOccupancy(values)
  return snapshot.occupants.some(
    (occupantValue) =>
      resolveDashPanelDockSlot(occupantValue.position) === slot && occupantValue.id !== exceptId,
  )
}

/** Atomically attempts to lease a slot and leaves the existing snapshot untouched on conflict. */
export function claimDashPanelDock(
  values: readonly DashPanelDockOccupant[],
  candidateValue: DashPanelDockOccupant,
): DashPanelDockClaimResult {
  const candidate = occupant(candidateValue, values.length)
  const existing = resolveDashPanelDockOccupancy(values)
  const incumbent = existing.occupants.find(
    (occupantValue) =>
      resolveDashPanelDockSlot(occupantValue.position) ===
      resolveDashPanelDockSlot(candidate.position),
  )
  if (incumbent !== undefined) {
    const conflict = Object.freeze({
      reason: 'dock_occupied' as const,
      occupant: candidate,
      incumbent,
      slot: resolveDashPanelDockSlot(candidate.position),
    })
    return Object.freeze({ status: 'rejected' as const, occupancy: existing, conflict })
  }
  const occupancy = resolveDashPanelDockOccupancy([...values, candidate])
  return Object.freeze({ status: 'accepted' as const, occupancy })
}

function sidePositions(side: DashPanelDockSide): readonly DashPanelDockPosition[] {
  return side === 'left'
    ? ['top-left', 'bottom-left', 'full-left', 'center-left']
    : ['top-right', 'bottom-right', 'full-right', 'center-right']
}

/**
 * Computes the complete side allocation from the current occupants. Ratios are
 * maxima; intrinsic sizing remains the caller's responsibility for corner and
 * center occupants.
 */
export function resolveDashPanelDockSideAllocation(
  side: DashPanelDockSide,
  values: readonly DashPanelDockOccupant[],
  available: number,
): DashPanelDockSideAllocation {
  if (side !== 'left' && side !== 'right') throw new TypeError('DashPanel dock side is invalid.')
  if (typeof available !== 'number' || !Number.isFinite(available) || available < 0)
    throw new TypeError('DashPanel side allocation height must be finite and non-negative.')
  const accepted = resolveDashPanelDockOccupancy(values).occupants
  const allowed = new Set(sidePositions(side))
  const occupants = accepted.filter((value) => allowed.has(value.position))
  const corners = occupants.filter(
    (value) => value.position === `top-${side}` || value.position === `bottom-${side}`,
  )
  const main = occupants.find(
    (value) => value.position === `full-${side}` || value.position === `center-${side}`,
  )
  let cornerRatio = 0
  let mainRatio = 0
  if (main === undefined) {
    if (corners.length === 1) cornerRatio = 2 / 3
    else if (corners.length >= 2) cornerRatio = 1 / 2
  } else if (corners.length === 0) {
    mainRatio = 1
  } else if (corners.length === 1) {
    cornerRatio = main.position.startsWith('full-') ? 1 / 3 : 1 / 3
    mainRatio = main.position.startsWith('full-') ? 2 / 3 : 1 / 3
  } else {
    cornerRatio = 1 / 3
    mainRatio = 1 / 3
  }
  const allocations = occupants.map((value) => {
    const ratio = value === main ? mainRatio : cornerRatio
    const max = available * ratio
    const isTop = value.position === `top-${side}`
    const isBottom = value.position === `bottom-${side}`
    const offset = isTop
      ? 0
      : isBottom
        ? available - max
        : value.position === `center-${side}` && corners.length > 0
          ? (available - max) / 2
          : corners.some((corner) => corner.position === `top-${side}`)
            ? cornerRatio * available
            : 0
    return Object.freeze({ position: value.position, ratio, max, offset })
  })
  const used = allocations.reduce((total, value) => total + value.max, 0)
  return Object.freeze({
    side,
    available,
    allocations: Object.freeze(allocations),
    unused: Math.max(0, available - used),
  })
}

export const dashPanelDockSlot = resolveDashPanelDockSlot
export const dashPanelDockOccupancy = resolveDashPanelDockOccupancy
export const dashPanelDockSideAllocation = resolveDashPanelDockSideAllocation
