import { motion, useDragControls, useMotionValue, type MotionStyle } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from 'zustand'
import { rectWithHeight } from './panel-geometry.js'
import {
  baseRectFromDisplayedRect,
  rectFromElement,
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
import { buttonVariants } from './ui.js'
import { usePanelLayoutSynchronization } from './use-panel-layout.js'
import { cn } from './utils.js'
import type { TweakerPanelProps, TweakerPanelStore } from './tweaker-panel-types.js'

export { createTweakerPanelStore } from './tweaker-panel-store.js'
export {
  useRegisterTweakerItem,
  useTweakerPanelSelector,
  useTweakerPanelState,
  useTweakerPanelStoreApi,
  useTweakerPanelStoreSelector,
} from './tweaker-panel-context.js'
export { TweakerGroupContextProvider, useTweakerGroupContext } from './tweaker-group-context.js'
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
  TweakerPanelDefaultPlacement,
  TweakerPanelProps,
  TweakerPanelState,
  TweakerPanelStore,
  TweakerReorderItemLayout,
  TweakerReorderItemMotion,
  TweakerStatus,
  TweakerValue,
} from './tweaker-panel-types.js'

export function TweakerPanel({
  children,
  className,
  collapsible = false,
  defaultCollapsed = false,
  defaultPlacement = 'top-right',
  drag = true,
  dragElastic = false,
  dragMomentum = false,
  id,
  initialMeta,
  initialValues,
  onFocusCapture,
  onPointerDownCapture,
  store: injectedPanelStore,
  style,
  theme: themeProp,
  title,
  width,
  ...props
}: TweakerPanelProps) {
  const { portalContainer, store: providerStore } = useTweakerProviderContext()
  const theme = useResolvedTweakerTheme(themeProp)
  const panelId = injectedPanelStore?.getState().panelId ?? id
  if (panelId === undefined) {
    throw new Error('TweakerPanel requires either an id or an application-owned store.')
  }
  const panelDragControls = useDragControls()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const panelElementRef = useRef<HTMLElement | null>(null)
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
  const { applyProjection, measureIntrinsicHeight, scheduleSynchronization, updatePanelRect } =
    usePanelLayoutSynchronization({
      containerElement: portalContainer,
      contentElementRef: bodyRef,
      panelElementRef,
      panelId,
      synchronizationPausedRef: dragStateRef,
      store: providerStore,
      x,
      y,
    })
  useRegisterTweakerPanel({ id: panelId })

  if (!portalContainer) return null

  return createPortal(
    <TweakerThemeContextProvider theme={theme}>
      <TweakerPanelContextProvider store={panelStore}>
        <motion.aside
          {...props}
          id={panelId}
          data-tweaker-panel
          data-collapsed={panelCollapsed ? 'true' : 'false'}
          data-tweaker-theme={theme}
          data-tweaker-panel-id={panelId}
          ref={panelElementRef}
          className={cn(
            'pointer-events-auto absolute flex min-h-0 max-h-[calc(100dvh-1rem)] w-(--tweaker-panel-width) max-w-[calc(100dvw-2rem)] flex-col overflow-hidden rounded-tweaker-surface border border-tweaker-border bg-tweaker-surface text-tweaker-text shadow-tweaker-panel ring-1 ring-(--_tweaker-panel-ring)',
            panelPlacementClassNames[defaultPlacement],
            className,
          )}
          drag={drag}
          dragControls={panelDragControls}
          dragElastic={dragElastic}
          dragListener={false}
          dragMomentum={dragMomentum}
          style={
            {
              ...style,
              ...(callerMaxHeight === undefined || callerMaxHeight === 'none'
                ? {}
                : {
                    '--_tw-panel-caller-max-height':
                      typeof callerMaxHeight === 'number'
                        ? `${callerMaxHeight}px`
                        : callerMaxHeight,
                  }),
              maxHeight:
                'min(var(--_tw-panel-available-height, calc(100dvh - 1rem)), var(--_tw-panel-caller-max-height, 1000000px))',
              '--tweaker-panel-width': typeof width === 'number' ? `${width}px` : width,
              x,
              y,
              zIndex,
            } as MotionStyle & {
              '--_tw-panel-caller-max-height'?: MotionStyle['maxHeight']
              '--tweaker-panel-width'?: string
            }
          }
          onDrag={(event, info) => {
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
          }}
          onDragEnd={(event, info) => {
            const dock = dragStateRef.current?.dock ?? null
            dragStateRef.current = null
            panelElementRef.current?.removeAttribute('data-tweaker-panel-snapping')

            const panelElement = panelElementRef.current
            const displayedPosition = { x: Math.round(x.get()), y: Math.round(y.get()) }
            x.set(displayedPosition.x)
            y.set(displayedPosition.y)

            if (panelElement) {
              const baseRect = baseRectFromDisplayedRect(
                rectFromElement(panelElement),
                displayedPosition,
              )
              providerStore.getState().setPanelLayout(panelId, {
                dock,
                x: Math.round(baseRect.left + displayedPosition.x),
                y: Math.round(baseRect.top + displayedPosition.y),
              })
            }
            updatePanelRect()
            scheduleSynchronization()
            props.onDragEnd?.(event, info)
          }}
          onDragStart={(event, info) => {
            const panelElement = panelElementRef.current
            if (panelElement) {
              const displayedPosition = { x: x.get(), y: y.get() }
              const intrinsicHeight = measureIntrinsicHeight()
              dragStateRef.current = {
                baseRect: rectWithHeight(
                  baseRectFromDisplayedRect(rectFromElement(panelElement), displayedPosition),
                  intrinsicHeight,
                ),
                containerRect: rectFromElement(portalContainer),
                dock: null,
                intrinsicHeight,
                peerRects: Object.entries(providerStore.getState().panelRects)
                  .filter(([peerPanelId]) => peerPanelId !== panelId)
                  .map(([, rect]) => rect),
                startPosition: displayedPosition,
              }
            }

            providerStore.getState().activatePanel(panelId)
            props.onDragStart?.(event, info)
          }}
          onFocusCapture={(event) => {
            providerStore.getState().activatePanel(panelId)
            onFocusCapture?.(event)
          }}
          onPointerDownCapture={(event) => {
            providerStore.getState().activatePanel(panelId)
            onPointerDownCapture?.(event)
          }}
        >
          {title ? (
            <div
              className={cn(
                'border-tweaker-border flex h-[2.3125rem] shrink-0 cursor-grab items-center gap-(--tweaker-space-1) border-b py-(--tweaker-space-2) pr-(--tweaker-space-3) select-none active:cursor-grabbing',
                collapsible ? 'pl-(--tweaker-space-1)' : 'pl-(--tweaker-space-3)',
              )}
              data-tweaker-panel-header=""
              onPointerDown={(event) => {
                if (drag) {
                  event.preventDefault()
                  window.getSelection()?.removeAllRanges()
                  panelDragControls.start(event)
                }
              }}
            >
              {collapsible ? (
                <button
                  aria-expanded={!panelCollapsed}
                  aria-label={`${panelCollapsed ? 'Expand' : 'Collapse'} panel ${titleText}`}
                  className={cn(
                    buttonVariants({ size: 'icon', variant: 'ghost' }),
                    'size-(--tweaker-icon-lg) shrink-0 text-tweaker-muted',
                  )}
                  type="button"
                  onClick={() => setCollapsed((current) => !current)}
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
              <h2 className="min-w-0 flex-1 truncate text-(length:--tweaker-font-size-xl) font-(--tweaker-font-semibold) tracking-(--tweaker-tracking-normal)">
                {title}
              </h2>
              <TweakerPanelActions panelId={panelId} panelTitle={titleText} />
            </div>
          ) : null}
          <div
            aria-hidden={panelCollapsed}
            className={cn(
              'grid min-h-0 flex-1 transition-[grid-template-rows] duration-(--tweaker-duration-fast) ease-(--tweaker-ease-out) motion-reduce:transition-none',
              panelCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
            )}
            inert={panelCollapsed}
          >
            <div className="min-h-0 overflow-hidden">
              <TooltipProvider>
                <TweakerReorderList
                  ref={bodyRef}
                  className="h-full min-h-0 overflow-auto"
                  parentId={rootGroupId}
                >
                  {children}
                </TweakerReorderList>
              </TooltipProvider>
            </div>
          </div>
          <TweakerPanelConstraintRepairDialog panelTitle={titleText} />
        </motion.aside>
      </TweakerPanelContextProvider>
    </TweakerThemeContextProvider>,
    portalContainer,
  )
}

const panelPlacementClassNames = {
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'right-4 bottom-4',
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
} as const
