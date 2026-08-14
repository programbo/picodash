'use client'

import {
  forwardRef,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react'
import { parseAbsolute, parseDate, parseTime } from '@internationalized/date'
import { parseColor } from 'react-aria-components'
import type { PicodashJsonValue } from '@picodash/nexus'
import { Dashlet, type DashletProps } from './index.js'
import { isNumberCompatible } from './number-compatibility.js'
import { PresentationWarning, presentationWarningId } from './presentation-warning.js'
import { asDashletBindingField } from './ready-made-field-types.js'
import type {
  ChoiceField,
  ChoiceFieldProps,
  ChoiceOptionValue,
  ChoiceValue,
  ExactField,
  ExactCompoundFieldProps,
  FieldProps,
  ScalarField,
  WritableScalarFieldProps,
} from './ready-made-field-types.js'
import {
  ColorField,
  DateField,
  DateRangeField,
  DateTimeField,
  Meter,
  ProgressBar,
  RangeSlider,
  Status,
  TimeField,
  serializeColor,
  type ColorFormat,
  type DateFieldProps,
  type DateRangeFieldProps,
  type DateTimeFieldProps,
  type MeterProps,
  type NumberRangeValue,
  type ProgressBarProps,
  type RangeSliderProps,
  type StatusOption,
  type TimeFieldProps,
  validateSupportedColorFormat,
} from './ui-values.js'

type Shell = Omit<
  DashletProps,
  'field' | 'children' | 'label' | 'mode' | 'primaryFocusRef' | 'defaultValue' | 'onChange'
> & {
  readonly label: ReactNode
}

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

function validateLocale(locale: string | undefined): void {
  if (locale === undefined) return
  try {
    Intl.getCanonicalLocales(locale)
  } catch {
    throw new TypeError('locale must be a valid BCP 47 language tag.')
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

function rangeCompatible(value: NumberRangeValue, min: number, max: number, step: number): boolean {
  return (
    Number.isFinite(value.start) &&
    Number.isFinite(value.end) &&
    value.start <= value.end &&
    value.start >= min &&
    value.end <= max &&
    isNumberCompatible(value.start, min, max, step) &&
    isNumberCompatible(value.end, min, max, step)
  )
}

function rangeText(value: NumberRangeValue): string {
  return `{ start: ${String(value.start)}, end: ${String(value.end)} }`
}

function temporalPrecisionCompatible(
  value: { readonly minute: number; readonly second: number; readonly millisecond: number },
  granularity: 'hour' | 'minute' | 'second' | undefined,
): boolean {
  const effectiveGranularity = granularity ?? 'minute'
  if (effectiveGranularity === 'hour')
    return value.minute === 0 && value.second === 0 && value.millisecond === 0
  if (effectiveGranularity === 'minute') return value.second === 0 && value.millisecond === 0
  return value.millisecond === 0
}

export type RangeDashletProps<
  F extends ScalarField<PicodashJsonValue> = ExactField<NumberRangeValue>,
> = Shell &
  ExactCompoundFieldProps<F, NumberRangeValue> &
  Pick<RangeSliderProps, 'min' | 'max' | 'step' | 'formatOptions'> & {
    readonly formatValue?: (value: NumberRangeValue) => ReactNode
  }

function RangeDashletInner<F extends ScalarField<PicodashJsonValue>>(
  {
    field,
    min = 0,
    max = 100,
    step = 1,
    formatOptions,
    formatValue,
    ...props
  }: RangeDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateBounds(min, max)
  validateStep(step)
  return (
    <Dashlet
      {...props}
      ref={ref}
      field={asDashletBindingField(field)}
      layout={props.layout ?? 'block'}
    >
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as NumberRangeValue
        const value = (binding.draftValue ?? canonical) as NumberRangeValue
        const mismatch = !rangeCompatible(canonical, min, max, step)
        return (
          <>
            {mismatch ? (
              <output
                id={binding.controlId}
                data-picodash-dashlist-range-value
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true, binding)}
              >
                {JSON.stringify(canonical)}
              </output>
            ) : (
              <RangeSlider
                id={binding.controlId}
                value={value}
                onChange={binding.setInput}
                min={min}
                max={max}
                step={step}
                formatOptions={formatOptions}
                disabled={context.disabled}
                readOnly={context.readOnly}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, false, binding)}
                {...bindingAria(binding)}
              />
            )}
            {formatValue && !mismatch ? (
              <output data-picodash-dashlist-range-value>{formatValue(canonical)}</output>
            ) : null}
            <PresentationWarning
              context={context}
              incompatible={mismatch}
              message={`The current range (${rangeText(canonical)}) is outside the configured range.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const RangeDashlet = forwardRef(RangeDashletInner) as unknown as {
  <F extends ScalarField<PicodashJsonValue>>(
    props: RangeDashletProps<F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: RangeDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type MeterDashletProps<F extends ScalarField<number> = ScalarField<number>> = Omit<
  Shell,
  'readOnly' | 'disabled'
> &
  FieldProps<F> &
  Pick<MeterProps, 'min' | 'max' | 'formatOptions'> & {
    readonly formatValue?: (value: number) => ReactNode
  }

function MeterDashletInner<F extends ScalarField<number>>(
  { field, min = 0, max = 100, formatOptions, formatValue, ...props }: MeterDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateBounds(min, max)
  return (
    <Dashlet {...props} ref={ref} field={asDashletBindingField(field)} mode="display">
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as number
        const mismatch = !Number.isFinite(canonical) || canonical < min || canonical > max
        return (
          <>
            {mismatch ? (
              <output
                id={binding.controlId}
                data-picodash-dashlist-meter-value
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true, binding)}
              >
                {String(canonical)}
              </output>
            ) : (
              <Meter
                id={binding.controlId}
                value={canonical}
                min={min}
                max={max}
                formatOptions={formatOptions}
                formatValue={formatValue}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, false, binding)}
                {...bindingAria(binding)}
              />
            )}
            <PresentationWarning
              context={context}
              incompatible={mismatch}
              message={`The current value (${String(canonical)}) is outside the configured range.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const MeterDashlet = forwardRef(MeterDashletInner) as <F extends ScalarField<number>>(
  props: MeterDashletProps<F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export type ProgressDashletProps<F extends ScalarField<number> = ScalarField<number>> = Omit<
  Shell,
  'readOnly' | 'disabled'
> &
  FieldProps<F> &
  Pick<ProgressBarProps, 'min' | 'max' | 'formatOptions'> & {
    readonly formatValue?: (value: number) => ReactNode
  }

function ProgressDashletInner<F extends ScalarField<number>>(
  { field, min = 0, max = 100, formatOptions, formatValue, ...props }: ProgressDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateBounds(min, max)
  return (
    <Dashlet {...props} ref={ref} field={asDashletBindingField(field)} mode="display">
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as number
        const mismatch = !Number.isFinite(canonical) || canonical < min || canonical > max
        return (
          <>
            {mismatch ? (
              <output
                id={binding.controlId}
                data-picodash-dashlist-progress-value
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true, binding)}
              >
                {String(canonical)}
              </output>
            ) : (
              <ProgressBar
                id={binding.controlId}
                value={canonical}
                min={min}
                max={max}
                formatOptions={formatOptions}
                formatValue={formatValue}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, false, binding)}
                {...bindingAria(binding)}
              />
            )}
            <PresentationWarning
              context={context}
              incompatible={mismatch}
              message={`The current value (${String(canonical)}) is outside the configured range.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const ProgressDashlet = forwardRef(ProgressDashletInner) as <F extends ScalarField<number>>(
  props: ProgressDashletProps<F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

type StatusChoice<T extends ChoiceValue> = StatusOption<T>
export type StatusDashletProps<
  T extends ChoiceValue = ChoiceValue,
  F extends ChoiceField = ChoiceField,
> = F extends ChoiceField
  ? Omit<Shell, 'readOnly' | 'disabled'> &
      ChoiceFieldProps<F, T> & {
        readonly options: readonly StatusChoice<ChoiceOptionValue<F, T>>[]
      }
  : never
type StatusDashletInnerProps<T extends ChoiceValue, F extends ChoiceField> = Omit<
  Shell,
  'readOnly' | 'disabled'
> &
  ChoiceFieldProps<F, T> & {
    readonly options: readonly StatusChoice<T>[]
  }

function validateStatusOptions<T extends ChoiceValue>(options: readonly StatusChoice<T>[]): void {
  const seen = new Set<string>()
  for (const option of options) {
    if (
      (typeof option.value !== 'string' && typeof option.value !== 'number') ||
      (typeof option.value === 'number' && !Number.isFinite(option.value))
    )
      throw new TypeError('status values must be finite strings or numbers.')
    const key = `${typeof option.value}:${String(option.value)}`
    if (seen.has(key)) throw new TypeError('options must contain unique values.')
    seen.add(key)
    if (typeof option.label !== 'string' && !option.textValue)
      throw new TypeError('non-text status labels require textValue.')
    if (!['neutral', 'info', 'success', 'warning', 'danger'].includes(option.tone))
      throw new TypeError('status options require a valid tone.')
  }
}

function StatusDashletInner<T extends ChoiceValue, F extends ChoiceField>(
  props: StatusDashletInnerProps<T, F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateStatusOptions(props.options)
  const { field, options, ...shell } = props
  return (
    <Dashlet {...shell} ref={ref} field={asDashletBindingField(field)} mode="display">
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as string | number
        const compatible = options.some((option) => Object.is(option.value, canonical))
        return (
          <>
            <Status
              id={binding.controlId}
              value={canonical}
              options={options}
              aria-labelledby={context.labelId}
              aria-describedby={describedBy(context, !compatible, binding)}
              {...bindingAria(binding)}
            />
            <PresentationWarning
              context={context}
              incompatible={!compatible}
              message={`The current value (${String(canonical)}) is not in the configured status options.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const StatusDashlet = forwardRef(StatusDashletInner) as {
  <T extends ChoiceValue, F extends ChoiceField>(
    props: StatusDashletProps<T, F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: StatusDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

type TemporalCommon = Pick<DateFieldProps, 'min' | 'max' | 'locale' | 'shouldForceLeadingZeros'>
export type DateDashletProps<F extends ScalarField<string> = ExactField<string>> = Shell &
  WritableScalarFieldProps<F, string> &
  TemporalCommon

function DateDashletInner<F extends ScalarField<string>>(
  { field, min, max, locale, shouldForceLeadingZeros, ...props }: DateDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateLocale(locale)
  let parsedMin
  let parsedMax
  try {
    parsedMin = min === undefined ? undefined : parseDate(min)
    parsedMax = max === undefined ? undefined : parseDate(max)
  } catch {
    throw new TypeError('date bounds must be valid ISO dates.')
  }
  if (parsedMin && parsedMax && parsedMin.compare(parsedMax) > 0)
    throw new TypeError('min must be less than or equal to max.')
  return (
    <Dashlet {...props} ref={ref} field={asDashletBindingField(field)}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as string
        let compatible = true
        try {
          const parsed = parseDate(canonical)
          if (parsedMin && parsed.compare(parsedMin) < 0) compatible = false
          if (parsedMax && parsed.compare(parsedMax) > 0) compatible = false
        } catch {
          compatible = false
        }
        return (
          <>
            {compatible ? (
              <DateField
                id={binding.controlId}
                value={(binding.draftValue ?? canonical) as string}
                onChange={(next) => next !== null && binding.setInput(next)}
                min={min}
                max={max}
                locale={locale}
                shouldForceLeadingZeros={shouldForceLeadingZeros}
                disabled={context.disabled}
                readOnly={context.readOnly}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, false, binding)}
                {...bindingAria(binding)}
              />
            ) : (
              <output
                id={binding.controlId}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true, binding)}
              >
                {canonical}
              </output>
            )}
            <PresentationWarning
              context={context}
              incompatible={!compatible}
              message={`The current value (${String(canonical)}) cannot be represented by the configured date field.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const DateDashlet = forwardRef(DateDashletInner) as {
  <F extends ScalarField<string>>(
    props: DateDashletProps<F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: DateDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type TimeDashletProps<F extends ScalarField<string> = ExactField<string>> = Shell &
  WritableScalarFieldProps<F, string> &
  Pick<
    TimeFieldProps,
    'min' | 'max' | 'locale' | 'granularity' | 'hourCycle' | 'shouldForceLeadingZeros'
  >

function TimeDashletInner<F extends ScalarField<string>>(
  {
    field,
    min,
    max,
    locale,
    granularity,
    hourCycle,
    shouldForceLeadingZeros,
    ...props
  }: TimeDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateLocale(locale)
  let parsedMin
  let parsedMax
  try {
    parsedMin = min === undefined ? undefined : parseTime(min)
    parsedMax = max === undefined ? undefined : parseTime(max)
  } catch {
    throw new TypeError('time bounds must be valid ISO local times.')
  }
  if (parsedMin && parsedMax && parsedMin.compare(parsedMax) > 0)
    throw new TypeError('min must be less than or equal to max.')
  return (
    <Dashlet {...props} ref={ref} field={asDashletBindingField(field)}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as string
        let compatible = true
        try {
          const parsed = parseTime(canonical)
          if (!temporalPrecisionCompatible(parsed, granularity)) compatible = false
          if (parsedMin && parsed.compare(parsedMin) < 0) compatible = false
          if (parsedMax && parsed.compare(parsedMax) > 0) compatible = false
        } catch {
          compatible = false
        }
        return (
          <>
            {compatible ? (
              <TimeField
                id={binding.controlId}
                value={(binding.draftValue ?? canonical) as string}
                onChange={(next) => next !== null && binding.setInput(next)}
                min={min}
                max={max}
                locale={locale}
                granularity={granularity}
                hourCycle={hourCycle}
                shouldForceLeadingZeros={shouldForceLeadingZeros}
                disabled={context.disabled}
                readOnly={context.readOnly}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, false, binding)}
                {...bindingAria(binding)}
              />
            ) : (
              <output
                id={binding.controlId}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true, binding)}
              >
                {canonical}
              </output>
            )}
            <PresentationWarning
              context={context}
              incompatible={!compatible}
              message={`The current value (${String(canonical)}) cannot be represented by the configured time field.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const TimeDashlet = forwardRef(TimeDashletInner) as {
  <F extends ScalarField<string>>(
    props: TimeDashletProps<F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: TimeDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type DateTimeDashletProps<F extends ScalarField<string> = ExactField<string>> = Shell &
  WritableScalarFieldProps<F, string> &
  Pick<
    DateTimeFieldProps,
    | 'min'
    | 'max'
    | 'locale'
    | 'granularity'
    | 'hourCycle'
    | 'hideTimeZone'
    | 'shouldForceLeadingZeros'
  > & {
    readonly timeZone: string
  }

function DateTimeDashletInner<F extends ScalarField<string>>(
  {
    field,
    timeZone,
    min,
    max,
    locale,
    granularity,
    hourCycle,
    hideTimeZone,
    shouldForceLeadingZeros,
    ...props
  }: DateTimeDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateLocale(locale)
  if (!timeZone || typeof timeZone !== 'string') throw new TypeError('timeZone is required.')
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
  } catch {
    throw new TypeError('timeZone must be a valid IANA time zone.')
  }
  let parsedMin
  let parsedMax
  try {
    parsedMin = min === undefined ? undefined : parseAbsolute(min, timeZone)
    parsedMax = max === undefined ? undefined : parseAbsolute(max, timeZone)
  } catch {
    throw new TypeError('date-time bounds must be valid RFC 3339 date-times.')
  }
  if (parsedMin && parsedMax && parsedMin.compare(parsedMax) > 0)
    throw new TypeError('min must be less than or equal to max.')
  return (
    <Dashlet {...props} ref={ref} field={asDashletBindingField(field)}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as string
        let compatible = true
        try {
          const parsed = parseAbsolute(canonical, timeZone)
          if (!temporalPrecisionCompatible(parsed, granularity)) compatible = false
          if (parsedMin && parsed.compare(parsedMin) < 0) compatible = false
          if (parsedMax && parsed.compare(parsedMax) > 0) compatible = false
        } catch {
          compatible = false
        }
        return (
          <>
            {compatible ? (
              <DateTimeField
                id={binding.controlId}
                value={(binding.draftValue ?? canonical) as string}
                onChange={(next) => next !== null && binding.setInput(next)}
                timeZone={timeZone}
                min={min}
                max={max}
                locale={locale}
                granularity={granularity}
                hourCycle={hourCycle}
                hideTimeZone={hideTimeZone}
                shouldForceLeadingZeros={shouldForceLeadingZeros}
                disabled={context.disabled}
                readOnly={context.readOnly}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, false, binding)}
                {...bindingAria(binding)}
              />
            ) : (
              <output
                id={binding.controlId}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true, binding)}
              >
                {canonical}
              </output>
            )}
            <PresentationWarning
              context={context}
              incompatible={!compatible}
              message={`The current value (${String(canonical)}) cannot be represented by the configured date-time field.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const DateTimeDashlet = forwardRef(DateTimeDashletInner) as {
  <F extends ScalarField<string>>(
    props: DateTimeDashletProps<F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: DateTimeDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

type DateRangeValue = { readonly start: string; readonly end: string }

export type DateRangeDashletProps<
  F extends ScalarField<PicodashJsonValue> = ExactField<DateRangeValue>,
> = Shell &
  ExactCompoundFieldProps<F, DateRangeValue> &
  Pick<DateRangeFieldProps, 'locale' | 'shouldForceLeadingZeros'>

function DateRangeDashletInner<F extends ScalarField<PicodashJsonValue>>(
  { field, locale, shouldForceLeadingZeros, ...props }: DateRangeDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateLocale(locale)
  return (
    <Dashlet
      {...props}
      ref={ref}
      field={asDashletBindingField(field)}
      layout={props.layout ?? 'block'}
    >
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as { start: string; end: string }
        let compatible = true
        try {
          const start = parseDate(canonical.start)
          const end = parseDate(canonical.end)
          compatible = start.compare(end) <= 0
        } catch {
          compatible = false
        }
        return (
          <>
            {compatible ? (
              <DateRangeField
                id={binding.controlId}
                value={(binding.draftValue ?? canonical) as { start: string; end: string }}
                onChange={(next) => next !== null && binding.setInput(next)}
                locale={locale}
                shouldForceLeadingZeros={shouldForceLeadingZeros}
                disabled={context.disabled}
                readOnly={context.readOnly}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, false, binding)}
                {...bindingAria(binding)}
              />
            ) : (
              <output
                id={binding.controlId}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true, binding)}
              >
                {JSON.stringify(canonical)}
              </output>
            )}
            <PresentationWarning
              context={context}
              incompatible={!compatible}
              message="The current date range cannot be represented by the configured date range field."
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const DateRangeDashlet = forwardRef(DateRangeDashletInner) as unknown as {
  <F extends ScalarField<PicodashJsonValue>>(
    props: DateRangeDashletProps<F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: DateRangeDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}

export type ColorDashletProps<F extends ScalarField<string> = ExactField<string>> = Shell &
  WritableScalarFieldProps<F, string> & {
    readonly format?: ColorFormat
  }

function ColorDashletInner<F extends ScalarField<string>>(
  { field, format = 'hex', ...props }: ColorDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateSupportedColorFormat(format)
  return (
    <Dashlet {...props} ref={ref} field={asDashletBindingField(field)}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as string
        let compatible = true
        try {
          const parsed = parseColor(canonical)
          serializeColor(parsed, format)
        } catch {
          compatible = false
        }
        return (
          <>
            {compatible ? (
              <ColorField
                id={binding.controlId}
                value={(binding.draftValue ?? canonical) as string}
                onChange={(next) => next !== null && binding.setInput(next)}
                format={format}
                disabled={context.disabled}
                readOnly={context.readOnly}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, false, binding)}
                {...bindingAria(binding)}
              />
            ) : (
              <output
                id={binding.controlId}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true, binding)}
              >
                {canonical}
              </output>
            )}
            <PresentationWarning
              context={context}
              incompatible={!compatible}
              message={`The current color (${String(canonical)}) cannot be edited in the configured color format.`}
            />
          </>
        )
      }}
    </Dashlet>
  )
}
export const ColorDashlet = forwardRef(ColorDashletInner) as {
  <F extends ScalarField<string>>(
    props: ColorDashletProps<F> & RefAttributes<HTMLDivElement>,
  ): ReactElement | null
  (props: ColorDashletProps & RefAttributes<HTMLDivElement>): ReactElement | null
}
