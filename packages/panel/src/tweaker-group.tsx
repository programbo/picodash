import { ChevronRight } from 'lucide-react'
import { Reorder, useTransform, type HTMLMotionProps } from 'motion/react'
import { useMemo, useRef, type ReactNode } from 'react'
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
  type TweakerControlStates,
  type TweakerPlacement,
  type TweakerStatus,
} from './tweaker-panel.js'
import {
  disabledReorderItemLayout,
  reorderDragTransition,
  reorderTopWithOffset,
  reorderTransition,
  useTweakerReorderItem,
} from './tweaker-reorder-item.js'
import { TweakerReorderIndicator } from './tweaker-reorder-indicator.js'
import { tweakerMotionTokens } from './theme.js'
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
  const transformTemplate = useMemo<NonNullable<HTMLMotionProps<'section'>['transformTemplate']>>(
    () => (latest) => (transformTemplateProp ? transformTemplateProp(latest, '') : 'none'),
    [transformTemplateProp],
  )
  const {
    beginReorder,
    cancelReorder,
    commitReorder,
    dragConstraintsRef,
    dragControls,
    parentId,
    visualDragOffsetY,
  } = useTweakerReorderItem(id, reorderable)
  const visualTop = useTransform(() =>
    reorderTopWithOffset(props.style?.top, visualDragOffsetY.get()),
  )

  useRegisterTweakerItem({
    collapsible,
    defaultCollapsed,
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
        'group/tweaker-section relative isolate col-span-full shrink-0 select-none rounded-(--tweaker-row-radius) border border-l-2 border-tweaker-border/80 border-l-transparent bg-(--tweaker-group-background) transition-[background-color,border-color,box-shadow,backdrop-filter] duration-(--tweaker-duration-fast) data-[dragging=true]:z-(--tweaker-layer-drag)! data-[dragging=true]:border-tweaker-focus data-[dragging=true]:bg-(--tweaker-group-drag) data-[dragging=true]:shadow-tweaker-panel data-[dragging=true]:backdrop-blur-(--tweaker-blur-surface) data-[focused=true]:border-tweaker-focus/60 data-[status=alert]:border-l-(--tweaker-color-alert-border) data-[status=alert]:bg-tweaker-alert-subtle data-[status=error]:border-l-(--tweaker-color-danger-border) data-[status=error]:bg-tweaker-danger-subtle data-[status=info]:border-l-(--tweaker-color-info-border) data-[status=info]:bg-tweaker-info-subtle data-[status=warning]:border-l-(--tweaker-color-warning-border) data-[status=warning]:bg-tweaker-warning-subtle',
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
      dragElastic={tweakerMotionTokens.dragElastic}
      dragListener={false}
      dragTransition={props.dragTransition ?? reorderDragTransition}
      layout={disabledReorderItemLayout}
      style={{ ...props.style, top: visualTop }}
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
      <div
        className="group-data-[hovered=true]/tweaker-section:bg-tweaker-surface-muted/80 flex min-h-(--tweaker-group-header-min-height) items-center gap-0 rounded-t-(--tweaker-row-radius) py-(--tweaker-space-1) pr-(--tweaker-space-1-5) transition-colors duration-(--tweaker-duration-fast) group-data-[collapsed=true]/tweaker-section:rounded-b-(--tweaker-row-radius)"
        onPointerEnter={() => store.getState().setHoveredItem(id)}
      >
        <button
          aria-disabled={!reorderable}
          aria-label={`Reorder ${labelText}`}
          className={cn(
            buttonVariants({ size: 'icon', variant: 'ghost' }),
            'size-(--tweaker-chrome-button-size) shrink-0 cursor-grab text-tweaker-muted opacity-(--tweaker-opacity-muted) active:cursor-grabbing aria-disabled:cursor-default aria-disabled:opacity-100',
          )}
          type="button"
          onPointerCancel={cancelReorder}
          onPointerDown={beginReorder}
        >
          <TweakerReorderIndicator reorderable={reorderable} />
        </button>
        <button
          aria-expanded={!collapsed}
          className={cn(
            buttonVariants({ size: 'sm', variant: 'ghost' }),
            'min-w-0 flex-1 justify-start pr-(--tweaker-space-1) pl-0 text-(length:--tweaker-font-size-lg) text-tweaker-muted',
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
                'size-(--tweaker-chrome-icon-size) transition-transform duration-(--tweaker-duration-fast) ease-(--tweaker-ease-out) motion-reduce:transition-none',
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
          'grid transition-[grid-template-rows] duration-(--tweaker-duration-fast) ease-(--tweaker-ease-out) motion-reduce:transition-none',
          collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
        data-tweaker-group-disclosure=""
        inert={collapsed}
      >
        <div className="min-h-0 overflow-hidden">
          <TweakerReorderList
            ref={childListRef}
            className="ml-(--tweaker-group-child-inset-inline) pb-(--tweaker-group-child-padding-bottom)"
            parentId={id}
          >
            {children}
          </TweakerReorderList>
        </div>
      </div>
    </Reorder.Item>
  )
}
