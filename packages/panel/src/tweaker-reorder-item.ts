import { isMotionValue, useDragControls, useMotionValue, type HTMLMotionProps } from 'motion/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useTweakerGroupContext } from './tweaker-group-context.js'
import { useTweakerPanelStoreApi } from './tweaker-panel-context.js'
import { tweakerMotionTokens } from './theme.js'

export const reorderTransition: HTMLMotionProps<'div'>['transition'] = {
  layout: tweakerMotionTokens.reorder,
  x: tweakerMotionTokens.reorder,
  y: tweakerMotionTokens.reorder,
}

export const reorderDragTransition: HTMLMotionProps<'div'>['dragTransition'] =
  tweakerMotionTokens.reorderDrag

type ReorderItemLayoutProp = true | 'position'

/**
 * Motion's Reorder.Item runtime forwards `false` to the underlying motion
 * component, but its public prop type narrows layout to enabled modes.
 * Keep that compatibility cast here so reorder roots can disable projection
 * while retaining Reorder.Item's drag controls and constraints.
 */
export const disabledReorderItemLayout = false as unknown as ReorderItemLayoutProp

export function reorderTopWithOffset(top: unknown, offset: number) {
  const resolvedTop = isMotionValue(top) ? top.get() : top
  if (typeof resolvedTop === 'number') return resolvedTop + offset
  if (typeof resolvedTop === 'string' && resolvedTop.trim()) {
    return offset === 0 ? resolvedTop : `calc(${resolvedTop} + ${offset}px)`
  }
  return offset
}

export function useTweakerReorderItem(itemId: string, reorderable: boolean) {
  const store = useTweakerPanelStoreApi()
  const dragControls = useDragControls()
  const visualDragOffsetY = useMotionValue(0)
  const { beginItemReorder, commitPendingOrder, dragConstraintsRef, parentId } =
    useTweakerGroupContext()

  const beginReorder = (event: ReactPointerEvent) => {
    if (!reorderable) return
    beginItemReorder(itemId, event.pageY, event.pointerId, (offset) =>
      visualDragOffsetY.set(offset),
    )
    store.getState().setDraggingItem(itemId)
    dragControls.start(event)
  }

  const cancelReorder = () => {
    visualDragOffsetY.set(0)
    store.getState().setDraggingItem(null)
  }
  const commitReorder = () => {
    visualDragOffsetY.set(0)
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
    visualDragOffsetY,
  }
}
