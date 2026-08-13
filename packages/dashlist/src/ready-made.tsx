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

type AnyField = PicodashField<any, any>
type FieldValue<F> =
  F extends PicodashField<infer Values, infer Key>
    ? Key extends keyof Values
      ? Values[Key]
      : never
    : never
type FieldProps<F extends AnyField, Value> =
  FieldValue<F> extends Value ? { readonly field: F } : { readonly field: never }
type Shell = Omit<DashletProps<any, any, 'input'>, 'field' | 'children' | 'label' | 'mode'> & {
  readonly label: ReactNode
}

export type DashletChoiceOption<T extends string | number> = SelectOption<T>
export type SliderDashletMark = SliderMark

function warningId(controlId: string): string {
  return `${controlId}-presentation-warning`
}

function describedBy(context: any, warning: boolean): string | undefined {
  const ids = [
    context.descriptionId,
    context.issuesId,
    warning ? warningId(context.binding.controlId) : undefined,
  ].filter((id): id is string => Boolean(id))
  return ids.length ? ids.join(' ') : undefined
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
    const value = typeof option === 'object' ? option.value : option
    const key = `${typeof value}:${String(value)}`
    if (seen.has(key)) throw new TypeError('options must contain unique values.')
    seen.add(key)
    if (
      typeof option === 'object' &&
      option.label !== undefined &&
      typeof option.label !== 'string' &&
      !option.textValue
    )
      throw new TypeError('non-text option labels require textValue.')
  }
}

export type TextDashletProps<F extends AnyField = AnyField> = Shell &
  FieldProps<F, string> &
  Pick<TextFieldProps, 'multiline' | 'minRows' | 'placeholder'>
export const TextDashlet = forwardRef<HTMLDivElement, TextDashletProps>(function TextDashlet(
  { field, multiline, minRows, placeholder, ...props },
  ref,
) {
  if (minRows !== undefined && (!multiline || !Number.isInteger(minRows) || minRows <= 0))
    throw new TypeError('minRows must be a positive integer when multiline is true.')
  return (
    <Dashlet {...props} ref={ref} field={field}>
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
            aria-describedby={describedBy(context, false)}
          />
        )
      }}
    </Dashlet>
  )
})

export type NumberDashletProps<F extends AnyField = AnyField> = Shell &
  FieldProps<F, number> &
  Pick<NumberFieldProps, 'min' | 'max' | 'step' | 'placeholder' | 'formatOptions'>
export const NumberDashlet = forwardRef<HTMLDivElement, NumberDashletProps>(function NumberDashlet(
  { field, min, max, step, placeholder, formatOptions, ...props },
  ref,
) {
  validateBounds(min, max)
  validateStep(step)
  return (
    <Dashlet {...props} ref={ref} field={field}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as number
        const value = (binding.draftValue ?? canonical) as number
        const mismatch =
          (min !== undefined && canonical < min) || (max !== undefined && canonical > max)
        return (
          <>
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
              aria-describedby={describedBy(context, mismatch)}
            />
            {mismatch ? (
              <PresentationWarning context={context}>
                The current value ({String(canonical)}) is outside the configured range.
              </PresentationWarning>
            ) : null}
          </>
        )
      }}
    </Dashlet>
  )
})

export type SliderDashletProps<F extends AnyField = AnyField> = Shell &
  FieldProps<F, number> &
  Pick<SliderProps, 'min' | 'max' | 'step' | 'marks' | 'formatOptions'> & {
    readonly formatValue?: (canonical: number) => ReactNode
  }
export const SliderDashlet = forwardRef<HTMLDivElement, SliderDashletProps>(function SliderDashlet(
  { field, min = 0, max = 100, step = 1, marks, formatValue, formatOptions, ...props },
  ref,
) {
  validateBounds(min, max)
  validateStep(step)
  if (marks?.some((mark) => !Number.isFinite(mark.value) || mark.value < min || mark.value > max))
    throw new TypeError('marks values must be finite and within the slider bounds.')
  return (
    <Dashlet {...props} ref={ref} field={field}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as number
        const value = (binding.draftValue ?? canonical) as number
        const mismatch = canonical < min || canonical > max
        return (
          <>
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
              aria-describedby={describedBy(context, mismatch)}
            />
            {formatValue ? (
              <output data-picodash-dashlist-slider-value>{formatValue(canonical)}</output>
            ) : null}
            {mismatch ? (
              <PresentationWarning context={context}>
                The current value ({String(canonical)}) is outside the configured range.
              </PresentationWarning>
            ) : null}
          </>
        )
      }}
    </Dashlet>
  )
})

export type SwitchDashletProps<F extends AnyField = AnyField> = Shell & FieldProps<F, boolean>
export const SwitchDashlet = forwardRef<HTMLDivElement, SwitchDashletProps>(function SwitchDashlet(
  { field, ...props },
  ref,
) {
  return (
    <Dashlet {...props} ref={ref} field={field}>
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
            aria-describedby={describedBy(context, false)}
          />
        )
      }}
    </Dashlet>
  )
})

type ChoiceShell<T extends string | number> = Shell & {
  readonly options: readonly SelectOption<T>[]
  readonly placeholder?: string
}
export type SelectDashletProps<
  T extends string | number,
  F extends AnyField = AnyField,
> = ChoiceShell<T> & FieldProps<F, T>
function SelectDashletInner<T extends string | number, F extends AnyField = AnyField>(
  props: SelectDashletProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateChoices(props.options)
  const { field, options, placeholder, ...shell } = props
  return (
    <Dashlet {...shell} ref={ref} field={field}>
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
              disabled={context.disabled}
              readOnly={context.readOnly}
              aria-labelledby={context.labelId}
              aria-describedby={describedBy(context, !compatible)}
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
export const SelectDashlet = forwardRef(SelectDashletInner) as <
  T extends string | number,
  F extends AnyField = AnyField,
>(
  props: SelectDashletProps<T, F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export type SegmentedDashletProps<
  T extends string | number,
  F extends AnyField = AnyField,
> = ChoiceShell<T> & FieldProps<F, T>
function SegmentedDashletInner<T extends string | number, F extends AnyField = AnyField>(
  props: SegmentedDashletProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateChoices(props.options)
  const { field, options, ...shell } = props
  return (
    <Dashlet {...shell} ref={ref} field={field}>
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
              aria-describedby={describedBy(context, !compatible)}
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
export const SegmentedDashlet = forwardRef(SegmentedDashletInner) as <
  T extends string | number,
  F extends AnyField = AnyField,
>(
  props: SegmentedDashletProps<T, F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export type DisplayDashletProps<F extends AnyField = AnyField> = Omit<
  Shell,
  'readOnly' | 'disabled'
> &
  FieldProps<F, PicodashJsonValue> & {
    readonly formatValue?: (value: PicodashJsonValue) => ReactNode
  }
export const DisplayDashlet = forwardRef<HTMLDivElement, DisplayDashletProps>(
  function DisplayDashlet({ field, formatValue, ...props }, ref) {
    return (
      <Dashlet {...props} ref={ref} field={field} mode="display">
        {(context: any) => {
          const value = context.binding.value as PicodashJsonValue
          return (
            <Display
              id={context.binding.controlId}
              value={value}
              renderedValue={formatValue ? formatValue(value) : undefined}
              isFormatted={Boolean(formatValue)}
              aria-labelledby={context.labelId}
              aria-describedby={describedBy(context, false)}
            />
          )
        }}
      </Dashlet>
    )
  },
)

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
