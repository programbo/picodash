import { useDragControls, type HTMLMotionProps } from 'motion/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useTweakerGroupContext } from './tweaker-group-context.js'
import { useTweakerPanelStoreApi } from './tweaker-panel-context.js'

export const reorderTransition: HTMLMotionProps<'div'>['transition'] = {
  layout: { type: 'spring', stiffness: 650, damping: 30, mass: 0.55 },
  x: { type: 'spring', stiffness: 650, damping: 30, mass: 0.55 },
  y: { type: 'spring', stiffness: 650, damping: 30, mass: 0.55 },
}

export const reorderDragTransition: HTMLMotionProps<'div'>['dragTransition'] = {
  bounceDamping: 28,
  bounceStiffness: 700,
  power: 0.08,
  restDelta: 0.5,
  restSpeed: 12,
  timeConstant: 120,
}

export function useTweakerReorderItem(itemId: string, reorderable: boolean) {
  const store = useTweakerPanelStoreApi()
  const dragControls = useDragControls()
  const { beginItemReorder, commitPendingOrder, dragConstraintsRef, parentId } =
    useTweakerGroupContext()

  const beginReorder = (event: ReactPointerEvent) => {
    if (!reorderable) return
    beginItemReorder(itemId, event.pageY, event.pointerId)
    store.getState().setDraggingItem(itemId)
    dragControls.start(event)
  }

  const cancelReorder = () => store.getState().setDraggingItem(null)
  const commitReorder = () => {
    commitPendingOrder()
    store.getState().setDraggingItem(null)
  }

  return {
    beginReorder,
    cancelReorder,
    commitReorder,
    dragConstraintsRef,
    dragControls,
    parentId,
  }
}
