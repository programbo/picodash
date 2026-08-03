import { Info, RotateCcw } from 'lucide-react'
import { Reorder, useReducedMotion, useTransform, type HTMLMotionProps } from 'motion/react'
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { picodashPresentationContractsEqual } from '@picodash/store'
import type {
  PicodashField,
  PicodashFieldState,
  PicodashItemBinding,
  PicodashItemRegistration,
  PicodashPresentationContract,
  PicodashStoreState,
} from '@picodash/store'
import { Button, buttonVariants } from '../ui/button.js'
import { Label } from '../ui/label.js'
import { Tooltip, TooltipContent, TooltipTrigger } from '../overlays/Tooltip.js'
import {
  useRegisterPicodashItem,
  usePicodashPanelSelector,
  usePicodashPanelStoreApi,
  type PicodashControlStates,
  type PicodashPin,
  type PicodashStatus,
  type PicodashValue,
} from './PicodashPanel.js'
import type { AnyPicodashStore, AnyPicodashValues } from '../../state/panel/picodash-panel-types.js'
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
import { cn, toDataValue, toKebabCase } from '../../utilities/utils.js'
import { usePicodashListScope } from '../../state/panel/picodash-list-scope-context.js'

export type ReactiveProp<T> = T | ((state: PicodashStoreState<AnyPicodashValues>) => T)
export type PicodashItemContentLayout = 'inline' | 'block' | 'full'
export type PicodashItemStates = PicodashControlStates

export interface PicodashItemFieldContext<TValue extends PicodashValue = PicodashValue> {
  disabled: boolean
  dirty: boolean
  draftValue?: unknown
  errors: readonly string[]
  field: PicodashField<Record<string, TValue>, string>
  fieldState: PicodashFieldState<TValue>
  readOnly: boolean
  touched: boolean
  value: TValue | undefined
}

export interface PicodashInputFieldContext<
  TValue extends PicodashValue = PicodashValue,
> extends PicodashItemFieldContext<TValue> {
  resetValue: () => void
  setInput: (candidate: unknown) => void
}

export interface PicodashDisplayFieldContext<
  TValue extends PicodashValue = PicodashValue,
> extends PicodashItemFieldContext<TValue> {
  readOnly: true
}

export interface PicodashCompoundFieldContext<
  TValue extends PicodashValue = PicodashValue,
> extends PicodashItemFieldContext<TValue> {
  errorId: string
  inputId: string
  labelId: string
}

export interface PicodashCompoundInputFieldContext<
  TValue extends PicodashValue = PicodashValue,
> extends PicodashCompoundFieldContext<TValue> {
  reset: () => void
  setInput: (candidate: unknown) => void
}

export interface PicodashCompoundDisplayFieldContext<
  TValue extends PicodashValue = PicodashValue,
> extends PicodashCompoundFieldContext<TValue> {
  readOnly: true
}

export interface PicodashItemContextValue<
  TValue extends PicodashValue = PicodashValue,
> extends PicodashInputFieldContext<TValue> {
  errorId: string
  id: string
  inputId: string
}

export interface PicodashDisplayItemContextValue<
  TValue extends PicodashValue = PicodashValue,
> extends PicodashDisplayFieldContext<TValue> {
  errorId: string
  id: string
  inputId: string
}

export type PicodashItemFieldBinding<TValue extends PicodashValue = PicodashValue> =
  | PicodashField<Record<string, TValue>, string>
  | {
      field: PicodashField<Record<string, TValue>, string>
      mode?: 'display' | 'input'
      presentation?: PicodashPresentationContract<TValue>
    }

type PicodashBindingValue<TBinding> =
  TBinding extends PicodashField<infer TValues, infer TKey>
    ? TValues[TKey] & PicodashValue
    : TBinding extends { field: PicodashField<infer TValues, infer TKey> }
      ? TValues[TKey] & PicodashValue
      : never

export type PicodashItemBindingContext<TBinding> = TBinding extends { mode: 'display' }
  ? PicodashCompoundDisplayFieldContext<PicodashBindingValue<TBinding>>
  : PicodashCompoundInputFieldContext<PicodashBindingValue<TBinding>>

export type PicodashCompoundItemFields = Readonly<
  Record<string, PicodashItemFieldBinding<PicodashValue>>
>

export interface PicodashCompoundItemContext<TFields extends PicodashCompoundItemFields> {
  disabled: boolean
  errorId: string
  fields: { readonly [TAlias in keyof TFields]: PicodashItemBindingContext<TFields[TAlias]> }
  id: string
  inputId: string
  readOnly: boolean
  reset: () => void
}

export interface PicodashItemBaseProps extends Omit<
  HTMLMotionProps<'div'>,
  'children' | 'defaultValue' | 'id' | 'layout' | 'value'
> {
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
  children?: ReactNode | ((item: PicodashItemContextValue<TValue>) => ReactNode)
  field: PicodashField<Record<string, TValue>, string>
  fields?: never
  id?: string
  onValueChange?: (value: TValue, item: PicodashItemContextValue<TValue>) => void
  readOnly?: ReactiveProp<boolean>
  presentation?: PicodashPresentationContract<TValue>
  valueMode?: 'input'
}

interface PicodashNonFieldItemValueProps {
  children?: ReactNode
  field?: never
  fields?: never
  id: string
  onValueChange?: never
  presentation?: never
  readOnly?: ReactiveProp<boolean>
  valueMode?: 'display'
}

export type PicodashInputItemProps<TValue extends PicodashValue = PicodashValue> =
  PicodashItemBaseProps & PicodashFieldItemValueProps<TValue>

export type PicodashDisplayItemProps<TValue extends PicodashValue = PicodashValue> =
  PicodashItemBaseProps &
    (
      | {
          children?: ReactNode | ((item: PicodashDisplayItemContextValue<TValue>) => ReactNode)
          field: PicodashField<Record<string, TValue>, string>
          fields?: never
          id?: string
          onValueChange?: never
          presentation?: PicodashPresentationContract<TValue>
          readOnly?: ReactiveProp<boolean>
          valueMode: 'display'
        }
      | {
          children?: ReactNode | ((item: PicodashDisplayItemContextValue<TValue>) => ReactNode)
          field?: never
          fields?: never
          id: string
          onValueChange?: never
          presentation?: never
          readOnly?: ReactiveProp<boolean>
          valueMode?: 'display'
        }
    )

export type PicodashItemProps<TValue extends PicodashValue = PicodashValue> =
  | PicodashInputItemProps<TValue>
  | PicodashDisplayItemProps<TValue>
  | (PicodashItemBaseProps & PicodashNonFieldItemValueProps)

export type PicodashCompoundItemProps<TFields extends PicodashCompoundItemFields> =
  PicodashItemBaseProps & {
    children?: ReactNode | ((item: PicodashCompoundItemContext<TFields>) => ReactNode)
    field?: never
    fields: TFields
    id: string
    onValueChange?: never
    presentation?: never
    readOnly?: ReactiveProp<boolean>
    valueMode?: never
  }

const emptyStates: PicodashItemStates = {}
const PicodashItemContext = createContext<PicodashItemContextValue | null>(null)
const focusableControlSelector =
  'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'

function isFocusableControl(element: HTMLElement) {
  return (
    element.matches(focusableControlSelector) &&
    !element.matches(
      '[disabled], [aria-disabled="true"], [data-disabled]:not([data-disabled="false"])',
    ) &&
    !element.closest('[inert]')
  )
}

export function PicodashItem<TFields extends PicodashCompoundItemFields>(
  props: PicodashCompoundItemProps<TFields>,
): ReactNode
export function PicodashItem<TValue extends PicodashValue = PicodashValue>(
  props: PicodashDisplayItemProps<TValue>,
): ReactNode
export function PicodashItem<TValue extends PicodashValue = PicodashValue>(
  props: PicodashInputItemProps<TValue>,
): ReactNode
export function PicodashItem(
  props: PicodashItemBaseProps & PicodashNonFieldItemValueProps,
): ReactNode
export function PicodashItem({
  children,
  className,
  contentClassName,
  contentLayout = 'inline',
  description: descriptionProp,
  disabled: disabledProp,
  field,
  fields,
  help: helpProp,
  id,
  label: labelProp,
  onBlurCapture,
  onClick,
  onFocusCapture,
  onPointerCancelCapture,
  onPointerDownCapture,
  onPointerEnter,
  onPointerLeave,
  onPointerUpCapture,
  onValueChange,
  pin: pinProp,
  presentation,
  readOnly: readOnlyProp,
  reorderable: reorderableProp,
  states: statesProp,
  status: statusProp,
  transformTemplate: transformTemplateProp,
  valueMode,
  visible: visibleProp,
  ...props
}: PicodashItemProps | PicodashCompoundItemProps<PicodashCompoundItemFields>) {
  const fieldKey = field?.key
  const itemId = id ?? fieldKey
  if (itemId === undefined) {
    throw new Error('PicodashItem requires `id` when `field` is omitted.')
  }
  const listScope = usePicodashListScope()
  const domItemId = listScope ? `${listScope}:${itemId}` : itemId
  const inputId = `${domItemId}:input`
  const labelId = `${domItemId}:label`
  const descriptionId = `${domItemId}:description`
  const errorId = `${domItemId}:errors`
  const controlContentRef = useRef<HTMLDivElement | null>(null)
  const store = usePicodashPanelStoreApi()
  const stableFieldsRef = useRef<PicodashCompoundItemFields | undefined>(undefined)
  const stableFields = stabilizePicodashCompoundItemFields(stableFieldsRef.current, fields)
  stableFieldsRef.current = stableFields
  const resolvedBindings = useMemo(() => resolveCompoundBindings(stableFields), [stableFields])
  const value = usePicodashPanelSelector((state) =>
    fieldKey === undefined ? undefined : (state.values[fieldKey] as PicodashValue | undefined),
  )
  const fieldState = usePicodashPanelSelector((state) =>
    fieldKey === undefined
      ? undefined
      : (state.fieldStates[fieldKey] as PicodashFieldState<PicodashValue> | undefined),
  )
  const compoundValues = usePicodashPanelSelector(
    useShallow((state) =>
      resolvedBindings.map(
        (binding) => state.values[binding.field.key] as PicodashValue | undefined,
      ),
    ),
  )
  const compoundFieldStates = usePicodashPanelSelector(
    useShallow((state) =>
      resolvedBindings.map(
        (binding) =>
          state.fieldStates[binding.field.key] as PicodashFieldState<PicodashValue> | undefined,
      ),
    ),
  )
  const label = useResolvedPanelProp(labelProp)
  const description = useResolvedPanelProp(descriptionProp)
  const help = useResolvedPanelProp(helpProp)
  const disabled = useResolvedPanelProp(disabledProp, false) ?? false
  const configuredReadOnly = useResolvedPanelProp(readOnlyProp, false) ?? false
  const resolvedValueMode = field === undefined ? valueMode : (valueMode ?? 'input')
  const readOnly = resolvedValueMode === 'display' || configuredReadOnly
  const registrationField = useMemo(
    () =>
      field
        ? ({
            field,
            mode: resolvedValueMode,
            ...(presentation ? { presentation } : {}),
          } as PicodashItemBinding<AnyPicodashValues>)
        : undefined,
    [field, presentation, resolvedValueMode],
  )
  const pin = useResolvedPanelProp(pinProp)
  const configuredReorderable = useResolvedPanelProp(reorderableProp, true) ?? true
  const states = useResolvedPanelProp(statesProp, emptyStates) ?? emptyStates
  const status = useResolvedPanelProp(statusProp)
  const visible = useResolvedPanelProp(visibleProp, true) ?? true
  const labelText = typeof label === 'string' ? label : undefined
  const active = usePicodashPanelSelector((state) =>
    Object.keys(state.interaction.activeIds).some((activeId) => activeId.endsWith(`:${itemId}`)),
  )
  const dragging = usePicodashPanelSelector((state) => state.interaction.draggingId === itemId)
  const focused = usePicodashPanelSelector((state) => state.interaction.focusedId === itemId)
  const hovered = usePicodashPanelSelector((state) => state.interaction.hoveredId === itemId)
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
    if (!disabled && !readOnly && field !== undefined) {
      store.getState().resetFieldValue(field)
    }
  }, [disabled, field, readOnly, store])

  const resetCompound = useCallback(() => {
    resetPicodashCompoundItemFields(store, stableFields, disabled, configuredReadOnly)
  }, [configuredReadOnly, disabled, stableFields, store])

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
        fieldKey === undefined
          ? (candidate as PicodashValue)
          : (store.getState().values[fieldKey] as PicodashValue)
      onValueChange?.(canonicalValue, {
        disabled,
        errorId,
        field,
        fieldState:
          fieldKey === undefined
            ? undefined
            : (store.getState().fieldStates[fieldKey] as
                | PicodashFieldState<PicodashValue>
                | undefined),
        id: itemId,
        inputId,
        readOnly,
        resetValue,
        setInput,
        value: canonicalValue,
      } as PicodashItemContextValue)
    },
    [
      disabled,
      errorId,
      field,
      fieldKey,
      inputId,
      itemId,
      onValueChange,
      readOnly,
      resetValue,
      store,
    ],
  )

  const itemContext = useMemo<PicodashItemContextValue>(
    () =>
      ({
        disabled,
        dirty: fieldState?.dirty ?? false,
        draftValue: fieldState?.draftValue,
        errorId,
        errors: fieldState?.errors ?? [],
        field,
        fieldState:
          fieldState ??
          ({
            defaultValue: value,
            dirty: false,
            errors: [],
            touched: false,
          } as PicodashFieldState<PicodashValue>),
        id: itemId,
        inputId,
        readOnly,
        resetValue,
        setInput,
        touched: fieldState?.touched ?? false,
        value,
      }) as PicodashItemContextValue,
    [disabled, errorId, field, fieldState, inputId, itemId, readOnly, resetValue, setInput, value],
  )

  const compoundContext = useMemo<PicodashCompoundItemContext<PicodashCompoundItemFields>>(
    () => ({
      disabled,
      errorId,
      fields: Object.fromEntries(
        resolvedBindings.map((binding, index) => {
          const state = compoundFieldStates[index] as PicodashFieldState<PicodashValue>
          const ids = picodashCompoundFieldIds(domItemId, binding.alias)
          const shared = {
            disabled,
            dirty: state.dirty,
            draftValue: state.draftValue,
            ...ids,
            errors: state.errors,
            field: binding.field,
            fieldState: state,
            readOnly: configuredReadOnly || binding.mode === 'display',
            touched: state.touched,
            value: compoundValues[index],
          }
          return [
            binding.alias,
            binding.mode === 'display'
              ? { ...shared, readOnly: true }
              : {
                  ...shared,
                  readOnly: configuredReadOnly,
                  reset: () => {
                    if (!disabled && !configuredReadOnly) {
                      store.getState().resetFieldValue(binding.field)
                    }
                  },
                  setInput: (candidate: unknown) => {
                    setPicodashCompoundItemFieldInput(
                      store,
                      binding.field,
                      candidate,
                      disabled,
                      configuredReadOnly,
                    )
                  },
                },
          ]
        }),
      ) as PicodashCompoundItemContext<PicodashCompoundItemFields>['fields'],
      id: itemId,
      inputId,
      readOnly:
        configuredReadOnly ||
        (resolvedBindings.length > 0 &&
          resolvedBindings.every((binding) => binding.mode === 'display')),
      reset: resetCompound,
    }),
    [
      configuredReadOnly,
      disabled,
      errorId,
      inputId,
      itemId,
      domItemId,
      compoundFieldStates,
      compoundValues,
      resetCompound,
      resolvedBindings,
      store,
    ],
  )

  useRegisterPicodashItem({
    ...(registrationField
      ? {
          field: registrationField,
        }
      : stableFields
        ? {
            fields: stableFields as Readonly<
              Record<string, PicodashItemBinding<AnyPicodashValues>>
            >,
          }
        : {}),
    hidden: !visible,
    id: itemId,
    kind: 'item',
    label: labelText,
    parentId,
    pin,
    reorderable: configuredReorderable,
  } as PicodashItemRegistration<AnyPicodashValues>)

  if (!visible) return null

  const stateAttributes = dataAttributesForStates(states)
  const disabledOrReadOnly = disabled || readOnly
  const aggregateFieldStates = fieldState ? [fieldState] : compoundFieldStates
  const itemDirty = aggregateFieldStates.some((state) => state?.dirty)
  const itemErrors = aggregateFieldStates.flatMap((state) => state?.errors ?? [])

  return (
    <PicodashItemContext.Provider value={itemContext as unknown as PicodashItemContextValue}>
      <Reorder.Item<string, 'div'>
        {...props}
        {...stateAttributes}
        as="div"
        aria-describedby={
          [description ? descriptionId : undefined, itemErrors.length ? errorId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        aria-errormessage={itemErrors.length ? errorId : undefined}
        aria-invalid={itemErrors.length ? true : undefined}
        aria-labelledby={label ? labelId : undefined}
        className={cn(
          'group/control rounded-picodash-control text-picodash-text data-[dragging=true]:border-picodash-focus data-[dragging=true]:shadow-picodash-panel data-[focused=true]:border-picodash-focus/60 data-[status=alert]:bg-picodash-alert-subtle data-[status=error]:bg-picodash-danger-subtle data-[status=info]:bg-picodash-info-subtle data-[status=warning]:bg-picodash-warning-subtle relative isolate col-span-full grid min-h-10 shrink-0 grid-cols-subgrid items-start gap-x-(--picodash-space-1) gap-y-(--picodash-space-0-5) border border-l-2 border-transparent bg-transparent py-(--picodash-space-1) pr-(--picodash-space-1-5) transition-[background-color,border-color,box-shadow,backdrop-filter] duration-(--picodash-duration-fast) outline-none select-none data-[dragging=true]:z-(--picodash-layer-drag)! data-[dragging=true]:bg-(--_picodash-row-drag) data-[dragging=true]:backdrop-blur-(--picodash-blur-surface) data-[hovered=true]:bg-(--_picodash-row-hover) data-[status=alert]:border-l-(--_picodash-color-alert-border) data-[status=error]:border-l-(--_picodash-color-danger-border) data-[status=info]:border-l-(--_picodash-color-info-border) data-[status=warning]:border-l-(--_picodash-color-warning-border)',
          !showReorderSlot && 'pl-(--picodash-space-1-5)',
          className,
        )}
        data-active={active ? 'true' : 'false'}
        data-item-id={itemId}
        data-content-layout={contentLayout}
        data-dirty={itemDirty ? 'true' : 'false'}
        data-dragging={dragging ? 'true' : 'false'}
        data-focused={focused ? 'true' : 'false'}
        data-hovered={hovered ? 'true' : 'false'}
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
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented) return
          if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return

          const interactiveTarget =
            event.target instanceof Element ? event.target.closest(focusableControlSelector) : null
          if (!interactiveTarget) focusControl()
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
        {showReorderSlot && (reorderable || keyboardReorderActive) ? (
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
            data-picodash-reorder-slot="interactive"
            type="button"
            onKeyDown={(event) => handleReorderKeyDown(event, labelText ?? 'Item')}
            onPointerCancel={cancelReorder}
            onPointerDown={beginReorder}
          >
            <PicodashReorderIndicator reorderable={reorderable} />
          </button>
        ) : showReorderSlot ? (
          <span
            aria-hidden="true"
            className="text-picodash-muted pointer-events-none relative z-10 col-start-1 inline-flex size-(--picodash-control-height-xs) shrink-0 items-center justify-center self-center opacity-(--picodash-opacity-muted)"
            data-picodash-reorder-slot="static"
          >
            <PicodashReorderIndicator reorderable={false} />
          </span>
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
          {typeof children === 'function'
            ? fields
              ? (
                  children as (
                    item: PicodashCompoundItemContext<PicodashCompoundItemFields>,
                  ) => ReactNode
                )(compoundContext)
              : (children as (item: PicodashItemContextValue) => ReactNode)(itemContext)
            : children}
        </div>

        {itemErrors.length ? (
          <div
            className="text-picodash-danger col-span-3 col-start-2 text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight)"
            id={errorId}
            role="alert"
          >
            {itemErrors.join(' ')}
          </div>
        ) : null}

        {description ? (
          <div
            id={descriptionId}
            className={cn(
              'pt-1.5 text-(length:--picodash-font-size-sm) leading-(--picodash-line-tight) font-(--picodash-font-light) text-(--_picodash-color-description)',
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

interface ResolvedCompoundBinding {
  alias: string
  field: PicodashField<AnyPicodashValues, string>
  mode: 'display' | 'input'
  presentation?: PicodashPresentationContract
}

function resolveCompoundBindings(
  fields: PicodashCompoundItemFields | undefined,
): readonly ResolvedCompoundBinding[] {
  if (!fields) return []
  return Object.entries(fields).flatMap(([alias, binding]) => {
    const resolved = resolveCompoundBinding(alias, binding)
    return resolved === undefined ? [] : [resolved]
  })
}

function resolveCompoundBinding(
  alias: string,
  binding: PicodashItemFieldBinding | undefined,
): ResolvedCompoundBinding | undefined {
  if (binding === undefined) return undefined
  if ('key' in binding) {
    return {
      alias,
      field: binding as PicodashField<AnyPicodashValues, string>,
      mode: 'input',
    }
  }
  return {
    alias,
    field: binding.field as PicodashField<AnyPicodashValues, string>,
    mode: binding.mode ?? 'input',
    presentation: binding.presentation,
  }
}

export function picodashCompoundFieldIds(itemId: string, alias: string) {
  const prefix = `${itemId}:${alias}`
  return {
    errorId: `${prefix}:errors`,
    inputId: `${prefix}:input`,
    labelId: `${prefix}:label`,
  } as const
}

export function stabilizePicodashCompoundItemFields(
  previous: PicodashCompoundItemFields | undefined,
  next: PicodashCompoundItemFields | undefined,
): PicodashCompoundItemFields | undefined {
  if (previous === next || next === undefined) return next
  if (previous === undefined) return next

  const previousAliases = Object.keys(previous)
  const nextAliases = Object.keys(next)
  if (
    previousAliases.length !== nextAliases.length ||
    nextAliases.some((alias) => !Object.hasOwn(previous, alias))
  ) {
    return next
  }

  for (const alias of nextAliases) {
    const previousBinding = resolveCompoundBinding(alias, previous[alias])
    const nextBinding = resolveCompoundBinding(alias, next[alias])
    if (
      previousBinding === undefined ||
      nextBinding === undefined ||
      previousBinding.field !== nextBinding.field ||
      previousBinding.mode !== nextBinding.mode ||
      !presentationContractsEqual(previousBinding.presentation, nextBinding.presentation)
    ) {
      return next
    }
  }
  return previous
}

function presentationContractsEqual(
  left: PicodashPresentationContract | undefined,
  right: PicodashPresentationContract | undefined,
) {
  if (left === right) return true
  if (left === undefined || right === undefined) return false
  return picodashPresentationContractsEqual(left, right)
}

export function resetPicodashCompoundItemFields(
  store: AnyPicodashStore,
  fields: PicodashCompoundItemFields | undefined,
  disabled = false,
  readOnly = false,
) {
  if (disabled || readOnly) return

  const defaults = Object.fromEntries(
    resolveCompoundBindings(fields)
      .filter((binding) => binding.mode === 'input')
      .flatMap((binding) => {
        const state = store.getState().fieldStates[binding.field.key]
        return state === undefined || state.defaultValue === undefined
          ? []
          : [[binding.field.key, state.defaultValue] as const]
      }),
  )
  if (Object.keys(defaults).length > 0) store.getState().setFieldValues(defaults)
}

export function setPicodashCompoundItemFieldInput(
  store: AnyPicodashStore,
  field: PicodashField<AnyPicodashValues, string>,
  candidate: unknown,
  disabled = false,
  readOnly = false,
) {
  if (disabled || readOnly) return
  store.getState().setFieldInput(field, candidate)
}

export function useResolvedPanelProp<T>(
  prop: ReactiveProp<T> | undefined,
  fallback?: T,
): T | undefined {
  const value = prop === undefined ? fallback : prop
  return usePicodashPanelSelector((state) =>
    typeof value === 'function'
      ? (value as (state: PicodashStoreState<AnyPicodashValues>) => T)(state)
      : value,
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
