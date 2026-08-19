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
import { isNumberCompatible, isStepPrecisionScalable } from './number-compatibility.js'
import { PresentationWarning, presentationWarningId } from './presentation-warning.js'
import { asDashletBindingField } from './ready-made-field-types.js'
import type {
  ChoiceField,
  ChoiceFieldProps,
  ChoiceOptionValue,
  ChoiceValue,
  ExactField,
  FieldProps,
  FieldValue,
  ScalarField,
  WritableRootField,
  WritableScalarFieldProps,
} from './ready-made-field-types.js'
import {
  Display,
  NumberField,
  Select,
  SegmentedControl,
  Slider,
  Switch,
  TextField,
  type NumberFieldProps,
  type SelectOption,
  type SliderMark,
  type SliderProps,
  type TextFieldProps,
} from './ui.js'

type Shell = Omit<
  DashletProps,
  'field' | 'children' | 'label' | 'mode' | 'primaryFocusRef' | 'defaultValue' | 'onChange'
> & {
  readonly label: ReactNode
}

export type DashletChoiceOption<T extends string | number> = SelectOption<T>
export type SliderDashletMark = SliderMark

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

function validateFinite(name: string, value: number | undefined): void {
  if (value !== undefined && !Number.isFinite(value)) throw new TypeError(`${name} must be finite.`)
}
function validateBounds(min: number | undefined, max: number | undefined): void {
  validateFinite('min', min)
  validateFinite('max', max)
  if (min !== undefined && max !== undefined && min > max)
    throw new TypeError('min must be less than or equal to max.')
}
function validateStep(step: number | undefined): void {
  if (step !== undefined && (!Number.isFinite(step) || step <= 0))
    throw new TypeError('step must be a positive finite number.')
}

function validateChoices<T extends string | number>(options: readonly SelectOption<T>[]): void {
  const seen = new Set<string>()
  for (const option of options) {
    const value = typeof option === 'object' && option !== null ? option.value : option
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

export type TextDashletProps<F extends ScalarField<string> = ExactField<string>> = Shell &
  WritableScalarFieldProps<F, string> &
  Pick<TextFieldProps, 'multiline' | 'minRows' | 'placeholder'>
function TextDashletInner<F extends ScalarField<string>>(
  { field, multiline, minRows, placeholder, ...props }: TextDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <Dashlet {...props} ref={ref} field={asDashletBindingField(field)}>
      {(context: any) => {
        const binding = context.binding
        const value = (binding.draftValue ?? binding.value) as string
        return (
          <TextField
            id={binding.controlId}
            value={value}
            onChange={binding.setInput}
            multiline={multiline}
            minRows={minRows}
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
export const TextDashlet = forwardRef(TextDashletInner) as {
  <F extends ScalarField<string>>(
    props: TextDashletProps<F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: TextDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type NumberDashletProps<F extends ScalarField<number> = ExactField<number>> = Shell &
  WritableScalarFieldProps<F, number> &
  Pick<NumberFieldProps, 'min' | 'max' | 'step' | 'placeholder' | 'formatOptions'>
function NumberDashletInner<F extends ScalarField<number>>(
  { field, min, max, step, placeholder, formatOptions, ...props }: NumberDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateBounds(min, max)
  validateStep(step)
  return (
    <Dashlet {...props} ref={ref} field={asDashletBindingField(field)}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as number
        const value = (binding.draftValue ?? canonical) as number
        const rangeMismatch =
          (min !== undefined && canonical < min) || (max !== undefined && canonical > max)
        const stepMismatch =
          !rangeMismatch && step !== undefined && !isNumberCompatible(canonical, min, max, step)
        const mismatch = rangeMismatch || stepMismatch
        return (
          <>
            {mismatch ? (
              <output
                id={binding.controlId}
                data-picodash-dashlist-number-value
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true, binding)}
              >
                {String(canonical)}
              </output>
            ) : (
              <NumberField
                id={binding.controlId}
                value={value}
                onChange={(next) => next !== null && binding.setInput(next)}
                min={min}
                max={max}
                step={step}
                formatOptions={formatOptions}
                placeholder={placeholder}
                disabled={context.disabled}
                readOnly={context.readOnly}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, false, binding)}
                {...bindingAria(binding)}
              />
            )}
            <PresentationWarning
              context={context}
              incompatible={mismatch}
              message={
                rangeMismatch
                  ? `The current value (${String(canonical)}) is outside the configured range.`
                  : `The current value (${String(canonical)}) is not on the configured number step.`
              }
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const NumberDashlet = forwardRef(NumberDashletInner) as {
  <F extends ScalarField<number>>(
    props: NumberDashletProps<F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: NumberDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type SliderDashletProps<F extends ScalarField<number> = ExactField<number>> = Shell &
  WritableScalarFieldProps<F, number> &
  Pick<SliderProps, 'min' | 'max' | 'step' | 'marks' | 'formatOptions'> & {
    readonly formatValue?: (canonical: number) => ReactNode
  }
function SliderDashletInner<F extends ScalarField<number>>(
  {
    field,
    min = 0,
    max = 100,
    step = 1,
    marks,
    formatValue,
    formatOptions,
    ...props
  }: SliderDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateBounds(min, max)
  validateStep(step)
  if (marks?.some((mark) => !Number.isFinite(mark.value) || mark.value < min || mark.value > max))
    throw new TypeError('marks values must be finite and within the slider bounds.')
  return (
    <Dashlet {...props} ref={ref} field={asDashletBindingField(field)}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as number
        const value = (binding.draftValue ?? canonical) as number
        const rangeMismatch = canonical < min || canonical > max
        const unsupportedStep = !rangeMismatch && !isStepPrecisionScalable(step)
        const stepMismatch =
          !rangeMismatch && (unsupportedStep || !isNumberCompatible(canonical, min, max, step))
        const mismatch = rangeMismatch || stepMismatch
        return (
          <>
            {mismatch ? (
              <output
                id={binding.controlId}
                data-picodash-dashlist-slider-canonical
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true, binding)}
              >
                {String(canonical)}
              </output>
            ) : (
              <Slider
                id={binding.controlId}
                value={value}
                onChange={binding.setInput}
                min={min}
                max={max}
                step={step}
                marks={marks}
                formatOptions={formatOptions}
                disabled={context.disabled}
                readOnly={context.readOnly}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, false, binding)}
                {...bindingAria(binding)}
              />
            )}
            {formatValue && !mismatch ? (
              <output data-picodash-dashlist-slider-value>{formatValue(canonical)}</output>
            ) : null}
            <PresentationWarning
              context={context}
              incompatible={mismatch}
              message={
                rangeMismatch
                  ? `The current value (${String(canonical)}) is outside the configured range.`
                  : unsupportedStep
                    ? `The current value (${String(canonical)}) cannot be represented safely with the configured slider step (${String(step)}).`
                    : `The current value (${String(canonical)}) is not on the configured slider step.`
              }
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const SliderDashlet = forwardRef(SliderDashletInner) as {
  <F extends ScalarField<number>>(
    props: SliderDashletProps<F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: SliderDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type SwitchDashletProps<F extends ScalarField<boolean> = ExactField<boolean>> = Shell &
  WritableScalarFieldProps<F, boolean>
function SwitchDashletInner<F extends ScalarField<boolean>>(
  { field, ...props }: SwitchDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <Dashlet {...props} ref={ref} field={asDashletBindingField(field)}>
      {(context: any) => {
        const binding = context.binding
        return (
          <Switch
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
export const SwitchDashlet = forwardRef(SwitchDashletInner) as {
  <const F extends ExactField<boolean>>(
    props: SwitchDashletProps<F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  <const Key extends string, const Values extends Record<Key, boolean>>(
    props: SwitchDashletProps<WritableRootField<Key, boolean, Values>> &
      RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: SwitchDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

type ChoiceShell<T extends ChoiceValue> = Shell & {
  readonly options: readonly SelectOption<T>[]
}
type SelectChoiceShell<T extends ChoiceValue> = ChoiceShell<T> & {
  readonly placeholder?: string
}
export type SelectDashletProps<
  T extends ChoiceValue = ChoiceValue,
  F extends ChoiceField = ChoiceField,
> = F extends ChoiceField
  ? SelectChoiceShell<ChoiceOptionValue<F, T>> & ChoiceFieldProps<F, T>
  : never
type SelectDashletInnerProps<T extends ChoiceValue, F extends ChoiceField> = SelectChoiceShell<T> &
  ChoiceFieldProps<F, T>
function SelectDashletInner<T extends ChoiceValue, F extends ChoiceField>(
  props: SelectDashletInnerProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateChoices(props.options)
  const { field, options, placeholder, ...shell } = props
  return (
    <Dashlet {...shell} ref={ref} field={asDashletBindingField(field)}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as T
        const value = (binding.draftValue ?? canonical) as T
        const compatible = options.some(
          (option) => (typeof option === 'object' ? option.value : option) === canonical,
        )
        return (
          <>
            <Select
              id={binding.controlId}
              value={value}
              onChange={binding.setInput}
              options={options}
              placeholder={placeholder}
              disabled={context.disabled || options.length === 0}
              readOnly={context.readOnly}
              aria-labelledby={context.labelId}
              aria-describedby={describedBy(context, !compatible, binding)}
              {...bindingAria(binding)}
            />
            <PresentationWarning
              context={context}
              incompatible={!compatible}
              message={`The current value (${String(canonical)}) is not in the configured choices.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const SelectDashlet = forwardRef(SelectDashletInner) as {
  <T extends ChoiceValue, F extends ChoiceField>(
    props: SelectDashletProps<T, F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: SelectDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type SegmentedDashletProps<
  T extends ChoiceValue = ChoiceValue,
  F extends ChoiceField = ChoiceField,
> = F extends ChoiceField ? ChoiceShell<ChoiceOptionValue<F, T>> & ChoiceFieldProps<F, T> : never
type SegmentedDashletInnerProps<T extends ChoiceValue, F extends ChoiceField> = ChoiceShell<T> &
  ChoiceFieldProps<F, T>
function SegmentedDashletInner<T extends ChoiceValue, F extends ChoiceField>(
  props: SegmentedDashletInnerProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateChoices(props.options)
  const { field, options, ...rawShell } = props
  const { placeholder: _placeholder, ...shell } = rawShell as typeof rawShell & {
    readonly placeholder?: string
  }
  return (
    <Dashlet {...shell} ref={ref} field={asDashletBindingField(field)}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as T
        const value = (binding.draftValue ?? canonical) as T
        const compatible = options.some(
          (option) => (typeof option === 'object' ? option.value : option) === canonical,
        )
        return (
          <>
            <SegmentedControl
              id={binding.controlId}
              value={value}
              onChange={binding.setInput}
              options={options}
              disabled={context.disabled}
              readOnly={context.readOnly}
              aria-labelledby={context.labelId}
              aria-describedby={describedBy(context, !compatible, binding)}
              {...bindingAria(binding)}
            />
            <PresentationWarning
              context={context}
              incompatible={!compatible}
              message={`The current value (${String(canonical)}) is not in the configured choices.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const SegmentedDashlet = forwardRef(SegmentedDashletInner) as {
  <T extends ChoiceValue, F extends ChoiceField>(
    props: SegmentedDashletProps<T, F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: SegmentedDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type DisplayDashletProps<
  F extends ScalarField<PicodashJsonValue> = ScalarField<PicodashJsonValue>,
> = Omit<Shell, 'readOnly' | 'disabled'> &
  FieldProps<F> & {
    readonly formatValue?: (value: FieldValue<F>) => ReactNode
  }
function DisplayDashletInner<F extends ScalarField<PicodashJsonValue>>(
  { field, formatValue, ...props }: DisplayDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <Dashlet {...props} ref={ref} field={asDashletBindingField(field)} mode="display">
      {(context: any) => {
        const value = context.binding.value as PicodashJsonValue
        return (
          <Display
            id={context.binding.controlId}
            value={value}
            renderedValue={formatValue ? formatValue(value as FieldValue<F>) : undefined}
            isFormatted={Boolean(formatValue)}
            aria-labelledby={context.labelId}
            aria-describedby={describedBy(context, false, context.binding)}
            {...bindingAria(context.binding)}
          />
        )
      }}
    </Dashlet>
  )
}
export const DisplayDashlet = forwardRef(DisplayDashletInner) as <
  F extends ScalarField<PicodashJsonValue>,
>(
  props: DisplayDashletProps<F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export {
  ColorDashlet,
  DateDashlet,
  DateRangeDashlet,
  DateTimeDashlet,
  MeterDashlet,
  ProgressDashlet,
  RangeDashlet,
  StatusDashlet,
  TimeDashlet,
} from './ready-made-values.js'
export type {
  ColorDashletProps,
  DateDashletProps,
  DateRangeDashletProps,
  DateTimeDashletProps,
  MeterDashletProps,
  ProgressDashletProps,
  RangeDashletProps,
  StatusDashletProps,
  TimeDashletProps,
} from './ready-made-values.js'

export {
  CheckboxDashlet,
  CheckboxGroupDashlet,
  ComboboxDashlet,
  MultiSelectDashlet,
  RadioGroupDashlet,
  SearchDashlet,
  type CheckboxDashletProps,
  type CheckboxGroupDashletProps,
  type ComboboxDashletProps,
  type MultiSelectDashletProps,
  type RadioGroupDashletProps,
  type SearchDashletProps,
} from './ready-made-choices.js'
