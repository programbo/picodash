import { GripVertical, Info, RotateCcw } from 'lucide-react'
import { Reorder, useDragControls, type HTMLMotionProps } from 'motion/react'
import { createContext, useCallback, useContext, useId, useMemo, type ReactNode } from 'react'
import { Button, Label, buttonVariants } from './ui.js'
import {
  useRegisterTweakerItem,
  useTweakerGroupContext,
  useTweakerPanelSelector,
  useTweakerPanelState,
  useTweakerPanelStoreApi,
  type TweakerControlStates,
  type TweakerPanelState,
  type TweakerPlacement,
  type TweakerStatus,
  type TweakerValue,
} from './tweaker-panel.js'
import { cn, toDataValue, toKebabCase } from './utils.js'

export type ReactiveProp<T> = T | ((state: TweakerPanelState) => T)

export interface TweakerControlContextValue<TValue extends TweakerValue = TweakerValue> {
  disabled: boolean
  field?: string
  fieldState?: TweakerPanelState['fields'][string]
  id: string
  inputId: string
  readOnly: boolean
  resetValue: () => void
  setValue: (value: TValue) => void
  value: TValue | undefined
}

export interface TweakerControlProps<TValue extends TweakerValue = TweakerValue> extends Omit<
  HTMLMotionProps<'div'>,
  'children' | 'defaultValue' | 'id' | 'layout' | 'value'
> {
  children?: ReactNode | ((control: TweakerControlContextValue<TValue>) => ReactNode)
  controlClassName?: string
  defaultValue?: TValue
  description?: ReactiveProp<ReactNode>
  disabled?: ReactiveProp<boolean>
  field?: string
  help?: ReactiveProp<ReactNode>
  id?: string
  label?: ReactiveProp<ReactNode>
  onValueChange?: (value: TValue, control: TweakerControlContextValue<TValue>) => void
  placement?: ReactiveProp<TweakerPlacement>
  readOnly?: ReactiveProp<boolean>
  reorderable?: ReactiveProp<boolean>
  states?: ReactiveProp<TweakerControlStates>
  status?: ReactiveProp<TweakerStatus | undefined>
  visible?: ReactiveProp<boolean>
}

const emptyStates: TweakerControlStates = {}
const TweakerControlContext = createContext<TweakerControlContextValue | null>(null)
const reorderTransition: HTMLMotionProps<'div'>['transition'] = {
  layout: { type: 'spring', stiffness: 650, damping: 30, mass: 0.55 },
  x: { type: 'spring', stiffness: 650, damping: 30, mass: 0.55 },
  y: { type: 'spring', stiffness: 650, damping: 30, mass: 0.55 },
}
const dragTransition: HTMLMotionProps<'div'>['dragTransition'] = {
  bounceDamping: 28,
  bounceStiffness: 700,
  power: 0.08,
  restDelta: 0.5,
  restSpeed: 12,
  timeConstant: 120,
}

export function TweakerControl<TValue extends TweakerValue = TweakerValue>({
  children,
  className,
  controlClassName,
  defaultValue,
  description: descriptionProp,
  disabled: disabledProp,
  field,
  help: helpProp,
  id,
  label: labelProp,
  onBlurCapture,
  onFocusCapture,
  onPointerCancelCapture,
  onPointerDownCapture,
  onPointerEnter,
  onPointerLeave,
  onPointerUpCapture,
  onValueChange,
  placement: placementProp,
  readOnly: readOnlyProp,
  reorderable: reorderableProp,
  states: statesProp,
  status: statusProp,
  visible: visibleProp,
  ...props
}: TweakerControlProps<TValue>) {
  const reactId = useId()
  const controlId = id ?? field ?? `tweaker-control-${reactId.replaceAll(':', '')}`
  const inputId = `${controlId}:input`
  const labelId = `${controlId}:label`
  const descriptionId = `${controlId}:description`
  const store = useTweakerPanelStoreApi()
  const dragControls = useDragControls()
  const { commitPendingOrder, dragConstraintsRef, parentId } = useTweakerGroupContext()
  const value = useTweakerPanelSelector((state) =>
    field === undefined ? undefined : (state.values[field] as TValue | undefined),
  )
  const fieldState = useTweakerPanelSelector((state) =>
    field === undefined ? undefined : state.fields[field],
  )
  const interaction = useTweakerPanelSelector((state) => state.interaction)
  const label = useResolvedPanelProp(labelProp)
  const description = useResolvedPanelProp(descriptionProp)
  const help = useResolvedPanelProp(helpProp)
  const disabled = useResolvedPanelProp(disabledProp, false) ?? false
  const readOnly = useResolvedPanelProp(readOnlyProp, false) ?? false
  const placement = useResolvedPanelProp(placementProp, 'auto') ?? 'auto'
  const reorderable = useResolvedPanelProp(reorderableProp, true) ?? true
  const states = useResolvedPanelProp(statesProp, emptyStates) ?? emptyStates
  const status = useResolvedPanelProp(statusProp)
  const visible = useResolvedPanelProp(visibleProp, true) ?? true
  const labelText = typeof label === 'string' ? label : undefined
  const active = Object.keys(interaction.activeIds).some((activeId) =>
    activeId.endsWith(`:${controlId}`),
  )

  const resetValue = useCallback(() => {
    if (field !== undefined) {
      store.getState().resetFieldValue(field)
    }
  }, [field, store])

  const setValue = useCallback(
    (nextValue: TValue) => {
      if (disabled || readOnly) return
      if (field !== undefined) {
        store.getState().setFieldValue(field, nextValue)
      }
      onValueChange?.(nextValue, {
        disabled,
        field,
        fieldState,
        id: controlId,
        inputId,
        readOnly,
        resetValue,
        setValue,
        value: nextValue,
      })
    },
    [controlId, disabled, field, fieldState, inputId, onValueChange, readOnly, resetValue, store],
  )

  const controlContext = useMemo<TweakerControlContextValue<TValue>>(
    () => ({
      disabled,
      field,
      fieldState,
      id: controlId,
      inputId,
      readOnly,
      resetValue,
      setValue,
      value,
    }),
    [controlId, disabled, field, fieldState, inputId, readOnly, resetValue, setValue, value],
  )

  useRegisterTweakerItem({
    defaultValue,
    fieldId: field,
    hidden: !visible,
    id: controlId,
    kind: 'control',
    label: labelText,
    parentId,
    placement,
    reorderable,
  })

  if (!visible) return null

  const stateAttributes = dataAttributesForStates(states)
  const disabledOrReadOnly = disabled || readOnly

  return (
    <TweakerControlContext.Provider value={controlContext as unknown as TweakerControlContextValue}>
      <Reorder.Item<string, 'div'>
        {...props}
        {...stateAttributes}
        as="div"
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={label ? labelId : undefined}
        className={cn(
          'group/control relative flex min-h-12 shrink-0 select-none gap-2 rounded-md border border-transparent bg-transparent px-2 py-2 text-foreground outline-none transition-[background-color,border-color,box-shadow,backdrop-filter] duration-150 data-[dragging=true]:z-10 data-[dragging=true]:border-ring data-[dragging=true]:bg-accent/90 data-[dragging=true]:shadow-2xl data-[dragging=true]:shadow-black/35 data-[dragging=true]:backdrop-blur-md data-[focused=true]:border-ring/60 data-[hovered=true]:bg-accent/65 data-[status=alert]:border-l-orange-400/80 data-[status=alert]:bg-orange-500/10 data-[status=error]:border-l-red-400/80 data-[status=error]:bg-red-500/10 data-[status=info]:border-l-sky-400/80 data-[status=info]:bg-sky-500/10 data-[status=warning]:border-l-amber-400/80 data-[status=warning]:bg-amber-500/10',
          status && 'border-l-2',
          className,
        )}
        data-active={active ? 'true' : 'false'}
        data-control-id={controlId}
        data-dirty={fieldState?.dirty ? 'true' : 'false'}
        data-dragging={interaction.draggingId === controlId ? 'true' : 'false'}
        data-focused={interaction.focusedId === controlId ? 'true' : 'false'}
        data-hovered={interaction.hoveredId === controlId ? 'true' : 'false'}
        data-item-kind="control"
        data-order-band={placement}
        data-parent-id={parentId}
        data-placement={placement}
        data-readonly={readOnly ? 'true' : 'false'}
        data-reorderable={reorderable ? 'true' : 'false'}
        data-status={status}
        dragConstraints={dragConstraintsRef}
        dragControls={dragControls}
        dragElastic={0.01}
        dragListener={false}
        dragTransition={props.dragTransition ?? dragTransition}
        layout="position"
        style={props.style}
        transition={props.transition ?? reorderTransition}
        value={controlId}
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
          store.getState().setFocusedItem(controlId)
          onFocusCapture?.(event)
        }}
        onPointerCancelCapture={(event) => {
          store.getState().setInteractionActive(`pointer:${controlId}`, false)
          onPointerCancelCapture?.(event)
        }}
        onPointerDownCapture={(event) => {
          store.getState().setInteractionActive(`pointer:${controlId}`, true)
          onPointerDownCapture?.(event)
        }}
        onPointerEnter={(event) => {
          store.getState().setHoveredItem(controlId)
          onPointerEnter?.(event)
        }}
        onPointerLeave={(event) => {
          store.getState().setHoveredItem(null)
          store.getState().setInteractionActive(`pointer:${controlId}`, false)
          onPointerLeave?.(event)
        }}
        onPointerUpCapture={(event) => {
          store.getState().setInteractionActive(`pointer:${controlId}`, false)
          onPointerUpCapture?.(event)
        }}
      >
        <button
          aria-disabled={!reorderable}
          aria-label={labelText ? `Reorder ${labelText}` : 'Reorder control'}
          className={cn(
            buttonVariants({ size: 'icon', variant: 'ghost' }),
            'mt-0.5 size-6 shrink-0 cursor-grab text-muted-foreground opacity-70 active:cursor-grabbing aria-disabled:cursor-default aria-disabled:opacity-30',
          )}
          type="button"
          onPointerCancel={() => {
            store.getState().setDraggingItem(null)
          }}
          onPointerDown={(event) => {
            if (!reorderable) return
            store.getState().setDraggingItem(controlId)
            dragControls.start(event)
          }}
          onPointerUp={() => {
            store.getState().setDraggingItem(null)
          }}
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>

        <div className={cn('grid min-w-0 flex-1 gap-1.5', controlClassName)}>
          {label || help ? (
            <div className="flex min-w-0 items-center gap-1.5">
              {label ? (
                <Label
                  className={cn(
                    'min-w-0 truncate text-xs text-muted-foreground',
                    disabledOrReadOnly && 'opacity-70',
                  )}
                  htmlFor={field ? inputId : undefined}
                  id={labelId}
                >
                  {label}
                </Label>
              ) : null}
              {help ? (
                <span
                  className="text-muted-foreground inline-flex"
                  title={typeof help === 'string' ? help : undefined}
                >
                  <Info className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">{help}</span>
                </span>
              ) : null}
              {field ? (
                <Button
                  aria-label={labelText ? `Reset ${labelText}` : 'Reset control'}
                  className="ml-auto size-6 opacity-0 transition-opacity group-hover/control:opacity-100 group-data-[dirty=true]/control:opacity-100"
                  disabled={disabled}
                  size="icon"
                  variant="ghost"
                  onClick={resetValue}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="min-w-0">
            {typeof children === 'function' ? children(controlContext) : children}
          </div>

          {description ? (
            <div id={descriptionId} className="text-muted-foreground text-xs leading-5">
              {description}
            </div>
          ) : null}
        </div>
      </Reorder.Item>
    </TweakerControlContext.Provider>
  )
}

export function useTweakerControl<TValue extends TweakerValue = TweakerValue>() {
  const context = useContext(TweakerControlContext)
  if (!context) {
    throw new Error('useTweakerControl must be used inside TweakerControl.')
  }
  return context as unknown as TweakerControlContextValue<TValue>
}

export function useResolvedPanelProp<T>(
  prop: ReactiveProp<T> | undefined,
  fallback?: T,
): T | undefined {
  const state = useTweakerPanelState()
  const value = prop === undefined ? fallback : prop
  if (typeof value === 'function') {
    return (value as (state: TweakerPanelState) => T)(state)
  }
  return value
}

export function dataAttributesForStates(states: TweakerControlStates) {
  const attributes: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(states)) {
    const attributeName = `data-state-${toKebabCase(key)}`
    attributes[attributeName] = toDataValue(value)
  }
  return attributes
}
