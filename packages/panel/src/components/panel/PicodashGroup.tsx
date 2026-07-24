import { ChevronRight } from 'lucide-react'
import { Reorder, useReducedMotion, useTransform, type HTMLMotionProps } from 'motion/react'
import { useMemo, useRef, type ReactNode } from 'react'
import {
  dataAttributesForStates,
  useResolvedPanelProp,
  type ReactiveProp,
  type PicodashItemStates,
} from './PicodashItem.js'
import {
  PicodashReorderList,
  useRegisterPicodashItem,
  usePicodashPanelSelector,
  usePicodashPanelStoreApi,
  type PicodashPin,
  type PicodashStatus,
} from './PicodashPanel.js'
import {
  disabledReorderItemLayout,
  reducedMotionReorderTransition,
  reorderDragTransition,
  reorderTopWithOffset,
  reorderTransition,
  usePicodashReorderItem,
} from './reorder/PicodashReorderItem.js'
import { rootGroupId } from '../../state/order/picodash-order.js'
import { PicodashReorderIndicator } from './reorder/PicodashReorderIndicator.js'
import { picodashMotionTokens } from '../../lib/theme/theme.js'
import { buttonVariants } from '../ui/button.js'
import { cn } from '../../utilities/utils.js'

export interface PicodashGroupProps extends Omit<
  HTMLMotionProps<'section'>,
  'children' | 'id' | 'layout' | 'title' | 'value'
> {
  children?: ReactNode
  collapsible?: ReactiveProp<boolean>
  defaultCollapsed?: boolean
  id: string
  label?: ReactiveProp<ReactNode>
  pin?: ReactiveProp<PicodashPin | undefined>
  reorderable?: ReactiveProp<boolean>
  states?: ReactiveProp<PicodashItemStates>
  status?: ReactiveProp<PicodashStatus | undefined>
  visible?: ReactiveProp<boolean>
}

const emptyStates: PicodashItemStates = {}

export function PicodashGroup({
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
  pin: pinProp,
  reorderable: reorderableProp,
  states: statesProp,
  status: statusProp,
  transformTemplate: transformTemplateProp,
  visible: visibleProp,
  ...props
}: PicodashGroupProps) {
  const store = usePicodashPanelStoreApi()
  const childListRef = useRef<HTMLDivElement | null>(null)
  const interaction = usePicodashPanelSelector((state) => state.interaction)
  const collapsed = usePicodashPanelSelector(
    (state) => state.collapsedGroups[id] ?? defaultCollapsed,
  )
  const label = useResolvedPanelProp(labelProp, id)
  const collapsible = useResolvedPanelProp(collapsibleProp, true) ?? true
  const pin = useResolvedPanelProp(pinProp)
  const configuredReorderable = useResolvedPanelProp(reorderableProp, true) ?? true
  const states = useResolvedPanelProp(statesProp, emptyStates) ?? emptyStates
  const status = useResolvedPanelProp(statusProp)
  const visible = useResolvedPanelProp(visibleProp, true) ?? true
  const labelText = typeof label === 'string' ? label : id
  const active = Object.keys(interaction.activeIds).some((activeId) => activeId.endsWith(`:${id}`))
  const prefersReducedMotion = useReducedMotion()
  const {
    beginReorder,
    cancelReorder,
    commitReorder,
    dragConstraintsRef,
    dragControls,
    handleReorderKeyDown,
    keyboardAnnouncement,
    keyboardReorderActive,
    parentId,
    reorderable,
    visualDragOffsetY,
  } = usePicodashReorderItem(id, configuredReorderable, pin)
  const transformTemplate = useMemo<NonNullable<HTMLMotionProps<'section'>['transformTemplate']>>(
    () => (latest) => (transformTemplateProp ? transformTemplateProp(latest, '') : 'none'),
    [transformTemplateProp],
  )
  const visualTop = useTransform(() =>
    reorderTopWithOffset(props.style?.top, visualDragOffsetY.get()),
  )
  const showReorderSlot = reorderable || keyboardReorderActive || parentId !== rootGroupId

  useRegisterPicodashItem({
    collapsible,
    defaultCollapsed,
    hidden: !visible,
    id,
    kind: 'group',
    label: labelText,
    parentId,
    pin,
    reorderable: configuredReorderable,
  })

  if (!visible) return null

  const stateAttributes = dataAttributesForStates(states)

  return (
    <Reorder.Item<string, 'section'>
      {...props}
      {...stateAttributes}
      as="section"
      className={cn(
        'group/picodash-section rounded-picodash-control border-picodash-border/80 data-[dragging=true]:border-picodash-focus data-[dragging=true]:shadow-picodash-panel data-[focused=true]:border-picodash-focus/60 data-[hovered=true]:border-l-picodash-surface-muted/80 data-[status=alert]:bg-picodash-alert-subtle data-[status=error]:bg-picodash-danger-subtle data-[status=info]:bg-picodash-info-subtle data-[status=warning]:bg-picodash-warning-subtle relative isolate col-span-full shrink-0 border border-l-2 border-l-transparent bg-(--_picodash-color-well) transition-[background-color,border-color,box-shadow,backdrop-filter] duration-(--picodash-duration-fast) select-none data-[dragging=true]:z-(--picodash-layer-drag)! data-[dragging=true]:bg-(--_picodash-group-drag) data-[dragging=true]:backdrop-blur-(--picodash-blur-surface) data-[status=alert]:border-l-(--_picodash-color-alert-border) data-[status=error]:border-l-(--_picodash-color-danger-border) data-[status=info]:border-l-(--_picodash-color-info-border) data-[status=warning]:border-l-(--_picodash-color-warning-border)',
        className,
      )}
      data-active={active ? 'true' : 'false'}
      data-collapsed={collapsed ? 'true' : 'false'}
      data-dragging={interaction.draggingId === id ? 'true' : 'false'}
      data-focused={interaction.focusedId === id ? 'true' : 'false'}
      data-group-id={id}
      data-hovered={interaction.hoveredId === id ? 'true' : 'false'}
      data-item-id={id}
      data-item-kind="group"
      data-order-band={pin ?? 'auto'}
      data-parent-id={parentId}
      data-pin={pin}
      data-reorderable={reorderable ? 'true' : 'false'}
      data-status={status}
      dragConstraints={dragConstraintsRef}
      dragControls={dragControls}
      dragElastic={picodashMotionTokens.dragElastic}
      dragListener={false}
      dragTransition={props.dragTransition ?? reorderDragTransition}
      layout={disabledReorderItemLayout}
      style={{ ...props.style, top: visualTop }}
      transformTemplate={transformTemplate}
      transition={
        prefersReducedMotion
          ? reducedMotionReorderTransition
          : (props.transition ?? reorderTransition)
      }
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
        className={cn(
          'group-data-[hovered=true]/picodash-section:bg-picodash-surface-muted/80 rounded-t-picodash-control group-data-[collapsed=true]/picodash-section:rounded-b-picodash-control flex min-h-(--picodash-control-height-md) items-center gap-0 py-(--picodash-space-1) pr-(--picodash-space-1-5) transition-colors duration-(--picodash-duration-fast)',
          !showReorderSlot && 'pl-(--picodash-space-1-5)',
        )}
        onPointerEnter={() => store.getState().setHoveredItem(id)}
      >
        {showReorderSlot ? (
          <button
            aria-description="Press Space or Enter to pick up. Use Arrow Up and Arrow Down to move. Press Space or Enter to drop, or Escape to cancel."
            aria-disabled={!reorderable}
            aria-keyshortcuts="Space Enter ArrowUp ArrowDown Escape"
            aria-label={`Reorder ${labelText}`}
            aria-pressed={keyboardReorderActive}
            className={cn(
              buttonVariants({ size: 'icon', variant: 'ghost' }),
              'text-picodash-muted size-(--picodash-control-height-xs) shrink-0 cursor-grab opacity-(--picodash-opacity-muted) active:cursor-grabbing aria-disabled:cursor-default aria-disabled:opacity-100',
            )}
            type="button"
            onKeyDown={(event) => handleReorderKeyDown(event, labelText)}
            onPointerCancel={cancelReorder}
            onPointerDown={beginReorder}
          >
            <PicodashReorderIndicator reorderable={reorderable} />
          </button>
        ) : null}
        {keyboardAnnouncement ? (
          <span
            className="sr-only"
            aria-live="polite"
            aria-atomic="true"
            data-keyboard-reorder-status
          >
            {keyboardAnnouncement}
          </span>
        ) : null}
        <button
          aria-expanded={!collapsed}
          className={cn(
            buttonVariants({ size: 'sm', variant: 'ghost' }),
            'text-picodash-muted min-w-0 flex-1 justify-start pr-(--picodash-space-1) pl-0 text-(length:--picodash-font-size-lg) aria-expanded:bg-transparent',
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
                'size-(--picodash-icon-sm) transition-transform duration-(--picodash-duration-fast) ease-(--picodash-ease-out) motion-reduce:transition-none',
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
          'grid transition-[grid-template-rows] duration-(--picodash-duration-fast) ease-(--picodash-ease-out) motion-reduce:transition-none',
          collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
        data-picodash-group-disclosure=""
        inert={collapsed}
      >
        <div className="min-h-0 overflow-hidden">
          <PicodashReorderList
            ref={childListRef}
            className="ml-(--_picodash-nested-inset) pb-(--picodash-space-0-5)"
            parentId={id}
          >
            {children}
          </PicodashReorderList>
        </div>
      </div>
    </Reorder.Item>
  )
}
