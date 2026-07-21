import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { MotionStyle, MotionValue } from 'motion/react'
import { useStore } from 'zustand'
import {
  fixedPanelRect,
  panelMaxWidthForBoundary,
  panelParticipatesInSnapping,
  projectPanelGeometry,
  rectWithHeight,
  type PanelGeometryProjection,
  type PanelVerticalAnchor,
} from './panel-geometry.js'
import {
  baseRectFromDisplayedRect,
  clampPanelPosition,
  FLOATING_PLACEMENT_INSET,
  positionForFloatingCorner,
  positionForPanelLayout,
  rectForPanelBoundary,
  rectFromElement,
  SNAP_GAP,
  translationFromTransform,
  type PanelLayout,
  type PanelPosition,
  type PanelRect,
} from './panel-snapping.js'
import type { TweakerStore } from './tweaker-provider.js'
import type { TweakerPanelPlacement } from './tweaker-panel-types.js'

export function panelUsesBottomConstraint({
  computedBottom,
  computedTop,
  typedBottom,
  typedTop,
}: {
  computedBottom: string
  computedTop: string
  typedBottom?: string
  typedTop?: string
}) {
  return typedBottom === undefined
    ? computedBottom !== 'auto' && computedTop === 'auto'
    : typedBottom !== 'auto' && typedTop === 'auto'
}

export function panelHasCallerConstraint(
  inlineConstraint: MotionStyle['maxHeight'] | MotionStyle['maxWidth'] | undefined,
  constraintClassName: string | undefined,
  computedConstraint: string,
  baselineConstraint: string,
) {
  if (inlineConstraint !== undefined) return true
  return Boolean(constraintClassName?.trim()) && computedConstraint !== baselineConstraint
}

export function withoutCallerClassNames(appliedClassName: string, callerClassName: string) {
  const callerClasses = new Set(callerClassName.split(/\s+/).filter(Boolean))
  return appliedClassName
    .split(/\s+/)
    .filter((className) => className && !callerClasses.has(className))
    .join(' ')
}

export function resolveFloatingCornerLayout(
  layout: PanelLayout | undefined,
  panelRect: Pick<PanelRect, 'height' | 'width'>,
  boundaryRect: PanelRect,
  fallbackPlacement?: TweakerPanelPlacement,
): PanelLayout | undefined {
  const placement = layout?.placement ?? (layout === undefined ? fallbackPlacement : undefined)
  if (placement?.mode !== 'floating' || !placement.position) return layout
  const effectiveLayout = layout ?? { dock: null, x: 0, y: 0 }
  return {
    ...effectiveLayout,
    placement,
    ...positionForFloatingCorner(placement.position, panelRect, boundaryRect),
  }
}

export function nonFixedPanelMaxWidthForBoundary(
  boundaryWidth: number,
  callerMaxWidth: number,
  placement: Exclude<TweakerPanelPlacement, { mode: 'fixed' }>,
) {
  const inset = placement.mode === 'floating' ? FLOATING_PLACEMENT_INSET : SNAP_GAP
  return panelMaxWidthForBoundary(boundaryWidth - inset * 2, callerMaxWidth)
}

export function usePanelLayoutSynchronization({
  boundaryElement,
  callerHeight,
  callerMaxHeight,
  callerMaxWidth,
  collapsed,
  constraintClassName,
  contentElementRef,
  enabled,
  panelElementRef,
  panelId,
  placement,
  positionElementRef,
  synchronizationPausedRef,
  store,
  x,
  y,
}: {
  boundaryElement: Element | null
  callerHeight?: MotionStyle['height']
  callerMaxHeight?: MotionStyle['maxHeight']
  callerMaxWidth?: MotionStyle['maxWidth']
  collapsed: boolean
  constraintClassName?: string
  contentElementRef: RefObject<HTMLElement | null>
  enabled: boolean
  panelElementRef: RefObject<HTMLElement | null>
  panelId: string
  placement: TweakerPanelPlacement
  positionElementRef?: RefObject<HTMLElement | null>
  synchronizationPausedRef?: RefObject<unknown>
  store: TweakerStore
  x: MotionValue<number>
  y: MotionValue<number>
}) {
  const savedLayout = useStore(store, (state) => state.panelLayouts[panelId])
  const appliedMaxHeightRef = useRef<number | null>(null)
  const appliedMaxWidthRef = useRef<number | null>(null)
  const enabledRef = useRef(enabled)
  const synchronizationFrameRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const updatePanelRect = useCallback(() => {
    if (!enabledRef.current) return
    if (!panelParticipatesInSnapping(placement, collapsed)) {
      store.getState().setPanelRect(panelId, null)
      return
    }
    const panelElement = panelElementRef.current
    if (panelElement) store.getState().setPanelRect(panelId, rectFromElement(panelElement))
  }, [collapsed, panelElementRef, panelId, placement.mode, store])

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

  const measureCallerMaxHeight = useCallback(
    (containerRect: PanelRect) => {
      const panelElement = panelElementRef.current
      return panelElement
        ? measureCallerMaxConstraint(
            panelElement,
            'maxHeight',
            callerMaxHeight,
            constraintClassName,
            containerRect.height,
          )
        : Number.POSITIVE_INFINITY
    },
    [callerMaxHeight, constraintClassName, panelElementRef],
  )

  const measureCallerMaxWidth = useCallback(
    (containerRect: PanelRect) => {
      const panelElement = panelElementRef.current
      return panelElement
        ? measureCallerMaxConstraint(
            panelElement,
            'maxWidth',
            callerMaxWidth,
            constraintClassName,
            containerRect.width,
          )
        : Number.POSITIVE_INFINITY
    },
    [callerMaxWidth, constraintClassName, panelElementRef],
  )

  const restoreCallerMaxHeight = useCallback(() => {
    const panelElement = panelElementRef.current
    if (!panelElement) return
    appliedMaxHeightRef.current = null
    applyCallerMaxHeight(panelElement, callerMaxHeight)
  }, [callerMaxHeight, panelElementRef])

  const restoreCallerFixedDimensions = useCallback(() => {
    const panelElement = panelElementRef.current
    if (!panelElement) return
    applyCallerDimension(panelElement, 'height', callerHeight)
    restoreCallerMaxHeight()
  }, [callerHeight, panelElementRef, restoreCallerMaxHeight])

  const applyProjection = useCallback(
    ({
      anchor,
      baseRect,
      bottomInset,
      containerRect,
      inset,
      intrinsicHeight = baseRect.height,
      position,
      useProjectedPosition = false,
    }: {
      anchor: PanelVerticalAnchor
      baseRect: PanelRect
      bottomInset?: number
      containerRect: PanelRect
      inset?: number
      intrinsicHeight?: number
      position: PanelPosition
      useProjectedPosition?: boolean
    }): PanelGeometryProjection => {
      const panelElement = panelElementRef.current
      const positionElement = positionElementRef?.current ?? panelElement
      if (panelElement && positionElement && !isFloatingPanel(positionElement)) {
        restoreCallerMaxHeight()
        if (x.get() !== position.x) x.set(position.x)
        if (y.get() !== position.y) y.set(position.y)
        return {
          availableHeight: rectFromElement(panelElement).height,
          position,
          rect: rectFromElement(panelElement),
        }
      }

      const callerMaxHeight = measureCallerMaxHeight(containerRect)
      const projection = projectPanelGeometry({
        anchor,
        baseRect,
        bottomInset,
        containerRect,
        inset,
        intrinsicHeight: Math.min(intrinsicHeight, callerMaxHeight),
        position,
      })
      const appliedMaxHeight = Math.min(projection.availableHeight, callerMaxHeight)
      if (panelElement && appliedMaxHeightRef.current !== appliedMaxHeight) {
        appliedMaxHeightRef.current = appliedMaxHeight
        panelElement.style.maxHeight = `${appliedMaxHeight}px`
      }
      const appliedPosition =
        useProjectedPosition && panelElement && positionElement && positionElement !== panelElement
          ? (() => {
              const currentPosition = { x: x.get(), y: y.get() }
              const projectedBaseRect = basePanelRectFromPositionElement(
                panelElement,
                positionElement,
                currentPosition,
              )
              return {
                x: projection.rect.left - projectedBaseRect.left,
                y: projection.rect.top - projectedBaseRect.top,
              }
            })()
          : useProjectedPosition
            ? projection.position
            : panelElement
              ? (() => {
                  const currentPosition = { x: x.get(), y: y.get() }
                  const rebasedRect = baseRectFromDisplayedRect(
                    rectFromElement(panelElement),
                    currentPosition,
                  )
                  return {
                    x: projection.rect.left - rebasedRect.left,
                    y: projection.rect.top - rebasedRect.top,
                  }
                })()
              : projection.position
      if (x.get() !== appliedPosition.x) x.set(appliedPosition.x)
      if (y.get() !== appliedPosition.y) y.set(appliedPosition.y)
      return { ...projection, position: appliedPosition }
    },
    [measureCallerMaxHeight, panelElementRef, positionElementRef, restoreCallerMaxHeight, x, y],
  )

  const syncDisplayedPositionToSavedLayout = useCallback(() => {
    if (!enabledRef.current) return
    if (synchronizationPausedRef?.current) return
    const panelElement = panelElementRef.current
    const positionElement = positionElementRef?.current ?? panelElement
    if (!panelElement || !positionElement) return
    const containerRect = rectForPanelBoundary(boundaryElement)

    if (placement.mode === 'fixed') {
      const measuredCallerMaxHeight = measureCallerMaxHeight(containerRect)
      const measuredCallerMaxWidth = measureCallerMaxWidth(containerRect)
      const appliedMaxHeight = Math.min(containerRect.height, measuredCallerMaxHeight)
      const appliedMaxWidth = Math.min(containerRect.width, measuredCallerMaxWidth)
      if (appliedMaxHeightRef.current !== appliedMaxHeight) {
        appliedMaxHeightRef.current = appliedMaxHeight
        panelElement.style.maxHeight = `${appliedMaxHeight}px`
      }
      if (appliedMaxWidthRef.current !== appliedMaxWidth) {
        appliedMaxWidthRef.current = appliedMaxWidth
        panelElement.style.maxWidth = `${appliedMaxWidth}px`
      }
      if (placement.position === 'left' || placement.position === 'right') {
        panelElement.style.height = `${appliedMaxHeight}px`
      } else {
        applyCallerDimension(panelElement, 'height', callerHeight)
      }

      const panelRect = rectFromElement(panelElement)
      positionElement.style.width = `${panelRect.width}px`
      positionElement.style.height = `${panelRect.height}px`
      const displayedPosition = { x: x.get(), y: y.get() }
      const baseRect = baseRectFromDisplayedRect(
        rectFromElement(positionElement),
        displayedPosition,
      )
      const targetRect = fixedPanelRect({
        boundaryRect: containerRect,
        height: panelRect.height,
        position: placement.position,
        width: panelRect.width,
      })
      const targetPosition = {
        x: targetRect.left - baseRect.left,
        y: targetRect.top - baseRect.top,
      }
      if (x.get() !== targetPosition.x) x.set(targetPosition.x)
      if (y.get() !== targetPosition.y) y.set(targetPosition.y)
      requestAnimationFrame(updatePanelRect)
      return
    }

    restoreCallerFixedDimensions()
    const appliedMaxWidth = nonFixedPanelMaxWidthForBoundary(
      containerRect.width,
      measureCallerMaxWidth(containerRect),
      placement,
    )
    if (appliedMaxWidthRef.current !== appliedMaxWidth) {
      appliedMaxWidthRef.current = appliedMaxWidth
      panelElement.style.maxWidth = `${appliedMaxWidth}px`
    }
    positionElement.style.removeProperty('height')
    positionElement.style.removeProperty('width')

    if (!isFloatingPanel(positionElement)) {
      restoreCallerMaxHeight()
      const appliedPosition = translationFromTransform(getComputedStyle(positionElement).transform)
      const baseRect = baseRectFromDisplayedRect(rectFromElement(panelElement), appliedPosition)
      const targetPosition = positionForPanelLayout({
        baseRect,
        containerRect,
        layout: store.getState().panelLayouts[panelId],
      })
      const containedPosition = clampPanelPosition(targetPosition, baseRect, containerRect)
      if (x.get() !== containedPosition.x) x.set(containedPosition.x)
      if (y.get() !== containedPosition.y) y.set(containedPosition.y)
      requestAnimationFrame(updatePanelRect)
      return
    }

    const displayedRect = rectFromElement(panelElement)
    const appliedPosition = translationFromTransform(getComputedStyle(positionElement).transform)
    const intrinsicHeight = measureIntrinsicHeight()
    const savedPosition = store.getState().panelLayouts[panelId]
    const floatingCorner =
      savedPosition?.placement?.mode === 'floating'
        ? savedPosition.placement.position
        : savedPosition === undefined && boundaryElement && placement.mode === 'floating'
          ? placement.position
          : undefined
    const hasExplicitFloatingCorner = floatingCorner !== undefined
    const layoutRect = hasExplicitFloatingCorner
      ? basePanelRectFromPositionElement(panelElement, positionElement, appliedPosition)
      : baseRectFromDisplayedRect(displayedRect, appliedPosition)
    const baseRect = rectWithHeight(layoutRect, intrinsicHeight)
    const computedStyle = getComputedStyle(positionElement)
    const typedStyleMap =
      typeof positionElement.computedStyleMap === 'function'
        ? positionElement.computedStyleMap()
        : undefined
    const typedBottom = typedStyleMap?.get('bottom')?.toString()
    const typedTop = typedStyleMap?.get('top')?.toString()
    const startsBottomPositioned =
      savedPosition === undefined &&
      panelUsesBottomConstraint({
        computedBottom: computedStyle.bottom,
        computedTop: computedStyle.top,
        typedBottom,
        typedTop,
      })
    const effectiveSavedPosition =
      resolveFloatingCornerLayout(
        savedPosition,
        baseRect,
        containerRect,
        boundaryElement ? placement : undefined,
      ) ??
      (placement.mode === 'magnetic'
        ? {
            dock: null,
            placement,
            x: layoutRect.left,
            y: layoutRect.top,
          }
        : undefined)
    const targetPosition = positionForPanelLayout({
      baseRect,
      containerRect,
      layout: effectiveSavedPosition,
    })
    applyProjection({
      anchor:
        savedPosition?.dock?.vertical === 'bottom' ||
        floatingCorner?.startsWith('bottom') ||
        startsBottomPositioned
          ? 'bottom'
          : 'top',
      baseRect,
      bottomInset: floatingCorner?.startsWith('bottom')
        ? FLOATING_PLACEMENT_INSET
        : startsBottomPositioned
          ? Math.max(containerRect.bottom - layoutRect.bottom, 0)
          : undefined,
      containerRect,
      intrinsicHeight,
      position: targetPosition,
      useProjectedPosition: hasExplicitFloatingCorner,
    })
    requestAnimationFrame(updatePanelRect)
  }, [
    applyProjection,
    boundaryElement,
    callerHeight,
    callerMaxHeight,
    callerMaxWidth,
    measureIntrinsicHeight,
    measureCallerMaxHeight,
    measureCallerMaxWidth,
    panelElementRef,
    panelId,
    placement,
    positionElementRef,
    restoreCallerFixedDimensions,
    restoreCallerMaxHeight,
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
    if (!enabled) return
    syncDisplayedPositionToSavedLayout()
  }, [
    callerMaxHeight,
    constraintClassName,
    enabled,
    savedLayout?.dock?.horizontal,
    savedLayout?.dock?.vertical,
    savedLayout?.placement?.mode,
    savedLayout?.placement?.position,
    savedLayout?.x,
    savedLayout?.y,
    syncDisplayedPositionToSavedLayout,
  ])

  useEffect(() => {
    const panelElement = panelElementRef.current
    const positionElement = positionElementRef?.current ?? panelElement
    if (!enabled || !panelElement || !positionElement) {
      store.getState().setPanelRect(panelId, null)
      return
    }

    const resizeObserver = new ResizeObserver(scheduleSynchronization)
    if (boundaryElement) resizeObserver.observe(boundaryElement)
    resizeObserver.observe(panelElement)
    if (positionElement !== panelElement) resizeObserver.observe(positionElement)
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
        attributeFilter: ['data-collapsed'],
        attributes: true,
        childList: true,
        subtree: true,
      })
    } else {
      mutationObserver.observe(panelElement, {
        attributeFilter: ['data-collapsed'],
        attributes: true,
        childList: true,
        subtree: true,
      })
    }
    window.addEventListener('resize', scheduleSynchronization)
    const scrollListenerOptions = { capture: true, passive: true } as const
    window.addEventListener('scroll', scheduleSynchronization, scrollListenerOptions)
    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', scheduleSynchronization)
      window.removeEventListener('scroll', scheduleSynchronization, scrollListenerOptions)
      if (synchronizationFrameRef.current !== null) {
        cancelAnimationFrame(synchronizationFrameRef.current)
        synchronizationFrameRef.current = null
      }
      store.getState().setPanelRect(panelId, null)
    }
  }, [
    boundaryElement,
    contentElementRef,
    enabled,
    panelElementRef,
    panelId,
    positionElementRef,
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

function applyCallerMaxHeight(
  panelElement: HTMLElement,
  callerMaxHeight: MotionStyle['maxHeight'] | undefined,
) {
  applyCallerDimension(panelElement, 'maxHeight', callerMaxHeight)
}

function basePanelRectFromPositionElement(
  panelElement: HTMLElement,
  positionElement: HTMLElement,
  displayedPosition: PanelPosition,
): PanelRect {
  const positionBaseRect = baseRectFromDisplayedRect(
    rectFromElement(positionElement),
    displayedPosition,
  )
  const panelWidth = panelElement.offsetWidth
  const panelHeight = panelElement.offsetHeight
  const left = positionBaseRect.left + panelElement.offsetLeft
  const top = positionBaseRect.top + panelElement.offsetTop
  return {
    bottom: top + panelHeight,
    height: panelHeight,
    left,
    right: left + panelWidth,
    top,
    width: panelWidth,
  }
}

function measureCallerMaxConstraint(
  panelElement: HTMLElement,
  property: 'maxHeight' | 'maxWidth',
  inlineConstraint: MotionStyle['maxHeight'] | MotionStyle['maxWidth'] | undefined,
  constraintClassName: string | undefined,
  containingBlockSize: number,
) {
  if (inlineConstraint === undefined && !constraintClassName?.trim()) {
    return Number.POSITIVE_INFINITY
  }

  if (inlineConstraint === undefined && constraintClassName) {
    const { baselineConstraint, computedConstraint } = measureClassMaxConstraintEffect(
      panelElement,
      property,
      constraintClassName,
    )
    if (
      !panelHasCallerConstraint(
        inlineConstraint,
        constraintClassName,
        computedConstraint,
        baselineConstraint,
      )
    ) {
      return Number.POSITIVE_INFINITY
    }
  }

  return measureUsedMaxConstraint(panelElement, property, containingBlockSize, inlineConstraint)
}

function measureClassMaxConstraintEffect(
  panelElement: HTMLElement,
  property: 'maxHeight' | 'maxWidth',
  constraintClassName: string,
) {
  return withPanelMeasurementProbe(panelElement, (probeElement) => {
    applyCallerDimension(probeElement, property, undefined)
    const computedConstraint = getComputedStyle(probeElement)[property]
    const appliedClassName = probeElement.getAttribute('class') ?? ''
    probeElement.setAttribute(
      'class',
      withoutCallerClassNames(appliedClassName, constraintClassName),
    )
    const baselineConstraint = getComputedStyle(probeElement)[property]
    return { baselineConstraint, computedConstraint }
  })
}

function measureUsedMaxConstraint(
  panelElement: HTMLElement,
  property: 'maxHeight' | 'maxWidth',
  containingBlockSize: number,
  inlineConstraint: MotionStyle['maxHeight'] | MotionStyle['maxWidth'] | undefined,
) {
  const dimension = property === 'maxHeight' ? 'height' : 'width'
  return withPanelMeasurementProbe(panelElement, (probeElement, probeContainer) => {
    applyCallerDimension(probeElement, property, inlineConstraint)
    probeContainer.style.setProperty(
      dimension,
      `${Math.max(containingBlockSize, 0)}px`,
      'important',
    )
    probeElement.style.setProperty(dimension, '1000000px', 'important')
    const usedDimension = Number.parseFloat(getComputedStyle(probeElement)[dimension])
    return Number.isFinite(usedDimension) ? Math.max(usedDimension, 0) : Number.POSITIVE_INFINITY
  })
}

function withPanelMeasurementProbe<T>(
  panelElement: HTMLElement,
  measure: (probeElement: HTMLElement, probeContainer: HTMLElement) => T,
) {
  const liveContainingBlock = panelElement.parentElement
  const containingBlock = liveContainingBlock ?? panelElement.ownerDocument.body
  const probeContainer = liveContainingBlock
    ? (liveContainingBlock.cloneNode(false) as HTMLElement)
    : panelElement.ownerDocument.createElement('div')
  const probeElement = panelElement.cloneNode(false) as HTMLElement

  probeContainer.setAttribute('aria-hidden', 'true')
  probeContainer.removeAttribute('id')
  probeElement.removeAttribute('id')
  probeContainer.style.setProperty('contain', 'strict')
  probeContainer.style.setProperty('display', 'block', 'important')
  probeContainer.style.setProperty('left', '-1000000px', 'important')
  probeContainer.style.setProperty('pointer-events', 'none', 'important')
  probeContainer.style.setProperty('position', 'absolute', 'important')
  probeContainer.style.setProperty('top', '-1000000px', 'important')
  probeContainer.style.setProperty('visibility', 'hidden', 'important')
  probeElement.style.setProperty('animation', 'none', 'important')
  probeElement.style.setProperty('position', 'static', 'important')
  probeElement.style.setProperty('transform', 'none', 'important')
  probeElement.style.setProperty('transition', 'none', 'important')
  probeContainer.append(probeElement)
  containingBlock.append(probeContainer)

  try {
    return measure(probeElement, probeContainer)
  } finally {
    probeContainer.remove()
  }
}

function applyCallerDimension(
  panelElement: HTMLElement,
  property: 'height' | 'maxHeight' | 'maxWidth',
  value: MotionStyle['height'] | MotionStyle['maxHeight'] | MotionStyle['maxWidth'] | undefined,
) {
  const resolvedCallerMaxHeight =
    value && typeof value === 'object' && 'get' in value && typeof value.get === 'function'
      ? value.get()
      : value

  const cssProperty =
    property === 'maxHeight' ? 'max-height' : property === 'maxWidth' ? 'max-width' : 'height'

  if (typeof resolvedCallerMaxHeight === 'number') {
    panelElement.style[property] = `${resolvedCallerMaxHeight}px`
  } else if (typeof resolvedCallerMaxHeight === 'string') {
    panelElement.style[property] = resolvedCallerMaxHeight
  } else {
    panelElement.style.removeProperty(cssProperty)
  }
}

function isFloatingPanel(panelElement: HTMLElement) {
  const position = getComputedStyle(panelElement).position
  return position === 'absolute' || position === 'fixed'
}
