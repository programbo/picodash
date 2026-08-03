import type { PicodashRegisteredItem, PicodashStoreState } from '@picodash/store'
import type { AnyPicodashValues } from './picodash-panel-types.js'

export interface PicodashCollapsibleGroupState {
  collapsed: boolean
  id: string
}

export function collapsibleGroupsForState(
  state: Pick<PicodashStoreState<AnyPicodashValues>, 'itemMetadata' | 'items'>,
): PicodashCollapsibleGroupState[] {
  return Object.values(state.items)
    .filter(isVisibleCollapsibleGroup)
    .map((group) => ({
      collapsed: state.itemMetadata.collapsed[group.id] ?? group.defaultCollapsed,
      id: group.id,
    }))
}

export function registeredFieldIdsForState(
  state: Pick<PicodashStoreState<AnyPicodashValues>, 'items'>,
): string[] {
  return Array.from(
    new Set(
      Object.values(state.items).flatMap((item) =>
        item.bindings.map((binding) => binding.field.key),
      ),
    ),
  )
}

export function registeredWritableFieldIdsForState(
  state: Pick<PicodashStoreState<AnyPicodashValues>, 'items'>,
): string[] {
  return registeredFieldIdsForState({
    items: Object.fromEntries(
      Object.entries(state.items).filter(([, item]) =>
        item.bindings.some((binding) => binding.mode === 'input'),
      ),
    ),
  })
}

function isVisibleCollapsibleGroup(
  item: PicodashRegisteredItem<AnyPicodashValues>,
): item is PicodashRegisteredItem<AnyPicodashValues> & { kind: 'group' } {
  return item.kind === 'group' && item.collapsible === true && item.hidden !== true
}
