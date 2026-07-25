import {
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  type MotionStyle,
} from 'motion/react'
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  ChevronRight,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from 'zustand'
import { panelParticipatesInSnapping, rectWithHeight } from '../../geometry/panel-geometry.js'
import {
  baseRectFromDisplayedRect,
  dockForSnapPosition,
  isPanelPlacementEdgeAttached,
  normalizePicodashPanelPlacement,
  rectForPanelBoundary,
  rectFromElement,
  resolvePicodashPanelBoundary,
  SNAP_GAP,
  snapPanelPosition,
  snapPositionForDock,
  type PanelDock,
  type PanelDockEdge,
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
import type {
  PicodashPanelCloseBehavior,
  PicodashPanelCloseDetails,
  PicodashPanelPlacement,
  PicodashPanelProps,
  PicodashPanelSnapPosition,
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
  PicodashPanelFixedPosition,
  PicodashPanelPlacement,
  PicodashPanelProps,
  PicodashPanelSnapPosition,
  PicodashPanelState,
  PicodashPanelStore,
  PicodashReorderItemLayout,
  PicodashReorderItemMotion,
  PicodashStatus,
  PicodashValue,
} from '../../state/panel/picodash-panel-types.js'

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
  defaultPlacement = 'top-right',
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
  const [dragMagneticPosition, setDragMagneticPosition] = useState<
    PicodashPanelSnapPosition | null | undefined
  >(undefined)
  const defaultVisibleRef = useRef(defaultVisible)
  const pendingDeregisterCloseRef = useRef<PicodashPanelCloseDetails | null>(null)
  const panelElementRef = useRef<HTMLElement | null>(null)
  const positionElementRef = useRef<HTMLDivElement | null>(null)
  const fixedToggleRef = useRef<HTMLButtonElement | null>(null)
  const panelStoreRef = useRef<PicodashPanelStore | null>(injectedPanelStore ?? null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const dragMagneticPositionRef = useRef<PicodashPanelSnapPosition | null | undefined>(undefined)
  const dragStateRef = useRef<{
    baseRect: PanelRect
    containerRect: PanelRect
    dock: PanelDock | null
    intrinsicHeight: number
    lastRect: PanelRect
    offset: PanelPosition
    peerRects: PanelRect[]
    placement: PicodashPanelPlacement
    startPosition: PanelPosition
  } | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const normalizedDefaultPlacement = useMemo(
    () => normalizePicodashPanelPlacement(defaultPlacement),
    [defaultPlacement],
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
    placement.mode === 'magnetic' && dragMagneticPosition !== undefined
      ? {
          mode: 'magnetic',
          ...(dragMagneticPosition ? { position: dragMagneticPosition } : {}),
        }
      : placement
  const fixedPlacement = placement.mode === 'fixed'
  const layoutEdgePlacement = isPanelPlacementEdgeAttached(placement)
  const edgePlacement = isPanelPlacementEdgeAttached(visualPlacement)
  const shellDragProps = panelShellDragProps(fixedPlacement, {
    _dragX,
    _dragY,
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
    enabled: visible && !deregistered,
    panelElementRef,
    panelId,
    placement,
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
    if (dragMagneticPosition === undefined) return
    const dragState = dragStateRef.current
    synchronizePlacementGeometry(
      {
        mode: 'magnetic',
        ...(dragMagneticPosition ? { position: dragMagneticPosition } : {}),
      },
      dragState?.placement.mode === 'magnetic' ? dragState.baseRect : undefined,
    )
    if (dragMagneticPosition !== null) return
    const panelElement = panelElementRef.current
    if (!dragState || !panelElement || dragState.placement.mode !== 'magnetic') return
    const displayedPosition = { x: x.get(), y: y.get() }
    const intrinsicHeight = measureIntrinsicHeight()
    dragState.baseRect = rectWithHeight(
      baseRectFromDisplayedRect(rectFromElement(panelElement), displayedPosition),
      intrinsicHeight,
    )
    dragState.intrinsicHeight = intrinsicHeight
    dragState.startPosition = {
      x: displayedPosition.x - dragState.offset.x,
      y: displayedPosition.y - dragState.offset.y,
    }
  }, [dragMagneticPosition, measureIntrinsicHeight, synchronizePlacementGeometry, x, y])

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
  }, [className, layoutEdgePlacement, scheduleSynchronization, style])

  useEffect(() => {
    const details = pendingDeregisterCloseRef.current
    if (!deregistered || !details) return

    pendingDeregisterCloseRef.current = null
    onClose?.(details)
  }, [deregistered, onClose])

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

  const handleDrag: NonNullable<PicodashPanelProps['onDrag']> = (event, info) => {
    const dragState = dragStateRef.current
    if (!dragState) {
      props.onDrag?.(event, info)
      return
    }

    dragState.offset = { x: info.offset.x, y: info.offset.y }
    const snapGap = dragState.placement.mode === 'magnetic' ? 0 : SNAP_GAP
    const snapped = snapPanelPosition({
      baseRect: dragState.baseRect,
      containerRect: dragState.containerRect,
      options: {
        gap: snapGap,
        retainedViewportDocks:
          dragState.placement.mode === 'magnetic'
            ? retainedViewportDocksForDrag(info.delta, dragState.dock)
            : undefined,
        viewportDocks:
          dragState.placement.mode === 'magnetic'
            ? viewportDocksForDrag(info.delta, dragState.dock)
            : undefined,
      },
      peerRects: dragState.peerRects,
      position: {
        x: dragState.startPosition.x + info.offset.x,
        y: dragState.startPosition.y + info.offset.y,
      },
    })
    applyProjection({
      anchor: snapped.dock?.vertical === 'bottom' ? 'bottom' : 'top',
      baseRect: dragState.baseRect,
      containerRect: dragState.containerRect,
      inset: snapGap,
      intrinsicHeight: dragState.intrinsicHeight,
      position: snapped.position,
    })
    dragState.dock = snapped.dock
    if (dragState.placement.mode === 'magnetic') {
      const nextMagneticPosition = snapPositionForDock(snapped.dock)
      const magneticPositionChanged = dragMagneticPositionRef.current !== nextMagneticPosition
      if (magneticPositionChanged) {
        dragMagneticPositionRef.current = nextMagneticPosition
        setDragMagneticPosition(nextMagneticPosition)
      }
      if (nextMagneticPosition) {
        const previousBaseRect = dragState.baseRect
        const synchronizedGeometry = synchronizePlacementGeometry(
          {
            mode: 'magnetic',
            position: nextMagneticPosition,
          },
          dragState.baseRect,
        )
        if (magneticPositionChanged && synchronizedGeometry?.dragBaseRect) {
          dragState.baseRect = synchronizedGeometry.dragBaseRect
          dragState.startPosition = {
            x:
              dragState.startPosition.x -
              (synchronizedGeometry.dragBaseRect.left - previousBaseRect.left),
            y:
              dragState.startPosition.y -
              (synchronizedGeometry.dragBaseRect.top - previousBaseRect.top),
          }
        }
      }
    }
    panelElementRef.current?.toggleAttribute(
      'data-picodash-panel-snapping',
      snapped.snappedX || snapped.snappedY,
    )
    if (dragState.placement.mode === 'magnetic') {
      requestAnimationFrame(() => {
        if (dragStateRef.current === dragState && panelElementRef.current) {
          dragState.lastRect = rectFromElement(panelElementRef.current)
        }
      })
    }
    updatePanelRect()
    props.onDrag?.(event, info)
  }

  const handleDragEnd: NonNullable<PicodashPanelProps['onDragEnd']> = (event, info) => {
    const dragState = dragStateRef.current
    const dock = dragState?.dock ?? null
    const snapPosition = snapPositionForDock(dock)
    const nextPlacement: PicodashPanelPlacement =
      dragState?.placement.mode === 'magnetic'
        ? { mode: 'magnetic', ...(snapPosition ? { position: snapPosition } : {}) }
        : { mode: 'floating' }
    dragStateRef.current = null
    dragMagneticPositionRef.current = undefined
    setDragMagneticPosition(undefined)
    panelElementRef.current?.removeAttribute('data-picodash-panel-snapping')

    const panelElement = panelElementRef.current
    const displayedPosition = { x: Math.round(x.get()), y: Math.round(y.get()) }
    x.set(displayedPosition.x)
    y.set(displayedPosition.y)

    if (panelElement) {
      const displayedRect =
        nextPlacement.mode === 'magnetic' && nextPlacement.position === undefined && dragState
          ? dragState.lastRect
          : rectFromElement(panelElement)
      const baseRect = baseRectFromDisplayedRect(displayedRect, displayedPosition)
      providerStore.getState().setPanelLayout(panelId, {
        dock,
        placement: nextPlacement,
        x: Math.round(baseRect.left + displayedPosition.x),
        y: Math.round(baseRect.top + displayedPosition.y),
      })
    }
    updatePanelRect()
    scheduleSynchronization()
    props.onDragEnd?.(event, info)
  }

  const handleDragStart: NonNullable<PicodashPanelProps['onDragStart']> = (event, info) => {
    const panelElement = panelElementRef.current
    if (panelElement) {
      dragMagneticPositionRef.current =
        placement.mode === 'magnetic' ? (placement.position ?? null) : undefined
      const displayedPosition = { x: x.get(), y: y.get() }
      const intrinsicHeight = measureIntrinsicHeight()
      dragStateRef.current = {
        baseRect: rectWithHeight(
          baseRectFromDisplayedRect(rectFromElement(panelElement), displayedPosition),
          intrinsicHeight,
        ),
        containerRect: rectForPanelBoundary(resolvedBoundary),
        dock:
          placement.mode === 'magnetic' && placement.position
            ? dockForSnapPosition(placement.position)
            : null,
        intrinsicHeight,
        lastRect: rectFromElement(panelElement),
        offset: { x: 0, y: 0 },
        placement,
        peerRects: Object.entries(providerStore.getState().panelRects)
          .filter(
            ([peerPanelId]) =>
              peerPanelId !== panelId &&
              providerStore.getState().panels[peerPanelId]?.boundary === resolvedBoundary,
          )
          .map(([, rect]) => rect),
        startPosition: displayedPosition,
      }
    }

    providerStore.getState().activatePanel(panelId)
    props.onDragStart?.(event, info)
  }

  if (!portalContainer || deregistered) return null

  return createPortal(
    <PicodashThemeContextProvider theme={theme}>
      <PicodashPanelContextProvider store={panelStore}>
        <motion.div
          {...shellDragProps}
          data-picodash-panel-shell=""
          data-fixed-placement={fixedPlacement ? placement.position : undefined}
          data-magnetic-placement={
            visualPlacement.mode === 'magnetic' ? (visualPlacement.position ?? '') : undefined
          }
          className={cn(
            'pointer-events-none absolute h-fit w-fit max-w-[calc(100dvw-2rem)]',
            placementShellClassName(placement),
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
                ? undefined
                : {
                    bottom: style?.bottom,
                    left: style?.left,
                    position: style?.position,
                    right: style?.right,
                    top: style?.top,
                  }),
              '--picodash-panel-width': typeof width === 'number' ? `${width}px` : width,
              backdropFilter: 'none',
              background: 'none',
              border: 0,
              boxShadow: 'none',
              filter: 'none',
              opacity: 1,
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
              edgePlacement
                ? panelCollapsed
                  ? fixedCollapsedTransform(visualPlacement.position)
                  : { x: '0%', y: '0%' }
                : props.animate
            }
            aria-hidden={edgePlacement && panelCollapsed ? true : undefined}
            className={cn(
              'rounded-picodash-surface border-picodash-border bg-picodash-surface text-picodash-text shadow-picodash-panel pointer-events-auto relative flex max-h-[calc(100dvh-1rem)] min-h-0 w-(--picodash-panel-width) max-w-[calc(100dvw-2rem)] flex-col overflow-hidden border ring-1 ring-(--_picodash-panel-ring)',
              edgePlacement && fixedPanelEdgeClassNames[visualPlacement.position],
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
              edgePlacement
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
                  edgePlacement &&
                    fixedPositionUsesLeftEdge(visualPlacement.position) &&
                    'pr-(--picodash-control-height-md)',
                  edgePlacement &&
                    !fixedPositionUsesLeftEdge(visualPlacement.position) &&
                    'pl-(--picodash-control-height-md)',
                )}
                data-picodash-panel-header=""
                onPointerDown={(event) => {
                  if (!fixedPlacement && drag) {
                    event.preventDefault()
                    window.getSelection()?.removeAllRanges()
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
          {edgePlacement && collapsible ? (
            <FixedPanelToggle
              animatePosition={fixedPlacement}
              collapsed={panelCollapsed}
              panelId={panelId}
              panelTitle={titleText}
              position={visualPlacement.position}
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
  position: PicodashPanelSnapPosition
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

function fixedToggleIcon(position: PicodashPanelSnapPosition, collapsed: boolean): LucideIcon {
  if (position === 'top') return collapsed ? ArrowDown : ArrowUp
  if (position === 'bottom') return collapsed ? ArrowUp : ArrowDown
  if (position === 'bottom-left') return collapsed ? ArrowUpRight : ArrowDownLeft
  if (position === 'bottom-right') return collapsed ? ArrowUpLeft : ArrowDownRight
  if (fixedPositionUsesLeftEdge(position)) return collapsed ? ArrowRight : ArrowLeft
  return collapsed ? ArrowLeft : ArrowRight
}

function fixedTogglePositionClassName(position: PicodashPanelSnapPosition, collapsed: boolean) {
  if (!collapsed) {
    return fixedPositionUsesLeftEdge(position)
      ? 'top-[0.1875rem] right-[0.1875rem]'
      : 'top-[0.1875rem] left-[0.1875rem]'
  }
  if (position === 'bottom-left') return 'bottom-0 left-0'
  if (position === 'bottom-right') return 'right-0 bottom-0'
  if (position === 'bottom') return 'bottom-0 left-0'
  return fixedPositionUsesLeftEdge(position) ? 'top-0 left-0' : 'top-0 right-0'
}

function fixedPositionUsesLeftEdge(position: PicodashPanelSnapPosition) {
  return position === 'left' || position.endsWith('-left')
}

function fixedCollapsedTransform(position: PicodashPanelSnapPosition) {
  if (position === 'top') return { x: '0%', y: '-100%' }
  if (position === 'bottom') return { x: '0%', y: '100%' }
  if (position === 'bottom-left') return { x: '-100%', y: '100%' }
  if (position === 'bottom-right') return { x: '100%', y: '100%' }
  return fixedPositionUsesLeftEdge(position) ? { x: '-100%', y: '0%' } : { x: '100%', y: '0%' }
}

function placementShellClassName(placement: PicodashPanelPlacement) {
  if (isPanelPlacementEdgeAttached(placement)) return 'top-0 left-0'
  const position = placement.position ?? 'top-right'
  return panelPlacementClassNames[position]
}

function viewportDocksForDrag(delta: PanelPosition, currentDock: PanelDock | null) {
  const docks: PanelDockEdge[] = []
  if (delta.x < 0) {
    docks.push('left')
  } else if (delta.x > 0) {
    docks.push('right')
  } else if (currentDock?.horizontal) {
    docks.push(currentDock.horizontal)
  }
  if (delta.y < 0) {
    docks.push('top')
  } else if (delta.y > 0) {
    docks.push('bottom')
  } else if (currentDock?.vertical) {
    docks.push(currentDock.vertical)
  }
  return docks
}

function retainedViewportDocksForDrag(delta: PanelPosition, currentDock: PanelDock | null) {
  const docks: PanelDockEdge[] = []
  if (
    (currentDock?.horizontal === 'left' && delta.x <= 0) ||
    (currentDock?.horizontal === 'right' && delta.x >= 0)
  ) {
    docks.push(currentDock.horizontal)
  }
  if (
    (currentDock?.vertical === 'top' && delta.y <= 0) ||
    (currentDock?.vertical === 'bottom' && delta.y >= 0)
  ) {
    docks.push(currentDock.vertical)
  }
  return docks
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

const panelPlacementClassNames = {
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'right-4 bottom-4',
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  top: 'top-2 left-1/2 -translate-x-1/2',
  right: 'top-1/2 right-2 -translate-y-1/2',
  bottom: 'bottom-2 left-1/2 -translate-x-1/2',
  left: 'top-1/2 left-2 -translate-y-1/2',
} as const

const fixedPanelEdgeClassNames = {
  top: 'rounded-t-none',
  bottom: 'rounded-b-none',
  'bottom-left': 'rounded-bl-none',
  'bottom-right': 'rounded-br-none',
  'top-left': 'rounded-tl-none',
  'top-right': 'rounded-tr-none',
  left: 'rounded-l-none',
  right: 'rounded-r-none',
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
