import { Info, RotateCcw } from 'lucide-react'
import { Reorder, useReducedMotion, useTransform, type HTMLMotionProps } from 'motion/react'
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'
import { Button, buttonVariants } from '../ui/button.js'
import { Label } from '../ui/label.js'
import { Tooltip, TooltipContent, TooltipTrigger } from '../overlays/Tooltip.js'
import {
  useRegisterPicodashItem,
  usePicodashPanelSelector,
  usePicodashPanelStoreApi,
  type PicodashControlStates,
  type PicodashPanelState,
  type PicodashPin,
  type PicodashStatus,
  type PicodashValue,
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
import type { PicodashParser, PicodashValidator } from '../../validation/picodash-validation.js'
import { cn, toDataValue, toKebabCase } from '../../utilities/utils.js'

export type ReactiveProp<T> = T | ((state: PicodashPanelState) => T)
export type PicodashItemContentLayout = 'inline' | 'block' | 'full'
export type PicodashItemStates = PicodashControlStates

export interface PicodashItemContextValue<TValue extends PicodashValue = PicodashValue> {
  disabled: boolean
  errorId: string
  field?: string
  fieldState?: PicodashPanelState['fields'][string]
  id: string
  inputId: string
  readOnly: boolean
  resetValue: () => void
  setInput: (candidate: unknown) => void
  value: TValue | undefined
}

export interface PicodashItemBaseProps<TValue extends PicodashValue> extends Omit<
  HTMLMotionProps<'div'>,
  'children' | 'defaultValue' | 'id' | 'layout' | 'value'
> {
  children?: ReactNode | ((item: PicodashItemContextValue<TValue>) => ReactNode)
  contentClassName?: string
  contentLayout?: PicodashItemContentLayout
  description?: ReactiveProp<ReactNode>
  disabled?: ReactiveProp<boolean>
  help?: ReactiveProp<ReactNode>
  label?: ReactiveProp<ReactNode>
  pin?: ReactiveProp<PicodashPin | undefined>
  reorderable?: ReactiveProp<boolean>
  states?: ReactiveProp<PicodashItemStates>
  status?: ReactiveProp<PicodashStatus | undefined>
  visible?: ReactiveProp<boolean>
}

interface PicodashFieldItemValueProps<TValue extends PicodashValue> {
  defaultValue?: TValue
  field: string
  id?: string
  onValueChange?: (value: TValue, item: PicodashItemContextValue<TValue>) => void
  parse?: PicodashParser<TValue>
  readOnly?: ReactiveProp<boolean>
  validate?: PicodashValidator<TValue>
  valueMode?: 'input' | 'display'
}

interface PicodashNonFieldItemValueProps {
  defaultValue?: never
  field?: never
  id: string
  onValueChange?: never
  parse?: never
  readOnly?: ReactiveProp<boolean>
  validate?: never
  valueMode?: 'display'
}

export type PicodashInputItemProps<TValue extends PicodashValue = PicodashValue> =
  PicodashItemBaseProps<TValue> & PicodashFieldItemValueProps<TValue>

export type PicodashDisplayItemProps<TValue extends PicodashValue = PicodashValue> =
  PicodashItemBaseProps<TValue> &
    (
      | (Omit<
          PicodashFieldItemValueProps<TValue>,
          'defaultValue' | 'onValueChange' | 'parse' | 'validate' | 'valueMode'
        > & {
          valueMode?: 'display'
        })
      | PicodashNonFieldItemValueProps
    )

export type PicodashItemProps<TValue extends PicodashValue = PicodashValue> =
  | PicodashInputItemProps<TValue>
  | (PicodashItemBaseProps<TValue> & PicodashNonFieldItemValueProps)

const emptyStates: PicodashItemStates = {}
const PicodashItemContext = createContext<PicodashItemContextValue | null>(null)
const focusableControlSelector =
  'button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'

function isFocusableControl(element: HTMLElement) {
  return (
    element.matches(focusableControlSelector) &&
    !element.matches(
      '[disabled], [aria-disabled="true"], [data-disabled]:not([data-disabled="false"])',
    ) &&
    !element.closest('[inert]')
  )
}

export function PicodashItem<TValue extends PicodashValue = PicodashValue>({
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
}: PicodashItemProps<TValue>) {
  const itemId = id ?? field
  if (itemId === undefined) {
    throw new Error('PicodashItem requires `id` when `field` is omitted.')
  }
  const inputId = `${itemId}:input`
  const labelId = `${itemId}:label`
  const descriptionId = `${itemId}:description`
  const errorId = `${itemId}:errors`
  const controlContentRef = useRef<HTMLDivElement | null>(null)
  const store = usePicodashPanelStoreApi()
  const value = usePicodashPanelSelector((state) =>
    field === undefined ? undefined : (state.values[field] as TValue | undefined),
  )
  const fieldState = usePicodashPanelSelector((state) =>
    field === undefined ? undefined : state.fields[field],
  )
  const interaction = usePicodashPanelSelector((state) => state.interaction)
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
  } = usePicodashReorderItem(itemId, configuredReorderable, pin)
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

  const focusControl = useCallback(() => {
    const content = controlContentRef.current
    if (!content) return

    const directTarget = content.ownerDocument.getElementById(inputId)
    const statefulTargets = content.querySelectorAll<HTMLElement>(
      '[data-selected="true"], [aria-checked="true"], [data-state="on"]',
    )
    const fallbackTargets = content.querySelectorAll<HTMLElement>(focusableControlSelector)
    const target = [directTarget, ...statefulTargets, ...fallbackTargets].find(
      (candidate): candidate is HTMLElement =>
        candidate instanceof HTMLElement &&
        content.contains(candidate) &&
        isFocusableControl(candidate),
    )

    target?.focus()
  }, [inputId])

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

  const itemContext = useMemo<PicodashItemContextValue<TValue>>(
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

  useRegisterPicodashItem({
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
    validate: validate as PicodashValidator | undefined,
    valueMode: resolvedValueMode,
  })

  if (!visible) return null

  const stateAttributes = dataAttributesForStates(states)
  const disabledOrReadOnly = disabled || readOnly

  return (
    <PicodashItemContext.Provider value={itemContext as unknown as PicodashItemContextValue}>
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
          'group/control rounded-picodash-control text-picodash-text data-[dragging=true]:border-picodash-focus data-[dragging=true]:shadow-picodash-panel data-[focused=true]:border-picodash-focus/60 data-[status=alert]:bg-picodash-alert-subtle data-[status=error]:bg-picodash-danger-subtle data-[status=info]:bg-picodash-info-subtle data-[status=warning]:bg-picodash-warning-subtle relative isolate col-span-full grid min-h-10 shrink-0 grid-cols-subgrid items-start gap-x-(--picodash-space-1) gap-y-(--picodash-space-0-5) border border-l-2 border-transparent bg-transparent py-(--picodash-space-1) pr-(--picodash-space-1-5) transition-[background-color,border-color,box-shadow,backdrop-filter] duration-(--picodash-duration-fast) outline-none select-none data-[dragging=true]:z-(--picodash-layer-drag)! data-[dragging=true]:bg-(--_picodash-row-drag) data-[dragging=true]:backdrop-blur-(--picodash-blur-surface) data-[hovered=true]:bg-(--_picodash-row-hover) data-[status=alert]:border-l-(--_picodash-color-alert-border) data-[status=error]:border-l-(--_picodash-color-danger-border) data-[status=info]:border-l-(--_picodash-color-info-border) data-[status=warning]:border-l-(--_picodash-color-warning-border)',
          !showReorderSlot && 'pl-(--picodash-space-1-5)',
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
          className="group-data-[hovered=true]/picodash-section:bg-picodash-surface-muted/80 pointer-events-none absolute -inset-y-0.75 left-(--_picodash-nested-inset) z-0 w-6 transition-colors duration-(--picodash-duration-fast)"
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
              'text-picodash-muted relative z-10 col-start-1 size-(--picodash-control-height-xs) shrink-0 cursor-grab self-center opacity-(--picodash-opacity-muted) active:cursor-grabbing aria-disabled:cursor-default aria-disabled:opacity-100',
            )}
            type="button"
            onKeyDown={(event) => handleReorderKeyDown(event, labelText ?? 'Item')}
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

        <div className="col-start-2 flex min-w-0 items-center gap-1 self-center">
          {label ? (
            <Label
              className={cn(
                'text-picodash-muted min-w-0 truncate',
                disabledOrReadOnly && 'opacity-(--picodash-opacity-muted)',
              )}
              htmlFor={field ? inputId : undefined}
              id={labelId}
              onClick={focusControl}
            >
              {label}
            </Label>
          ) : null}
          {help ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={labelText ? `Help for ${labelText}` : 'Item help'}
                  className="text-picodash-muted hover:text-picodash-text focus-visible:ring-picodash-focus rounded-picodash-control inline-flex size-(--picodash-icon-lg) shrink-0 items-center justify-center text-(length:--picodash-font-size-xl) leading-(--picodash-line-normal) transition-colors duration-(--picodash-duration-fast) outline-none focus-visible:ring-2"
                  type="button"
                >
                  <Info className="size-(--picodash-icon-xs)" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{help}</TooltipContent>
            </Tooltip>
          ) : null}
          {field ? (
            fieldState?.dirty ? (
              <Button
                aria-label={labelText ? `Reset ${labelText}` : 'Reset item'}
                className="size-(--picodash-icon-lg)"
                disabled={disabled || readOnly}
                size="icon"
                variant="ghost"
                onClick={resetValue}
              >
                <RotateCcw className="size-(--picodash-icon-xs)" aria-hidden="true" />
              </Button>
            ) : (
              <span className="size-(--picodash-icon-lg) shrink-0" aria-hidden="true" />
            )
          ) : null}
        </div>

        <div
          ref={controlContentRef}
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
            className="text-picodash-danger col-span-3 col-start-2 text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight)"
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
              'text-picodash-muted pt-1.5 text-(length:--picodash-font-size-sm) leading-(--picodash-line-tight) font-(--picodash-font-light)',
              contentLayout === 'inline' && 'col-span-2 col-start-3 row-start-2',
              contentLayout === 'block' && 'col-span-3 col-start-2 row-start-3',
              contentLayout === 'full' && 'col-span-4 col-start-1 row-start-3',
            )}
          >
            {description}
          </div>
        ) : null}
      </Reorder.Item>
    </PicodashItemContext.Provider>
  )
}

export function usePicodashItem<TValue extends PicodashValue = PicodashValue>() {
  const context = useContext(PicodashItemContext)
  if (!context) {
    throw new Error('usePicodashItem must be used inside PicodashItem.')
  }
  return context as unknown as PicodashItemContextValue<TValue>
}

export function useResolvedPanelProp<T>(
  prop: ReactiveProp<T> | undefined,
  fallback?: T,
): T | undefined {
  const value = prop === undefined ? fallback : prop
  return usePicodashPanelSelector((state) =>
    typeof value === 'function' ? (value as (state: PicodashPanelState) => T)(state) : value,
  )
}

export function dataAttributesForStates(states: PicodashItemStates) {
  const attributes: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(states)) {
    const attributeName = `data-state-${toKebabCase(key)}`
    attributes[attributeName] = toDataValue(value)
  }
  return attributes
}
