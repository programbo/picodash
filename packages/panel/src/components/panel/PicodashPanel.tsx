import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  type MotionStyle,
} from 'motion/react'
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  ChevronRight,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from 'zustand'
import {
  fixedPanelRect,
  panelParticipatesInSnapping,
  projectPanelGeometry,
  rectWithHeight,
} from '../../geometry/panel-geometry.js'
import {
  baseRectFromDisplayedRect,
  clampPanelPosition,
  dockForSnapPosition,
  isPanelPlacementEdgeAttached,
  hybridDockPositionForPointer,
  normalizePicodashPanelPlacement,
  placementPosition,
  rectForPanelBoundary,
  rectFromElement,
  resolvePicodashPanelPlacementOptions,
  resolvePicodashPanelBoundary,
  snapPanelPosition,
  snapPositionForDock,
  type PanelDock,
  type PanelPosition,
  type PanelRect,
} from '../../geometry/panel-snapping.js'
import {
  panelZIndexForState,
  useRegisterPicodashPanel,
  usePicodashProviderContext,
} from '../../state/provider/picodash-provider.js'
import { PicodashPanelContextProvider } from '../../state/panel/picodash-panel-context.js'
import {
  PicodashPanelActions,
  PicodashPanelConstraintRepairDialog,
} from './actions/PicodashPanelActions.js'
import { createPicodashPanelStore } from '../../state/panel/picodash-panel-store.js'
import { rootGroupId } from '../../state/order/picodash-order.js'
import { PicodashReorderList } from './reorder/PicodashReorderList.js'
import {
  PicodashThemeContextProvider,
  useResolvedPicodashTheme,
} from '../../lib/theme/picodash-theme-context.js'
import { TooltipProvider } from '../overlays/Tooltip.js'
import { buttonVariants } from '../ui/button.js'
import { usePanelLayoutSynchronization } from '../../hooks/use-panel-layout.js'
import { cn } from '../../utilities/utils.js'
import { picodashMotionTokens } from '../../lib/theme/theme.js'
import type {
  PicodashPanelCloseBehavior,
  PicodashPanelCloseDetails,
  PicodashPanelDockedPosition,
  PicodashPanelHybridDockPosition,
  PicodashPanelPlacement,
  PicodashPanelProps,
  PicodashPanelSnappedPosition,
  PicodashPanelStore,
} from '../../state/panel/picodash-panel-types.js'

export { createPicodashPanelStore } from '../../state/panel/picodash-panel-store.js'
export {
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  CollapseAllItem,
  CopyJsonItem,
  CopySubmenu,
  CopyYamlItem,
  ExpandAllItem,
  ExportJsonItem,
  ExportSubmenu,
  ExportYamlItem,
  ImportItem,
  ResetItem,
} from './actions/PicodashPanelActions.js'
export type {
  ActionMenuConfirmation,
  ActionMenuItemProps,
  ActionMenuSeparatorProps,
  ActionSubmenuProps,
  PicodashPanelActionMenu,
} from './actions/PicodashPanelActions.js'
export {
  useRegisterPicodashItem,
  usePicodashPanelSelector,
  usePicodashPanelStoreApi,
  usePicodashPanelStoreSelector,
} from '../../state/panel/picodash-panel-context.js'
export {
  bandForItem,
  hasVisibleReorderableSibling,
  itemCanReorder,
  orderedItemIdsForParent,
  orderedItemsForParent,
  orderIndexForItem,
  reorderValuesForPointer,
  useOrderedPicodashChildren,
} from '../../state/order/picodash-order.js'
export { PicodashReorderList } from './reorder/PicodashReorderList.js'
export type {
  PicodashControlStates,
  PicodashControlStateValue,
  PicodashFieldState,
  PicodashGroupContextValue,
  PicodashInteractionState,
  PicodashItemKind,
  PicodashItemRegistration,
  PicodashPin,
  PicodashPanelCloseBehavior,
  PicodashPanelCloseDetails,
  PicodashPanelCloseOptions,
  PicodashPanelBoundary,
  PicodashPanelCorner,
  PicodashPanelDefaultPlacement,
  PicodashPanelDockedPosition,
  PicodashPanelDockedDisposition,
  PicodashPanelFreeDisposition,
  PicodashPanelHybridDockPosition,
  PicodashPanelPlacement,
  PicodashPanelPlacementOptions,
  PicodashPanelProps,
  PicodashPanelSnappedDisposition,
  PicodashPanelSnappedPosition,
  PicodashPanelState,
  PicodashPanelStore,
  PicodashReorderItemLayout,
  PicodashReorderItemMotion,
  PicodashStatus,
  PicodashValue,
} from '../../state/panel/picodash-panel-types.js'

type PicodashPanelDragHandler = NonNullable<PicodashPanelProps['onDrag']>
type PicodashPanelDragEvent = Parameters<PicodashPanelDragHandler>[0]
type PicodashPanelDragInfo = Parameters<PicodashPanelDragHandler>[1]

export function PicodashPanel({
  _dragX,
  _dragY,
  actionMenu,
  boundary,
  children,
  className,
  close = false,
  collapsible = false,
  defaultCollapsed = false,
  defaultPlacement = {
    disposition: { kind: 'snapped', position: 'top-right' },
    mode: 'floating',
  },
  defaultVisible = true,
  drag = true,
  dragDirectionLock,
  dragElastic = false,
  dragMomentum = false,
  dragPropagation,
  dragSnapToOrigin,
  dragTransition,
  id,
  initialMeta,
  initialValues,
  onClose,
  onDirectionLock,
  onDragTransitionEnd,
  onFocusCapture,
  onMeasureDragConstraints,
  onPointerDownCapture,
  placementOptions,
  store: injectedPanelStore,
  style,
  theme: themeProp,
  title,
  whileDrag,
  width,
  ...props
}: PicodashPanelProps) {
  const { panelBoundary, portalContainer, store: providerStore } = usePicodashProviderContext()
  const theme = useResolvedPicodashTheme(themeProp)
  const panelId = injectedPanelStore?.getState().panelId ?? id
  if (panelId === undefined) {
    throw new Error('PicodashPanel requires either an id or an application-owned store.')
  }
  const panelDragControls = useDragControls()
  const reducedMotion = useReducedMotion()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [deregistered, setDeregistered] = useState(false)
  const [dragHybridPosition, setDragHybridPosition] = useState<
    PicodashPanelHybridDockPosition | 'bottom' | 'top' | null | undefined
  >(undefined)
  const [hybridPreviewPosition, setHybridPreviewPosition] =
    useState<PicodashPanelHybridDockPosition | null>(null)
  const [hybridDragActive, setHybridDragActive] = useState(false)
  const defaultVisibleRef = useRef(defaultVisible)
  const pendingDeregisterCloseRef = useRef<PicodashPanelCloseDetails | null>(null)
  const panelElementRef = useRef<HTMLElement | null>(null)
  const positionElementRef = useRef<HTMLDivElement | null>(null)
  const headerElementRef = useRef<HTMLDivElement | null>(null)
  const pendingDragOriginRef = useRef<{
    displayedPosition: PanelPosition
    panelRect: PanelRect
  } | null>(null)
  const fixedToggleRef = useRef<HTMLButtonElement | null>(null)
  const panelStoreRef = useRef<PicodashPanelStore | null>(injectedPanelStore ?? null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const hybridPreviewPositionRef = useRef<PicodashPanelHybridDockPosition | null>(null)
  const hybridPreviewTargetRef = useRef<PanelRect | null>(null)
  const latestHybridDragRef = useRef<{
    event: PicodashPanelDragEvent
    info: PicodashPanelDragInfo
  } | null>(null)
  const reapplyHybridDragRef = useRef<() => void>(() => undefined)
  const dragStateRef = useRef<{
    attachedFullHeight: number
    attachedDock: PanelDock | null
    attachedNaturalHeight: number
    attachedReleaseOffset: PanelPosition
    attachedReleased: boolean
    attachedWidth: number
    baseRect: PanelRect
    containerRect: PanelRect
    dock: PanelDock | null
    floatingHeight: number
    headerHeight: number
    intrinsicHeight: number
    lastRect: PanelRect
    originPosition: PanelPosition
    peerRects: PanelRect[]
    placement: PicodashPanelPlacement
    startPosition: PanelPosition
    targetPosition: PicodashPanelDockedPosition | PicodashPanelSnappedPosition | null
  } | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const dragGestureX = useMotionValue(0)
  const dragGestureY = useMotionValue(0)
  const previewX = useMotionValue(0)
  const previewY = useMotionValue(0)
  const previewWidth = useMotionValue(0)
  const previewHeight = useMotionValue(0)
  const previewOpacity = useMotionValue(0)
  const previewIconRotation = useMotionValue(0)
  const previewIconX = useMotionValue(0)
  const previewIconY = useMotionValue(0)
  const releaseCatchUpProgress = useMotionValue(0)
  const draggedPanelOpacity = useMotionValue(1)
  const previewAnimationRef = useRef<Array<{ stop: () => void }>>([])
  const releaseCatchUpAnimationRef = useRef<{ stop: () => void } | null>(null)
  useMotionValueEvent(releaseCatchUpProgress, 'change', () => reapplyHybridDragRef.current())
  const normalizedDefaultPlacement = useMemo(
    () => normalizePicodashPanelPlacement(defaultPlacement),
    [defaultPlacement],
  )
  const resolvedPlacementOptions = useMemo(
    () => resolvePicodashPanelPlacementOptions(placementOptions),
    [placementOptions],
  )
  const resolvedBoundary = useResolvedPanelBoundary(boundary, panelBoundary)

  if (!panelStoreRef.current) {
    panelStoreRef.current = createPicodashPanelStore({ initialMeta, initialValues, panelId })
  }

  const panelStore = panelStoreRef.current
  if (injectedPanelStore && panelStore !== injectedPanelStore) {
    throw new Error('PicodashPanel store cannot be changed after the panel mounts.')
  }
  const panelCollapsed = collapsible && collapsed
  const titleText = typeof title === 'string' ? title : 'panel'
  const callerMaxHeight = style?.maxHeight
  const zIndex = useStore(providerStore, (state) => panelZIndexForState(state, panelId))
  const placement = useStore(
    providerStore,
    (state) => state.panels[panelId]?.placement ?? normalizedDefaultPlacement,
  )
  const visualPlacement: PicodashPanelPlacement =
    placement.mode === 'hybrid' && dragHybridPosition !== undefined
      ? hybridPlacementForPosition(dragHybridPosition)
      : placement
  const fixedPlacement = placement.mode === 'fixed'
  const shellPlacement =
    dragHybridPosition !== undefined && dragStateRef.current?.placement.mode === 'hybrid'
      ? dragStateRef.current.placement
      : placement
  const layoutEdgePlacement = isPanelPlacementEdgeAttached(shellPlacement)
  const fixedLikePosition =
    visualPlacement.disposition.kind === 'docked' ? visualPlacement.disposition.position : null
  const edgePlacement = fixedLikePosition !== null
  const shellDragProps = panelShellDragProps(fixedPlacement, {
    _dragX: _dragX ?? dragGestureX,
    _dragY: _dragY ?? dragGestureY,
    dragDirectionLock,
    dragPropagation,
    dragSnapToOrigin,
    dragTransition,
    onDirectionLock,
    onDragTransitionEnd,
    onMeasureDragConstraints,
    whileDrag,
  })
  const visible = useStore(
    providerStore,
    (state) => state.panels[panelId]?.visible ?? defaultVisibleRef.current,
  )
  const closeBehavior: PicodashPanelCloseBehavior =
    typeof close === 'object' ? close.behavior : 'hide'
  const {
    applyProjection,
    measureEdgeAttachedPanelSize,
    measureIntrinsicHeight,
    scheduleSynchronization,
    synchronizePlacementGeometry,
    updatePanelRect,
  } = usePanelLayoutSynchronization({
    boundaryElement: resolvedBoundary,
    callerHeight: style?.height,
    callerMaxHeight,
    callerMaxWidth: style?.maxWidth,
    collapsed: panelCollapsed,
    constraintClassName: className,
    contentElementRef: bodyRef,
    enabled: portalContainer !== null && visible && !deregistered,
    panelElementRef,
    panelId,
    placement,
    placementOptions: resolvedPlacementOptions,
    positionElementRef,
    synchronizationPausedRef: dragStateRef,
    store: providerStore,
    x,
    y,
  })
  useRegisterPicodashPanel({
    boundary: resolvedBoundary,
    defaultPlacement,
    id: panelId,
    visible: defaultVisibleRef.current,
  })

  useLayoutEffect(() => {
    if (layoutEdgePlacement) return

    const synchronizeConstraints = () => {
      const panelElement = panelElementRef.current
      const positionElement = positionElementRef.current
      if (!panelElement || !positionElement) return

      const computedStyle = getComputedStyle(panelElement)
      synchronizeConstraintAxis(positionElement, computedStyle, 'left', 'right')
      synchronizeConstraintAxis(positionElement, computedStyle, 'top', 'bottom')
      scheduleSynchronization()
    }

    synchronizeConstraints()
    window.addEventListener('resize', synchronizeConstraints)
    return () => window.removeEventListener('resize', synchronizeConstraints)
  }, [className, layoutEdgePlacement, portalContainer, scheduleSynchronization, style])

  useEffect(() => {
    const details = pendingDeregisterCloseRef.current
    if (!deregistered || !details) return

    pendingDeregisterCloseRef.current = null
    onClose?.(details)
  }, [deregistered, onClose])

  useEffect(
    () => () => {
      for (const animation of previewAnimationRef.current) animation.stop()
      releaseCatchUpAnimationRef.current?.stop()
    },
    [],
  )

  const togglePanelCollapsed = () => {
    const nextCollapsed = !panelCollapsed
    if (!panelParticipatesInSnapping(placement, nextCollapsed)) {
      providerStore.getState().setPanelRect(panelId, null)
    }
    if (
      edgePlacement &&
      nextCollapsed &&
      panelElementRef.current?.contains(document.activeElement)
    ) {
      requestAnimationFrame(() => fixedToggleRef.current?.focus())
    }
    setCollapsed(nextCollapsed)
  }

  const updateHybridPreview = (
    position: PicodashPanelHybridDockPosition | null,
    targetRect: PanelRect,
    panelRect: PanelRect,
  ) => {
    const previousPosition = hybridPreviewPositionRef.current
    const previewWasHidden = previousPosition === null
    const destination = position ? targetRect : panelRect
    const iconDestination = position
      ? hybridPreviewIconPosition(position, destination, resolvedPlacementOptions.snapProximity)
      : {
          x: destination.left + destination.width / 2,
          y: destination.top + destination.height / 2,
        }
    if (
      previousPosition === position &&
      (position === null || panelRectsAlmostEqual(hybridPreviewTargetRef.current, destination))
    ) {
      return
    }

    for (const animation of previewAnimationRef.current) animation.stop()
    previewAnimationRef.current = []
    if (previewWasHidden && position) {
      previewX.jump(panelRect.left)
      previewY.jump(panelRect.top)
      previewWidth.jump(panelRect.width)
      previewHeight.jump(panelRect.height)
      previewIconX.jump(panelRect.left + panelRect.width / 2)
      previewIconY.jump(panelRect.top + panelRect.height / 2)
      previewIconRotation.jump(hybridPreviewIconRotation(position))
    }
    if (hybridPreviewPositionRef.current !== position) {
      hybridPreviewPositionRef.current = position
      setHybridPreviewPosition(position)
    }
    hybridPreviewTargetRef.current = destination

    if (reducedMotion) {
      previewX.set(destination.left)
      previewY.set(destination.top)
      previewWidth.set(destination.width)
      previewHeight.set(destination.height)
      previewOpacity.set(position ? 1 : 0)
      previewIconX.set(iconDestination.x)
      previewIconY.set(iconDestination.y)
      if (position) previewIconRotation.set(hybridPreviewIconRotation(position))
      draggedPanelOpacity.set(position ? 0.55 : 1)
      return
    }

    const transition = picodashMotionTokens.hybridPreview
    const fadeTransition = {
      duration: position ? 0.12 : 0.1,
      ease: 'easeOut' as const,
    }
    previewAnimationRef.current = [
      animate(previewX, destination.left, transition),
      animate(previewY, destination.top, transition),
      animate(previewWidth, destination.width, transition),
      animate(previewHeight, destination.height, transition),
      animate(previewOpacity, position ? 1 : 0, fadeTransition),
      animate(previewIconX, iconDestination.x, transition),
      animate(previewIconY, iconDestination.y, transition),
      ...(position
        ? [
            animate(
              previewIconRotation,
              nearestEquivalentRotation(
                previewIconRotation.get(),
                hybridPreviewIconRotation(position),
              ),
              transition,
            ),
          ]
        : []),
      animate(draggedPanelOpacity, position ? 0.55 : 1, fadeTransition),
    ]
  }

  const applyFloatingDrag = (
    dragState: NonNullable<typeof dragStateRef.current>,
    offset: PanelPosition,
  ) => {
    const snapped = snapPanelPosition({
      baseRect: dragState.baseRect,
      containerRect: dragState.containerRect,
      peerRects: dragState.peerRects,
      options: {
        gap: resolvedPlacementOptions.snapOffset,
        threshold: resolvedPlacementOptions.snapProximity,
      },
      position: {
        x: dragState.startPosition.x + offset.x,
        y: dragState.startPosition.y + offset.y,
      },
    })
    const projection = applyProjection({
      anchor: snapped.dock?.vertical === 'bottom' ? 'bottom' : 'top',
      baseRect: dragState.baseRect,
      containerRect: dragState.containerRect,
      inset: resolvedPlacementOptions.snapOffset,
      intrinsicHeight: dragState.intrinsicHeight,
      position: snapped.position,
    })
    dragState.dock = snapped.dock
    dragState.targetPosition = snapPositionForDock(snapped.dock)
    dragState.lastRect = projection.rect
    panelElementRef.current?.toggleAttribute(
      'data-picodash-panel-snapping',
      snapped.snappedX || snapped.snappedY,
    )
    return projection
  }

  const applyDrag = (
    event: PicodashPanelDragEvent,
    info: PicodashPanelDragInfo,
    notifyConsumer: boolean,
  ) => {
    const dragState = dragStateRef.current
    if (!dragState) {
      if (notifyConsumer) props.onDrag?.(event, info)
      return
    }

    const nextContainerRect = rectForPanelBoundary(resolvedBoundary)
    if (
      nextContainerRect.width !== dragState.containerRect.width ||
      nextContainerRect.height !== dragState.containerRect.height
    ) {
      const attachedSize = measureEdgeAttachedPanelSize(
        nextContainerRect,
        dragState.intrinsicHeight,
      )
      dragState.attachedFullHeight = attachedSize.fullHeight
      dragState.attachedNaturalHeight = attachedSize.naturalHeight
      dragState.attachedWidth = attachedSize.width
    }
    dragState.containerRect = nextContainerRect
    if (dragState.placement.mode === 'hybrid') {
      let detachedPlacement: PicodashPanelPlacement | null = null
      const detachDistance =
        resolvedPlacementOptions.snapProximity * resolvedPlacementOptions.detachThresholdMultiplier
      const releasesDownward =
        dragState.placement.disposition.kind === 'docked' &&
        (dragState.placement.disposition.position === 'full-left' ||
          dragState.placement.disposition.position === 'full-right')
      if (
        dragState.attachedDock &&
        !dragState.attachedReleased &&
        hybridReleaseDistance(info.offset, dragState.attachedDock, releasesDownward) <
          detachDistance
      ) {
        dragState.dock = dragState.attachedDock
        dragState.targetPosition =
          dragState.placement.disposition.kind === 'docked'
            ? dragState.placement.disposition.position
            : null
        synchronizePlacementGeometry(dragState.placement, dragState.baseRect)
        const panelRect = panelElementRef.current
          ? rectFromElement(panelElementRef.current)
          : dragState.lastRect
        updateHybridPreview(null, panelRect, panelRect)
        if (notifyConsumer) props.onDrag?.(event, info)
        return
      }

      if (dragState.attachedDock && !dragState.attachedReleased) {
        releaseCatchUpAnimationRef.current?.stop()
        releaseCatchUpAnimationRef.current = null
        releaseCatchUpProgress.set(reducedMotion ? 0 : 1)
        dragState.attachedReleased = true
        dragState.attachedReleaseOffset = hybridReleaseOffset(
          info.offset,
          dragState.attachedDock,
          detachDistance,
          releasesDownward,
        )
        dragState.dock = null
        dragState.targetPosition = null
        const freePlacement = hybridPlacementForPosition(null)
        detachedPlacement = freePlacement
        synchronizePlacementGeometry(freePlacement, dragState.baseRect)
        if (!reducedMotion) {
          releaseCatchUpAnimationRef.current = animate(
            releaseCatchUpProgress,
            0,
            picodashMotionTokens.hybridPreview,
          )
        }
      }

      const appliedOffset = dragState.attachedDock
        ? offsetAfterHybridRelease(
            info.offset,
            dragState.attachedReleaseOffset,
            releaseCatchUpProgress.get(),
          )
        : info.offset
      const displayedPosition = { x: x.get(), y: y.get() }
      const displayedRect = panelElementRef.current
        ? rectFromElement(panelElementRef.current)
        : dragState.lastRect
      const liveBaseRect = rectWithHeight(
        baseRectFromDisplayedRect(displayedRect, displayedPosition),
        dragState.floatingHeight,
      )
      const candidateAbsolutePosition = {
        x: dragState.originPosition.x + appliedOffset.x,
        y: dragState.originPosition.y + appliedOffset.y,
      }
      const candidatePosition = {
        x: candidateAbsolutePosition.x - liveBaseRect.left,
        y: candidateAbsolutePosition.y - liveBaseRect.top,
      }
      const containedProjection = projectPanelGeometry({
        anchor: 'top',
        baseRect: liveBaseRect,
        containerRect: dragState.containerRect,
        inset: resolvedPlacementOptions.snapOffset,
        intrinsicHeight: dragState.floatingHeight,
        position: candidatePosition,
      })
      const pointer = dragPointerClientPosition(event, info.point)
      const intentPosition = hybridDockPositionForPointer({
        containerRect: dragState.containerRect,
        headerHeight: dragState.headerHeight,
        intrinsicHeight: dragState.intrinsicHeight,
        panelRect: containedProjection.rect,
        pointer,
        snapOffset: resolvedPlacementOptions.snapOffset,
        snapProximity: resolvedPlacementOptions.snapProximity,
      })
      const previewPosition =
        intentPosition === 'top' || intentPosition === 'bottom' ? null : intentPosition
      const verticalSnapIntent =
        intentPosition === 'top' || intentPosition === 'bottom' ? intentPosition : null
      const ordinarySnap = snapPanelPosition({
        baseRect: liveBaseRect,
        containerRect: dragState.containerRect,
        options: {
          gap: resolvedPlacementOptions.snapOffset,
          threshold: resolvedPlacementOptions.snapProximity,
          viewportDocks: verticalSnapIntent ? [verticalSnapIntent] : [],
        },
        peerRects: intentPosition ? [] : dragState.peerRects,
        position: candidatePosition,
      })
      const targetPosition =
        previewPosition ??
        (dragState.intrinsicHeight >= dragState.containerRect.height && verticalSnapIntent
          ? verticalSnapIntent
          : ordinarySnap.dock?.vertical === 'top' || ordinarySnap.dock?.vertical === 'bottom'
            ? ordinarySnap.dock.vertical
            : null)
      if (
        dragState.placement.disposition.kind === 'snapped' &&
        providerStore.getState().panels[panelId]?.placement.disposition.kind === 'snapped' &&
        targetPosition !== dragState.placement.disposition.position
      ) {
        detachedPlacement = hybridPlacementForPosition(null)
      }
      const projection = applyProjection({
        anchor: 'top',
        baseRect: liveBaseRect,
        containerRect: dragState.containerRect,
        inset: resolvedPlacementOptions.snapOffset,
        intrinsicHeight: dragState.floatingHeight,
        position:
          previewPosition && !(releasesDownward && dragState.attachedReleased)
            ? clampPanelPosition(
                ordinarySnap.position,
                liveBaseRect,
                insetPanelRect(dragState.containerRect, resolvedPlacementOptions.snapOffset),
              )
            : ordinarySnap.position,
        useProvidedBaseRect: true,
      })
      const previewRect = previewPosition
        ? hybridPreviewRect(previewPosition, projection.rect, dragState.containerRect, {
            fullHeight: dragState.attachedFullHeight,
            naturalHeight: dragState.attachedNaturalHeight,
            width: dragState.attachedWidth,
          })
        : projection.rect
      updateHybridPreview(previewPosition, previewRect, projection.rect)
      dragState.dock = targetPosition ? dockForSnapPosition(targetPosition) : null
      dragState.targetPosition = targetPosition
      panelElementRef.current?.toggleAttribute(
        'data-picodash-panel-snapping',
        targetPosition !== null,
      )
      dragState.lastRect = projection.rect
      if (detachedPlacement) {
        providerStore.getState().setPanelPlacement(panelId, detachedPlacement)
        setDragHybridPosition(null)
      }
      updatePanelRect()
      if (notifyConsumer) props.onDrag?.(event, info)
      return
    }

    applyFloatingDrag(dragState, info.offset)
    updatePanelRect()
    if (notifyConsumer) props.onDrag?.(event, info)
  }

  reapplyHybridDragRef.current = () => {
    const dragState = dragStateRef.current
    const latestDrag = latestHybridDragRef.current
    if (!dragState?.attachedReleased || !latestDrag) return
    applyDrag(latestDrag.event, latestDrag.info, false)
  }

  const handleDrag: PicodashPanelDragHandler = (event, info) => {
    latestHybridDragRef.current = { event, info }
    applyDrag(event, info, true)
  }

  const handleDragEnd: NonNullable<PicodashPanelProps['onDragEnd']> = (event, info) => {
    const dragState = dragStateRef.current
    if (dragState?.placement.mode === 'floating') {
      applyFloatingDrag(dragState, info.offset)
    }
    const hybridTargetPosition =
      dragState?.placement.mode === 'hybrid'
        ? committedHybridPosition(dragState.targetPosition, hybridPreviewPositionRef.current)
        : null
    const nextPlacement: PicodashPanelPlacement =
      dragState?.placement.mode === 'hybrid'
        ? hybridPlacementForPosition(
            isHybridPosition(hybridTargetPosition) ? hybridTargetPosition : null,
          )
        : {
            disposition:
              dragState?.targetPosition && isSnappedPosition(dragState.targetPosition)
                ? { kind: 'snapped', position: dragState.targetPosition }
                : { kind: 'free' },
            mode: 'floating',
          }
    dragStateRef.current = null
    latestHybridDragRef.current = null
    releaseCatchUpAnimationRef.current?.stop()
    releaseCatchUpAnimationRef.current = null
    releaseCatchUpProgress.set(0)
    pendingDragOriginRef.current = null
    setDragHybridPosition(undefined)
    hybridPreviewPositionRef.current = null
    hybridPreviewTargetRef.current = null
    setHybridPreviewPosition(null)
    setHybridDragActive(false)
    previewOpacity.set(0)
    draggedPanelOpacity.set(1)
    for (const animation of previewAnimationRef.current) animation.stop()
    previewAnimationRef.current = []
    panelElementRef.current?.removeAttribute('data-picodash-panel-snapping')

    const panelElement = panelElementRef.current
    const displayedPosition = { x: Math.round(x.get()), y: Math.round(y.get()) }
    x.set(displayedPosition.x)
    y.set(displayedPosition.y)

    if (panelElement) {
      const displayedRect = dragState?.lastRect ?? rectFromElement(panelElement)
      const containerRect = rectForPanelBoundary(resolvedBoundary)
      providerStore.getState().setPanelLayout(panelId, {
        placement: nextPlacement,
        preferredCoordinates: {
          x: Math.round(displayedRect.left - containerRect.left),
          y: Math.round(displayedRect.top - containerRect.top),
        },
      })
    }
    updatePanelRect()
    scheduleSynchronization()
    props.onDragEnd?.(event, info)
  }

  const handleDragStart: NonNullable<PicodashPanelProps['onDragStart']> = (event, info) => {
    releaseCatchUpAnimationRef.current?.stop()
    releaseCatchUpAnimationRef.current = null
    latestHybridDragRef.current = null
    releaseCatchUpProgress.set(0)
    const panelElement = panelElementRef.current
    if (panelElement) {
      const displayedPosition = { x: x.get(), y: y.get() }
      const intrinsicHeight = measureIntrinsicHeight()
      const containerRect = rectForPanelBoundary(resolvedBoundary)
      const attachedSize = measureEdgeAttachedPanelSize(containerRect, intrinsicHeight)
      const initialDock =
        placement.mode === 'hybrid' && placement.disposition.kind === 'docked'
          ? dockForSnapPosition(placement.disposition.position)
          : null
      const panelRect = rectFromElement(panelElement)
      const dragOrigin = pendingDragOriginRef.current ?? {
        displayedPosition,
        panelRect,
      }
      pendingDragOriginRef.current = null
      dragStateRef.current = {
        attachedFullHeight: attachedSize.fullHeight,
        attachedDock: initialDock,
        attachedNaturalHeight: attachedSize.naturalHeight,
        attachedReleaseOffset: { x: 0, y: 0 },
        attachedReleased: initialDock === null,
        attachedWidth: attachedSize.width,
        baseRect:
          placement.mode === 'hybrid'
            ? baseRectFromDisplayedRect(dragOrigin.panelRect, dragOrigin.displayedPosition)
            : rectWithHeight(
                baseRectFromDisplayedRect(dragOrigin.panelRect, dragOrigin.displayedPosition),
                intrinsicHeight,
              ),
        containerRect,
        dock: initialDock,
        floatingHeight:
          placement.mode === 'hybrid' &&
          placement.disposition.kind === 'docked' &&
          (placement.disposition.position === 'full-left' ||
            placement.disposition.position === 'full-right')
            ? attachedSize.naturalHeight
            : panelRect.height,
        headerHeight:
          headerElementRef.current?.getBoundingClientRect().height ??
          resolvedPlacementOptions.snapProximity / 2,
        intrinsicHeight,
        lastRect: panelRect,
        originPosition: {
          x: dragOrigin.panelRect.left,
          y: dragOrigin.panelRect.top,
        },
        placement,
        peerRects: Object.entries(providerStore.getState().panelRects)
          .filter(
            ([peerPanelId]) =>
              peerPanelId !== panelId &&
              providerStore.getState().panels[peerPanelId]?.boundary === resolvedBoundary,
          )
          .map(([, rect]) => rect),
        startPosition: dragOrigin.displayedPosition,
        targetPosition: placementPosition(placement),
      }
      if (placement.mode === 'hybrid') {
        hybridPreviewPositionRef.current = null
        hybridPreviewTargetRef.current = null
        setHybridPreviewPosition(null)
        setHybridDragActive(true)
        previewX.set(panelRect.left)
        previewY.set(panelRect.top)
        previewWidth.set(panelRect.width)
        previewHeight.set(panelRect.height)
        previewOpacity.set(0)
        draggedPanelOpacity.set(1)
      }
    }

    providerStore.getState().activatePanel(panelId)
    props.onDragStart?.(event, info)
  }

  if (!portalContainer || deregistered) return null

  return createPortal(
    <PicodashThemeContextProvider theme={theme}>
      <PicodashPanelContextProvider store={panelStore}>
        {hybridDragActive ? (
          <motion.svg
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 h-dvh w-dvw overflow-visible"
            data-picodash-hybrid-preview-layer=""
            data-picodash-theme={theme}
            style={{ zIndex: Math.max(zIndex - 1, 0) }}
          >
            <motion.rect
              data-hybrid-dock-preview-halo=""
              fill="none"
              height={previewHeight}
              opacity={previewOpacity}
              rx={0}
              stroke="var(--picodash-color-surface)"
              strokeDasharray="12 12"
              strokeLinecap="round"
              strokeOpacity={0.92}
              strokeWidth={4}
              vectorEffect="non-scaling-stroke"
              width={previewWidth}
              x={previewX}
              y={previewY}
            />
            <motion.rect
              className="filter-[drop-shadow(var(--picodash-shadow-md))]"
              data-hybrid-dock-preview={hybridPreviewPosition ?? ''}
              fill="var(--picodash-color-surface)"
              fillOpacity={0.48}
              height={previewHeight}
              opacity={previewOpacity}
              rx={0}
              stroke="var(--picodash-color-text)"
              strokeDasharray="12 12"
              strokeLinecap="round"
              strokeOpacity={0.7}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              width={previewWidth}
              x={previewX}
              y={previewY}
            />
            <motion.path
              d={hybridPreviewIconPath}
              data-hybrid-dock-preview-icon={hybridPreviewPosition ?? ''}
              fill="var(--picodash-color-text)"
              fillOpacity={0.82}
              opacity={previewOpacity}
              stroke="var(--picodash-color-surface)"
              strokeOpacity={0.8}
              strokeWidth={1}
              style={{
                rotate: previewIconRotation,
                transformBox: 'fill-box',
                transformOrigin: 'center',
                x: previewIconX,
                y: previewIconY,
              }}
              vectorEffect="non-scaling-stroke"
            />
          </motion.svg>
        ) : null}
        <motion.div
          {...shellDragProps}
          data-picodash-panel-shell=""
          data-fixed-placement={
            fixedPlacement && placement.disposition.kind === 'docked'
              ? placement.disposition.position
              : undefined
          }
          data-hybrid-placement={
            visualPlacement.mode === 'hybrid'
              ? (placementPosition(visualPlacement) ?? '')
              : undefined
          }
          className={cn(
            'pointer-events-none absolute h-fit w-fit max-w-[calc(100dvw-2rem)]',
            placementShellClassName(shellPlacement),
            !visible && 'hidden',
          )}
          drag={fixedPlacement ? false : drag}
          dragControls={panelDragControls}
          dragElastic={dragElastic}
          dragListener={false}
          dragMomentum={dragMomentum}
          hidden={!visible}
          ref={positionElementRef}
          style={
            {
              ...(layoutEdgePlacement
                ? {
                    left: 0,
                    position: 'absolute',
                    top: 0,
                  }
                : {
                    bottom: style?.bottom,
                    left: style?.left,
                    position: style?.position ?? 'absolute',
                    right: style?.right,
                    top: style?.top,
                  }),
              '--picodash-panel-width': typeof width === 'number' ? `${width}px` : width,
              backdropFilter: 'none',
              background: 'none',
              border: 0,
              boxShadow: 'none',
              filter: 'none',
              opacity: draggedPanelOpacity,
              outline: 'none',
              overflow: 'visible',
              x,
              y,
              zIndex,
            } as MotionStyle & { '--picodash-panel-width'?: string }
          }
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
          onFocusCapture={(event) => {
            providerStore.getState().activatePanel(panelId)
            onFocusCapture?.(event)
          }}
          onPointerDownCapture={(event) => {
            providerStore.getState().activatePanel(panelId)
            onPointerDownCapture?.(event)
          }}
        >
          <motion.aside
            {...props}
            animate={
              fixedLikePosition
                ? panelCollapsed
                  ? fixedCollapsedTransform(fixedLikePosition)
                  : { x: '0%', y: '0%' }
                : props.animate
            }
            aria-hidden={edgePlacement && panelCollapsed ? true : undefined}
            className={cn(
              'rounded-picodash-surface border-picodash-border bg-picodash-surface text-picodash-text shadow-picodash-panel pointer-events-auto relative flex max-h-[calc(100dvh-1rem)] min-h-0 w-(--picodash-panel-width) max-w-[calc(100dvw-2rem)] flex-col overflow-hidden border ring-1 ring-(--_picodash-panel-ring)',
              fixedLikePosition && fixedPanelEdgeClassNames[fixedLikePosition],
              className,
            )}
            data-collapsed={panelCollapsed ? 'true' : 'false'}
            data-picodash-panel
            data-picodash-panel-id={panelId}
            data-picodash-theme={theme}
            data-visible={visible ? 'true' : 'false'}
            hidden={!visible}
            id={panelId}
            inert={edgePlacement && panelCollapsed}
            onAnimationComplete={(definition) => {
              updatePanelRect()
              props.onAnimationComplete?.(definition)
            }}
            ref={panelElementRef}
            style={
              {
                ...style,
                '--picodash-panel-width': typeof width === 'number' ? `${width}px` : width,
                position: 'static',
                zIndex,
              } as MotionStyle & { '--picodash-panel-width'?: string }
            }
            transition={
              placement.mode === 'hybrid'
                ? {
                    ...(edgePlacement
                      ? {
                          duration: reducedMotion ? 0 : 0.2,
                          ease: [0.16, 1, 0.3, 1],
                        }
                      : props.transition),
                  }
                : edgePlacement
                  ? {
                      duration: reducedMotion ? 0 : 0.2,
                      ease: [0.16, 1, 0.3, 1],
                    }
                  : props.transition
            }
          >
            {panelShouldRenderHeader({
              actionMenu,
              close,
              collapsible,
              fixedPlacement: edgePlacement,
              title,
            }) ? (
              <div
                className={cn(
                  'border-picodash-border flex h-9.25 shrink-0 items-center gap-(--picodash-space-1) border-b py-(--picodash-space-2) pr-(--picodash-space-3) select-none',
                  !fixedPlacement && 'cursor-grab active:cursor-grabbing',
                  collapsible && !edgePlacement
                    ? 'pl-(--picodash-space-1)'
                    : 'pl-(--picodash-space-3)',
                  fixedLikePosition &&
                    fixedPositionUsesLeftEdge(fixedLikePosition) &&
                    'pr-(--picodash-control-height-md)',
                  fixedLikePosition &&
                    !fixedPositionUsesLeftEdge(fixedLikePosition) &&
                    'pl-(--picodash-control-height-md)',
                )}
                data-picodash-panel-header=""
                ref={headerElementRef}
                onPointerDown={(event) => {
                  if (!fixedPlacement && drag) {
                    event.preventDefault()
                    window.getSelection()?.removeAllRanges()
                    const panelElement = panelElementRef.current
                    if (panelElement) {
                      pendingDragOriginRef.current = {
                        displayedPosition: { x: x.get(), y: y.get() },
                        panelRect: rectFromElement(panelElement),
                      }
                    }
                    panelDragControls.start(event)
                  }
                }}
              >
                {collapsible && !edgePlacement ? (
                  <button
                    aria-expanded={!panelCollapsed}
                    aria-label={`${panelCollapsed ? 'Expand' : 'Collapse'} panel ${titleText}`}
                    className={cn(
                      buttonVariants({ size: 'icon', variant: 'ghost' }),
                      'text-picodash-muted aria-expanded:hover:bg-picodash-surface-muted! size-(--picodash-icon-lg) shrink-0 aria-expanded:bg-transparent!',
                    )}
                    type="button"
                    onClick={() => togglePanelCollapsed()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <ChevronRight
                      className={cn(
                        'size-(--picodash-icon-sm) transition-transform duration-(--picodash-duration-fast) ease-(--picodash-ease-out) motion-reduce:transition-none',
                        !panelCollapsed && 'rotate-90',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                ) : null}
                {title ? (
                  <h2 className="min-w-0 flex-1 truncate text-(length:--picodash-font-size-xl) font-(--picodash-font-semibold) tracking-(--picodash-tracking-normal)">
                    {title}
                  </h2>
                ) : (
                  <span className="min-w-0 flex-1" />
                )}
                <PicodashPanelActions
                  actionMenu={actionMenu}
                  panelId={panelId}
                  panelTitle={titleText}
                />
                {close ? (
                  <button
                    aria-label={`Close panel ${titleText}`}
                    className={cn(
                      buttonVariants({ size: 'icon', variant: 'ghost' }),
                      'text-picodash-muted size-(--picodash-icon-lg) shrink-0',
                    )}
                    type="button"
                    onClick={() => {
                      if (closeBehavior === 'deregister') {
                        pendingDeregisterCloseRef.current = {
                          behavior: closeBehavior,
                          panelId,
                        }
                        providerStore.getState().unregisterPanel(panelId)
                        setDeregistered(true)
                      } else {
                        providerStore.getState().setPanelVisible(panelId, false)
                        onClose?.({ behavior: closeBehavior, panelId })
                      }
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <X className="size-(--picodash-icon-sm)" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}
            <div
              aria-hidden={!edgePlacement && panelCollapsed}
              className={cn(
                'grid min-h-0 flex-1 transition-[grid-template-rows] duration-(--picodash-duration-fast) ease-(--picodash-ease-out) motion-reduce:transition-none',
                !edgePlacement && panelCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
              )}
              inert={!edgePlacement && panelCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                <TooltipProvider>
                  <PicodashReorderList
                    ref={bodyRef}
                    className="h-full min-h-0 overflow-auto"
                    fixedPlacement={edgePlacement}
                    parentId={rootGroupId}
                  >
                    {children}
                  </PicodashReorderList>
                </TooltipProvider>
              </div>
            </div>
            <PicodashPanelConstraintRepairDialog panelTitle={titleText} />
          </motion.aside>
          {fixedLikePosition && collapsible ? (
            <FixedPanelToggle
              animatePosition={fixedPlacement}
              collapsed={panelCollapsed}
              panelId={panelId}
              panelTitle={titleText}
              position={fixedLikePosition}
              reducedMotion={reducedMotion ?? false}
              theme={theme}
              ref={fixedToggleRef}
              onToggle={togglePanelCollapsed}
            />
          ) : null}
        </motion.div>
      </PicodashPanelContextProvider>
    </PicodashThemeContextProvider>,
    portalContainer,
  )
}

function FixedPanelToggle({
  animatePosition,
  collapsed,
  onToggle,
  panelId,
  panelTitle,
  position,
  reducedMotion,
  theme,
  ref,
}: {
  animatePosition: boolean
  collapsed: boolean
  onToggle: () => void
  panelId: string
  panelTitle: string
  position: PicodashPanelDockedPosition
  reducedMotion: boolean
  theme: string
  ref: Ref<HTMLButtonElement>
}) {
  const Icon = fixedToggleIcon(position, collapsed)

  return (
    <motion.button
      aria-controls={panelId}
      aria-expanded={!collapsed}
      aria-label={`${collapsed ? 'Expand' : 'Collapse'} panel ${panelTitle}`}
      className={cn(
        buttonVariants({ size: 'icon', variant: 'ghost' }),
        'text-picodash-muted pointer-events-auto absolute z-10 size-(--picodash-control-height-md) shrink-0',
        'transition-[background-color,color] motion-reduce:transition-none',
        collapsed
          ? 'bg-(--picodash-color-surface)/72! backdrop-blur-xl hover:bg-(--picodash-color-surface)/82! focus-visible:bg-(--picodash-color-surface)/82!'
          : 'hover:bg-picodash-surface-muted/50! bg-transparent!',
        fixedTogglePositionClassName(position, collapsed),
      )}
      data-picodash-fixed-toggle=""
      data-picodash-theme={theme}
      layout={animatePosition ? 'position' : false}
      ref={ref}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      type="button"
      onClick={onToggle}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Icon className="size-(--picodash-icon-md)" aria-hidden="true" />
    </motion.button>
  )
}

function fixedToggleIcon(position: PicodashPanelDockedPosition, collapsed: boolean): LucideIcon {
  if (position === 'bottom-left') return collapsed ? ArrowUpRight : ArrowDownLeft
  if (position === 'bottom-right') return collapsed ? ArrowUpLeft : ArrowDownRight
  if (fixedPositionUsesLeftEdge(position)) return collapsed ? ArrowRight : ArrowLeft
  return collapsed ? ArrowLeft : ArrowRight
}

function fixedTogglePositionClassName(position: PicodashPanelDockedPosition, collapsed: boolean) {
  if (!collapsed) {
    return fixedPositionUsesLeftEdge(position)
      ? 'top-[0.1875rem] right-[0.1875rem]'
      : 'top-[0.1875rem] left-[0.1875rem]'
  }
  if (position === 'bottom-left') return 'bottom-0 left-0'
  if (position === 'bottom-right') return 'right-0 bottom-0'
  return fixedPositionUsesLeftEdge(position) ? 'top-0 left-0' : 'top-0 right-0'
}

function fixedPositionUsesLeftEdge(position: PicodashPanelDockedPosition) {
  return position.endsWith('-left')
}

function fixedCollapsedTransform(position: PicodashPanelDockedPosition) {
  if (position === 'bottom-left') return { x: '-100%', y: '100%' }
  if (position === 'bottom-right') return { x: '100%', y: '100%' }
  return fixedPositionUsesLeftEdge(position) ? { x: '-100%', y: '0%' } : { x: '100%', y: '0%' }
}

function placementShellClassName(placement: PicodashPanelPlacement) {
  return placement.disposition.kind === 'free' ? '' : 'top-0 left-0'
}

function dragPointerClientPosition(
  _event: MouseEvent | PointerEvent | TouchEvent,
  fallbackPagePoint: PanelPosition,
) {
  return {
    x: fallbackPagePoint.x - window.scrollX,
    y: fallbackPagePoint.y - window.scrollY,
  }
}

function hybridPlacementForPosition(
  position: PicodashPanelHybridDockPosition | 'bottom' | 'top' | null,
): PicodashPanelPlacement {
  if (position === null) {
    return { disposition: { kind: 'free' }, mode: 'hybrid' }
  }
  return position === 'bottom' || position === 'top'
    ? { disposition: { kind: 'snapped', position }, mode: 'hybrid' }
    : { disposition: { kind: 'docked', position }, mode: 'hybrid' }
}

function committedHybridPosition(
  target: PicodashPanelDockedPosition | PicodashPanelSnappedPosition | null,
  preview: PicodashPanelHybridDockPosition | null,
) {
  if (target === null || target === 'bottom' || target === 'top') return target
  return target === preview ? target : null
}

function isHybridPosition(
  position: PicodashPanelDockedPosition | PicodashPanelSnappedPosition | null,
): position is PicodashPanelHybridDockPosition | 'bottom' | 'top' {
  return (
    position !== 'left' &&
    position !== 'middle-left' &&
    position !== 'middle-right' &&
    position !== 'right'
  )
}

function isSnappedPosition(
  position: PicodashPanelDockedPosition | PicodashPanelSnappedPosition,
): position is PicodashPanelSnappedPosition {
  return (
    position !== 'full-left' &&
    position !== 'full-right' &&
    position !== 'middle-left' &&
    position !== 'middle-right'
  )
}

function hybridReleaseDistance(offset: PanelPosition, dock: PanelDock, releasesDownward = false) {
  const inward = hybridInwardOffset(offset, dock, releasesDownward)
  return Math.hypot(inward.x, inward.y)
}

function hybridReleaseOffset(
  offset: PanelPosition,
  dock: PanelDock,
  detachDistance: number,
  releasesDownward = false,
) {
  const inward = hybridInwardOffset(offset, dock, releasesDownward)
  const distance = Math.hypot(inward.x, inward.y)
  if (distance <= detachDistance) return inward
  const resistanceRatio = detachDistance / distance
  return {
    x: inward.x * resistanceRatio,
    y: inward.y * resistanceRatio,
  }
}

function offsetAfterHybridRelease(
  offset: PanelPosition,
  releaseOffset: PanelPosition,
  catchUpProgress: number,
) {
  const progress = Math.min(Math.max(catchUpProgress, 0), 1)
  return {
    x: offset.x - releaseOffset.x * progress,
    y: offset.y - releaseOffset.y * progress,
  }
}

function hybridInwardOffset(
  offset: PanelPosition,
  dock: PanelDock,
  releasesDownward: boolean,
): PanelPosition {
  let x = 0
  let y = 0
  if (dock.horizontal === 'left') {
    x = Math.max(offset.x, 0)
  } else if (dock.horizontal === 'right') {
    x = Math.min(offset.x, 0)
  }
  if (releasesDownward || dock.vertical === 'top') {
    y = Math.max(offset.y, 0)
  } else if (dock.vertical === 'bottom') {
    y = Math.min(offset.y, 0)
  }
  return { x, y }
}

function hybridPreviewRect(
  position: PicodashPanelHybridDockPosition,
  panelRect: PanelRect,
  containerRect: PanelRect,
  attachedSize: {
    fullHeight: number
    naturalHeight: number
    width: number
  },
) {
  return fixedPanelRect({
    boundaryRect: containerRect,
    height:
      position === 'full-left' || position === 'full-right'
        ? attachedSize.fullHeight
        : attachedSize.naturalHeight,
    position,
    width: attachedSize.width,
  })
}

function hybridPreviewIconRotation(position: PicodashPanelHybridDockPosition) {
  switch (position) {
    case 'top-left':
      return -45
    case 'top-right':
      return 45
    case 'full-right':
      return 90
    case 'bottom-right':
      return 135
    case 'bottom-left':
      return -135
    case 'full-left':
      return -90
  }
}

const hybridPreviewIconPath = 'M -16 12 L 0 -7 L 16 12 Z'
const hybridPreviewIconTip = { x: 0, y: -7 }
const hybridPreviewIconTransformOrigin = { x: 0, y: 2.5 }
const hybridPreviewIconProximityGap = 2

function hybridPreviewIconPosition(
  position: PicodashPanelHybridDockPosition,
  rect: PanelRect,
  snapProximity: number,
) {
  const edgeInset = snapProximity + hybridPreviewIconProximityGap
  const tip = {
    x: position.endsWith('left') ? rect.left + edgeInset : rect.right - edgeInset,
    y: position.startsWith('top')
      ? rect.top + edgeInset
      : position.startsWith('bottom')
        ? rect.bottom - edgeInset
        : rect.top + rect.height / 2,
  }
  const radians = (hybridPreviewIconRotation(position) * Math.PI) / 180
  const tipOffset = {
    x:
      hybridPreviewIconTransformOrigin.x +
      (hybridPreviewIconTip.x - hybridPreviewIconTransformOrigin.x) * Math.cos(radians) -
      (hybridPreviewIconTip.y - hybridPreviewIconTransformOrigin.y) * Math.sin(radians),
    y:
      hybridPreviewIconTransformOrigin.y +
      (hybridPreviewIconTip.x - hybridPreviewIconTransformOrigin.x) * Math.sin(radians) +
      (hybridPreviewIconTip.y - hybridPreviewIconTransformOrigin.y) * Math.cos(radians),
  }
  return {
    x: tip.x - tipOffset.x,
    y: tip.y - tipOffset.y,
  }
}

function nearestEquivalentRotation(current: number, target: number) {
  const delta = ((((target - current) % 360) + 540) % 360) - 180
  return current + delta
}

function panelRectsAlmostEqual(left: PanelRect | null, right: PanelRect) {
  return (
    left !== null &&
    Math.abs(left.left - right.left) < 0.5 &&
    Math.abs(left.top - right.top) < 0.5 &&
    Math.abs(left.width - right.width) < 0.5 &&
    Math.abs(left.height - right.height) < 0.5
  )
}

function insetPanelRect(rect: PanelRect, inset: number): PanelRect {
  const left = rect.left + inset
  const top = rect.top + inset
  const right = Math.max(left, rect.right - inset)
  const bottom = Math.max(top, rect.bottom - inset)
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  }
}

function useResolvedPanelBoundary(
  boundary: PicodashPanelProps['boundary'],
  providerBoundary: Parameters<typeof resolvePicodashPanelBoundary>[1],
) {
  const [resolvedBoundary, setResolvedBoundary] = useState<Element | null>(() =>
    resolvePicodashPanelBoundary(boundary, providerBoundary),
  )
  const resolvedBoundaryRef = useRef(resolvedBoundary)

  useLayoutEffect(() => {
    const synchronize = () => {
      const nextBoundary = resolvePicodashPanelBoundary(boundary, providerBoundary)
      if (resolvedBoundaryRef.current === nextBoundary) return
      resolvedBoundaryRef.current = nextBoundary
      setResolvedBoundary(nextBoundary)
    }
    synchronize()
    const requestedBoundary = boundary === undefined ? providerBoundary : boundary
    let frame: number | null = null
    let observer: MutationObserver | null = null
    if (requestedBoundary && 'current' in requestedBoundary) {
      let remainingPollFrames = 60
      const pollUnresolvedBoundary = () => {
        frame = null
        synchronize()
        remainingPollFrames -= 1
        if (requestedBoundary.current === null && remainingPollFrames > 0) {
          frame = requestAnimationFrame(pollUnresolvedBoundary)
        }
      }
      const ensureUnresolvedBoundaryPolling = (pollFrames: number) => {
        remainingPollFrames = Math.max(remainingPollFrames, pollFrames)
        if (requestedBoundary.current === null && frame === null) {
          frame = requestAnimationFrame(pollUnresolvedBoundary)
        }
      }
      observer = new MutationObserver(() => {
        synchronize()
        ensureUnresolvedBoundaryPolling(1)
      })
      observer.observe(document.documentElement, { childList: true, subtree: true })
      ensureUnresolvedBoundaryPolling(60)
    }
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [boundary, providerBoundary])

  return resolvedBoundary
}

function synchronizeConstraintAxis(
  positionElement: HTMLElement,
  computedStyle: CSSStyleDeclaration,
  start: 'left' | 'top',
  end: 'bottom' | 'right',
) {
  const startValue = computedStyle[start]
  const endValue = computedStyle[end]
  if (startValue === 'auto' && endValue === 'auto') {
    positionElement.style.removeProperty(start)
    positionElement.style.removeProperty(end)
    return
  }
  positionElement.style[start] = startValue
  positionElement.style[end] = endValue
}

const fixedPanelEdgeClassNames = {
  'bottom-left': 'rounded-bl-none',
  'bottom-right': 'rounded-br-none',
  'full-left': 'rounded-l-none',
  'full-right': 'rounded-r-none',
  'middle-left': 'rounded-l-none',
  'middle-right': 'rounded-r-none',
  'top-left': 'rounded-tl-none',
  'top-right': 'rounded-tr-none',
} as const

type PanelShellDragProps = Pick<
  PicodashPanelProps,
  | '_dragX'
  | '_dragY'
  | 'dragDirectionLock'
  | 'dragPropagation'
  | 'dragSnapToOrigin'
  | 'dragTransition'
  | 'onDirectionLock'
  | 'onDragTransitionEnd'
  | 'onMeasureDragConstraints'
  | 'whileDrag'
>

export function panelShouldRenderHeader({
  actionMenu,
  close,
  collapsible,
  fixedPlacement,
  title,
}: {
  actionMenu: PicodashPanelProps['actionMenu']
  close: PicodashPanelProps['close']
  collapsible: boolean
  fixedPlacement: boolean
  title: PicodashPanelProps['title']
}) {
  return Boolean(title || close || actionMenu !== false || (fixedPlacement && collapsible))
}

export function panelShellDragProps(
  fixedPlacement: boolean,
  dragProps: PanelShellDragProps,
): PanelShellDragProps {
  return fixedPlacement ? {} : dragProps
}
