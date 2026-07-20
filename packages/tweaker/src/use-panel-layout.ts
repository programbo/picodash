import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { MotionStyle, MotionValue } from 'motion/react'
import { useStore } from 'zustand'
import {
  projectPanelGeometry,
  rectWithHeight,
  type PanelGeometryProjection,
  type PanelVerticalAnchor,
} from './panel-geometry.js'
import {
  baseRectFromDisplayedRect,
  positionForPanelLayout,
  rectFromElement,
  translationFromTransform,
  type PanelPosition,
  type PanelRect,
} from './panel-snapping.js'
import type { TweakerStore } from './tweaker-provider.js'

export function usePanelLayoutSynchronization({
  callerMaxHeight,
  containerElement,
  constraintClassName,
  contentElementRef,
  panelElementRef,
  panelId,
  synchronizationPausedRef,
  store,
  x,
  y,
}: {
  callerMaxHeight?: MotionStyle['maxHeight']
  containerElement: HTMLElement | null
  constraintClassName?: string
  contentElementRef: RefObject<HTMLElement | null>
  panelElementRef: RefObject<HTMLElement | null>
  panelId: string
  synchronizationPausedRef?: RefObject<unknown>
  store: TweakerStore
  x: MotionValue<number>
  y: MotionValue<number>
}) {
  const savedLayout = useStore(store, (state) => state.panelLayouts[panelId])
  const appliedMaxHeightRef = useRef<number | null>(null)
  const synchronizationFrameRef = useRef<number | null>(null)

  const updatePanelRect = useCallback(() => {
    const panelElement = panelElementRef.current
    if (panelElement) store.getState().setPanelRect(panelId, rectFromElement(panelElement))
  }, [panelElementRef, panelId, store])

  const measureIntrinsicHeight = useCallback(() => {
    const panelElement = panelElementRef.current
    if (!panelElement) return 0

    const panelRect = rectFromElement(panelElement)
    const contentElement = contentElementRef.current
    if (!contentElement || panelElement.dataset.collapsed === 'true') return panelRect.height

    const contentRect = rectFromElement(contentElement)
    const chromeHeight = Math.max(panelRect.height - contentRect.height, 0)
    return Math.max(panelRect.height, chromeHeight + contentElement.scrollHeight)
  }, [contentElementRef, panelElementRef])

  const measureCallerMaxHeight = useCallback(() => {
    const panelElement = panelElementRef.current
    if (!panelElement) return Number.POSITIVE_INFINITY

    const appliedMaxHeight = panelElement.style.maxHeight
    const resolvedCallerMaxHeight =
      callerMaxHeight &&
      typeof callerMaxHeight === 'object' &&
      'get' in callerMaxHeight &&
      typeof callerMaxHeight.get === 'function'
        ? callerMaxHeight.get()
        : callerMaxHeight

    if (typeof resolvedCallerMaxHeight === 'number') {
      panelElement.style.maxHeight = `${resolvedCallerMaxHeight}px`
    } else if (typeof resolvedCallerMaxHeight === 'string') {
      panelElement.style.maxHeight = resolvedCallerMaxHeight
    } else {
      panelElement.style.removeProperty('max-height')
    }

    const computedMaxHeight = Number.parseFloat(getComputedStyle(panelElement).maxHeight)
    if (appliedMaxHeight) {
      panelElement.style.maxHeight = appliedMaxHeight
    } else {
      panelElement.style.removeProperty('max-height')
    }
    return Number.isFinite(computedMaxHeight)
      ? Math.max(computedMaxHeight, 0)
      : Number.POSITIVE_INFINITY
  }, [callerMaxHeight, panelElementRef])

  const applyProjection = useCallback(
    ({
      anchor,
      baseRect,
      containerRect,
      intrinsicHeight = baseRect.height,
      position,
    }: {
      anchor: PanelVerticalAnchor
      baseRect: PanelRect
      containerRect: PanelRect
      intrinsicHeight?: number
      position: PanelPosition
    }): PanelGeometryProjection => {
      const callerMaxHeight = measureCallerMaxHeight()
      const projection = projectPanelGeometry({
        anchor,
        baseRect,
        containerRect,
        intrinsicHeight: Math.min(intrinsicHeight, callerMaxHeight),
        position,
      })
      const panelElement = panelElementRef.current
      const appliedMaxHeight = Math.min(projection.availableHeight, callerMaxHeight)
      if (panelElement && appliedMaxHeightRef.current !== appliedMaxHeight) {
        appliedMaxHeightRef.current = appliedMaxHeight
        panelElement.style.maxHeight = `${appliedMaxHeight}px`
      }
      if (x.get() !== projection.position.x) x.set(projection.position.x)
      if (y.get() !== projection.position.y) y.set(projection.position.y)
      return projection
    },
    [measureCallerMaxHeight, panelElementRef, x, y],
  )

  const syncDisplayedPositionToSavedLayout = useCallback(() => {
    if (synchronizationPausedRef?.current) return
    const panelElement = panelElementRef.current
    if (!containerElement || !panelElement) return

    const appliedPosition = translationFromTransform(getComputedStyle(panelElement).transform)
    const intrinsicHeight = measureIntrinsicHeight()
    const baseRect = rectWithHeight(
      baseRectFromDisplayedRect(rectFromElement(panelElement), appliedPosition),
      intrinsicHeight,
    )
    const savedPosition = store.getState().panelLayouts[panelId]
    const containerRect = rectFromElement(containerElement)
    const targetPosition = positionForPanelLayout({
      baseRect,
      containerRect,
      layout: savedPosition,
    })
    applyProjection({
      anchor: savedPosition?.dock?.vertical === 'bottom' ? 'bottom' : 'top',
      baseRect,
      containerRect,
      intrinsicHeight,
      position: targetPosition,
    })
    requestAnimationFrame(updatePanelRect)
  }, [
    applyProjection,
    containerElement,
    measureIntrinsicHeight,
    panelElementRef,
    panelId,
    store,
    synchronizationPausedRef,
    updatePanelRect,
  ])

  const scheduleSynchronization = useCallback(() => {
    if (synchronizationFrameRef.current !== null) return
    synchronizationFrameRef.current = requestAnimationFrame(() => {
      synchronizationFrameRef.current = null
      syncDisplayedPositionToSavedLayout()
    })
  }, [syncDisplayedPositionToSavedLayout])

  useLayoutEffect(() => {
    syncDisplayedPositionToSavedLayout()
  }, [
    callerMaxHeight,
    constraintClassName,
    savedLayout?.dock?.horizontal,
    savedLayout?.dock?.vertical,
    savedLayout?.x,
    savedLayout?.y,
    syncDisplayedPositionToSavedLayout,
  ])

  useEffect(() => {
    const panelElement = panelElementRef.current
    if (!containerElement || !panelElement) return

    const resizeObserver = new ResizeObserver(scheduleSynchronization)
    resizeObserver.observe(containerElement)
    resizeObserver.observe(panelElement)
    const contentElement = contentElementRef.current
    if (contentElement) {
      resizeObserver.observe(contentElement)
      if (contentElement.firstElementChild) {
        resizeObserver.observe(contentElement.firstElementChild)
      }
    }
    const mutationObserver = new MutationObserver(scheduleSynchronization)
    mutationObserver.observe(panelElement, {
      attributeFilter: ['data-collapsed'],
      attributes: true,
    })
    if (contentElement) {
      mutationObserver.observe(contentElement, {
        attributes: true,
        childList: true,
        subtree: true,
      })
    } else {
      mutationObserver.observe(panelElement, {
        childList: true,
        subtree: true,
      })
    }
    window.addEventListener('resize', scheduleSynchronization)
    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', scheduleSynchronization)
      if (synchronizationFrameRef.current !== null) {
        cancelAnimationFrame(synchronizationFrameRef.current)
        synchronizationFrameRef.current = null
      }
      store.getState().setPanelRect(panelId, null)
    }
  }, [
    containerElement,
    contentElementRef,
    panelElementRef,
    panelId,
    scheduleSynchronization,
    store,
  ])

  return {
    applyProjection,
    measureIntrinsicHeight,
    scheduleSynchronization,
    updatePanelRect,
  }
}
