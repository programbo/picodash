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
  const { values, valuesRef, previewOrder } = useSynchronizedVisibleOrder(registeredValues)
  const layoutVersion = useReorderListLayoutVersion(listRef, store, draggingId)
  const { beginItemReorder, commitPendingOrder } = usePointerReorderSession({
    dragConstraintsRef,
    listRef,
    parentId,
    previewOrder,
    store,
    valuesRef,
  })
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

function useSynchronizedVisibleOrder(registeredValues: string[]) {
  const [values, setValues] = useState(registeredValues)
  const valuesRef = useRef(values)

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

  const previewOrder = useCallback((nextVisibleOrder: string[]) => {
    if (arraysEqual(valuesRef.current, nextVisibleOrder)) return false
    valuesRef.current = nextVisibleOrder
    setValues(nextVisibleOrder)
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
    initialOrder: string[]
    itemId: string
    layouts: TweakerReorderItemLayout[]
    scrollContainer: HTMLElement | null
    startPointerY: number
    startScrollTop: number
  } | null>(null)

  const stopPointerTracking = useCallback(() => {
    removePointerTrackingRef.current?.()
    removePointerTrackingRef.current = null
  }, [])

  useEffect(() => stopPointerTracking, [stopPointerTracking])

  const previewItemReorder = useCallback(
    (itemId: string, pointerY: number) => {
      const session = reorderSessionRef.current
      if (!session || session.itemId !== itemId) return

      const scrollOffset = (session.scrollContainer?.scrollTop ?? 0) - session.startScrollTop
      const nextOrder = reorderValuesForPointer(
        session.initialOrder,
        itemId,
        session.layouts,
        pointerY - session.startPointerY + scrollOffset,
      )
      if (previewOrder(nextOrder)) {
        pendingStoreOrderRef.current = nextOrder
      }
    },
    [previewOrder],
  )

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
        if (event.pointerId === pointerId) previewItemReorder(itemId, event.pageY)
      }
      const stopTrackingPointer = (event: PointerEvent) => {
        if (event.pointerId === pointerId) stopPointerTracking()
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
    [dragConstraintsRef, listRef, previewItemReorder, stopPointerTracking, valuesRef],
  )

  const commitPendingOrder = useCallback(() => {
    stopPointerTracking()
    reorderSessionRef.current = null
    const pendingStoreOrder = pendingStoreOrderRef.current
    if (!pendingStoreOrder) return

    pendingStoreOrderRef.current = null
    store.getState().setOrder(parentId, pendingStoreOrder)
  }, [parentId, stopPointerTracking, store])

  return { beginItemReorder, commitPendingOrder }
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}
