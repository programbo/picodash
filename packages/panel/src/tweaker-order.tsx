import { Children, cloneElement, isValidElement, useMemo, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  TweakerItemRegistration,
  TweakerPanelState,
  TweakerPanelStore,
  TweakerPlacement,
  TweakerReorderItemLayout,
} from './tweaker-panel-types.js'

export const rootGroupId = 'root'

export function bandForItem(item: Pick<TweakerItemRegistration, 'placement'>): TweakerPlacement {
  return item.placement
}

export function orderedItemsForParent(
  state: Pick<TweakerPanelState, 'items' | 'order'>,
  parentId: string,
) {
  return orderedItemIdsForParent(state, parentId)
    .map((id, index) => ({ item: state.items[id]!, order: index }))
    .filter((entry) => !entry.item.hidden)
}

export function orderedItemIdsForParent(
  state: Pick<TweakerPanelState, 'items' | 'order'>,
  parentId: string,
) {
  const children = Object.values(state.items).filter((item) => item.parentId === parentId)
  const childIds = new Set(children.map((item) => item.id))
  const orderedIds = state.order[parentId]?.filter((id) => childIds.has(id)) ?? []
  const missing = children.filter((item) => !orderedIds.includes(item.id)).map((item) => item.id)
  return normalizeParentOrder([...orderedIds, ...missing], state.items, parentId)
}

export function orderIndexForItem(state: TweakerPanelState, itemId: string) {
  const item = state.items[itemId]
  if (!item) return 0
  const index = orderedItemsForParent(state, item.parentId)
    .filter((entry) => entry.item.placement === item.placement)
    .findIndex((entry) => entry.item.id === itemId)
  return index < 0 ? 0 : index
}

export function reorderValuesForPointer(
  initialValues: string[],
  itemId: string,
  layouts: TweakerReorderItemLayout[],
  pointerOffset: number,
) {
  const initialIndex = initialValues.indexOf(itemId)
  const draggedLayout = layouts.find((layout) => layout.id === itemId)
  if (initialIndex < 0 || !draggedLayout || pointerOffset === 0) return initialValues

  let targetIndex = initialIndex
  if (pointerOffset > 0) {
    for (let index = initialIndex + 1; index < initialValues.length; index += 1) {
      const layout = layouts.find((entry) => entry.id === initialValues[index])
      if (!layout || draggedLayout.max + pointerOffset <= (layout.min + layout.max) / 2) break
      targetIndex = index
    }
  } else {
    for (let index = initialIndex - 1; index >= 0; index -= 1) {
      const layout = layouts.find((entry) => entry.id === initialValues[index])
      if (!layout || draggedLayout.min + pointerOffset >= (layout.min + layout.max) / 2) break
      targetIndex = index
    }
  }

  if (targetIndex === initialIndex) return initialValues

  const nextValues = [...initialValues]
  const [draggedValue] = nextValues.splice(initialIndex, 1)
  nextValues.splice(targetIndex, 0, draggedValue!)
  return nextValues
}

export function useOrderedTweakerChildren(
  store: TweakerPanelStore,
  children: ReactNode,
  parentId: string,
) {
  const orderedIds = useStore(
    store,
    useShallow((state) => orderedItemIdsForParent(state, parentId)),
  )

  return useMemo(() => orderTweakerChildren(children, orderedIds), [children, orderedIds])
}

export function orderTweakerChildren(children: ReactNode, orderedIds: string[]) {
  const childArray = Children.toArray(children)
  if (childArray.length < 2 || orderedIds.length < 2) return childArray

  const orderById = new Map(orderedIds.map((id, index) => [id, index]))
  const entries = childArray.map((child) => {
    const itemId = itemIdFromTweakerChild(child)
    return { child: keyedTweakerChild(child, itemId), order: orderById.get(itemId ?? '') }
  })
  const orderedEntries = entries
    .filter((entry): entry is { child: ReactNode; order: number } => entry.order !== undefined)
    .sort((left, right) => left.order - right.order)

  if (orderedEntries.length < 2) return childArray
  if (orderedEntries.length === entries.length) return orderedEntries.map((entry) => entry.child)

  const orderedQueue = [...orderedEntries]
  return entries.map((entry) =>
    entry.order === undefined ? entry.child : (orderedQueue.shift()?.child ?? entry.child),
  )
}

export function normalizeAllOrders(
  order: Record<string, string[]>,
  items: Record<string, TweakerItemRegistration>,
) {
  const parentIds = new Set<string>([rootGroupId])
  for (const item of Object.values(items)) {
    parentIds.add(item.parentId)
    if (item.kind === 'group') parentIds.add(item.id)
  }

  return Object.fromEntries(
    Array.from(parentIds).map((parentId) => [
      parentId,
      normalizeParentOrder(order[parentId] ?? [], items, parentId),
    ]),
  )
}

export function normalizeParentOrder(
  orderedIds: string[],
  items: Record<string, TweakerItemRegistration>,
  parentId: string,
) {
  const children = Object.values(items).filter((item) => item.parentId === parentId)
  const childIds = new Set(children.map((item) => item.id))
  const seen = new Set<string>()
  const base = orderedIds.filter((id) => {
    if (!childIds.has(id) || seen.has(id)) return false
    seen.add(id)
    return true
  })
  const full = [...base, ...children.filter((item) => !seen.has(item.id)).map((item) => item.id)]
  const byBand = {
    auto: full.filter((id) => items[id]?.placement === 'auto'),
    end: full.filter((id) => items[id]?.placement === 'end'),
    start: full.filter((id) => items[id]?.placement === 'start'),
  }
  return [...byBand.start, ...byBand.auto, ...byBand.end]
}

type TweakerChildProps = {
  field?: unknown
  fieldId?: unknown
  id?: unknown
}

function itemIdFromTweakerChild(child: ReactNode) {
  if (!isValidElement<TweakerChildProps>(child)) return undefined

  const { field, fieldId, id } = child.props
  if (typeof id === 'string') return id
  if (typeof field === 'string') return field
  if (typeof fieldId === 'string') return fieldId
  return undefined
}

function keyedTweakerChild(child: ReactNode, itemId: string | undefined) {
  if (!itemId || !isValidElement(child) || child.key === itemId) return child
  return cloneElement(child, { key: itemId })
}
