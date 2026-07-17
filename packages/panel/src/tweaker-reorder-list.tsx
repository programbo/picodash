import { motion, Reorder } from 'motion/react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { TweakerGroupContextProvider } from './tweaker-group-context.js'
import { useTweakerPanelStoreApi } from './tweaker-panel-context.js'
import {
  orderedItemsForParent,
  orderTweakerChildren,
  reorderValuesForPointer,
} from './tweaker-order.js'
import type {
  TweakerGroupContextValue,
  TweakerPanelStore,
  TweakerReorderItemLayout,
} from './tweaker-panel-types.js'

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
  const { previewOrder, values, valuesRef } = useSynchronizedVisibleOrder(
    registeredValues,
    draggingId,
  )
  const layoutVersion = useReorderListLayoutVersion(listRef, store, draggingId)
  const { beginItemReorder, commitPendingOrder, synchronizeVisualOffset } =
    usePointerReorderSession({
      dragConstraintsRef,
      listRef,
      parentId,
      previewOrder,
      store,
      valuesRef,
    })
  useLayoutEffect(() => {
    synchronizeVisualOffset()
  }, [synchronizeVisualOffset, values])
  const groupContext = useMemo<TweakerGroupContextValue>(
    () => ({
      beginItemReorder,
      commitPendingOrder,
      dragConstraintsRef,
      listRef,
      parentId,
    }),
    [beginItemReorder, commitPendingOrder, listRef, parentId],
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
        <TweakerGroupContextProvider value={groupContext}>
          {orderedChildren}
        </TweakerGroupContextProvider>
      </Reorder.Group>
    </motion.div>
  )
}

function useSynchronizedVisibleOrder(registeredValues: string[], draggingId: string | null) {
  const [values, setValues] = useState(registeredValues)
  const valuesRef = useRef(values)

  useLayoutEffect(() => {
    if (draggingId) return
    if (arraysEqual(valuesRef.current, registeredValues)) return
    valuesRef.current = registeredValues
    setValues(registeredValues)
  }, [draggingId, registeredValues])

  useLayoutEffect(() => {
    valuesRef.current = values
  }, [values])

  const previewOrder = useCallback((nextValues: string[]) => {
    if (arraysEqual(valuesRef.current, nextValues)) return false
    valuesRef.current = nextValues
    setValues(nextValues)
    return true
  }, [])

  return { previewOrder, values, valuesRef }
}

function useReorderListLayoutVersion(
  listRef: RefObject<HTMLDivElement | null>,
  store: TweakerPanelStore,
  draggingId: string | null,
) {
  const [layoutVersion, setLayoutVersion] = useState(0)
  const listWidthRef = useRef<number | null>(null)
  const layoutWidthRef = useRef<number | null>(null)

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
      if (store.getState().interaction.draggingId || layoutWidthRef.current === nextWidth) return

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

  return layoutVersion
}

function usePointerReorderSession({
  dragConstraintsRef,
  listRef,
  parentId,
  previewOrder,
  store,
  valuesRef,
}: {
  dragConstraintsRef: RefObject<HTMLDivElement | null>
  listRef: RefObject<HTMLDivElement | null>
  parentId: string
  previewOrder: (values: string[]) => boolean
  store: TweakerPanelStore
  valuesRef: RefObject<string[]>
}) {
  const pendingStoreOrderRef = useRef<string[] | null>(null)
  const removePointerTrackingRef = useRef<(() => void) | null>(null)
  const reorderSessionRef = useRef<{
    initialBandOrder: string[]
    initialOrder: string[]
    initialItemOffsetTop: number
    itemElement: HTMLElement
    itemId: string
    lastVisualOffset: number
    latestPointerOffset: number
    layouts: TweakerReorderItemLayout[]
    scrollContainer: HTMLElement | null
    setVisualOffset: (offset: number) => void
    startPointerY: number
    startScrollTop: number
  } | null>(null)

  const stopPointerTracking = useCallback(() => {
    removePointerTrackingRef.current?.()
    removePointerTrackingRef.current = null
  }, [])

  useEffect(() => stopPointerTracking, [stopPointerTracking])

  const synchronizeVisualOffset = useCallback(() => {
    const session = reorderSessionRef.current
    if (!session) return
    const desiredLogicalTop = session.initialItemOffsetTop + session.latestPointerOffset
    const currentSlotTop = session.itemElement.offsetTop - session.lastVisualOffset
    const nextVisualOffset = desiredLogicalTop - currentSlotTop
    session.lastVisualOffset = nextVisualOffset
    session.setVisualOffset(nextVisualOffset)
  }, [])

  const updatePendingItemReorder = useCallback(
    (itemId: string, pointerY: number) => {
      const session = reorderSessionRef.current
      if (!session || session.itemId !== itemId) return

      const scrollOffset = (session.scrollContainer?.scrollTop ?? 0) - session.startScrollTop
      const pointerOffset = pointerY - session.startPointerY + scrollOffset
      session.latestPointerOffset = pointerOffset
      synchronizeVisualOffset()
      const nextOrder = reorderValuesForPointer(
        session.initialBandOrder,
        itemId,
        session.layouts,
        pointerOffset,
      )
      const queuedBandOrder = [...nextOrder]
      const nextFullOrder = session.initialOrder.map((id) =>
        session.initialBandOrder.includes(id) ? (queuedBandOrder.shift() ?? id) : id,
      )
      pendingStoreOrderRef.current = nextFullOrder
      previewOrder(nextFullOrder)
    },
    [previewOrder, synchronizeVisualOffset],
  )

  const beginItemReorder = useCallback(
    (
      itemId: string,
      pointerY: number,
      pointerId: number,
      setVisualOffset: (offset: number) => void,
    ) => {
      const groupElement = dragConstraintsRef.current
      if (!groupElement) return

      stopPointerTracking()
      pendingStoreOrderRef.current = [...valuesRef.current]
      setVisualOffset(0)
      const itemElements = Array.from(groupElement.children).filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      )
      const itemElement = itemElements.find(
        (element) => (element.dataset.controlId ?? element.dataset.groupId) === itemId,
      )
      if (!itemElement) return
      const itemBand = itemElement.dataset.orderBand
      const idsInBand = new Set(
        itemElements
          .filter((element) => element.dataset.orderBand === itemBand)
          .map((element) => element.dataset.controlId ?? element.dataset.groupId)
          .filter((id): id is string => Boolean(id)),
      )
      const layouts = itemElements
        .map((element) => {
          const id = element.dataset.controlId ?? element.dataset.groupId
          if (!id || !idsInBand.has(id)) return null
          const rect = element.getBoundingClientRect()
          return { id, max: rect.bottom, min: rect.top }
        })
        .filter((layout): layout is TweakerReorderItemLayout => layout !== null)
      const scrollContainer =
        listRef.current?.closest<HTMLElement>('[data-tweaker-reorder-list="root"]') ?? null

      reorderSessionRef.current = {
        initialBandOrder: valuesRef.current.filter((id) => idsInBand.has(id)),
        initialItemOffsetTop: itemElement.offsetTop,
        initialOrder: [...valuesRef.current],
        itemElement,
        itemId,
        lastVisualOffset: 0,
        latestPointerOffset: 0,
        layouts,
        scrollContainer,
        setVisualOffset,
        startPointerY: pointerY,
        startScrollTop: scrollContainer?.scrollTop ?? 0,
      }

      const trackPointer = (event: PointerEvent) => {
        if (event.pointerId === pointerId) updatePendingItemReorder(itemId, event.pageY)
      }
      const stopTrackingPointer = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return
        // Auto-scroll can update scrollTop after the final pointermove capture.
        // Recompute from the release coordinate and latest scroll before Motion
        // fires onDragEnd and commits the pending order.
        updatePendingItemReorder(itemId, event.pageY)
        stopPointerTracking()
      }
      const cancelTrackingPointer = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return
        const session = reorderSessionRef.current
        if (session) {
          session.setVisualOffset(0)
          previewOrder(session.initialOrder)
        }
        pendingStoreOrderRef.current = null
        reorderSessionRef.current = null
        stopPointerTracking()
      }
      window.addEventListener('pointermove', trackPointer, true)
      window.addEventListener('pointercancel', cancelTrackingPointer, true)
      window.addEventListener('pointerup', stopTrackingPointer, true)
      removePointerTrackingRef.current = () => {
        window.removeEventListener('pointermove', trackPointer, true)
        window.removeEventListener('pointercancel', cancelTrackingPointer, true)
        window.removeEventListener('pointerup', stopTrackingPointer, true)
      }
    },
    [
      dragConstraintsRef,
      listRef,
      previewOrder,
      stopPointerTracking,
      updatePendingItemReorder,
      valuesRef,
    ],
  )

  const commitPendingOrder = useCallback(() => {
    stopPointerTracking()
    reorderSessionRef.current = null
    const pendingStoreOrder = pendingStoreOrderRef.current
    pendingStoreOrderRef.current = null
    if (!pendingStoreOrder) return

    store.getState().setOrder(parentId, pendingStoreOrder)
  }, [parentId, stopPointerTracking, store])

  return { beginItemReorder, commitPendingOrder, synchronizeVisualOffset }
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}
