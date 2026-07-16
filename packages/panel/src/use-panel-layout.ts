import { useCallback, useEffect, type RefObject } from 'react'
import type { MotionValue } from 'motion/react'
import { useStore } from 'zustand'
import {
  baseRectFromDisplayedRect,
  clampPanelPosition,
  positionForPanelLayout,
  rectFromElement,
  translationFromTransform,
} from './panel-snapping.js'
import type { TweakerStore } from './tweaker-provider.js'

export function usePanelLayoutSynchronization({
  containerElement,
  panelElementRef,
  panelId,
  store,
  x,
  y,
}: {
  containerElement: HTMLDivElement | null
  panelElementRef: RefObject<HTMLElement | null>
  panelId: string
  store: TweakerStore
  x: MotionValue<number>
  y: MotionValue<number>
}) {
  const savedLayout = useStore(store, (state) => state.panelLayouts[panelId])

  const updatePanelRect = useCallback(() => {
    const panelElement = panelElementRef.current
    if (panelElement) store.getState().setPanelRect(panelId, rectFromElement(panelElement))
  }, [panelElementRef, panelId, store])

  const syncDisplayedPositionToSavedLayout = useCallback(() => {
    const panelElement = panelElementRef.current
    if (!containerElement || !panelElement) return

    const displayedPosition = { x: x.get(), y: y.get() }
    const appliedPosition = translationFromTransform(getComputedStyle(panelElement).transform)
    const baseRect = baseRectFromDisplayedRect(rectFromElement(panelElement), appliedPosition)
    const savedPosition = store.getState().panelLayouts[panelId]
    const containerRect = rectFromElement(containerElement)
    const targetPosition = positionForPanelLayout({
      baseRect,
      containerRect,
      layout: savedPosition,
    })
    const displayPosition = clampPanelPosition(targetPosition, baseRect, containerRect)

    if (displayPosition.x === displayedPosition.x && displayPosition.y === displayedPosition.y) {
      if (appliedPosition.x === displayedPosition.x && appliedPosition.y === displayedPosition.y) {
        updatePanelRect()
      } else {
        requestAnimationFrame(updatePanelRect)
      }
      return
    }

    x.set(displayPosition.x)
    y.set(displayPosition.y)
    requestAnimationFrame(updatePanelRect)
  }, [containerElement, panelElementRef, panelId, store, updatePanelRect, x, y])

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

    const resizeObserver = new ResizeObserver(syncDisplayedPositionToSavedLayout)
    resizeObserver.observe(containerElement)
    window.addEventListener('resize', syncDisplayedPositionToSavedLayout)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', syncDisplayedPositionToSavedLayout)
      store.getState().setPanelRect(panelId, null)
    }
  }, [containerElement, panelId, store, syncDisplayedPositionToSavedLayout])

  return updatePanelRect
}
