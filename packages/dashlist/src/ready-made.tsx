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
type FieldProps<F extends AnyField, Value> = {
  readonly field: F & (FieldValue<F> extends Value ? unknown : never)
}
type ChoiceValue = string | number
type ChoiceFieldProps<F extends AnyField, T extends ChoiceValue> = {
  readonly field: F &
    ([FieldValue<F>] extends [string]
      ? [T] extends [FieldValue<F>]
        ? unknown
        : never
      : [FieldValue<F>] extends [number]
        ? [T] extends [FieldValue<F>]
          ? unknown
          : never
        : never)
}
type Shell = Omit<
  DashletProps<any, any, 'input'>,
  'field' | 'children' | 'label' | 'mode' | 'primaryFocusRef'
> & {
  readonly label: ReactNode
}

export type DashletChoiceOption<T extends string | number> = SelectOption<T>
export type SliderDashletMark = SliderMark

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

function onStep(value: number, min: number, step: number): boolean {
  const quotient = (value - min) / step
  if (!Number.isFinite(quotient)) return false
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(quotient)) * 100
  return Math.abs(quotient - Math.round(quotient)) <= tolerance
}

function numberCompatible(
  value: number,
  min: number | undefined,
  max: number | undefined,
  step: number | undefined,
): boolean {
  if (!Number.isFinite(value)) return false
  if (min !== undefined && value < min) return false
  if (max !== undefined && value > max) return false
  // React Aria anchors an explicitly stepped NumberField to zero when no min is given.
  return step === undefined || onStep(value, min ?? 0, step)
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

export type TextDashletProps<F extends AnyField = AnyField> = Shell &
  FieldProps<F, string> &
  Pick<TextFieldProps, 'multiline' | 'minRows' | 'placeholder'>
function TextDashletInner<F extends AnyField = AnyField>(
  { field, multiline, minRows, placeholder, ...props }: TextDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
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
            aria-describedby={describedBy(context, false, binding)}
            {...bindingAria(binding)}
          />
        )
      }}
    </Dashlet>
  )
}
export const TextDashlet = forwardRef(TextDashletInner) as <F extends AnyField>(
  props: TextDashletProps<F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export type NumberDashletProps<F extends AnyField = AnyField> = Shell &
  FieldProps<F, number> &
  Pick<NumberFieldProps, 'min' | 'max' | 'step' | 'placeholder' | 'formatOptions'>
function NumberDashletInner<F extends AnyField = AnyField>(
  { field, min, max, step, placeholder, formatOptions, ...props }: NumberDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateBounds(min, max)
  validateStep(step)
  return (
    <Dashlet {...props} ref={ref} field={field}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as number
        const value = (binding.draftValue ?? canonical) as number
        const rangeMismatch =
          (min !== undefined && canonical < min) || (max !== undefined && canonical > max)
        const stepMismatch =
          !rangeMismatch && step !== undefined && !numberCompatible(canonical, min, max, step)
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
            {mismatch ? (
              <PresentationWarning context={context}>
                {rangeMismatch
                  ? `The current value (${String(canonical)}) is outside the configured range.`
                  : `The current value (${String(canonical)}) is not on the configured number step.`}
              </PresentationWarning>
            ) : null}
          </>
        )
      }}
    </Dashlet>
  )
}
export const NumberDashlet = forwardRef(NumberDashletInner) as <F extends AnyField>(
  props: NumberDashletProps<F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export type SliderDashletProps<F extends AnyField = AnyField> = Shell &
  FieldProps<F, number> &
  Pick<SliderProps, 'min' | 'max' | 'step' | 'marks' | 'formatOptions'> & {
    readonly formatValue?: (canonical: number) => ReactNode
  }
function SliderDashletInner<F extends AnyField = AnyField>(
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
    <Dashlet {...props} ref={ref} field={field}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as number
        const value = (binding.draftValue ?? canonical) as number
        const rangeMismatch = canonical < min || canonical > max
        const stepMismatch = !rangeMismatch && !numberCompatible(canonical, min, max, step)
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
            {mismatch ? (
              <PresentationWarning context={context}>
                {rangeMismatch
                  ? `The current value (${String(canonical)}) is outside the configured range.`
                  : `The current value (${String(canonical)}) is not on the configured slider step.`}
              </PresentationWarning>
            ) : null}
          </>
        )
      }}
    </Dashlet>
  )
}
export const SliderDashlet = forwardRef(SliderDashletInner) as <F extends AnyField>(
  props: SliderDashletProps<F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export type SwitchDashletProps<F extends AnyField = AnyField> = Shell & FieldProps<F, boolean>
function SwitchDashletInner<F extends AnyField = AnyField>(
  { field, ...props }: SwitchDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
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
            aria-describedby={describedBy(context, false, binding)}
            {...bindingAria(binding)}
          />
        )
      }}
    </Dashlet>
  )
}
export const SwitchDashlet = forwardRef(SwitchDashletInner) as <F extends AnyField>(
  props: SwitchDashletProps<F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

type ChoiceShell<T extends string | number> = Shell & {
  readonly options: readonly SelectOption<T>[]
}
type SelectChoiceShell<T extends string | number> = ChoiceShell<T> & {
  readonly placeholder?: string
}
export type SelectDashletProps<
  T extends string | number,
  F extends AnyField = AnyField,
> = SelectChoiceShell<T> & ChoiceFieldProps<F, T>
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
              disabled={context.disabled || options.length === 0}
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
export const SelectDashlet = forwardRef(SelectDashletInner) as <
  T extends string | number,
  F extends AnyField,
>(
  props: SelectDashletProps<T, F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export type SegmentedDashletProps<
  T extends string | number,
  F extends AnyField = AnyField,
> = ChoiceShell<T> & ChoiceFieldProps<F, T>
function SegmentedDashletInner<T extends string | number, F extends AnyField = AnyField>(
  props: SegmentedDashletProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateChoices(props.options)
  const { field, options, ...rawShell } = props
  const { placeholder: _placeholder, ...shell } = rawShell as typeof rawShell & {
    readonly placeholder?: string
  }
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
export const SegmentedDashlet = forwardRef(SegmentedDashletInner) as <
  T extends string | number,
  F extends AnyField,
>(
  props: SegmentedDashletProps<T, F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export type DisplayDashletProps<F extends AnyField = AnyField> = Omit<
  Shell,
  'readOnly' | 'disabled'
> &
  FieldProps<F, PicodashJsonValue> & {
    readonly formatValue?: (value: FieldValue<F>) => ReactNode
  }
function DisplayDashletInner<F extends AnyField = AnyField>(
  { field, formatValue, ...props }: DisplayDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <Dashlet {...props} ref={ref} field={field} mode="display">
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
export const DisplayDashlet = forwardRef(DisplayDashletInner) as <F extends AnyField>(
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
