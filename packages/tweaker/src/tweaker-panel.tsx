import {
  motion,
  useDragControls,
  useMotionValue,
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
import { panelParticipatesInSnapping, rectWithHeight } from './panel-geometry.js'
import {
  baseRectFromDisplayedRect,
  normalizeTweakerPanelPlacement,
  rectForPanelBoundary,
  rectFromElement,
  resolveTweakerPanelBoundary,
  snapPanelPosition,
  type PanelDock,
  type PanelPosition,
  type PanelRect,
} from './panel-snapping.js'
import {
  panelZIndexForState,
  useRegisterTweakerPanel,
  useTweakerProviderContext,
} from './tweaker-provider.js'
import { TweakerPanelContextProvider } from './tweaker-panel-context.js'
import { TweakerPanelActions, TweakerPanelConstraintRepairDialog } from './tweaker-panel-actions.js'
import { createTweakerPanelStore } from './tweaker-panel-store.js'
import { rootGroupId } from './tweaker-order.js'
import { TweakerReorderList } from './tweaker-reorder-list.js'
import { TweakerThemeContextProvider, useResolvedTweakerTheme } from './tweaker-theme-context.js'
import { TooltipProvider } from './tooltip.js'
import { buttonVariants } from './components/ui/button.js'
import { usePanelLayoutSynchronization } from './use-panel-layout.js'
import { cn } from './utils.js'
import type {
  TweakerPanelCloseBehavior,
  TweakerPanelCloseDetails,
  TweakerPanelFixedPosition,
  TweakerPanelPlacement,
  TweakerPanelProps,
  TweakerPanelStore,
} from './tweaker-panel-types.js'

export { createTweakerPanelStore } from './tweaker-panel-store.js'
export {
  useRegisterTweakerItem,
  useTweakerPanelSelector,
  useTweakerPanelStoreApi,
  useTweakerPanelStoreSelector,
} from './tweaker-panel-context.js'
export {
  bandForItem,
  hasVisibleReorderableSibling,
  itemCanReorder,
  orderedItemIdsForParent,
  orderedItemsForParent,
  orderIndexForItem,
  reorderValuesForPointer,
  useOrderedTweakerChildren,
} from './tweaker-order.js'
export { TweakerReorderList } from './tweaker-reorder-list.js'
export type {
  TweakerControlStates,
  TweakerControlStateValue,
  TweakerFieldState,
  TweakerGroupContextValue,
  TweakerInteractionState,
  TweakerItemKind,
  TweakerItemRegistration,
  TweakerPin,
  TweakerPanelCloseBehavior,
  TweakerPanelCloseDetails,
  TweakerPanelCloseOptions,
  TweakerPanelBoundary,
  TweakerPanelCorner,
  TweakerPanelDefaultPlacement,
  TweakerPanelFixedPosition,
  TweakerPanelPlacement,
  TweakerPanelProps,
  TweakerPanelSnapPosition,
  TweakerPanelState,
  TweakerPanelStore,
  TweakerReorderItemLayout,
  TweakerReorderItemMotion,
  TweakerStatus,
  TweakerValue,
} from './tweaker-panel-types.js'

export function TweakerPanel({
  _dragX,
  _dragY,
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
}: TweakerPanelProps) {
  const { panelBoundary, portalContainer, store: providerStore } = useTweakerProviderContext()
  const theme = useResolvedTweakerTheme(themeProp)
  const panelId = injectedPanelStore?.getState().panelId ?? id
  if (panelId === undefined) {
    throw new Error('TweakerPanel requires either an id or an application-owned store.')
  }
  const panelDragControls = useDragControls()
  const reducedMotion = useReducedMotion()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [deregistered, setDeregistered] = useState(false)
  const defaultVisibleRef = useRef(defaultVisible)
  const pendingDeregisterCloseRef = useRef<TweakerPanelCloseDetails | null>(null)
  const panelElementRef = useRef<HTMLElement | null>(null)
  const positionElementRef = useRef<HTMLDivElement | null>(null)
  const fixedToggleRef = useRef<HTMLButtonElement | null>(null)
  const panelStoreRef = useRef<TweakerPanelStore | null>(injectedPanelStore ?? null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    baseRect: PanelRect
    containerRect: PanelRect
    dock: PanelDock | null
    intrinsicHeight: number
    peerRects: PanelRect[]
    startPosition: PanelPosition
  } | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const normalizedDefaultPlacement = useMemo(
    () => normalizeTweakerPanelPlacement(defaultPlacement),
    [defaultPlacement],
  )
  const resolvedBoundary = useResolvedPanelBoundary(boundary, panelBoundary)

  if (!panelStoreRef.current) {
    panelStoreRef.current = createTweakerPanelStore({ initialMeta, initialValues, panelId })
  }

  const panelStore = panelStoreRef.current
  if (injectedPanelStore && panelStore !== injectedPanelStore) {
    throw new Error('TweakerPanel store cannot be changed after the panel mounts.')
  }
  const panelCollapsed = collapsible && collapsed
  const titleText = typeof title === 'string' ? title : 'panel'
  const callerMaxHeight = style?.maxHeight
  const zIndex = useStore(providerStore, (state) => panelZIndexForState(state, panelId))
  const placement = useStore(
    providerStore,
    (state) => state.panels[panelId]?.placement ?? normalizedDefaultPlacement,
  )
  const fixedPlacement = placement.mode === 'fixed'
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
  const closeBehavior: TweakerPanelCloseBehavior =
    typeof close === 'object' ? close.behavior : 'hide'
  const { applyProjection, measureIntrinsicHeight, scheduleSynchronization, updatePanelRect } =
    usePanelLayoutSynchronization({
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
  useRegisterTweakerPanel({
    boundary: resolvedBoundary,
    defaultPlacement,
    id: panelId,
    visible: defaultVisibleRef.current,
  })

  useLayoutEffect(() => {
    if (fixedPlacement) return

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
  }, [className, fixedPlacement, scheduleSynchronization, style])

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
      fixedPlacement &&
      nextCollapsed &&
      panelElementRef.current?.contains(document.activeElement)
    ) {
      requestAnimationFrame(() => fixedToggleRef.current?.focus())
    }
    setCollapsed(nextCollapsed)
  }

  const handleDrag: NonNullable<TweakerPanelProps['onDrag']> = (event, info) => {
    const dragState = dragStateRef.current
    if (!dragState) {
      props.onDrag?.(event, info)
      return
    }

    const snapped = snapPanelPosition({
      baseRect: dragState.baseRect,
      containerRect: dragState.containerRect,
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
      intrinsicHeight: dragState.intrinsicHeight,
      position: snapped.position,
    })
    dragState.dock = snapped.dock
    panelElementRef.current?.toggleAttribute(
      'data-tweaker-panel-snapping',
      snapped.snappedX || snapped.snappedY,
    )
    updatePanelRect()
    props.onDrag?.(event, info)
  }

  const handleDragEnd: NonNullable<TweakerPanelProps['onDragEnd']> = (event, info) => {
    const dock = dragStateRef.current?.dock ?? null
    dragStateRef.current = null
    panelElementRef.current?.removeAttribute('data-tweaker-panel-snapping')

    const panelElement = panelElementRef.current
    const displayedPosition = { x: Math.round(x.get()), y: Math.round(y.get()) }
    x.set(displayedPosition.x)
    y.set(displayedPosition.y)

    if (panelElement) {
      const baseRect = baseRectFromDisplayedRect(rectFromElement(panelElement), displayedPosition)
      providerStore.getState().setPanelLayout(panelId, {
        dock,
        x: Math.round(baseRect.left + displayedPosition.x),
        y: Math.round(baseRect.top + displayedPosition.y),
      })
    }
    updatePanelRect()
    scheduleSynchronization()
    props.onDragEnd?.(event, info)
  }

  const handleDragStart: NonNullable<TweakerPanelProps['onDragStart']> = (event, info) => {
    const panelElement = panelElementRef.current
    if (panelElement) {
      const displayedPosition = { x: x.get(), y: y.get() }
      const intrinsicHeight = measureIntrinsicHeight()
      dragStateRef.current = {
        baseRect: rectWithHeight(
          baseRectFromDisplayedRect(rectFromElement(panelElement), displayedPosition),
          intrinsicHeight,
        ),
        containerRect: rectForPanelBoundary(resolvedBoundary),
        dock: null,
        intrinsicHeight,
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
    <TweakerThemeContextProvider theme={theme}>
      <TweakerPanelContextProvider store={panelStore}>
        <motion.div
          {...shellDragProps}
          data-tweaker-panel-shell=""
          data-fixed-placement={fixedPlacement ? placement.position : undefined}
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
              ...(fixedPlacement
                ? undefined
                : {
                    bottom: style?.bottom,
                    left: style?.left,
                    position: style?.position,
                    right: style?.right,
                    top: style?.top,
                  }),
              '--tweaker-panel-width': typeof width === 'number' ? `${width}px` : width,
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
            } as MotionStyle & { '--tweaker-panel-width'?: string }
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
              fixedPlacement
                ? panelCollapsed
                  ? fixedCollapsedTransform(placement.position)
                  : { x: '0%', y: '0%' }
                : props.animate
            }
            aria-hidden={fixedPlacement && panelCollapsed ? true : undefined}
            className={cn(
              'pointer-events-auto relative flex min-h-0 max-h-[calc(100dvh-1rem)] w-(--tweaker-panel-width) max-w-[calc(100dvw-2rem)] flex-col overflow-hidden rounded-tweaker-surface border border-tweaker-border bg-tweaker-surface text-tweaker-text shadow-tweaker-panel ring-1 ring-(--_tweaker-panel-ring)',
              fixedPlacement && fixedPanelEdgeClassNames[placement.position],
              className,
            )}
            data-collapsed={panelCollapsed ? 'true' : 'false'}
            data-tweaker-panel
            data-tweaker-panel-id={panelId}
            data-tweaker-theme={theme}
            data-visible={visible ? 'true' : 'false'}
            hidden={!visible}
            id={panelId}
            inert={fixedPlacement && panelCollapsed}
            onAnimationComplete={(definition) => {
              updatePanelRect()
              props.onAnimationComplete?.(definition)
            }}
            ref={panelElementRef}
            style={
              {
                ...style,
                '--tweaker-panel-width': typeof width === 'number' ? `${width}px` : width,
                position: 'static',
                zIndex,
              } as MotionStyle & { '--tweaker-panel-width'?: string }
            }
            transition={
              fixedPlacement
                ? {
                    duration: reducedMotion ? 0 : 0.2,
                    ease: [0.16, 1, 0.3, 1],
                  }
                : props.transition
            }
          >
            {title || close || (fixedPlacement && collapsible) ? (
              <div
                className={cn(
                  'border-tweaker-border flex h-[2.3125rem] shrink-0 items-center gap-(--tweaker-space-1) border-b py-(--tweaker-space-2) pr-(--tweaker-space-3) select-none',
                  !fixedPlacement && 'cursor-grab active:cursor-grabbing',
                  collapsible && !fixedPlacement
                    ? 'pl-(--tweaker-space-1)'
                    : 'pl-(--tweaker-space-3)',
                  fixedPlacement &&
                    fixedPositionUsesLeftEdge(placement.position) &&
                    'pr-(--tweaker-control-height-md)',
                  fixedPlacement &&
                    !fixedPositionUsesLeftEdge(placement.position) &&
                    'pl-(--tweaker-control-height-md)',
                )}
                data-tweaker-panel-header=""
                onPointerDown={(event) => {
                  if (!fixedPlacement && drag) {
                    event.preventDefault()
                    window.getSelection()?.removeAllRanges()
                    panelDragControls.start(event)
                  }
                }}
              >
                {collapsible && !fixedPlacement ? (
                  <button
                    aria-expanded={!panelCollapsed}
                    aria-label={`${panelCollapsed ? 'Expand' : 'Collapse'} panel ${titleText}`}
                    className={cn(
                      buttonVariants({ size: 'icon', variant: 'ghost' }),
                      'size-(--tweaker-icon-lg) shrink-0 text-tweaker-muted',
                    )}
                    type="button"
                    onClick={() => togglePanelCollapsed()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <ChevronRight
                      className={cn(
                        'size-(--tweaker-icon-sm) transition-transform duration-(--tweaker-duration-fast) ease-(--tweaker-ease-out) motion-reduce:transition-none',
                        !panelCollapsed && 'rotate-90',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                ) : null}
                {title ? (
                  <h2 className="min-w-0 flex-1 truncate text-(length:--tweaker-font-size-xl) font-(--tweaker-font-semibold) tracking-(--tweaker-tracking-normal)">
                    {title}
                  </h2>
                ) : (
                  <span className="min-w-0 flex-1" />
                )}
                <TweakerPanelActions panelId={panelId} panelTitle={titleText} />
                {close ? (
                  <button
                    aria-label={`Close panel ${titleText}`}
                    className={cn(
                      buttonVariants({ size: 'icon', variant: 'ghost' }),
                      'size-(--tweaker-icon-lg) shrink-0 text-tweaker-muted',
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
                    <X className="size-(--tweaker-icon-sm)" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}
            <div
              aria-hidden={!fixedPlacement && panelCollapsed}
              className={cn(
                'grid min-h-0 flex-1 transition-[grid-template-rows] duration-(--tweaker-duration-fast) ease-(--tweaker-ease-out) motion-reduce:transition-none',
                !fixedPlacement && panelCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
              )}
              inert={!fixedPlacement && panelCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                <TooltipProvider>
                  <TweakerReorderList
                    ref={bodyRef}
                    className="h-full min-h-0 overflow-auto"
                    fixedPlacement={fixedPlacement}
                    parentId={rootGroupId}
                  >
                    {children}
                  </TweakerReorderList>
                </TooltipProvider>
              </div>
            </div>
            <TweakerPanelConstraintRepairDialog panelTitle={titleText} />
          </motion.aside>
          {fixedPlacement && collapsible ? (
            <FixedPanelToggle
              collapsed={panelCollapsed}
              panelId={panelId}
              panelTitle={titleText}
              position={placement.position}
              reducedMotion={reducedMotion ?? false}
              ref={fixedToggleRef}
              onToggle={togglePanelCollapsed}
            />
          ) : null}
        </motion.div>
      </TweakerPanelContextProvider>
    </TweakerThemeContextProvider>,
    portalContainer,
  )
}

function FixedPanelToggle({
  collapsed,
  onToggle,
  panelId,
  panelTitle,
  position,
  reducedMotion,
  ref,
}: {
  collapsed: boolean
  onToggle: () => void
  panelId: string
  panelTitle: string
  position: TweakerPanelFixedPosition
  reducedMotion: boolean
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
        'pointer-events-auto absolute z-10 size-(--tweaker-control-height-md) shrink-0 text-tweaker-muted',
        'transition-[background-color,color] motion-reduce:transition-none',
        fixedTogglePositionClassName(position, collapsed),
      )}
      data-tweaker-fixed-toggle=""
      layout="position"
      ref={ref}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      type="button"
      onClick={onToggle}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Icon className="size-(--tweaker-icon-md)" aria-hidden="true" />
    </motion.button>
  )
}

function fixedToggleIcon(position: TweakerPanelFixedPosition, collapsed: boolean): LucideIcon {
  if (position === 'bottom-left') return collapsed ? ArrowUpRight : ArrowDownLeft
  if (position === 'bottom-right') return collapsed ? ArrowUpLeft : ArrowDownRight
  if (fixedPositionUsesLeftEdge(position)) return collapsed ? ArrowRight : ArrowLeft
  return collapsed ? ArrowLeft : ArrowRight
}

function fixedTogglePositionClassName(position: TweakerPanelFixedPosition, collapsed: boolean) {
  if (!collapsed) {
    return fixedPositionUsesLeftEdge(position)
      ? 'top-[0.1875rem] right-[0.1875rem]'
      : 'top-[0.1875rem] left-[0.1875rem]'
  }
  if (position === 'bottom-left') return 'bottom-0 left-0'
  if (position === 'bottom-right') return 'right-0 bottom-0'
  return fixedPositionUsesLeftEdge(position) ? 'top-0 left-0' : 'top-0 right-0'
}

function fixedPositionUsesLeftEdge(position: TweakerPanelFixedPosition) {
  return position === 'left' || position.endsWith('-left')
}

function fixedCollapsedTransform(position: TweakerPanelFixedPosition) {
  if (position === 'bottom-left') return { x: '-100%', y: '100%' }
  if (position === 'bottom-right') return { x: '100%', y: '100%' }
  return fixedPositionUsesLeftEdge(position) ? { x: '-100%', y: '0%' } : { x: '100%', y: '0%' }
}

function placementShellClassName(placement: TweakerPanelPlacement) {
  if (placement.mode === 'fixed') return 'top-0 left-0'
  const position = placement.position ?? 'top-right'
  return panelPlacementClassNames[position]
}

function useResolvedPanelBoundary(
  boundary: TweakerPanelProps['boundary'],
  providerBoundary: Parameters<typeof resolveTweakerPanelBoundary>[1],
) {
  const [resolvedBoundary, setResolvedBoundary] = useState<Element | null>(() =>
    resolveTweakerPanelBoundary(boundary, providerBoundary),
  )
  const resolvedBoundaryRef = useRef(resolvedBoundary)

  useLayoutEffect(() => {
    const synchronize = () => {
      const nextBoundary = resolveTweakerPanelBoundary(boundary, providerBoundary)
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
  'bottom-left': 'rounded-bl-none',
  'bottom-right': 'rounded-br-none',
  'top-left': 'rounded-tl-none',
  'top-right': 'rounded-tr-none',
  left: 'rounded-l-none',
  right: 'rounded-r-none',
} as const

type PanelShellDragProps = Pick<
  TweakerPanelProps,
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

export function panelShellDragProps(
  fixedPlacement: boolean,
  dragProps: PanelShellDragProps,
): PanelShellDragProps {
  return fixedPlacement ? {} : dragProps
}
