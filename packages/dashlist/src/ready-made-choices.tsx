'use client'

import {
  forwardRef,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react'
import type { PicodashJsonValue } from '@picodash/nexus'
import { Dashlet, type DashletProps } from './index.js'
import { PresentationWarning, presentationWarningId } from './presentation-warning.js'
import { asDashletBindingField } from './ready-made-field-types.js'
import type {
  ArrayChoiceField,
  ArrayChoiceFallbackField,
  ArrayChoiceFieldProps,
  ArrayChoiceOptionValue,
  ChoiceField,
  ChoiceFieldProps,
  ChoiceOptionValue,
  ChoiceValue,
  ExactField,
  ScalarField,
  WritableRootField,
  WritableScalarFieldProps,
} from './ready-made-field-types.js'
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

type Shell = Omit<
  DashletProps,
  'field' | 'children' | 'label' | 'mode' | 'primaryFocusRef' | 'defaultValue' | 'onChange'
> & {
  readonly label: ReactNode
}

type ChoiceShell<T extends ChoiceValue> = Shell & {
  readonly options: readonly SelectOption<T>[]
}
type ArrayChoiceShell<T extends ChoiceValue> = ChoiceShell<T>

function describedBy(context: any, warning: boolean, binding?: any): string | undefined {
  const ids = [
    context.descriptionId,
    binding?.issuesId ?? context.issuesId,
    warning ? presentationWarningId(context.binding.controlId) : undefined,
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

export type CheckboxDashletProps<F extends ScalarField<boolean> = ExactField<boolean>> = Shell &
  WritableScalarFieldProps<F, boolean>
function CheckboxDashletInner<F extends ScalarField<boolean>>(
  { field, ...props }: CheckboxDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <Dashlet {...props} ref={ref} field={asDashletBindingField(field)}>
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
}
export const CheckboxDashlet = forwardRef(CheckboxDashletInner) as {
  <const F extends ExactField<boolean>>(
    props: CheckboxDashletProps<F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  <const Key extends string, const Values extends Record<Key, boolean>>(
    props: CheckboxDashletProps<WritableRootField<Key, boolean, Values>> &
      RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: CheckboxDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type RadioGroupDashletProps<
  T extends ChoiceValue = ChoiceValue,
  F extends ChoiceField = ChoiceField,
> = F extends ChoiceField
  ? ChoiceShell<ChoiceOptionValue<F, T>> &
      ChoiceFieldProps<F, T> &
      Pick<RadioGroupProps<ChoiceOptionValue<F, T>>, 'orientation'>
  : never
type RadioGroupDashletInnerProps<T extends ChoiceValue, F extends ChoiceField> = ChoiceShell<T> &
  ChoiceFieldProps<F, T> &
  Pick<RadioGroupProps<T>, 'orientation'>
function RadioGroupDashletInner<T extends ChoiceValue, F extends ChoiceField>(
  props: RadioGroupDashletInnerProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { field, options, orientation, layout, ...shell } = props
  validateChoices(options)
  return (
    <Dashlet {...shell} layout={layout ?? 'block'} ref={ref} field={asDashletBindingField(field)}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as T
        const displayCandidate = (binding.draftValue ?? canonical) as T
        const canonicalCompatible = hasChoice(options, canonical)
        const displayCompatible = hasChoice(options, displayCandidate)
        return (
          <>
            <RadioGroup
              id={binding.controlId}
              value={displayCompatible ? displayCandidate : undefined}
              onChange={binding.setInput}
              options={options}
              orientation={orientation}
              disabled={context.disabled}
              readOnly={context.readOnly}
              aria-labelledby={context.labelId}
              aria-describedby={describedBy(context, !canonicalCompatible, binding)}
              {...bindingAria(binding)}
            />
            <PresentationWarning
              context={context}
              incompatible={!canonicalCompatible}
              message={`The current value (${String(canonical)}) is not in the configured choices.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const RadioGroupDashlet = forwardRef(RadioGroupDashletInner) as {
  <T extends ChoiceValue, F extends ChoiceField>(
    props: RadioGroupDashletProps<T, F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: RadioGroupDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type ComboboxDashletProps<
  T extends ChoiceValue = ChoiceValue,
  F extends ChoiceField = ChoiceField,
> = F extends ChoiceField
  ? ChoiceShell<ChoiceOptionValue<F, T>> &
      ChoiceFieldProps<F, T> &
      Pick<ComboboxProps<ChoiceOptionValue<F, T>>, 'placeholder'>
  : never
type ComboboxDashletInnerProps<T extends ChoiceValue, F extends ChoiceField> = ChoiceShell<T> &
  ChoiceFieldProps<F, T> &
  Pick<ComboboxProps<T>, 'placeholder'>
function ComboboxDashletInner<T extends ChoiceValue, F extends ChoiceField>(
  props: ComboboxDashletInnerProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { field, options, placeholder, layout, ...shell } = props
  validateChoices(options)
  return (
    <Dashlet {...shell} layout={layout ?? 'block'} ref={ref} field={asDashletBindingField(field)}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as T
        const displayCandidate = (binding.draftValue ?? canonical) as T
        const canonicalCompatible = hasChoice(options, canonical)
        const displayCompatible = hasChoice(options, displayCandidate)
        return (
          <>
            <Combobox
              id={binding.controlId}
              value={displayCompatible ? displayCandidate : undefined}
              onChange={binding.setInput}
              options={options}
              placeholder={placeholder}
              disabled={context.disabled}
              readOnly={context.readOnly}
              aria-labelledby={context.labelId}
              aria-describedby={describedBy(context, !canonicalCompatible, binding)}
              {...bindingAria(binding)}
            />
            <PresentationWarning
              context={context}
              incompatible={!canonicalCompatible}
              message={`The current value (${String(canonical)}) is not in the configured choices.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const ComboboxDashlet = forwardRef(ComboboxDashletInner) as {
  <T extends ChoiceValue, F extends ChoiceField>(
    props: ComboboxDashletProps<T, F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: ComboboxDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type CheckboxGroupDashletProps<
  T extends ChoiceValue = ChoiceValue,
  F extends ArrayChoiceField = ArrayChoiceFallbackField,
> = F extends ArrayChoiceField
  ? ArrayChoiceShell<ArrayChoiceOptionValue<F, T>> & ArrayChoiceFieldProps<F, T>
  : never
type CheckboxGroupDashletInnerProps<
  T extends ChoiceValue,
  F extends ArrayChoiceField,
> = ArrayChoiceShell<T> & ArrayChoiceFieldProps<F, T>
function CheckboxGroupDashletInner<T extends ChoiceValue, F extends ArrayChoiceField>(
  props: CheckboxGroupDashletInnerProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { field, options, layout, ...shell } = props
  validateChoices(options)
  return (
    <Dashlet {...shell} layout={layout ?? 'block'} ref={ref} field={asDashletBindingField(field)}>
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
            <PresentationWarning
              context={context}
              incompatible={!compatible}
              message={`The current value (${jsonText(canonical)}) cannot be represented by the configured choices. Values must be configured, unique, and in declared option order.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const CheckboxGroupDashlet = forwardRef(CheckboxGroupDashletInner) as {
  <T extends ChoiceValue, F extends ArrayChoiceField>(
    props: CheckboxGroupDashletProps<T, F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: CheckboxGroupDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type MultiSelectDashletProps<
  T extends ChoiceValue = ChoiceValue,
  F extends ArrayChoiceField = ArrayChoiceFallbackField,
> = F extends ArrayChoiceField
  ? ArrayChoiceShell<ArrayChoiceOptionValue<F, T>> &
      ArrayChoiceFieldProps<F, T> &
      Pick<MultiSelectProps<ArrayChoiceOptionValue<F, T>>, 'placeholder'>
  : never
type MultiSelectDashletInnerProps<
  T extends ChoiceValue,
  F extends ArrayChoiceField,
> = ArrayChoiceShell<T> & ArrayChoiceFieldProps<F, T> & Pick<MultiSelectProps<T>, 'placeholder'>
function MultiSelectDashletInner<T extends ChoiceValue, F extends ArrayChoiceField>(
  props: MultiSelectDashletInnerProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { field, options, placeholder, layout, ...shell } = props
  validateChoices(options)
  return (
    <Dashlet {...shell} layout={layout ?? 'block'} ref={ref} field={asDashletBindingField(field)}>
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
            <PresentationWarning
              context={context}
              incompatible={!compatible}
              message={`The current value (${jsonText(canonical)}) cannot be represented by the configured choices. Values must be configured, unique, and in declared option order.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const MultiSelectDashlet = forwardRef(MultiSelectDashletInner) as {
  <T extends ChoiceValue, F extends ArrayChoiceField>(
    props: MultiSelectDashletProps<T, F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: MultiSelectDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type SearchDashletProps<F extends ScalarField<string> = ExactField<string>> = Shell &
  WritableScalarFieldProps<F, string> &
  Pick<SearchFieldProps, 'placeholder'>
function SearchDashletInner<F extends ScalarField<string>>(
  { field, placeholder, ...props }: SearchDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <Dashlet {...props} ref={ref} field={asDashletBindingField(field)}>
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
}
export const SearchDashlet = forwardRef(SearchDashletInner) as {
  <F extends ScalarField<string>>(
    props: SearchDashletProps<F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: SearchDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

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
