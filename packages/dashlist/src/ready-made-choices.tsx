'use client'

import {
  forwardRef,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react'
import type { PicodashField, PicodashJsonValue } from '@picodash/nexus'
import { Dashlet, type DashletProps } from './index.js'
import {
  Checkbox,
  CheckboxGroup,
  Combobox,
  MultiSelect,
  RadioGroup,
  SearchField,
  type ComboboxProps,
  type MultiSelectProps,
  type RadioGroupProps,
  type SearchFieldProps,
  type SelectOption,
} from './ui-choices.js'

type AnyField = PicodashField<any, any>
type FieldValue<F> =
  F extends PicodashField<infer Values, infer Key>
    ? Key extends keyof Values
      ? Values[Key]
      : never
    : never
type FieldProps<F extends AnyField, Value> =
  FieldValue<F> extends Value ? { readonly field: F } : { readonly field: never }
type Shell = Omit<
  DashletProps<any, any, 'input'>,
  'field' | 'children' | 'label' | 'mode' | 'primaryFocusRef'
> & {
  readonly label: ReactNode
}

type ChoiceValue = string | number
type ChoiceShell<T extends ChoiceValue> = Shell & {
  readonly options: readonly SelectOption<T>[]
}
type ArrayChoiceShell<T extends ChoiceValue> = ChoiceShell<T>

function warningId(controlId: string): string {
  return `${controlId}-presentation-warning`
}

function describedBy(context: any, warning: boolean, binding?: any): string | undefined {
  const ids = [
    context.descriptionId,
    binding?.issuesId ?? context.issuesId,
    warning ? warningId(context.binding.controlId) : undefined,
  ].filter((id): id is string => Boolean(id))
  return ids.length ? ids.join(' ') : undefined
}

function bindingAria(binding: any): {
  readonly 'aria-invalid'?: boolean
  readonly 'aria-errormessage'?: string
} {
  return {
    'aria-invalid': binding.invalid || undefined,
    'aria-errormessage': binding.invalid ? binding.issuesId : undefined,
  }
}

function PresentationWarning({
  context,
  children,
}: {
  readonly context: any
  readonly children: ReactNode
}) {
  return (
    <div
      id={warningId(context.binding.controlId)}
      data-picodash-dashlet-presentation-warning
      data-code="presentation_incompatible"
      role="note"
    >
      {children}
    </div>
  )
}

function optionValue<T extends ChoiceValue>(option: SelectOption<T>): T {
  return typeof option === 'object' && option !== null ? option.value : option
}

function hasChoice<T extends ChoiceValue>(options: readonly SelectOption<T>[], value: T): boolean {
  return options.some((option) => optionValue(option) === value)
}

function arrayCompatible<T extends ChoiceValue>(
  options: readonly SelectOption<T>[],
  value: readonly T[],
): boolean {
  const seen = new Set<string>()
  let previousIndex = -1
  for (const item of value) {
    const key = `${typeof item}:${String(item)}`
    if (seen.has(key)) return false
    seen.add(key)
    const index = options.findIndex((option) => optionValue(option) === item)
    if (index < 0 || index < previousIndex) return false
    previousIndex = index
  }
  return true
}

function jsonText(value: unknown): string {
  const encoded = JSON.stringify(value)
  return encoded === undefined ? String(value) : encoded
}

export type CheckboxDashletProps<F extends AnyField = AnyField> = Shell & FieldProps<F, boolean>
export const CheckboxDashlet = forwardRef<HTMLDivElement, CheckboxDashletProps>(
  function CheckboxDashlet({ field, ...props }, ref) {
    return (
      <Dashlet {...props} ref={ref} field={field}>
        {(context: any) => {
          const binding = context.binding
          return (
            <Checkbox
              id={binding.controlId}
              isSelected={(binding.draftValue ?? binding.value) as boolean}
              onChange={binding.setInput}
              disabled={context.disabled}
              readOnly={context.readOnly}
              aria-labelledby={context.labelId}
              aria-describedby={describedBy(context, false, binding)}
              {...bindingAria(binding)}
            />
          )
        }}
      </Dashlet>
    )
  },
)

export type RadioGroupDashletProps<
  T extends ChoiceValue,
  F extends AnyField = AnyField,
> = ChoiceShell<T> & FieldProps<F, T> & Pick<RadioGroupProps<T>, 'orientation'>
function RadioGroupDashletInner<T extends ChoiceValue, F extends AnyField = AnyField>(
  props: RadioGroupDashletProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { field, options, orientation, layout, ...shell } = props
  validateChoices(options)
  return (
    <Dashlet {...shell} layout={layout ?? 'block'} ref={ref} field={field}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as T
        const value = (binding.draftValue ?? canonical) as T
        const compatible = hasChoice(options, canonical)
        return (
          <>
            <RadioGroup
              id={binding.controlId}
              value={compatible ? value : undefined}
              onChange={binding.setInput}
              options={options}
              orientation={orientation}
              disabled={context.disabled}
              readOnly={context.readOnly}
              aria-labelledby={context.labelId}
              aria-describedby={describedBy(context, !compatible, binding)}
              {...bindingAria(binding)}
            />
            {!compatible ? (
              <PresentationWarning context={context}>
                The current value ({String(canonical)}) is not in the configured choices.
              </PresentationWarning>
            ) : null}
          </>
        )
      }}
    </Dashlet>
  )
}
export const RadioGroupDashlet = forwardRef(RadioGroupDashletInner) as <
  T extends ChoiceValue,
  F extends AnyField = AnyField,
>(
  props: RadioGroupDashletProps<T, F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export type ComboboxDashletProps<
  T extends ChoiceValue,
  F extends AnyField = AnyField,
> = ChoiceShell<T> & FieldProps<F, T> & Pick<ComboboxProps<T>, 'placeholder'>
function ComboboxDashletInner<T extends ChoiceValue, F extends AnyField = AnyField>(
  props: ComboboxDashletProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { field, options, placeholder, layout, ...shell } = props
  validateChoices(options)
  return (
    <Dashlet {...shell} layout={layout ?? 'block'} ref={ref} field={field}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as T
        const value = (binding.draftValue ?? canonical) as T
        const compatible = hasChoice(options, canonical)
        return (
          <>
            <Combobox
              id={binding.controlId}
              value={compatible ? value : undefined}
              onChange={binding.setInput}
              options={options}
              placeholder={placeholder}
              disabled={context.disabled}
              readOnly={context.readOnly}
              aria-labelledby={context.labelId}
              aria-describedby={describedBy(context, !compatible, binding)}
              {...bindingAria(binding)}
            />
            {!compatible ? (
              <PresentationWarning context={context}>
                The current value ({String(canonical)}) is not in the configured choices.
              </PresentationWarning>
            ) : null}
          </>
        )
      }}
    </Dashlet>
  )
}
export const ComboboxDashlet = forwardRef(ComboboxDashletInner) as <
  T extends ChoiceValue,
  F extends AnyField = AnyField,
>(
  props: ComboboxDashletProps<T, F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export type CheckboxGroupDashletProps<
  T extends ChoiceValue,
  F extends AnyField = AnyField,
> = ArrayChoiceShell<T> & FieldProps<F, readonly T[]>
function CheckboxGroupDashletInner<T extends ChoiceValue, F extends AnyField = AnyField>(
  props: CheckboxGroupDashletProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { field, options, layout, ...shell } = props
  validateChoices(options)
  return (
    <Dashlet {...shell} layout={layout ?? 'block'} ref={ref} field={field}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as readonly T[]
        const value = (binding.draftValue ?? canonical) as readonly T[]
        const compatible = arrayCompatible(options, canonical)
        return (
          <>
            <CheckboxGroup
              id={binding.controlId}
              value={compatible ? value : []}
              onChange={(next) => binding.setInput(next as unknown as PicodashJsonValue)}
              options={options}
              disabled={context.disabled || !compatible}
              readOnly={context.readOnly}
              aria-labelledby={context.labelId}
              aria-describedby={describedBy(context, !compatible, binding)}
              {...bindingAria(binding)}
            />
            {!compatible ? (
              <PresentationWarning context={context}>
                The current value ({jsonText(canonical)}) contains values that are not in the
                configured choices.
              </PresentationWarning>
            ) : null}
          </>
        )
      }}
    </Dashlet>
  )
}
export const CheckboxGroupDashlet = forwardRef(CheckboxGroupDashletInner) as <
  T extends ChoiceValue,
  F extends AnyField = AnyField,
>(
  props: CheckboxGroupDashletProps<T, F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export type MultiSelectDashletProps<
  T extends ChoiceValue,
  F extends AnyField = AnyField,
> = ArrayChoiceShell<T> & FieldProps<F, readonly T[]> & Pick<MultiSelectProps<T>, 'placeholder'>
function MultiSelectDashletInner<T extends ChoiceValue, F extends AnyField = AnyField>(
  props: MultiSelectDashletProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { field, options, placeholder, layout, ...shell } = props
  validateChoices(options)
  return (
    <Dashlet {...shell} layout={layout ?? 'block'} ref={ref} field={field}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as readonly T[]
        const value = (binding.draftValue ?? canonical) as readonly T[]
        const compatible = arrayCompatible(options, canonical)
        return (
          <>
            <MultiSelect
              id={binding.controlId}
              value={compatible ? value : []}
              onChange={(next) => binding.setInput(next as unknown as PicodashJsonValue)}
              options={options}
              placeholder={placeholder}
              disabled={context.disabled || !compatible}
              readOnly={context.readOnly}
              aria-labelledby={context.labelId}
              aria-describedby={describedBy(context, !compatible, binding)}
              {...bindingAria(binding)}
            />
            {!compatible ? (
              <PresentationWarning context={context}>
                The current value ({jsonText(canonical)}) contains values that are not in the
                configured choices.
              </PresentationWarning>
            ) : null}
          </>
        )
      }}
    </Dashlet>
  )
}
export const MultiSelectDashlet = forwardRef(MultiSelectDashletInner) as <
  T extends ChoiceValue,
  F extends AnyField = AnyField,
>(
  props: MultiSelectDashletProps<T, F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export type SearchDashletProps<F extends AnyField = AnyField> = Shell &
  FieldProps<F, string> &
  Pick<SearchFieldProps, 'placeholder'>
export const SearchDashlet = forwardRef<HTMLDivElement, SearchDashletProps>(function SearchDashlet(
  { field, placeholder, ...props },
  ref,
) {
  return (
    <Dashlet {...props} ref={ref} field={field}>
      {(context: any) => {
        const binding = context.binding
        return (
          <SearchField
            id={binding.controlId}
            value={(binding.draftValue ?? binding.value) as string}
            onChange={binding.setInput}
            placeholder={placeholder}
            disabled={context.disabled}
            readOnly={context.readOnly}
            aria-labelledby={context.labelId}
            aria-describedby={describedBy(context, false, binding)}
            {...bindingAria(binding)}
          />
        )
      }}
    </Dashlet>
  )
})

function validateChoices<T extends ChoiceValue>(options: readonly SelectOption<T>[]): void {
  const seen = new Set<string>()
  for (const option of options) {
    const value = optionValue(option)
    if (
      (typeof value !== 'string' && typeof value !== 'number') ||
      (typeof value === 'number' && !Number.isFinite(value))
    )
      throw new TypeError('choice values must be finite strings or numbers.')
    const key = `${typeof value}:${String(value)}`
    if (seen.has(key)) throw new TypeError('options must contain unique values.')
    seen.add(key)
    if (
      typeof option === 'object' &&
      option !== null &&
      option.label !== undefined &&
      typeof option.label !== 'string' &&
      !option.textValue
    )
      throw new TypeError('non-text option labels require textValue.')
  }
}
