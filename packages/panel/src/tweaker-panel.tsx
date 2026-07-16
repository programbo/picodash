import {
  motion,
  Reorder,
  useDragControls,
  useMotionValue,
  type HTMLMotionProps,
} from 'motion/react'
import { ChevronRight } from 'lucide-react'
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
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
import { TooltipProvider } from './tooltip.js'
import { buttonVariants } from './ui.js'
import { cn } from './utils.js'
import {
  baseRectFromDisplayedRect,
  clampPanelPosition,
  positionForPanelLayout,
  rectFromElement,
  snapPanelPosition,
  type PanelDock,
  type PanelPosition,
  type PanelRect,
} from './panel-snapping.js'

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
  collapsible?: boolean
  defaultCollapsed?: boolean
  defaultValues?: Record<string, TweakerValue>
  id?: string
  initialMeta?: Record<string, TweakerValue>
  title?: ReactNode
}

export interface TweakerGroupContextValue {
  beginItemReorder: (itemId: string, pointerY: number, pointerId: number) => void
  commitPendingOrder: () => void
  dragConstraintsRef: RefObject<HTMLDivElement | null>
  listRef: RefObject<HTMLDivElement | null>
  parentId: string
}

export interface TweakerReorderItemLayout {
  id: string
  max: number
  min: number
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
        // Reorder groups remount when list geometry changes. Keep collapse state
        // keyed by group identity so that internal remount cannot undo a toggle.
        return { items, order: normalizeAllOrders(order, items) }
      })
    },
  }))
}

export function TweakerPanel({
  children,
  className,
  collapsible = false,
  defaultCollapsed = false,
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
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const panelElementRef = useRef<HTMLElement | null>(null)
  const panelStoreRef = useRef<TweakerPanelStore | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    baseRect: PanelRect
    containerRect: PanelRect
    dock: PanelDock | null
    peerRects: PanelRect[]
    startPosition: PanelPosition
  } | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  if (!panelStoreRef.current) {
    panelStoreRef.current = createTweakerPanelStore({ defaultValues, initialMeta, panelId })
  }

  const panelStore = panelStoreRef.current
  const panelCollapsed = collapsible && collapsed
  const titleText = typeof title === 'string' ? title : 'panel'
  const zIndex = useStore(store, (state) => panelZIndexForState(state, panelId))
  const savedLayout = useStore(store, (state) => state.panelLayouts[panelId])
  const rootGroupContext = useMemo<TweakerGroupContextValue>(
    () => ({
      beginItemReorder: () => {},
      commitPendingOrder: () => {},
      dragConstraintsRef: bodyRef,
      listRef: bodyRef,
      parentId: rootGroupId,
    }),
    [],
  )
  const orderedChildren = useOrderedTweakerChildren(panelStore, children, rootGroupId)
  useRegisterTweakerPanel({ id: panelId })

  const updatePanelRect = useCallback(() => {
    const panelElement = panelElementRef.current
    if (!panelElement) return

    store.getState().setPanelRect(panelId, rectFromElement(panelElement))
  }, [panelId, store])

  const syncDisplayedPositionToSavedLayout = useCallback(() => {
    const panelElement = panelElementRef.current
    if (!containerElement || !panelElement) return

    const displayedPosition = { x: x.get(), y: y.get() }
    const baseRect = baseRectFromDisplayedRect(rectFromElement(panelElement), displayedPosition)
    const savedPosition = store.getState().panelLayouts[panelId]
    const containerRect = rectFromElement(containerElement)
    const targetPosition = positionForPanelLayout({
      baseRect,
      containerRect,
      layout: savedPosition,
    })
    const displayPosition = clampPanelPosition(targetPosition, baseRect, containerRect)
    if (displayPosition.x === displayedPosition.x && displayPosition.y === displayedPosition.y) {
      updatePanelRect()
      return
    }

    x.set(displayPosition.x)
    y.set(displayPosition.y)
    requestAnimationFrame(updatePanelRect)
  }, [containerElement, panelId, store, updatePanelRect, x, y])

  useEffect(() => {
    syncDisplayedPositionToSavedLayout()
  }, [
    savedLayout?.dock?.horizontal,
    savedLayout?.dock?.vertical,
    savedLayout?.x,
    savedLayout?.y,
    syncDisplayedPositionToSavedLayout,
  ])

  useEffect(() => {
    if (!containerElement) return

    syncDisplayedPositionToSavedLayout()

    const resizeObserver = new ResizeObserver(syncDisplayedPositionToSavedLayout)
    resizeObserver.observe(containerElement)
    window.addEventListener('resize', syncDisplayedPositionToSavedLayout)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', syncDisplayedPositionToSavedLayout)
      store.getState().setPanelRect(panelId, null)
    }
  }, [containerElement, panelId, store, syncDisplayedPositionToSavedLayout])

  if (!containerElement) return null

  const panel = (
    <TweakerPanelContext.Provider value={panelStore}>
      <motion.aside
        {...props}
        id={id}
        data-tweaker-panel
        data-collapsed={panelCollapsed ? 'true' : 'false'}
        data-tweaker-panel-id={panelId}
        ref={panelElementRef}
        className={cn(
          'pointer-events-auto absolute top-8 right-8 flex min-h-0 max-h-[calc(100dvh-1rem)] w-[min(24rem,calc(100dvw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-2xl shadow-black/30 ring-1 ring-white/5',
          className,
        )}
        drag={drag}
        dragControls={panelDragControls}
        dragElastic={dragElastic}
        dragListener={false}
        dragMomentum={dragMomentum}
        style={{ ...style, x, y, zIndex }}
        onDrag={(event, info) => {
          const dragState = dragStateRef.current
          if (!dragState) {
            props.onDrag?.(event, info)
            return
          }

          const snapped = snapPanelPosition({
            baseRect: dragState.baseRect,
            containerRect: dragState.containerRect,
            peerRects: dragState.peerRects,
            position: {
              x: dragState.startPosition.x + info.offset.x,
              y: dragState.startPosition.y + info.offset.y,
            },
          })

          x.set(snapped.position.x)
          y.set(snapped.position.y)
          dragState.dock = snapped.dock
          panelElementRef.current?.toggleAttribute(
            'data-tweaker-panel-snapping',
            snapped.snappedX || snapped.snappedY,
          )
          updatePanelRect()
          props.onDrag?.(event, info)
        }}
        onDragEnd={(event, info) => {
          const dock = dragStateRef.current?.dock ?? null
          dragStateRef.current = null
          panelElementRef.current?.removeAttribute('data-tweaker-panel-snapping')

          const panelElement = panelElementRef.current
          const displayedPosition = { x: Math.round(x.get()), y: Math.round(y.get()) }
          x.set(displayedPosition.x)
          y.set(displayedPosition.y)

          if (panelElement) {
            const baseRect = baseRectFromDisplayedRect(
              rectFromElement(panelElement),
              displayedPosition,
            )
            store.getState().setPanelLayout(panelId, {
              dock,
              x: Math.round(baseRect.left + displayedPosition.x),
              y: Math.round(baseRect.top + displayedPosition.y),
            })
          }
          updatePanelRect()
          props.onDragEnd?.(event, info)
        }}
        onDragStart={(event, info) => {
          const panelElement = panelElementRef.current
          if (panelElement) {
            const displayedPosition = { x: x.get(), y: y.get() }
            dragStateRef.current = {
              baseRect: baseRectFromDisplayedRect(rectFromElement(panelElement), displayedPosition),
              containerRect: rectFromElement(containerElement),
              dock: null,
              peerRects: Object.entries(store.getState().panelRects)
                .filter(([peerPanelId]) => peerPanelId !== panelId)
                .map(([, rect]) => rect),
              startPosition: displayedPosition,
            }
          }

          store.getState().activatePanel(panelId)
          props.onDragStart?.(event, info)
        }}
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
            className="border-border flex shrink-0 cursor-grab items-center gap-1 border-b py-2 pr-3 pl-1 select-none active:cursor-grabbing"
            onPointerDown={(event) => {
              if (drag) {
                event.preventDefault()
                window.getSelection()?.removeAllRanges()
                panelDragControls.start(event)
              }
            }}
          >
            {collapsible ? (
              <button
                aria-expanded={!panelCollapsed}
                aria-label={`${panelCollapsed ? 'Expand' : 'Collapse'} panel ${titleText}`}
                className={cn(
                  buttonVariants({ size: 'icon', variant: 'ghost' }),
                  'size-5 shrink-0 text-muted-foreground',
                )}
                type="button"
                onClick={() => setCollapsed((current) => !current)}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <ChevronRight
                  className={cn(
                    'size-3.5 transition-transform duration-150 ease-out motion-reduce:transition-none',
                    !panelCollapsed && 'rotate-90',
                  )}
                  aria-hidden="true"
                />
              </button>
            ) : null}
            <h2 className="text-sm font-semibold tracking-normal">{title}</h2>
          </div>
        ) : null}
        <div
          aria-hidden={panelCollapsed}
          className={cn(
            'grid min-h-0 flex-1 transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none',
            panelCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
          )}
          inert={panelCollapsed}
        >
          <div className="min-h-0 overflow-hidden">
            <TweakerGroupContext.Provider value={rootGroupContext}>
              <TooltipProvider>
                <TweakerReorderList
                  ref={bodyRef}
                  className="h-full min-h-0 overflow-auto"
                  parentId={rootGroupId}
                >
                  {orderedChildren}
                </TweakerReorderList>
              </TooltipProvider>
            </TweakerGroupContext.Provider>
          </div>
        </div>
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

type TweakerTransformTemplate = NonNullable<HTMLMotionProps<'div'>['transformTemplate']>

export function useTweakerReorderTransformTemplate(
  store: TweakerPanelStore,
  transformTemplate?: TweakerTransformTemplate,
) {
  return useMemo<TweakerTransformTemplate>(
    () => (latest, generated) => {
      const isReordering = Boolean(store.getState().interaction.draggingId)
      if (transformTemplate) {
        return transformTemplate(latest, isReordering ? generated : '')
      }
      return isReordering ? generated : 'none'
    },
    [store, transformTemplate],
  )
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

export function TweakerReorderList({
  children,
  className,
  parentId,
  ref,
}: {
  children: ReactNode
  className?: string
  parentId: string
  ref?: RefObject<HTMLDivElement | null>
}) {
  const store = useTweakerPanelStoreApi()
  const fallbackRef = useRef<HTMLDivElement | null>(null)
  const listRef = ref ?? fallbackRef
  const dragConstraintsRef = useRef<HTMLDivElement | null>(null)
  const registeredValues = useStore(
    store,
    useShallow((state) => orderedItemsForParent(state, parentId).map((entry) => entry.item.id)),
  )
  const draggingId = useStore(store, (state) => state.interaction.draggingId)
  const [values, setValues] = useState(registeredValues)
  const [layoutVersion, setLayoutVersion] = useState(0)
  const valuesRef = useRef(values)
  const listWidthRef = useRef<number | null>(null)
  const layoutWidthRef = useRef<number | null>(null)
  const pendingStoreOrderRef = useRef<string[] | null>(null)
  const removePointerTrackingRef = useRef<(() => void) | null>(null)
  const reorderSessionRef = useRef<{
    initialOrder: string[]
    itemId: string
    layouts: TweakerReorderItemLayout[]
    scrollContainer: HTMLElement | null
    startPointerY: number
    startScrollTop: number
  } | null>(null)

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

  useLayoutEffect(() => {
    const listElement = listRef.current
    if (!listElement) return

    const updateListWidth = () => {
      const nextWidth = listElement.clientWidth
      listWidthRef.current = nextWidth

      if (layoutWidthRef.current === null) {
        layoutWidthRef.current = nextWidth
        return
      }
      if (store.getState().interaction.draggingId) return
      if (layoutWidthRef.current === nextWidth) return

      layoutWidthRef.current = nextWidth
      setLayoutVersion((version) => version + 1)
    }

    updateListWidth()
    const resizeObserver = new ResizeObserver(updateListWidth)
    resizeObserver.observe(listElement)

    return () => {
      resizeObserver.disconnect()
      listWidthRef.current = null
      layoutWidthRef.current = null
    }
  }, [listRef, store])

  useLayoutEffect(() => {
    if (draggingId) return

    const currentWidth = listRef.current?.clientWidth ?? listWidthRef.current
    if (currentWidth === null || layoutWidthRef.current === currentWidth) return

    listWidthRef.current = currentWidth
    layoutWidthRef.current = currentWidth
    setLayoutVersion((version) => version + 1)
  }, [draggingId, listRef])

  const previewOrder = useCallback((nextVisibleOrder: string[]) => {
    const currentValues = valuesRef.current
    if (arraysEqual(currentValues, nextVisibleOrder)) return

    valuesRef.current = nextVisibleOrder
    pendingStoreOrderRef.current = nextVisibleOrder
    setValues(nextVisibleOrder)
  }, [])
  const previewItemReorder = useCallback(
    (itemId: string, pointerY: number) => {
      const session = reorderSessionRef.current
      if (!session || session.itemId !== itemId) return

      const scrollOffset = (session.scrollContainer?.scrollTop ?? 0) - session.startScrollTop
      previewOrder(
        reorderValuesForPointer(
          session.initialOrder,
          itemId,
          session.layouts,
          pointerY - session.startPointerY + scrollOffset,
        ),
      )
    },
    [previewOrder],
  )
  const stopPointerTracking = useCallback(() => {
    removePointerTrackingRef.current?.()
    removePointerTrackingRef.current = null
  }, [])

  useEffect(() => stopPointerTracking, [stopPointerTracking])

  const beginItemReorder = useCallback(
    (itemId: string, pointerY: number, pointerId: number) => {
      const groupElement = dragConstraintsRef.current
      if (!groupElement) return

      stopPointerTracking()

      const layouts = Array.from(groupElement.children)
        .map((element) => {
          if (!(element instanceof HTMLElement)) return null
          const id = element.dataset.controlId ?? element.dataset.groupId
          if (!id) return null
          const rect = element.getBoundingClientRect()
          return { id, max: rect.bottom, min: rect.top }
        })
        .filter((layout): layout is TweakerReorderItemLayout => layout !== null)
      const scrollContainer =
        listRef.current?.closest<HTMLElement>('[data-tweaker-reorder-list="root"]') ?? null

      reorderSessionRef.current = {
        initialOrder: valuesRef.current,
        itemId,
        layouts,
        scrollContainer,
        startPointerY: pointerY,
        startScrollTop: scrollContainer?.scrollTop ?? 0,
      }

      const trackPointer = (event: PointerEvent) => {
        if (event.pointerId === pointerId) {
          previewItemReorder(itemId, event.pageY)
        }
      }
      const stopTrackingPointer = (event: PointerEvent) => {
        if (event.pointerId === pointerId) {
          stopPointerTracking()
        }
      }

      window.addEventListener('pointermove', trackPointer, true)
      window.addEventListener('pointercancel', stopTrackingPointer, true)
      window.addEventListener('pointerup', stopTrackingPointer, true)
      removePointerTrackingRef.current = () => {
        window.removeEventListener('pointermove', trackPointer, true)
        window.removeEventListener('pointercancel', stopTrackingPointer, true)
        window.removeEventListener('pointerup', stopTrackingPointer, true)
      }
    },
    [dragConstraintsRef, listRef, previewItemReorder, stopPointerTracking],
  )
  const commitPendingOrder = useCallback(() => {
    stopPointerTracking()
    reorderSessionRef.current = null
    const pendingStoreOrder = pendingStoreOrderRef.current
    if (!pendingStoreOrder) return

    pendingStoreOrderRef.current = null
    commitVisibleOrderToStore(store, parentId, pendingStoreOrder)
  }, [parentId, stopPointerTracking, store])
  const groupContext = useMemo<TweakerGroupContextValue>(
    () => ({
      beginItemReorder,
      commitPendingOrder,
      dragConstraintsRef,
      listRef,
      parentId,
    }),
    [beginItemReorder, commitPendingOrder, dragConstraintsRef, listRef, parentId],
  )
  const orderedChildren = useMemo(() => orderTweakerChildren(children, values), [children, values])

  return (
    <motion.div
      ref={listRef}
      className={className}
      data-tweaker-reorder-list={parentId}
      layoutScroll
    >
      <Reorder.Group<string[], 'div'>
        ref={dragConstraintsRef}
        as="div"
        axis="y"
        className="grid h-auto min-h-max grid-cols-[auto_minmax(4.5rem,max-content)_minmax(0,1fr)_max-content] gap-y-1"
        key={layoutVersion}
        values={values}
        onReorder={() => {}}
      >
        <TweakerGroupContext.Provider value={groupContext}>
          {orderedChildren}
        </TweakerGroupContext.Provider>
      </Reorder.Group>
    </motion.div>
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
