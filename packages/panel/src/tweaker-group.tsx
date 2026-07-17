import { ChevronRight, GripVertical } from 'lucide-react'
import { Reorder, type HTMLMotionProps } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import {
  dataAttributesForStates,
  useResolvedPanelProp,
  type ReactiveProp,
} from './tweaker-control.js'
import {
  TweakerReorderList,
  useRegisterTweakerItem,
  useTweakerPanelSelector,
  useTweakerPanelStoreApi,
  useTweakerReorderTransformTemplate,
  type TweakerControlStates,
  type TweakerPlacement,
  type TweakerStatus,
} from './tweaker-panel.js'
import {
  reorderDragTransition,
  reorderTransition,
  useTweakerReorderItem,
} from './tweaker-reorder-item.js'
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
  transformTemplate: transformTemplateProp,
  visible: visibleProp,
  ...props
}: TweakerGroupProps) {
  const store = useTweakerPanelStoreApi()
  const childListRef = useRef<HTMLDivElement | null>(null)
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
  const transformTemplate = useTweakerReorderTransformTemplate(store, transformTemplateProp)
  const { beginReorder, cancelReorder, commitReorder, dragConstraintsRef, dragControls, parentId } =
    useTweakerReorderItem(id, reorderable)

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

  // Read drag state inside a stable template so Motion can expose sibling projection
  // synchronously, while idle disclosure changes remain owned by the grid transition.
  return (
    <Reorder.Item<string, 'section'>
      {...props}
      {...stateAttributes}
      as="section"
      className={cn(
        'group/tweaker-section col-span-full shrink-0 select-none rounded-md border border-l-2 border-border/80 border-l-transparent bg-secondary/30 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-150 data-[dragging=true]:z-10 data-[dragging=true]:border-ring data-[dragging=true]:bg-secondary/80 data-[dragging=true]:shadow-2xl data-[dragging=true]:shadow-black/35 data-[dragging=true]:backdrop-blur-md data-[focused=true]:border-ring/60 data-[status=alert]:border-l-orange-400/80 data-[status=alert]:bg-orange-500/10 data-[status=error]:border-l-red-400/80 data-[status=error]:bg-red-500/10 data-[status=info]:border-l-sky-400/80 data-[status=info]:bg-sky-500/10 data-[status=warning]:border-l-amber-400/80 data-[status=warning]:bg-amber-500/10',
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
      dragConstraints={dragConstraintsRef}
      dragControls={dragControls}
      dragElastic={0.01}
      dragListener={false}
      dragTransition={props.dragTransition ?? reorderDragTransition}
      layout
      style={props.style}
      transformTemplate={transformTemplate}
      transition={props.transition ?? reorderTransition}
      value={id}
      onDrag={props.onDrag}
      onDragEnd={(event, info) => {
        commitReorder()
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
      <div className="group-data-[hovered=true]/tweaker-section:bg-accent/80 flex min-h-8 items-center gap-0 rounded-t-sm py-1 pr-1.5 transition-colors duration-150 group-data-[collapsed=true]/tweaker-section:rounded-b-sm">
        <button
          aria-disabled={!reorderable}
          aria-label={`Reorder ${labelText}`}
          className={cn(
            buttonVariants({ size: 'icon', variant: 'ghost' }),
            'size-6 shrink-0 cursor-grab text-muted-foreground opacity-70 active:cursor-grabbing aria-disabled:cursor-default aria-disabled:opacity-30',
          )}
          type="button"
          onPointerCancel={cancelReorder}
          onPointerDown={beginReorder}
          onPointerUp={cancelReorder}
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
        <button
          aria-expanded={!collapsed}
          className={cn(
            buttonVariants({ size: 'sm', variant: 'ghost' }),
            'min-w-0 flex-1 justify-start pr-1 pl-0 text-xs text-muted-foreground',
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
            <ChevronRight
              className={cn(
                'size-3.5 transition-transform duration-150 ease-out motion-reduce:transition-none',
                !collapsed && 'rotate-90',
              )}
              aria-hidden="true"
            />
          ) : null}
          <span className="truncate">{label}</span>
        </button>
      </div>

      <div
        aria-hidden={collapsed}
        className={cn(
          'grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none',
          collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
        inert={collapsed}
      >
        <div className="min-h-0 overflow-hidden">
          <TweakerReorderList ref={childListRef} className="-ml-0.5 pb-1" parentId={id}>
            {children}
          </TweakerReorderList>
        </div>
      </div>
    </Reorder.Item>
  )
}
