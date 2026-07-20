import { Info, RotateCcw } from 'lucide-react'
import { Reorder, useReducedMotion, useTransform, type HTMLMotionProps } from 'motion/react'
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { Button, Label, buttonVariants } from './ui.js'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip.js'
import {
  useRegisterTweakerItem,
  useTweakerPanelSelector,
  useTweakerPanelStoreApi,
  type TweakerControlStates,
  type TweakerPanelState,
  type TweakerPin,
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
import { rootGroupId } from './tweaker-order.js'
import { TweakerReorderIndicator } from './tweaker-reorder-indicator.js'
import { tweakerMotionTokens } from './theme.js'
import type { TweakerParser, TweakerValidator } from './tweaker-validation.js'
import { cn, toDataValue, toKebabCase } from './utils.js'

export type ReactiveProp<T> = T | ((state: TweakerPanelState) => T)
export type TweakerItemContentLayout = 'inline' | 'block' | 'full'
export type TweakerItemStates = TweakerControlStates

export interface TweakerItemContextValue<TValue extends TweakerValue = TweakerValue> {
  disabled: boolean
  errorId: string
  field?: string
  fieldState?: TweakerPanelState['fields'][string]
  id: string
  inputId: string
  readOnly: boolean
  resetValue: () => void
  setInput: (candidate: unknown) => void
  value: TValue | undefined
}

export interface TweakerItemBaseProps<TValue extends TweakerValue> extends Omit<
  HTMLMotionProps<'div'>,
  'children' | 'defaultValue' | 'id' | 'layout' | 'value'
> {
  children?: ReactNode | ((item: TweakerItemContextValue<TValue>) => ReactNode)
  contentClassName?: string
  contentLayout?: TweakerItemContentLayout
  description?: ReactiveProp<ReactNode>
  disabled?: ReactiveProp<boolean>
  help?: ReactiveProp<ReactNode>
  label?: ReactiveProp<ReactNode>
  pin?: ReactiveProp<TweakerPin | undefined>
  reorderable?: ReactiveProp<boolean>
  states?: ReactiveProp<TweakerItemStates>
  status?: ReactiveProp<TweakerStatus | undefined>
  visible?: ReactiveProp<boolean>
}

interface TweakerFieldItemValueProps<TValue extends TweakerValue> {
  defaultValue?: TValue
  field: string
  id?: string
  onValueChange?: (value: TValue, item: TweakerItemContextValue<TValue>) => void
  parse?: TweakerParser<TValue>
  readOnly?: ReactiveProp<boolean>
  validate?: TweakerValidator<TValue>
  valueMode?: 'input' | 'display'
}

interface TweakerNonFieldItemValueProps {
  defaultValue?: never
  field?: never
  id: string
  onValueChange?: never
  parse?: never
  readOnly?: ReactiveProp<boolean>
  validate?: never
  valueMode?: 'display'
}

export type TweakerInputItemProps<TValue extends TweakerValue = TweakerValue> =
  TweakerItemBaseProps<TValue> & TweakerFieldItemValueProps<TValue>

export type TweakerDisplayItemProps<TValue extends TweakerValue = TweakerValue> =
  TweakerItemBaseProps<TValue> &
    (
      | (Omit<
          TweakerFieldItemValueProps<TValue>,
          'defaultValue' | 'onValueChange' | 'parse' | 'validate' | 'valueMode'
        > & {
          valueMode?: 'display'
        })
      | TweakerNonFieldItemValueProps
    )

export type TweakerItemProps<TValue extends TweakerValue = TweakerValue> =
  | TweakerInputItemProps<TValue>
  | (TweakerItemBaseProps<TValue> & TweakerNonFieldItemValueProps)

const emptyStates: TweakerItemStates = {}
const TweakerItemContext = createContext<TweakerItemContextValue | null>(null)

export function TweakerItem<TValue extends TweakerValue = TweakerValue>({
  children,
  className,
  contentClassName,
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
  parse,
  pin: pinProp,
  readOnly: readOnlyProp,
  reorderable: reorderableProp,
  states: statesProp,
  status: statusProp,
  transformTemplate: transformTemplateProp,
  validate,
  valueMode,
  visible: visibleProp,
  ...props
}: TweakerItemProps<TValue>) {
  const itemId = id ?? field
  if (itemId === undefined) {
    throw new Error('TweakerItem requires `id` when `field` is omitted.')
  }
  const inputId = `${itemId}:input`
  const labelId = `${itemId}:label`
  const descriptionId = `${itemId}:description`
  const errorId = `${itemId}:errors`
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
  const configuredReadOnly = useResolvedPanelProp(readOnlyProp, false) ?? false
  const resolvedValueMode = field === undefined ? valueMode : (valueMode ?? 'input')
  const readOnly = resolvedValueMode === 'display' || configuredReadOnly
  const pin = useResolvedPanelProp(pinProp)
  const configuredReorderable = useResolvedPanelProp(reorderableProp, true) ?? true
  const states = useResolvedPanelProp(statesProp, emptyStates) ?? emptyStates
  const status = useResolvedPanelProp(statusProp)
  const visible = useResolvedPanelProp(visibleProp, true) ?? true
  const labelText = typeof label === 'string' ? label : undefined
  const active = Object.keys(interaction.activeIds).some((activeId) =>
    activeId.endsWith(`:${itemId}`),
  )
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
  } = useTweakerReorderItem(itemId, configuredReorderable, pin)
  const transformTemplate = useMemo<NonNullable<HTMLMotionProps<'div'>['transformTemplate']>>(
    () => (latest) => (transformTemplateProp ? transformTemplateProp(latest, '') : 'none'),
    [transformTemplateProp],
  )
  const visualTop = useTransform(() =>
    reorderTopWithOffset(props.style?.top, visualDragOffsetY.get()),
  )
  const showReorderSlot = reorderable || keyboardReorderActive || parentId !== rootGroupId

  const resetValue = useCallback(() => {
    if (field !== undefined) {
      store.getState().resetFieldValue(field)
    }
  }, [field, store])

  const setInput = useCallback(
    (candidate: unknown) => {
      if (disabled || readOnly) return
      if (field !== undefined) {
        const result = store.getState().setFieldInput(field, candidate)
        if (!result.success) return
      }
      const canonicalValue =
        field === undefined ? (candidate as TValue) : (store.getState().values[field] as TValue)
      onValueChange?.(canonicalValue, {
        disabled,
        errorId,
        field,
        fieldState: field === undefined ? undefined : store.getState().fields[field],
        id: itemId,
        inputId,
        readOnly,
        resetValue,
        setInput,
        value: canonicalValue,
      })
    },
    [disabled, errorId, field, inputId, itemId, onValueChange, readOnly, resetValue, store],
  )

  const itemContext = useMemo<TweakerItemContextValue<TValue>>(
    () => ({
      disabled,
      errorId,
      field,
      fieldState,
      id: itemId,
      inputId,
      readOnly,
      resetValue,
      setInput,
      value,
    }),
    [disabled, errorId, field, fieldState, inputId, itemId, readOnly, resetValue, setInput, value],
  )

  useRegisterTweakerItem({
    defaultValue,
    field,
    hidden: !visible,
    id: itemId,
    kind: 'control',
    label: labelText,
    parse,
    parentId,
    pin,
    reorderable: configuredReorderable,
    validate: validate as TweakerValidator | undefined,
    valueMode: resolvedValueMode,
  })

  if (!visible) return null

  const stateAttributes = dataAttributesForStates(states)
  const disabledOrReadOnly = disabled || readOnly

  return (
    <TweakerItemContext.Provider value={itemContext as unknown as TweakerItemContextValue}>
      <Reorder.Item<string, 'div'>
        {...props}
        {...stateAttributes}
        as="div"
        aria-describedby={
          [description ? descriptionId : undefined, fieldState?.errors.length ? errorId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        aria-errormessage={fieldState?.errors.length ? errorId : undefined}
        aria-invalid={fieldState?.errors.length ? true : undefined}
        aria-labelledby={label ? labelId : undefined}
        className={cn(
          'group/control relative isolate col-span-full grid min-h-10 shrink-0 grid-cols-subgrid items-start gap-x-(--tweaker-space-1) gap-y-(--tweaker-space-0-5) select-none rounded-tweaker-control border border-l-2 border-transparent bg-transparent py-(--tweaker-space-1) pr-(--tweaker-space-1-5) text-tweaker-text outline-none transition-[background-color,border-color,box-shadow,backdrop-filter] duration-(--tweaker-duration-fast) data-[dragging=true]:z-(--tweaker-layer-drag)! data-[dragging=true]:border-tweaker-focus data-[dragging=true]:bg-(--_tweaker-row-drag) data-[dragging=true]:shadow-tweaker-panel data-[dragging=true]:backdrop-blur-(--tweaker-blur-surface) data-[focused=true]:border-tweaker-focus/60 data-[hovered=true]:bg-(--_tweaker-row-hover) data-[status=alert]:border-l-(--_tweaker-color-alert-border) data-[status=alert]:bg-tweaker-alert-subtle data-[status=error]:border-l-(--_tweaker-color-danger-border) data-[status=error]:bg-tweaker-danger-subtle data-[status=info]:border-l-(--_tweaker-color-info-border) data-[status=info]:bg-tweaker-info-subtle data-[status=warning]:border-l-(--_tweaker-color-warning-border) data-[status=warning]:bg-tweaker-warning-subtle',
          !showReorderSlot && 'pl-(--tweaker-space-1-5)',
          className,
        )}
        data-active={active ? 'true' : 'false'}
        data-item-id={itemId}
        data-content-layout={contentLayout}
        data-dirty={fieldState?.dirty ? 'true' : 'false'}
        data-dragging={interaction.draggingId === itemId ? 'true' : 'false'}
        data-focused={interaction.focusedId === itemId ? 'true' : 'false'}
        data-hovered={interaction.hoveredId === itemId ? 'true' : 'false'}
        data-item-kind="control"
        data-order-band={pin ?? 'auto'}
        data-parent-id={parentId}
        data-pin={pin}
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
        value={itemId}
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
          store.getState().setFocusedItem(itemId)
          onFocusCapture?.(event)
        }}
        onPointerCancelCapture={(event) => {
          store.getState().setInteractionActive(`pointer:${itemId}`, false)
          onPointerCancelCapture?.(event)
        }}
        onPointerDownCapture={(event) => {
          store.getState().setInteractionActive(`pointer:${itemId}`, true)
          onPointerDownCapture?.(event)
        }}
        onPointerEnter={(event) => {
          store.getState().setHoveredItem(itemId)
          onPointerEnter?.(event)
        }}
        onPointerLeave={(event) => {
          store.getState().setHoveredItem(null)
          store.getState().setInteractionActive(`pointer:${itemId}`, false)
          onPointerLeave?.(event)
        }}
        onPointerUpCapture={(event) => {
          store.getState().setInteractionActive(`pointer:${itemId}`, false)
          onPointerUpCapture?.(event)
        }}
      >
        <span
          className="group-data-[hovered=true]/tweaker-section:bg-tweaker-surface-muted/80 pointer-events-none absolute -inset-y-0.75 left-(--_tweaker-nested-inset) z-0 w-6 transition-colors duration-(--tweaker-duration-fast)"
          aria-hidden="true"
        />
        {showReorderSlot ? (
          <button
            aria-description="Press Space or Enter to pick up. Use Arrow Up and Arrow Down to move. Press Space or Enter to drop, or Escape to cancel."
            aria-disabled={!reorderable}
            aria-keyshortcuts="Space Enter ArrowUp ArrowDown Escape"
            aria-label={labelText ? `Reorder ${labelText}` : 'Reorder item'}
            aria-pressed={keyboardReorderActive}
            className={cn(
              buttonVariants({ size: 'icon', variant: 'ghost' }),
              'relative z-10 col-start-1 size-(--tweaker-control-height-xs) shrink-0 cursor-grab self-center text-tweaker-muted opacity-(--tweaker-opacity-muted) active:cursor-grabbing aria-disabled:cursor-default aria-disabled:opacity-100',
            )}
            type="button"
            onKeyDown={(event) => handleReorderKeyDown(event, labelText ?? 'Item')}
            onPointerCancel={cancelReorder}
            onPointerDown={beginReorder}
          >
            <TweakerReorderIndicator reorderable={reorderable} />
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
                  aria-label={labelText ? `Help for ${labelText}` : 'Item help'}
                  className="text-tweaker-muted hover:text-tweaker-text focus-visible:ring-tweaker-focus rounded-tweaker-control inline-flex size-(--tweaker-icon-lg) shrink-0 items-center justify-center text-(length:--tweaker-font-size-xl) leading-(--tweaker-line-normal) transition-colors duration-(--tweaker-duration-fast) outline-none focus-visible:ring-2"
                  type="button"
                >
                  <Info className="size-(--tweaker-icon-xs)" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{help}</TooltipContent>
            </Tooltip>
          ) : null}
          {field ? (
            fieldState?.dirty ? (
              <Button
                aria-label={labelText ? `Reset ${labelText}` : 'Reset item'}
                className="size-(--tweaker-icon-lg)"
                disabled={disabled || readOnly}
                size="icon"
                variant="ghost"
                onClick={resetValue}
              >
                <RotateCcw className="size-(--tweaker-icon-xs)" aria-hidden="true" />
              </Button>
            ) : (
              <span className="size-(--tweaker-icon-lg) shrink-0" aria-hidden="true" />
            )
          ) : null}
        </div>

        <div
          className={cn(
            'grid min-w-0 grid-cols-subgrid self-center',
            contentLayout === 'inline' && 'col-span-2 col-start-3',
            contentLayout === 'block' && 'col-span-3 col-start-2 row-start-2',
            contentLayout === 'full' && 'col-span-4 col-start-1 row-start-2',
            contentClassName,
          )}
        >
          {typeof children === 'function' ? children(itemContext) : children}
        </div>

        {fieldState?.errors.length ? (
          <div
            className="text-tweaker-danger col-span-3 col-start-2 text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight)"
            id={errorId}
            role="alert"
          >
            {fieldState.errors.join(' ')}
          </div>
        ) : null}

        {description ? (
          <div
            id={descriptionId}
            className={cn(
              'text-(length:--tweaker-font-size-sm) leading-(--tweaker-line-tight) font-(--tweaker-font-light) text-tweaker-muted pt-1.5',
              contentLayout === 'inline' && 'col-span-2 col-start-3 row-start-2',
              contentLayout === 'block' && 'col-span-3 col-start-2 row-start-3',
              contentLayout === 'full' && 'col-span-4 col-start-1 row-start-3',
            )}
          >
            {description}
          </div>
        ) : null}
      </Reorder.Item>
    </TweakerItemContext.Provider>
  )
}

export function useTweakerItem<TValue extends TweakerValue = TweakerValue>() {
  const context = useContext(TweakerItemContext)
  if (!context) {
    throw new Error('useTweakerItem must be used inside TweakerItem.')
  }
  return context as unknown as TweakerItemContextValue<TValue>
}

export function useResolvedPanelProp<T>(
  prop: ReactiveProp<T> | undefined,
  fallback?: T,
): T | undefined {
  const value = prop === undefined ? fallback : prop
  return useTweakerPanelSelector((state) =>
    typeof value === 'function' ? (value as (state: TweakerPanelState) => T)(state) : value,
  )
}

export function dataAttributesForStates(states: TweakerItemStates) {
  const attributes: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(states)) {
    const attributeName = `data-state-${toKebabCase(key)}`
    attributes[attributeName] = toDataValue(value)
  }
  return attributes
}
