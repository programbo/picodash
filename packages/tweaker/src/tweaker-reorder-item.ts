import {
  animate,
  isMotionValue,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type AnimationPlaybackControlsWithThen,
  type HTMLMotionProps,
} from 'motion/react'
import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useStore } from 'zustand'
import { useTweakerGroupContext } from './tweaker-group-context.js'
import { useTweakerPanelStoreApi } from './tweaker-panel-context.js'
import { hasVisibleReorderableSibling } from './tweaker-order.js'
import type { TweakerPin } from './tweaker-panel-types.js'
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

export const reducedMotionReorderTransition: HTMLMotionProps<'div'>['transition'] = {
  duration: 0,
  layout: { duration: 0 },
  x: { duration: 0 },
  y: { duration: 0 },
}

export function reorderTopWithOffset(top: unknown, offset: number) {
  const resolvedTop = isMotionValue(top) ? top.get() : top
  if (typeof resolvedTop === 'number') return resolvedTop + offset
  if (typeof resolvedTop === 'string' && resolvedTop.trim()) {
    return offset === 0 ? resolvedTop : `calc(${resolvedTop} + ${offset}px)`
  }
  return offset
}

export function useTweakerReorderItem(
  itemId: string,
  configuredReorderable: boolean,
  pin: TweakerPin | undefined,
) {
  const store = useTweakerPanelStoreApi()
  const dragControls = useDragControls()
  const visualDragOffsetY = useMotionValue(0)
  const siblingOffsetY = useSpring(0, tweakerMotionTokens.reorder)
  const visualOffsetY = useTransform(
    [visualDragOffsetY, siblingOffsetY],
    ([dragOffset, siblingOffset]) => Number(dragOffset) + Number(siblingOffset),
  )
  const prefersReducedMotion = useReducedMotion()
  const settleAnimationRef = useRef<AnimationPlaybackControlsWithThen | null>(null)
  const settleGenerationRef = useRef(0)
  const { beginItemReorder, commitPendingOrder, dragConstraintsRef, parentId, registerItemMotion } =
    useTweakerGroupContext()
  const hasReorderableSibling = useStore(store, (state) =>
    hasVisibleReorderableSibling(state, { id: itemId, parentId, pin }),
  )
  const reorderable = configuredReorderable && hasReorderableSibling

  const stopSettleAnimation = () => {
    settleGenerationRef.current += 1
    settleAnimationRef.current?.stop()
    settleAnimationRef.current = null
  }

  useLayoutEffect(
    () =>
      registerItemMotion(itemId, {
        animateFrom: (offset) => {
          siblingOffsetY.jump(offset)
          if (prefersReducedMotion || Math.abs(offset) <= 0.0001) {
            siblingOffsetY.jump(0)
          } else {
            siblingOffsetY.set(0)
          }
        },
        getOffset: () => siblingOffsetY.get(),
      }),
    [itemId, prefersReducedMotion, registerItemMotion, siblingOffsetY],
  )

  useEffect(
    () => () => {
      stopSettleAnimation()
    },
    [],
  )

  const beginReorder = (event: ReactPointerEvent) => {
    if (!reorderable) return
    stopSettleAnimation()
    const siblingOffset = siblingOffsetY.get()
    siblingOffsetY.jump(0)
    beginItemReorder(itemId, event.clientY, event.pointerId, (offset) => {
      visualDragOffsetY.set(offset + siblingOffset)
    })
    store.getState().setDraggingItem(itemId)
    dragControls.start(event)
  }

  const cancelReorder = () => {
    stopSettleAnimation()
    visualDragOffsetY.set(0)
    store.getState().setDraggingItem(null)
  }
  const commitReorder = () => {
    commitPendingOrder()
    stopSettleAnimation()

    if (prefersReducedMotion) {
      visualDragOffsetY.set(0)
      if (store.getState().interaction.draggingId === itemId) {
        store.getState().setDraggingItem(null)
      }
      return
    }

    const generation = settleGenerationRef.current
    const animation = animate(visualDragOffsetY, 0, tweakerMotionTokens.reorder)
    settleAnimationRef.current = animation
    void animation.then(() => {
      if (settleGenerationRef.current !== generation || settleAnimationRef.current !== animation) {
        return
      }
      settleAnimationRef.current = null
      if (store.getState().interaction.draggingId === itemId) {
        store.getState().setDraggingItem(null)
      }
    })
  }

  return {
    beginReorder,
    cancelReorder,
    commitReorder,
    dragConstraintsRef,
    dragControls,
    parentId,
    reorderable,
    visualDragOffsetY: visualOffsetY,
  }
}
