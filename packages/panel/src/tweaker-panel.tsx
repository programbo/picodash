import { motion, Reorder, useDragControls, type HTMLMotionProps } from 'motion/react'
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { createStore, useStore, type StoreApi } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import {
  panelZIndexForState,
  useRegisterTweakerPanel,
  useTweakerProviderContext,
} from './tweaker-provider.js'
import { cn } from './utils.js'

export type TweakerValue =
  | string
  | number
  | boolean
  | null
  | TweakerValue[]
  | { [key: string]: TweakerValue }

export type TweakerPlacement = 'auto' | 'start' | 'end'
export type TweakerItemKind = 'control' | 'group'
export type TweakerStatus = 'info' | 'warning' | 'alert' | 'error'
export type TweakerControlStateValue = boolean | string | number | null | undefined
export type TweakerControlStates = Record<string, TweakerControlStateValue>

export interface TweakerFieldState {
  defaultValue?: TweakerValue
  dirty: boolean
  errors: string[]
  touched: boolean
}

export interface TweakerItemRegistration {
  defaultValue?: TweakerValue
  fieldId?: string
  hidden?: boolean
  id: string
  kind: TweakerItemKind
  label?: string
  parentId: string
  placement: TweakerPlacement
  reorderable: boolean
}

export interface TweakerInteractionState {
  activeIds: Record<string, true>
  draggingId: string | null
  focusedId: string | null
  hoveredId: string | null
}

export interface TweakerPanelState {
  collapsedGroups: Record<string, boolean>
  fields: Record<string, TweakerFieldState>
  interaction: TweakerInteractionState
  items: Record<string, TweakerItemRegistration>
  meta: Record<string, TweakerValue>
  order: Record<string, string[]>
  panelId: string
  values: Record<string, TweakerValue>
  registerItem: (item: TweakerItemRegistration) => void
  moveItemToIndex: (itemId: string, index: number) => void
  moveItemRelativeTo: (itemId: string, overId: string, position: 'before' | 'after') => void
  reorderItem: (activeId: string, overId: string) => void
  resetFieldValue: (fieldId: string) => void
  resetFields: () => void
  setFieldDefault: (fieldId: string, value: TweakerValue | undefined) => void
  setFieldValue: (fieldId: string, value: TweakerValue) => void
  setFocusedItem: (itemId: string | null) => void
  setGroupCollapsed: (groupId: string, collapsed: boolean) => void
  setHoveredItem: (itemId: string | null) => void
  setInteractionActive: (interactionId: string, active: boolean) => void
  setDraggingItem: (itemId: string | null) => void
  setMetaValue: (key: string, value: TweakerValue) => void
  setOrder: (parentId: string, itemIds: string[]) => void
  unregisterItem: (itemId: string) => void
}

export type TweakerPanelStore = StoreApi<TweakerPanelState>

export interface TweakerPanelProps extends Omit<
  HTMLMotionProps<'aside'>,
  'children' | 'dragConstraints' | 'id' | 'title'
> {
  children?: ReactNode
  defaultValues?: Record<string, TweakerValue>
  id?: string
  initialMeta?: Record<string, TweakerValue>
  title?: ReactNode
}

export interface TweakerGroupContextValue {
  commitPendingOrder: () => void
  listRef: RefObject<HTMLDivElement | null>
  parentId: string
}

const rootGroupId = 'root'
const emptyValues: Record<string, TweakerValue> = {}
const emptyMeta: Record<string, TweakerValue> = {}
const TweakerPanelContext = createContext<TweakerPanelStore | null>(null)
const TweakerGroupContext = createContext<TweakerGroupContextValue | null>(null)

export function createTweakerPanelStore({
  defaultValues = emptyValues,
  initialMeta = emptyMeta,
  panelId,
}: {
  defaultValues?: Record<string, TweakerValue>
  initialMeta?: Record<string, TweakerValue>
  panelId: string
}): TweakerPanelStore {
  return createStore<TweakerPanelState>()((set) => ({
    collapsedGroups: {},
    fields: Object.fromEntries(
      Object.entries(defaultValues).map(([fieldId, value]) => [
        fieldId,
        { defaultValue: value, dirty: false, errors: [], touched: false },
      ]),
    ),
    interaction: { activeIds: {}, draggingId: null, focusedId: null, hoveredId: null },
    items: {},
    meta: initialMeta,
    order: { [rootGroupId]: [] },
    panelId,
    values: defaultValues,
    registerItem(item) {
      set((state) => {
        const previous = state.items[item.id]
        const items = { ...state.items, [item.id]: item }
        let order = state.order

        if (previous?.parentId && previous.parentId !== item.parentId) {
          order = removeFromParentOrder(order, previous.parentId, item.id)
        }

        const parentOrder = order[item.parentId] ?? []
        if (!parentOrder.includes(item.id)) {
          order = { ...order, [item.parentId]: [...parentOrder, item.id] }
        } else if (order === state.order) {
          order = { ...order }
        }

        if (item.kind === 'group' && !order[item.id]) {
          order[item.id] = []
        }

        const fieldState = item.fieldId === undefined ? undefined : state.fields[item.fieldId]
        const fields =
          item.fieldId === undefined
            ? state.fields
            : {
                ...state.fields,
                [item.fieldId]: {
                  ...(fieldState ?? emptyField()),
                  defaultValue: item.defaultValue,
                },
              }
        const values =
          item.fieldId === undefined ||
          Object.prototype.hasOwnProperty.call(state.values, item.fieldId) ||
          item.defaultValue === undefined
            ? state.values
            : { ...state.values, [item.fieldId]: item.defaultValue }

        return { fields, items, order: normalizeAllOrders(order, items), values }
      })
    },
    moveItemToIndex(itemId, index) {
      set((state) => {
        const item = state.items[itemId]
        if (!item?.reorderable) return state

        const parentOrder = state.order[item.parentId] ?? []
        const visibleBandOrder = parentOrder.filter((id) => {
          const orderedItem = state.items[id]
          return (
            orderedItem?.parentId === item.parentId &&
            orderedItem.placement === item.placement &&
            !orderedItem.hidden
          )
        })
        const from = visibleBandOrder.indexOf(itemId)
        if (from < 0) return state

        const maxIndex = Math.max(visibleBandOrder.length - 1, 0)
        const to = Math.min(Math.max(Math.round(index), 0), maxIndex)
        if (from === to) return state

        const nextVisibleBandOrder = [...visibleBandOrder]
        nextVisibleBandOrder.splice(from, 1)
        nextVisibleBandOrder.splice(to, 0, itemId)

        const queuedVisibleBandOrder = [...nextVisibleBandOrder]
        const nextParentOrder = parentOrder.map((id) => {
          const orderedItem = state.items[id]
          if (
            orderedItem?.parentId === item.parentId &&
            orderedItem.placement === item.placement &&
            !orderedItem.hidden
          ) {
            return queuedVisibleBandOrder.shift() ?? id
          }

          return id
        })

        return {
          order: normalizeAllOrders(
            { ...state.order, [item.parentId]: nextParentOrder },
            state.items,
          ),
        }
      })
    },
    moveItemRelativeTo(itemId, overId, position) {
      set((state) => {
        const item = state.items[itemId]
        const over = state.items[overId]
        if (!item?.reorderable || !over) return state
        if (item.parentId !== over.parentId || item.placement !== over.placement) return state

        const parentOrder = state.order[item.parentId] ?? []
        const visibleBandOrder = parentOrder.filter((id) => {
          const orderedItem = state.items[id]
          return (
            orderedItem?.parentId === item.parentId &&
            orderedItem.placement === item.placement &&
            !orderedItem.hidden
          )
        })
        if (!visibleBandOrder.includes(itemId) || !visibleBandOrder.includes(overId)) {
          return state
        }

        const nextVisibleBandOrder = visibleBandOrder.filter((id) => id !== itemId)
        const overIndex = nextVisibleBandOrder.indexOf(overId)
        if (overIndex < 0) return state

        nextVisibleBandOrder.splice(position === 'after' ? overIndex + 1 : overIndex, 0, itemId)
        if (visibleBandOrder.every((id, index) => nextVisibleBandOrder[index] === id)) {
          return state
        }

        const queuedVisibleBandOrder = [...nextVisibleBandOrder]
        const nextParentOrder = parentOrder.map((id) => {
          const orderedItem = state.items[id]
          if (
            orderedItem?.parentId === item.parentId &&
            orderedItem.placement === item.placement &&
            !orderedItem.hidden
          ) {
            return queuedVisibleBandOrder.shift() ?? id
          }

          return id
        })

        return {
          order: normalizeAllOrders(
            { ...state.order, [item.parentId]: nextParentOrder },
            state.items,
          ),
        }
      })
    },
    reorderItem(activeId, overId) {
      set((state) => {
        const active = state.items[activeId]
        const over = state.items[overId]
        if (!active || !over) return state
        if (!active.reorderable || active.parentId !== over.parentId) return state
        if (bandForItem(active) !== bandForItem(over)) return state

        const parentOrder = state.order[active.parentId] ?? []
        const from = parentOrder.indexOf(activeId)
        const to = parentOrder.indexOf(overId)
        if (from < 0 || to < 0 || from === to) return state

        const nextOrder = [...parentOrder]
        nextOrder.splice(from, 1)
        nextOrder.splice(to, 0, activeId)

        return {
          order: normalizeAllOrders({ ...state.order, [active.parentId]: nextOrder }, state.items),
        }
      })
    },
    resetFieldValue(fieldId) {
      set((state) => {
        const field = state.fields[fieldId]
        const values = { ...state.values }
        if (field?.defaultValue === undefined) {
          delete values[fieldId]
        } else {
          values[fieldId] = field.defaultValue
        }
        return {
          fields: {
            ...state.fields,
            [fieldId]: { ...(field ?? emptyField()), dirty: false, touched: false },
          },
          values,
        }
      })
    },
    resetFields() {
      set((state) => {
        const values: Record<string, TweakerValue> = {}
        for (const [fieldId, field] of Object.entries(state.fields)) {
          if (field.defaultValue !== undefined) {
            values[fieldId] = field.defaultValue
          }
        }

        return {
          fields: Object.fromEntries(
            Object.entries(state.fields).map(([fieldId, field]) => [
              fieldId,
              { ...field, dirty: false, touched: false },
            ]),
          ),
          values,
        }
      })
    },
    setFieldDefault(fieldId, value) {
      set((state) => ({
        fields: {
          ...state.fields,
          [fieldId]: {
            ...(state.fields[fieldId] ?? emptyField()),
            defaultValue: value,
          },
        },
        values: Object.prototype.hasOwnProperty.call(state.values, fieldId)
          ? state.values
          : value === undefined
            ? state.values
            : { ...state.values, [fieldId]: value },
      }))
    },
    setFieldValue(fieldId, value) {
      set((state) => ({
        fields: {
          ...state.fields,
          [fieldId]: { ...(state.fields[fieldId] ?? emptyField()), dirty: true, touched: true },
        },
        values: { ...state.values, [fieldId]: value },
      }))
    },
    setFocusedItem(itemId) {
      set((state) =>
        state.interaction.focusedId === itemId
          ? state
          : { interaction: { ...state.interaction, focusedId: itemId } },
      )
    },
    setGroupCollapsed(groupId, collapsed) {
      set((state) => ({
        collapsedGroups: { ...state.collapsedGroups, [groupId]: collapsed },
      }))
    },
    setHoveredItem(itemId) {
      set((state) =>
        state.interaction.draggingId || state.interaction.hoveredId === itemId
          ? state
          : { interaction: { ...state.interaction, hoveredId: itemId } },
      )
    },
    setInteractionActive(interactionId, active) {
      set((state) => {
        if (state.interaction.draggingId && interactionId.startsWith('pointer:')) {
          return state
        }

        const activeIds = { ...state.interaction.activeIds }
        if (active) {
          activeIds[interactionId] = true
        } else {
          delete activeIds[interactionId]
        }
        return { interaction: { ...state.interaction, activeIds } }
      })
    },
    setDraggingItem(itemId) {
      set((state) => {
        const activeIds =
          itemId === null
            ? Object.fromEntries(
                Object.entries(state.interaction.activeIds).filter(
                  ([activeId]) => !activeId.startsWith('pointer:'),
                ),
              )
            : state.interaction.activeIds

        return { interaction: { ...state.interaction, activeIds, draggingId: itemId } }
      })
    },
    setMetaValue(key, value) {
      set((state) => ({ meta: { ...state.meta, [key]: value } }))
    },
    setOrder(parentId, itemIds) {
      set((state) => ({
        order: normalizeAllOrders({ ...state.order, [parentId]: itemIds }, state.items),
      }))
    },
    unregisterItem(itemId) {
      set((state) => {
        if (!state.items[itemId]) return state
        if (state.interaction.draggingId) return state

        const items = { ...state.items }
        delete items[itemId]
        const order = Object.fromEntries(
          Object.entries(state.order)
            .filter(([parentId]) => parentId !== itemId)
            .map(([parentId, ids]) => [parentId, ids.filter((id) => id !== itemId)]),
        )
        const collapsedGroups = { ...state.collapsedGroups }
        delete collapsedGroups[itemId]
        return { collapsedGroups, items, order: normalizeAllOrders(order, items) }
      })
    },
  }))
}

export function TweakerPanel({
  children,
  className,
  defaultValues,
  drag = true,
  dragElastic = false,
  dragMomentum = false,
  id,
  initialMeta,
  onFocusCapture,
  onPointerDownCapture,
  style,
  title,
  ...props
}: TweakerPanelProps) {
  const reactId = useId()
  const panelId = id ?? `tweaker-panel-${reactId.replaceAll(':', '')}`
  const { containerElement, store } = useTweakerProviderContext()
  const panelDragControls = useDragControls()
  const dragConstraintsRef = useRef<HTMLDivElement | null>(null)
  const panelStoreRef = useRef<TweakerPanelStore | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  dragConstraintsRef.current = containerElement

  if (!panelStoreRef.current) {
    panelStoreRef.current = createTweakerPanelStore({ defaultValues, initialMeta, panelId })
  }

  const panelStore = panelStoreRef.current
  const zIndex = useStore(store, (state) => panelZIndexForState(state, panelId))
  const rootGroupContext = useMemo<TweakerGroupContextValue>(
    () => ({ commitPendingOrder: () => {}, listRef: bodyRef, parentId: rootGroupId }),
    [],
  )
  const orderedChildren = useOrderedTweakerChildren(panelStore, children, rootGroupId)
  useRegisterTweakerPanel({ id: panelId })

  if (!containerElement) return null

  const panel = (
    <TweakerPanelContext.Provider value={panelStore}>
      <motion.aside
        {...props}
        id={id}
        data-tweaker-panel
        data-tweaker-panel-id={panelId}
        className={cn(
          'pointer-events-auto absolute top-8 right-8 flex max-h-[calc(100dvh-4rem)] w-[min(24rem,calc(100dvw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-2xl shadow-black/30 ring-1 ring-white/5',
          className,
        )}
        drag={drag}
        dragControls={panelDragControls}
        dragConstraints={dragConstraintsRef}
        dragElastic={dragElastic}
        dragListener={false}
        dragMomentum={dragMomentum}
        style={{ ...style, zIndex }}
        onFocusCapture={(event) => {
          store.getState().activatePanel(panelId)
          onFocusCapture?.(event)
        }}
        onPointerDownCapture={(event) => {
          store.getState().activatePanel(panelId)
          onPointerDownCapture?.(event)
        }}
      >
        {title ? (
          <div
            className="border-border flex cursor-grab items-center justify-between border-b px-3 py-2 select-none active:cursor-grabbing"
            onPointerDown={(event) => {
              if (drag) {
                event.preventDefault()
                window.getSelection()?.removeAllRanges()
                panelDragControls.start(event)
              }
            }}
          >
            <h2 className="text-sm font-semibold tracking-normal">{title}</h2>
          </div>
        ) : null}
        <TweakerGroupContext.Provider value={rootGroupContext}>
          <TweakerReorderList
            ref={bodyRef}
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto p-2"
            parentId={rootGroupId}
          >
            {orderedChildren}
          </TweakerReorderList>
        </TweakerGroupContext.Provider>
      </motion.aside>
    </TweakerPanelContext.Provider>
  )

  return createPortal(panel, containerElement)
}

export function useTweakerPanelStoreApi() {
  const store = useContext(TweakerPanelContext)
  if (!store) {
    throw new Error('Tweaker panel content must be rendered inside TweakerPanel.')
  }
  return store
}

export function useTweakerGroupContext() {
  const context = useContext(TweakerGroupContext)
  if (!context) {
    throw new Error('Tweaker controls must be rendered inside TweakerPanel or TweakerGroup.')
  }
  return context
}

export function TweakerGroupContextProvider({
  children,
  value,
}: {
  children: ReactNode
  value: TweakerGroupContextValue
}) {
  return <TweakerGroupContext.Provider value={value}>{children}</TweakerGroupContext.Provider>
}

export function useTweakerPanelSelector<T>(selector: (state: TweakerPanelState) => T) {
  return useStore(useTweakerPanelStoreApi(), selector)
}

export function useTweakerPanelState() {
  return useTweakerPanelSelector((state) => state)
}

export function useRegisterTweakerItem({
  defaultValue,
  fieldId,
  hidden,
  id,
  kind,
  label,
  parentId,
  placement,
  reorderable,
}: TweakerItemRegistration) {
  const store = useTweakerPanelStoreApi()

  useEffect(() => {
    store.getState().registerItem({
      defaultValue,
      fieldId,
      hidden,
      id,
      kind,
      label,
      parentId,
      placement,
      reorderable,
    })
  }, [defaultValue, fieldId, hidden, id, kind, label, parentId, placement, reorderable, store])

  useEffect(() => {
    return () => {
      store.getState().unregisterItem(id)
    }
  }, [id, store])
}

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

export function TweakerReorderList({
  children,
  className,
  hidden,
  parentId,
  ref,
}: {
  children: ReactNode
  className?: string
  hidden?: boolean
  parentId: string
  ref?: RefObject<HTMLDivElement | null>
}) {
  const store = useTweakerPanelStoreApi()
  const fallbackRef = useRef<HTMLDivElement | null>(null)
  const listRef = ref ?? fallbackRef
  const registeredValues = useStore(
    store,
    useShallow((state) => orderedItemsForParent(state, parentId).map((entry) => entry.item.id)),
  )
  const itemLabels = useStore(
    store,
    useShallow((state) =>
      Object.fromEntries(
        orderedItemsForParent(state, parentId).map((entry) => [
          entry.item.id,
          entry.item.label ?? entry.item.id,
        ]),
      ),
    ),
  )
  const [values, setValues] = useState(registeredValues)
  const valuesRef = useRef(values)
  const pendingStoreOrderRef = useRef<string[] | null>(null)

  useEffect(() => {
    setValues((currentValues) => {
      if (arraysEqual(currentValues, registeredValues)) return currentValues

      const registered = new Set(registeredValues)
      const retained = currentValues.filter((id) => registered.has(id))
      const missing = registeredValues.filter((id) => !retained.includes(id))
      return [...retained, ...missing]
    })
  }, [registeredValues])

  useEffect(() => {
    valuesRef.current = values
  }, [values])

  const reorder = useCallback(
    (nextVisibleOrder: string[]) => {
      const currentValues = valuesRef.current
      if (arraysEqual(currentValues, nextVisibleOrder)) return

      valuesRef.current = nextVisibleOrder
      pendingStoreOrderRef.current = nextVisibleOrder
      setValues(nextVisibleOrder)

      const nextItemNames = nextVisibleOrder.map((id) => itemLabels[id] ?? id)
      console.log('[TweakerPanel] item order changed', nextItemNames)
    },
    [itemLabels],
  )
  const commitPendingOrder = useCallback(() => {
    const pendingStoreOrder = pendingStoreOrderRef.current
    if (!pendingStoreOrder) return

    pendingStoreOrderRef.current = null
    commitVisibleOrderToStore(store, parentId, pendingStoreOrder)
  }, [parentId, store])
  const groupContext = useMemo<TweakerGroupContextValue>(
    () => ({ commitPendingOrder, listRef, parentId }),
    [commitPendingOrder, listRef, parentId],
  )
  const orderedChildren = useMemo(() => orderTweakerChildren(children, values), [children, values])

  return (
    <Reorder.Group<string[], 'div'>
      ref={listRef}
      as="div"
      axis="y"
      className={className}
      hidden={hidden}
      values={values}
      onReorder={reorder}
    >
      <TweakerGroupContext.Provider value={groupContext}>
        {orderedChildren}
      </TweakerGroupContext.Provider>
    </Reorder.Group>
  )
}

function commitVisibleOrderToStore(
  store: TweakerPanelStore,
  parentId: string,
  nextVisibleOrder: string[],
) {
  store.getState().setOrder(parentId, nextVisibleOrder)
}

type TweakerChildProps = {
  field?: unknown
  fieldId?: unknown
  id?: unknown
}

type OrderedTweakerChild = {
  child: ReactNode
  order: number | undefined
}

function orderTweakerChildren(children: ReactNode, orderedIds: string[]) {
  const childArray = Children.toArray(children)
  if (childArray.length < 2 || orderedIds.length < 2) return childArray

  const orderById = new Map(orderedIds.map((id, index) => [id, index]))
  const entries: OrderedTweakerChild[] = childArray.map((child) => {
    const itemId = itemIdFromTweakerChild(child)

    return {
      child: keyedTweakerChild(child, itemId),
      order: orderById.get(itemId ?? ''),
    }
  })
  const orderedEntries = entries
    .filter((entry): entry is OrderedTweakerChild & { order: number } => entry.order !== undefined)
    .sort((left, right) => left.order - right.order)

  if (orderedEntries.length < 2) return childArray
  if (orderedEntries.length === entries.length) return orderedEntries.map((entry) => entry.child)

  const orderedQueue = [...orderedEntries]
  return entries.map((entry) =>
    entry.order === undefined ? entry.child : (orderedQueue.shift()?.child ?? entry.child),
  )
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

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function emptyField(): TweakerFieldState {
  return { dirty: false, errors: [], touched: false }
}

function removeFromParentOrder(order: Record<string, string[]>, parentId: string, itemId: string) {
  return { ...order, [parentId]: (order[parentId] ?? []).filter((id) => id !== itemId) }
}

function normalizeAllOrders(
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

function normalizeParentOrder(
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
