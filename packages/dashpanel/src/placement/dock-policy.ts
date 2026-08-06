import type { DashPanelDockPosition, DashPanelPlacement } from './placement.ts'

export const DASH_PANEL_DOCK_POSITIONS: readonly DashPanelDockPosition[] = Object.freeze([
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
  'full-left',
  'center-left',
  'full-right',
  'center-right',
  'full-top',
  'center-top',
  'full-bottom',
  'center-bottom',
])

export type DashPanelPlacementAvailability =
  | { readonly status: 'available' }
  | {
      readonly status: 'dormant'
      readonly reason: 'position_disabled'
      readonly position: DashPanelDockPosition
    }

const CANONICAL_DOCK_POSITION_SET = new Set<DashPanelDockPosition>(DASH_PANEL_DOCK_POSITIONS)
const AVAILABLE: DashPanelPlacementAvailability = Object.freeze({ status: 'available' })

function canonicalDockPositions(value: unknown, label: string): readonly DashPanelDockPosition[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`)

  const requested = new Set<DashPanelDockPosition>()
  for (const position of value) {
    if (
      typeof position !== 'string' ||
      !CANONICAL_DOCK_POSITION_SET.has(position as DashPanelDockPosition)
    )
      throw new TypeError(`${label} contains an unknown dock position.`)
    requested.add(position as DashPanelDockPosition)
  }

  return Object.freeze(DASH_PANEL_DOCK_POSITIONS.filter((position) => requested.has(position)))
}

export function resolveProviderDockPositions(
  positions?: readonly DashPanelDockPosition[],
): readonly DashPanelDockPosition[] {
  return canonicalDockPositions(
    positions === undefined ? DASH_PANEL_DOCK_POSITIONS : positions,
    'Provider dock positions',
  )
}

export function resolvePanelDockPositions(
  providerMaximum: readonly DashPanelDockPosition[],
  positions?: readonly DashPanelDockPosition[],
): readonly DashPanelDockPosition[] {
  const resolvedProviderMaximum = canonicalDockPositions(providerMaximum, 'Provider dock positions')
  const resolvedPanelPositions = canonicalDockPositions(
    positions === undefined ? resolvedProviderMaximum : positions,
    'Panel dock positions',
  )
  const providerSet = new Set(resolvedProviderMaximum)
  for (const position of resolvedPanelPositions) {
    if (!providerSet.has(position))
      throw new TypeError(`Panel dock position ${position} widens the Provider policy.`)
  }
  return resolvedPanelPositions
}

export function classifyDashPanelPlacement(
  placement: DashPanelPlacement,
  positions: readonly DashPanelDockPosition[],
): DashPanelPlacementAvailability {
  const resolvedPositions = canonicalDockPositions(positions, 'Panel dock positions')
  let dockedPosition: DashPanelDockPosition | undefined
  if (placement.mode === 'fixed') dockedPosition = placement.disposition.position
  else if (placement.mode === 'hybrid' && placement.disposition.kind === 'docked')
    dockedPosition = placement.disposition.position

  if (dockedPosition !== undefined && !resolvedPositions.includes(dockedPosition))
    return Object.freeze({
      status: 'dormant',
      reason: 'position_disabled',
      position: dockedPosition,
    })
  return AVAILABLE
}
