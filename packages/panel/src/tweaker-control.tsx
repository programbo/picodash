import { Info, RotateCcw } from 'lucide-react'
import { Reorder, useReducedMotion, useTransform, type HTMLMotionProps } from 'motion/react'
import { createContext, useCallback, useContext, useId, useMemo, type ReactNode } from 'react'
import { Button, Label, buttonVariants } from './ui.js'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip.js'
import {
  useRegisterTweakerItem,
  useTweakerPanelSelector,
  useTweakerPanelState,
  useTweakerPanelStoreApi,
  type TweakerControlStates,
  type TweakerPanelState,
  type TweakerPlacement,
  type TweakerStatus,
  type TweakerValue,
} from './tweaker-panel.js'
import {
  disabledReorderItemLayout,
  reducedMotionReorderTransition,
  reorderDragTransition,
  reorderTopWithOffset,
  reorderTransition,
  useTweakerReorderItem,
} from './tweaker-reorder-item.js'
import { TweakerReorderIndicator } from './tweaker-reorder-indicator.js'
import { tweakerMotionTokens } from './theme.js'
import { cn, toDataValue, toKebabCase } from './utils.js'

export type ReactiveProp<T> = T | ((state: TweakerPanelState) => T)
export type TweakerControlContentLayout = 'inline' | 'block' | 'full'

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
  contentLayout?: TweakerControlContentLayout
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

export function TweakerControl<TValue extends TweakerValue = TweakerValue>({
  children,
  className,
  controlClassName,
  contentLayout = 'inline',
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
  transformTemplate: transformTemplateProp,
  visible: visibleProp,
  ...props
}: TweakerControlProps<TValue>) {
  const reactId = useId()
  const controlId = id ?? field ?? `tweaker-control-${reactId.replaceAll(':', '')}`
  const inputId = `${controlId}:input`
  const labelId = `${controlId}:label`
  const descriptionId = `${controlId}:description`
  const store = useTweakerPanelStoreApi()
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
  const prefersReducedMotion = useReducedMotion()
  const {
    beginReorder,
    cancelReorder,
    commitReorder,
    dragConstraintsRef,
    dragControls,
    parentId,
    visualDragOffsetY,
  } = useTweakerReorderItem(controlId, reorderable)
  const transformTemplate = useMemo<NonNullable<HTMLMotionProps<'div'>['transformTemplate']>>(
    () => (latest) => (transformTemplateProp ? transformTemplateProp(latest, '') : 'none'),
    [transformTemplateProp],
  )
  const visualTop = useTransform(() =>
    reorderTopWithOffset(props.style?.top, visualDragOffsetY.get()),
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
          'group/control relative isolate col-span-full grid min-h-(--tweaker-row-min-height) shrink-0 grid-cols-subgrid items-start gap-x-(--tweaker-space-1) gap-y-(--tweaker-space-0-5) select-none rounded-(--tweaker-row-radius) border border-l-2 border-transparent bg-transparent py-(--tweaker-space-1) pr-(--tweaker-space-1-5) text-tweaker-text outline-none transition-[background-color,border-color,box-shadow,backdrop-filter] duration-(--tweaker-duration-fast) data-[dragging=true]:z-(--tweaker-layer-drag)! data-[dragging=true]:border-tweaker-focus data-[dragging=true]:bg-(--tweaker-row-drag) data-[dragging=true]:shadow-tweaker-panel data-[dragging=true]:backdrop-blur-(--tweaker-blur-surface) data-[focused=true]:border-tweaker-focus/60 data-[hovered=true]:bg-(--tweaker-row-hover) data-[status=alert]:border-l-(--tweaker-color-alert-border) data-[status=alert]:bg-tweaker-alert-subtle data-[status=error]:border-l-(--tweaker-color-danger-border) data-[status=error]:bg-tweaker-danger-subtle data-[status=info]:border-l-(--tweaker-color-info-border) data-[status=info]:bg-tweaker-info-subtle data-[status=warning]:border-l-(--tweaker-color-warning-border) data-[status=warning]:bg-tweaker-warning-subtle',
          className,
        )}
        data-active={active ? 'true' : 'false'}
        data-control-id={controlId}
        data-content-layout={contentLayout}
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
        dragElastic={tweakerMotionTokens.dragElastic}
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
        value={controlId}
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
        <span
          className="group-data-[hovered=true]/tweaker-section:bg-tweaker-surface-muted/80 pointer-events-none absolute inset-y-(--tweaker-control-hover-rail-inset-block) left-(--tweaker-control-hover-rail-left) z-0 w-(--tweaker-control-hover-rail-width) transition-colors duration-(--tweaker-duration-fast)"
          aria-hidden="true"
        />
        <button
          aria-disabled={!reorderable}
          aria-label={labelText ? `Reorder ${labelText}` : 'Reorder control'}
          className={cn(
            buttonVariants({ size: 'icon', variant: 'ghost' }),
            'relative z-10 col-start-1 size-(--tweaker-chrome-button-size) shrink-0 cursor-grab self-center text-tweaker-muted opacity-(--tweaker-opacity-muted) active:cursor-grabbing aria-disabled:cursor-default aria-disabled:opacity-100',
          )}
          type="button"
          onPointerCancel={cancelReorder}
          onPointerDown={beginReorder}
        >
          <TweakerReorderIndicator reorderable={reorderable} />
        </button>

        <div className="col-start-2 flex min-w-0 items-center gap-1 self-center">
          {label ? (
            <Label
              className={cn(
                'min-w-0 truncate text-tweaker-muted',
                disabledOrReadOnly && 'opacity-(--tweaker-opacity-muted)',
              )}
              htmlFor={field ? inputId : undefined}
              id={labelId}
            >
              {label}
            </Label>
          ) : null}
          {help ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={labelText ? `Help for ${labelText}` : 'Control help'}
                  className="text-tweaker-muted hover:text-tweaker-text focus-visible:ring-tweaker-focus inline-flex size-(--tweaker-chrome-action-size) shrink-0 items-center justify-center rounded-(--tweaker-button-radius) text-(length:--tweaker-font-size-xl) leading-(--tweaker-line-normal) transition-colors duration-(--tweaker-duration-fast) outline-none focus-visible:ring-2"
                  type="button"
                >
                  <Info className="size-(--tweaker-chrome-icon-small-size)" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{help}</TooltipContent>
            </Tooltip>
          ) : null}
          {field ? (
            fieldState?.dirty ? (
              <Button
                aria-label={labelText ? `Reset ${labelText}` : 'Reset control'}
                className="size-(--tweaker-chrome-action-size)"
                disabled={disabled || readOnly}
                size="icon"
                variant="ghost"
                onClick={resetValue}
              >
                <RotateCcw className="size-(--tweaker-chrome-icon-small-size)" aria-hidden="true" />
              </Button>
            ) : (
              <span className="size-(--tweaker-chrome-action-size) shrink-0" aria-hidden="true" />
            )
          ) : null}
        </div>

        <div
          className={cn(
            'grid min-w-0 grid-cols-subgrid self-center',
            contentLayout === 'inline' && 'col-span-2 col-start-3',
            contentLayout === 'block' && 'col-span-3 col-start-2 row-start-2',
            contentLayout === 'full' && 'col-span-4 col-start-1 row-start-2',
            controlClassName,
          )}
        >
          {typeof children === 'function' ? children(controlContext) : children}
        </div>

        {description ? (
          <div
            id={descriptionId}
            className={cn(
              'text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) font-(--tweaker-font-light) text-tweaker-muted',
              contentLayout === 'inline' && 'col-span-2 col-start-3 row-start-2',
              contentLayout === 'block' && 'col-span-3 col-start-2 row-start-3',
              contentLayout === 'full' && 'col-span-4 col-start-1 row-start-3',
            )}
          >
            {description}
          </div>
        ) : null}
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
  return typeof value === 'function' ? (value as (state: TweakerPanelState) => T)(state) : value
}

export function dataAttributesForStates(states: TweakerControlStates) {
  const attributes: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(states)) {
    const attributeName = `data-state-${toKebabCase(key)}`
    attributes[attributeName] = toDataValue(value)
  }
  return attributes
}
