import type { PicodashItemRegistration, PicodashPanelState } from './picodash-panel-types.js'

export interface PicodashCollapsibleGroupState {
  collapsed: boolean
  id: string
}

export function collapsibleGroupsForState(
  state: Pick<PicodashPanelState, 'collapsedGroups' | 'items'>,
): PicodashCollapsibleGroupState[] {
  return Object.values(state.items)
    .filter(isVisibleCollapsibleGroup)
    .map((group) => ({
      collapsed: state.collapsedGroups[group.id] ?? group.defaultCollapsed ?? false,
      id: group.id,
    }))
}

export function registeredFieldIdsForState(state: Pick<PicodashPanelState, 'items'>): string[] {
  return Array.from(
    new Set(
      Object.values(state.items)
        .map((item) => item.field)
        .filter((field): field is string => field !== undefined),
    ),
  )
}

export function registeredWritableFieldIdsForState(
  state: Pick<PicodashPanelState, 'items'>,
): string[] {
  return registeredFieldIdsForState({
    items: Object.fromEntries(
      Object.entries(state.items).filter(([, item]) => item.valueMode !== 'display'),
    ),
  })
}

function isVisibleCollapsibleGroup(
  item: PicodashItemRegistration,
): item is PicodashItemRegistration & { kind: 'group' } {
  return item.kind === 'group' && item.collapsible === true && item.hidden !== true
}
