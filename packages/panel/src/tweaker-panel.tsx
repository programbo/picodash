import { motion, useDragControls, useMotionValue } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from 'zustand'
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
import { TweakerPanelActions } from './tweaker-panel-actions.js'
import { createTweakerPanelStore } from './tweaker-panel-store.js'
import { rootGroupId } from './tweaker-order.js'
import { TweakerReorderList } from './tweaker-reorder-list.js'
import { TooltipProvider } from './tooltip.js'
import { tweakerDefaultTheme } from './theme.js'
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
  useTweakerReorderTransformTemplate,
} from './tweaker-panel-context.js'
export { TweakerGroupContextProvider, useTweakerGroupContext } from './tweaker-group-context.js'
export {
  bandForItem,
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
  TweakerPlacement,
  TweakerPanelProps,
  TweakerPanelState,
  TweakerPanelStore,
  TweakerReorderItemLayout,
  TweakerStatus,
  TweakerValue,
} from './tweaker-panel-types.js'

export function TweakerPanel({
  children,
  className,
  collapsible = false,
  defaultCollapsed = false,
  defaultValues,
  drag = true,
  dragElastic = false,
  dragMomentum = false,
  id,
  initialMeta,
  onFocusCapture,
  onPointerDownCapture,
  style,
  title,
  ...props
}: TweakerPanelProps) {
  const reactId = useId()
  const panelId = id ?? `tweaker-panel-${reactId.replaceAll(':', '')}`
  const { containerElement, store } = useTweakerProviderContext()
  const panelDragControls = useDragControls()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const panelElementRef = useRef<HTMLElement | null>(null)
  const panelStoreRef = useRef<TweakerPanelStore | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    baseRect: PanelRect
    containerRect: PanelRect
    dock: PanelDock | null
    peerRects: PanelRect[]
    startPosition: PanelPosition
  } | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  if (!panelStoreRef.current) {
    panelStoreRef.current = createTweakerPanelStore({ defaultValues, initialMeta, panelId })
  }

  const panelStore = panelStoreRef.current
  const panelCollapsed = collapsible && collapsed
  const titleText = typeof title === 'string' ? title : 'panel'
  const zIndex = useStore(store, (state) => panelZIndexForState(state, panelId))
  const updatePanelRect = usePanelLayoutSynchronization({
    containerElement,
    panelElementRef,
    panelId,
    store,
    x,
    y,
  })
  useRegisterTweakerPanel({ id: panelId })

  if (!containerElement) return null

  return createPortal(
    <TweakerPanelContextProvider store={panelStore}>
      <motion.aside
        {...props}
        id={id}
        data-tweaker-panel
        data-collapsed={panelCollapsed ? 'true' : 'false'}
        data-tweaker-theme={tweakerDefaultTheme}
        data-tweaker-panel-id={panelId}
        ref={panelElementRef}
        className={cn(
          'pointer-events-auto absolute top-(--tweaker-panel-inset) right-(--tweaker-panel-inset) flex min-h-0 max-h-(--tweaker-panel-max-height) w-(--tweaker-panel-width) flex-col overflow-hidden rounded-(--tweaker-panel-radius) border border-(--tweaker-panel-border) bg-(--tweaker-panel-background) text-(--tweaker-panel-foreground) shadow-tweaker-panel ring-1 ring-(--tweaker-panel-ring)',
          className,
        )}
        drag={drag}
        dragControls={panelDragControls}
        dragElastic={dragElastic}
        dragListener={false}
        dragMomentum={dragMomentum}
        style={{ ...style, x, y, zIndex }}
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
          x.set(snapped.position.x)
          y.set(snapped.position.y)
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
            store.getState().setPanelLayout(panelId, {
              dock,
              x: Math.round(baseRect.left + displayedPosition.x),
              y: Math.round(baseRect.top + displayedPosition.y),
            })
          }
          updatePanelRect()
          props.onDragEnd?.(event, info)
        }}
        onDragStart={(event, info) => {
          const panelElement = panelElementRef.current
          if (panelElement) {
            const displayedPosition = { x: x.get(), y: y.get() }
            dragStateRef.current = {
              baseRect: baseRectFromDisplayedRect(rectFromElement(panelElement), displayedPosition),
              containerRect: rectFromElement(containerElement),
              dock: null,
              peerRects: Object.entries(store.getState().panelRects)
                .filter(([peerPanelId]) => peerPanelId !== panelId)
                .map(([, rect]) => rect),
              startPosition: displayedPosition,
            }
          }

          store.getState().activatePanel(panelId)
          props.onDragStart?.(event, info)
        }}
        onFocusCapture={(event) => {
          store.getState().activatePanel(panelId)
          onFocusCapture?.(event)
        }}
        onPointerDownCapture={(event) => {
          store.getState().activatePanel(panelId)
          onPointerDownCapture?.(event)
        }}
      >
        {title ? (
          <div
            className="border-tweaker-border flex h-(--tweaker-panel-header-height) shrink-0 cursor-grab items-center gap-(--tweaker-space-1) border-b py-(--tweaker-space-2) pr-(--tweaker-space-3) pl-(--tweaker-space-1) select-none active:cursor-grabbing"
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
                  'size-(--tweaker-chrome-action-size) shrink-0 text-tweaker-muted',
                )}
                type="button"
                onClick={() => setCollapsed((current) => !current)}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <ChevronRight
                  className={cn(
                    'size-(--tweaker-chrome-icon-size) transition-transform duration-(--tweaker-duration-fast) ease-(--tweaker-ease-out) motion-reduce:transition-none',
                    !panelCollapsed && 'rotate-90',
                  )}
                  aria-hidden="true"
                />
              </button>
            ) : null}
            <h2 className="min-w-0 flex-1 truncate text-(length:--tweaker-panel-title-size) font-(--tweaker-font-semibold) tracking-(--tweaker-tracking-normal)">
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
      </motion.aside>
    </TweakerPanelContextProvider>,
    containerElement,
  )
}
