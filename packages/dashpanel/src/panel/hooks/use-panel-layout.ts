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
} from '../geometry/panel-geometry.js'
import {
  baseRectFromDisplayedRect,
  clampPanelPosition,
  initialPreferredCoordinatesForPlacement,
  isPanelPlacementFixedLike,
  offsetRect,
  positionForPanelLayout,
  rectForPanelBoundary,
  rectFromElement,
  translationFromTransform,
  type PanelLayout,
  type PanelPosition,
  type PanelRect,
  type ResolvedPicodashPanelPlacementOptions,
  type ResolvedPicodashPanelBoundaryInset,
} from '../geometry/panel-snapping.js'
import type { PicodashProviderStore } from '../state/provider/picodash-provider.js'
import type { PicodashPanelPlacement } from '../state/panel/picodash-panel-types.js'

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

export function floatingPanelMaxWidthForBoundary(
  boundaryWidth: number,
  callerMaxWidth: number,
  placementInset: number,
) {
  return panelMaxWidthForBoundary(boundaryWidth - placementInset * 2, callerMaxWidth)
}

export function usePanelLayoutSynchronization({
  boundaryElement,
  boundaryInset,
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
  placementOptions,
  positionElementRef,
  synchronizationPausedRef,
  store,
  x,
  y,
}: {
  boundaryElement: Element | null
  boundaryInset: ResolvedPicodashPanelBoundaryInset
  callerHeight?: MotionStyle['height']
  callerMaxHeight?: MotionStyle['maxHeight']
  callerMaxWidth?: MotionStyle['maxWidth']
  collapsed: boolean
  constraintClassName?: string
  contentElementRef: RefObject<HTMLElement | null>
  enabled: boolean
  panelElementRef: RefObject<HTMLElement | null>
  panelId: string
  placement: PicodashPanelPlacement
  placementOptions: ResolvedPicodashPanelPlacementOptions
  positionElementRef?: RefObject<HTMLElement | null>
  synchronizationPausedRef?: RefObject<unknown>
  store: PicodashProviderStore
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
  }, [collapsed, panelElementRef, panelId, placement, store])

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

  const measureIntrinsicHeightWithoutFixedSide = useCallback(() => {
    const panelElement = panelElementRef.current
    if (!panelElement) return 0

    const positionElement = positionElementRef?.current
    const panelHeight = panelElement.style.getPropertyValue('height')
    const panelHeightPriority = panelElement.style.getPropertyPriority('height')
    const positionHeight = positionElement?.style.getPropertyValue('height')
    const positionHeightPriority = positionElement?.style.getPropertyPriority('height')

    applyCallerDimension(panelElement, 'height', callerHeight)
    positionElement?.style.removeProperty('height')
    try {
      return measureIntrinsicHeight()
    } finally {
      restoreInlineStyleProperty(panelElement, 'height', panelHeight, panelHeightPriority)
      if (positionElement) {
        restoreInlineStyleProperty(
          positionElement,
          'height',
          positionHeight ?? '',
          positionHeightPriority ?? '',
        )
      }
    }
  }, [callerHeight, measureIntrinsicHeight, panelElementRef, positionElementRef])

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

  const measureEdgeAttachedPanelSize = useCallback(
    (containerRect: PanelRect, intrinsicHeight: number) => {
      const panelElement = panelElementRef.current
      const fullHeight = containerRect.height
      const naturalHeight = Math.min(
        intrinsicHeight,
        containerRect.height,
        measureCallerMaxHeight(containerRect),
      )
      const maxWidth = panelMaxWidthForBoundary(
        containerRect.width,
        measureCallerMaxWidth(containerRect),
      )
      const width = panelElement
        ? withPanelMeasurementProbe(panelElement, (probeElement, probeContainer) => {
            probeContainer.style.setProperty(
              'height',
              `${Math.max(containerRect.height, 0)}px`,
              'important',
            )
            probeContainer.style.setProperty(
              'width',
              `${Math.max(containerRect.width, 0)}px`,
              'important',
            )
            probeElement.style.setProperty('max-width', `${maxWidth}px`, 'important')
            return rectFromElement(probeElement).width
          })
        : 0
      return {
        fullHeight,
        naturalHeight,
        width,
      }
    },
    [measureCallerMaxHeight, measureCallerMaxWidth, panelElementRef],
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
      useProvidedBaseRect = false,
      useProjectedPosition = false,
    }: {
      anchor: PanelVerticalAnchor
      baseRect: PanelRect
      bottomInset?: number
      containerRect: PanelRect
      inset?: number
      intrinsicHeight?: number
      position: PanelPosition
      useProvidedBaseRect?: boolean
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
      const appliedPosition = useProvidedBaseRect
        ? projection.position
        : useProjectedPosition &&
            panelElement &&
            positionElement &&
            positionElement !== panelElement
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

  const synchronizePlacementGeometry = useCallback(
    (nextPlacement: PicodashPanelPlacement, dragBaseRect?: PanelRect) => {
      const panelElement = panelElementRef.current
      const positionElement = positionElementRef?.current ?? panelElement
      if (!panelElement || !positionElement) return null
      const containerRect = rectForPanelBoundary(boundaryElement, boundaryInset)
      const positionRectBeforeGeometry = dragBaseRect ? rectFromElement(positionElement) : undefined
      let synchronizedDragBaseRect: PanelRect | undefined

      if (nextPlacement.disposition.kind === 'docked') {
        const dockedPosition = nextPlacement.disposition.position
        const measuredCallerMaxHeight = measureCallerMaxHeight(containerRect)
        const measuredCallerMaxWidth = measureCallerMaxWidth(containerRect)
        const fillsSide = dockedPosition === 'full-left' || dockedPosition === 'full-right'
        const appliedMaxHeight = fillsSide
          ? containerRect.height
          : Math.min(containerRect.height, measuredCallerMaxHeight)
        const appliedMaxWidth = Math.min(containerRect.width, measuredCallerMaxWidth)
        if (appliedMaxHeightRef.current !== appliedMaxHeight) {
          appliedMaxHeightRef.current = appliedMaxHeight
          panelElement.style.maxHeight = `${appliedMaxHeight}px`
        }
        if (appliedMaxWidthRef.current !== appliedMaxWidth) {
          appliedMaxWidthRef.current = appliedMaxWidth
          panelElement.style.maxWidth = `${appliedMaxWidth}px`
        }
        if (fillsSide) {
          panelElement.style.setProperty('height', `${appliedMaxHeight}px`, 'important')
        } else {
          applyCallerDimension(panelElement, 'height', callerHeight)
        }
        const panelRect = rectFromElement(panelElement)
        positionElement.style.width = `${panelRect.width}px`
        positionElement.style.height = `${panelRect.height}px`
        const displayedPosition = { x: x.get(), y: y.get() }
        if (dragBaseRect && positionRectBeforeGeometry) {
          const positionRect = rectFromElement(positionElement)
          const shiftedBaseRect = offsetRect(dragBaseRect, {
            x: positionRect.left - positionRectBeforeGeometry.left,
            y: positionRect.top - positionRectBeforeGeometry.top,
          })
          synchronizedDragBaseRect = {
            ...shiftedBaseRect,
            bottom: shiftedBaseRect.top + panelRect.height,
            height: panelRect.height,
            right: shiftedBaseRect.left + panelRect.width,
            width: panelRect.width,
          }
        }
        const baseRect =
          synchronizedDragBaseRect ??
          baseRectFromDisplayedRect(rectFromElement(positionElement), displayedPosition)
        const targetRect = fixedPanelRect({
          boundaryRect: containerRect,
          height: panelRect.height,
          position: dockedPosition,
          width: panelRect.width,
        })
        const targetPosition = {
          x: targetRect.left - baseRect.left,
          y: targetRect.top - baseRect.top,
        }
        if (x.get() !== targetPosition.x) x.set(targetPosition.x)
        if (y.get() !== targetPosition.y) y.set(targetPosition.y)
      } else {
        restoreCallerFixedDimensions()
        const appliedMaxWidth = floatingPanelMaxWidthForBoundary(
          containerRect.width,
          measureCallerMaxWidth(containerRect),
          nextPlacement.disposition.kind === 'snapped' ? placementOptions.snapOffset : 0,
        )
        if (appliedMaxWidthRef.current !== appliedMaxWidth) {
          appliedMaxWidthRef.current = appliedMaxWidth
          panelElement.style.maxWidth = `${appliedMaxWidth}px`
        }
        positionElement.style.removeProperty('height')
        positionElement.style.removeProperty('width')
      }

      return {
        containerRect,
        dragBaseRect: synchronizedDragBaseRect,
        panelElement,
        positionElement,
      }
    },
    [
      boundaryElement,
      boundaryInset,
      callerHeight,
      measureCallerMaxHeight,
      measureCallerMaxWidth,
      panelElementRef,
      placementOptions.snapOffset,
      positionElementRef,
      restoreCallerFixedDimensions,
      panelId,
      store,
      x,
      y,
    ],
  )

  const syncDisplayedPositionToSavedLayout = useCallback(() => {
    if (!enabledRef.current) return
    if (synchronizationPausedRef?.current) return
    const currentPlacement = store.getState().panels[panelId]?.placement ?? placement
    const synchronizedGeometry = synchronizePlacementGeometry(currentPlacement)
    if (!synchronizedGeometry) return
    const { containerRect, panelElement, positionElement } = synchronizedGeometry

    if (isPanelPlacementFixedLike(currentPlacement)) {
      requestAnimationFrame(updatePanelRect)
      return
    }

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
    const snappedPosition =
      currentPlacement.disposition.kind === 'snapped'
        ? currentPlacement.disposition.position
        : undefined
    const layoutRect = snappedPosition
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
      savedPosition ??
      ({
        placement: currentPlacement,
        preferredCoordinates: initialPreferredCoordinatesForPlacement({
          baseRect,
          containerRect,
          placement: currentPlacement,
        }),
      } satisfies PanelLayout)
    const targetPosition = positionForPanelLayout({
      baseRect,
      containerRect,
      layout: effectiveSavedPosition,
      snapOffset: placementOptions.snapOffset,
    })
    applyProjection({
      anchor: snappedPosition?.startsWith('bottom') || startsBottomPositioned ? 'bottom' : 'top',
      baseRect,
      bottomInset: snappedPosition?.startsWith('bottom')
        ? placementOptions.snapOffset
        : startsBottomPositioned
          ? Math.max(containerRect.bottom - layoutRect.bottom, 0)
          : undefined,
      containerRect,
      inset: snappedPosition ? placementOptions.snapOffset : 0,
      intrinsicHeight,
      position: targetPosition,
      useProjectedPosition: snappedPosition !== undefined,
    })
    requestAnimationFrame(updatePanelRect)
  }, [
    applyProjection,
    boundaryElement,
    measureIntrinsicHeight,
    panelElementRef,
    panelId,
    placement,
    placementOptions.snapOffset,
    positionElementRef,
    restoreCallerMaxHeight,
    store,
    synchronizePlacementGeometry,
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
    savedLayout?.placement?.mode,
    savedLayout?.placement?.disposition,
    savedLayout?.preferredCoordinates.x,
    savedLayout?.preferredCoordinates.y,
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
    measureEdgeAttachedPanelSize,
    measureIntrinsicHeight,
    measureIntrinsicHeightWithoutFixedSide,
    scheduleSynchronization,
    synchronizePlacementGeometry,
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

function restoreInlineStyleProperty(
  element: HTMLElement,
  property: string,
  value: string,
  priority: string,
) {
  if (value) {
    element.style.setProperty(property, value, priority)
  } else {
    element.style.removeProperty(property)
  }
}

function isFloatingPanel(panelElement: HTMLElement) {
  const position = getComputedStyle(panelElement).position
  return position === 'absolute' || position === 'fixed'
}
