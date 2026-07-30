import type { PicodashItemOrderBand, PicodashItemPin, PicodashRegisteredItem } from './types.js'

type OrderItem = Pick<
  PicodashRegisteredItem<object>,
  'hidden' | 'id' | 'parentId' | 'pin' | 'reorderable'
>

export function bandForPicodashItem(item: Pick<OrderItem, 'pin'>): PicodashItemOrderBand {
  return item.pin ?? 'auto'
}

export function orderedPicodashItemIds(
  items: Readonly<Record<string, OrderItem>>,
  order: Readonly<Record<string, readonly string[]>>,
  parentId: string,
): readonly string[] {
  const childIds = new Set(
    Object.values(items)
      .filter((item) => item.parentId === parentId)
      .map((item) => item.id),
  )
  const ordered = (order[parentId] ?? []).filter((id) => childIds.has(id))
  const missing = [...childIds].filter((id) => !ordered.includes(id))
  return normalizePicodashParentOrder([...ordered, ...missing], items, parentId)
}

export function visibleOrderedPicodashItemIds(
  items: Readonly<Record<string, OrderItem>>,
  order: Readonly<Record<string, readonly string[]>>,
  parentId: string,
): readonly string[] {
  return orderedPicodashItemIds(items, order, parentId).filter((id) => !items[id]?.hidden)
}

export function picodashItemCanReorder(
  items: Readonly<Record<string, OrderItem>>,
  itemId: string,
): boolean {
  const item = items[itemId]
  if (item === undefined || item.hidden || !item.reorderable) return false
  return Object.values(items).some(
    (sibling) =>
      sibling.id !== item.id &&
      sibling.parentId === item.parentId &&
      sibling.pin === item.pin &&
      !sibling.hidden &&
      sibling.reorderable,
  )
}

export function normalizePicodashOrders(
  order: Readonly<Record<string, readonly string[]>>,
  items: Readonly<Record<string, OrderItem>>,
  knownItems: Readonly<Record<string, OrderItem>> = items,
): Record<string, readonly string[]> {
  const parentIds = new Set<string>(Object.keys(order))
  for (const item of Object.values(knownItems)) parentIds.add(item.parentId)

  return Object.fromEntries(
    [...parentIds].map((parentId) => [
      parentId,
      normalizePicodashParentOrder(order[parentId] ?? [], knownItems, parentId, true),
    ]),
  )
}

export function normalizePicodashParentOrder(
  orderedIds: readonly string[],
  items: Readonly<Record<string, OrderItem>>,
  parentId: string,
  preserveKnownUnmounted = false,
): readonly string[] {
  const children = Object.values(items).filter((item) => item.parentId === parentId)
  const childIds = new Set(children.map((item) => item.id))
  const seen = new Set<string>()
  const base = orderedIds.filter((id) => {
    const eligible =
      childIds.has(id) ||
      (preserveKnownUnmounted && (items[id] === undefined || items[id]?.parentId === parentId))
    if (!eligible || seen.has(id)) return false
    seen.add(id)
    return true
  })
  const full = [...base, ...children.filter((item) => !seen.has(item.id)).map((item) => item.id)]
  const byBand: Record<PicodashItemOrderBand, string[]> = {
    auto: [],
    end: [],
    start: [],
  }
  for (const id of full) {
    const item = items[id]
    byBand[item === undefined ? 'auto' : bandForPicodashItem(item)].push(id)
  }
  return [...byBand.start, ...byBand.auto, ...byBand.end]
}

export function movePicodashItemToIndex(
  items: Readonly<Record<string, OrderItem>>,
  order: Readonly<Record<string, readonly string[]>>,
  itemId: string,
  index: number,
): Readonly<Record<string, readonly string[]>> {
  const item = items[itemId]
  if (item === undefined || !picodashItemCanReorder(items, itemId)) return order

  const parentOrder = order[item.parentId] ?? []
  const visibleBandOrder = parentOrder.filter((id) => {
    const orderedItem = items[id]
    return (
      orderedItem?.parentId === item.parentId && orderedItem.pin === item.pin && !orderedItem.hidden
    )
  })
  const from = visibleBandOrder.indexOf(itemId)
  if (from < 0) return order
  const to = Math.min(Math.max(Math.round(index), 0), Math.max(visibleBandOrder.length - 1, 0))
  if (from === to) return order

  const nextBand = [...visibleBandOrder]
  nextBand.splice(from, 1)
  nextBand.splice(to, 0, itemId)
  return {
    ...order,
    [item.parentId]: replaceVisibleBandOrder(parentOrder, nextBand, items, item.parentId, item.pin),
  }
}

export function movePicodashItemRelativeTo(
  items: Readonly<Record<string, OrderItem>>,
  order: Readonly<Record<string, readonly string[]>>,
  itemId: string,
  overId: string,
  position: 'after' | 'before',
): Readonly<Record<string, readonly string[]>> {
  const item = items[itemId]
  const over = items[overId]
  if (
    item === undefined ||
    over === undefined ||
    !picodashItemCanReorder(items, itemId) ||
    item.parentId !== over.parentId ||
    item.pin !== over.pin
  ) {
    return order
  }
  const bandOrder = (order[item.parentId] ?? []).filter((id) => {
    const candidate = items[id]
    return candidate?.parentId === item.parentId && candidate.pin === item.pin && !candidate.hidden
  })
  if (!bandOrder.includes(itemId) || !bandOrder.includes(overId)) return order
  const nextBand = bandOrder.filter((id) => id !== itemId)
  const overIndex = nextBand.indexOf(overId)
  nextBand.splice(position === 'after' ? overIndex + 1 : overIndex, 0, itemId)
  if (bandOrder.every((id, index) => nextBand[index] === id)) return order
  return {
    ...order,
    [item.parentId]: replaceVisibleBandOrder(
      order[item.parentId] ?? [],
      nextBand,
      items,
      item.parentId,
      item.pin,
    ),
  }
}

function replaceVisibleBandOrder(
  parentOrder: readonly string[],
  nextVisibleBandOrder: readonly string[],
  items: Readonly<Record<string, OrderItem>>,
  parentId: string,
  pin: PicodashItemPin | undefined,
): readonly string[] {
  const queue = [...nextVisibleBandOrder]
  return parentOrder.map((id) => {
    const item = items[id]
    return item?.parentId === parentId && item.pin === pin && !item.hidden
      ? (queue.shift() ?? id)
      : id
  })
}
