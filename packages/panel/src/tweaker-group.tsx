import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { Reorder, useDragControls, type HTMLMotionProps } from 'motion/react'
import { useMemo, useRef, type ReactNode } from 'react'
import {
  dataAttributesForStates,
  useResolvedPanelProp,
  type ReactiveProp,
} from './tweaker-control.js'
import {
  TweakerGroupContextProvider,
  TweakerReorderList,
  useRegisterTweakerItem,
  useTweakerGroupContext,
  useOrderedTweakerChildren,
  useTweakerPanelSelector,
  useTweakerPanelStoreApi,
  type TweakerControlStates,
  type TweakerGroupContextValue,
  type TweakerPlacement,
  type TweakerStatus,
} from './tweaker-panel.js'
import { buttonVariants } from './ui.js'
import { cn } from './utils.js'

export interface TweakerGroupProps extends Omit<
  HTMLMotionProps<'section'>,
  'children' | 'id' | 'layout' | 'title' | 'value'
> {
  children?: ReactNode
  collapsible?: ReactiveProp<boolean>
  defaultCollapsed?: boolean
  id: string
  label?: ReactiveProp<ReactNode>
  placement?: ReactiveProp<TweakerPlacement>
  reorderable?: ReactiveProp<boolean>
  states?: ReactiveProp<TweakerControlStates>
  status?: ReactiveProp<TweakerStatus | undefined>
  visible?: ReactiveProp<boolean>
}

const emptyStates: TweakerControlStates = {}
const reorderTransition: HTMLMotionProps<'section'>['transition'] = {
  layout: { duration: 0.14, ease: 'easeOut' },
}

export function TweakerGroup({
  children,
  className,
  collapsible: collapsibleProp,
  defaultCollapsed = false,
  id,
  label: labelProp,
  onBlurCapture,
  onFocusCapture,
  onPointerCancelCapture,
  onPointerDownCapture,
  onPointerEnter,
  onPointerLeave,
  onPointerUpCapture,
  placement: placementProp,
  reorderable: reorderableProp,
  states: statesProp,
  status: statusProp,
  visible: visibleProp,
  ...props
}: TweakerGroupProps) {
  const store = useTweakerPanelStoreApi()
  const { commitPendingOrder, parentId } = useTweakerGroupContext()
  const childListRef = useRef<HTMLDivElement | null>(null)
  const dragControls = useDragControls()
  const orderedChildren = useOrderedTweakerChildren(store, children, id)
  const interaction = useTweakerPanelSelector((state) => state.interaction)
  const collapsed = useTweakerPanelSelector(
    (state) => state.collapsedGroups[id] ?? defaultCollapsed,
  )
  const label = useResolvedPanelProp(labelProp, id)
  const collapsible = useResolvedPanelProp(collapsibleProp, true) ?? true
  const placement = useResolvedPanelProp(placementProp, 'auto') ?? 'auto'
  const reorderable = useResolvedPanelProp(reorderableProp, true) ?? true
  const states = useResolvedPanelProp(statesProp, emptyStates) ?? emptyStates
  const status = useResolvedPanelProp(statusProp)
  const visible = useResolvedPanelProp(visibleProp, true) ?? true
  const labelText = typeof label === 'string' ? label : id
  const active = Object.keys(interaction.activeIds).some((activeId) => activeId.endsWith(`:${id}`))
  const groupContext = useMemo<TweakerGroupContextValue>(
    () => ({ commitPendingOrder: () => {}, listRef: childListRef, parentId: id }),
    [id],
  )

  useRegisterTweakerItem({
    hidden: !visible,
    id,
    kind: 'group',
    label: labelText,
    parentId,
    placement,
    reorderable,
  })

  if (!visible) return null

  const stateAttributes = dataAttributesForStates(states)

  return (
    <Reorder.Item<string, 'section'>
      {...props}
      {...stateAttributes}
      as="section"
      className={cn(
        'group/tweaker-section select-none rounded-md border border-border/80 bg-secondary/30 transition-colors data-[dragging=true]:z-10 data-[dragging=true]:border-ring data-[focused=true]:border-ring/60 data-[hovered=true]:bg-secondary/55 data-[status=alert]:border-l-orange-400/80 data-[status=alert]:bg-orange-500/10 data-[status=error]:border-l-red-400/80 data-[status=error]:bg-red-500/10 data-[status=info]:border-l-sky-400/80 data-[status=info]:bg-sky-500/10 data-[status=warning]:border-l-amber-400/80 data-[status=warning]:bg-amber-500/10',
        status && 'border-l-2',
        className,
      )}
      data-active={active ? 'true' : 'false'}
      data-collapsed={collapsed ? 'true' : 'false'}
      data-dragging={interaction.draggingId === id ? 'true' : 'false'}
      data-focused={interaction.focusedId === id ? 'true' : 'false'}
      data-group-id={id}
      data-hovered={interaction.hoveredId === id ? 'true' : 'false'}
      data-item-kind="group"
      data-order-band={placement}
      data-parent-id={parentId}
      data-placement={placement}
      data-reorderable={reorderable ? 'true' : 'false'}
      data-status={status}
      dragControls={dragControls}
      dragListener={false}
      style={props.style}
      transition={props.transition ?? reorderTransition}
      value={id}
      onDragEnd={(event, info) => {
        commitPendingOrder()
        store.getState().setDraggingItem(null)
        props.onDragEnd?.(event, info)
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          store.getState().setFocusedItem(null)
        }
        onBlurCapture?.(event)
      }}
      onFocusCapture={(event) => {
        store.getState().setFocusedItem(id)
        onFocusCapture?.(event)
      }}
      onPointerCancelCapture={(event) => {
        store.getState().setInteractionActive(`pointer:${id}`, false)
        onPointerCancelCapture?.(event)
      }}
      onPointerDownCapture={(event) => {
        store.getState().setInteractionActive(`pointer:${id}`, true)
        onPointerDownCapture?.(event)
      }}
      onPointerEnter={(event) => {
        store.getState().setHoveredItem(id)
        onPointerEnter?.(event)
      }}
      onPointerLeave={(event) => {
        store.getState().setHoveredItem(null)
        store.getState().setInteractionActive(`pointer:${id}`, false)
        onPointerLeave?.(event)
      }}
      onPointerUpCapture={(event) => {
        store.getState().setInteractionActive(`pointer:${id}`, false)
        onPointerUpCapture?.(event)
      }}
    >
      <div className="flex min-h-9 items-center gap-1.5 px-2 py-1.5">
        <button
          aria-disabled={!reorderable}
          aria-label={`Reorder ${labelText}`}
          className={cn(
            buttonVariants({ size: 'icon', variant: 'ghost' }),
            'size-6 shrink-0 cursor-grab text-muted-foreground opacity-70 active:cursor-grabbing aria-disabled:cursor-default aria-disabled:opacity-30',
          )}
          type="button"
          onPointerCancel={() => {
            store.getState().setDraggingItem(null)
          }}
          onPointerDown={(event) => {
            if (!reorderable) return
            store.getState().setDraggingItem(id)
            dragControls.start(event)
          }}
          onPointerUp={() => {
            store.getState().setDraggingItem(null)
          }}
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
        <button
          aria-expanded={!collapsed}
          className={cn(
            buttonVariants({ size: 'sm', variant: 'ghost' }),
            'min-w-0 flex-1 justify-start px-1.5 text-xs text-muted-foreground',
            !collapsible && 'pointer-events-none',
          )}
          type="button"
          onClick={() => {
            if (collapsible) {
              store.getState().setGroupCollapsed(id, !collapsed)
            }
          }}
        >
          {collapsible ? (
            collapsed ? (
              <ChevronRight className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )
          ) : null}
          <span className="truncate">{label}</span>
        </button>
      </div>

      <TweakerGroupContextProvider value={groupContext}>
        <TweakerReorderList
          ref={childListRef}
          className="flex flex-col gap-1 px-1.5 pb-1.5"
          hidden={collapsed}
          parentId={id}
        >
          {orderedChildren}
        </TweakerReorderList>
      </TweakerGroupContextProvider>
    </Reorder.Item>
  )
}
