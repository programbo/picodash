import type { TweakerItemRegistration, TweakerPanelState } from './tweaker-panel-types.js'

export interface TweakerCollapsibleGroupState {
  collapsed: boolean
  id: string
}

export function collapsibleGroupsForState(
  state: Pick<TweakerPanelState, 'collapsedGroups' | 'items'>,
): TweakerCollapsibleGroupState[] {
  return Object.values(state.items)
    .filter(isVisibleCollapsibleGroup)
    .map((group) => ({
      collapsed: state.collapsedGroups[group.id] ?? group.defaultCollapsed ?? false,
      id: group.id,
    }))
}

export function registeredFieldIdsForState(state: Pick<TweakerPanelState, 'items'>): string[] {
  return Array.from(
    new Set(
      Object.values(state.items)
        .map((item) => item.fieldId)
        .filter((fieldId): fieldId is string => fieldId !== undefined),
    ),
  )
}

function isVisibleCollapsibleGroup(
  item: TweakerItemRegistration,
): item is TweakerItemRegistration & { kind: 'group' } {
  return item.kind === 'group' && item.collapsible === true && item.hidden !== true
}
