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
import type { PicodashField } from '@picodash/nexus'
import { Dashlet, type DashletProps } from './index.js'
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
} from './ui-values.js'

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

function rangeCompatible(value: NumberRangeValue, min: number, max: number): boolean {
  return (
    Number.isFinite(value.start) &&
    Number.isFinite(value.end) &&
    value.start <= value.end &&
    value.start >= min &&
    value.end <= max
  )
}

function rangeText(value: NumberRangeValue): string {
  return `{ start: ${String(value.start)}, end: ${String(value.end)} }`
}

export type RangeDashletProps<F extends AnyField = AnyField> = Shell &
  FieldProps<F, NumberRangeValue> &
  Pick<RangeSliderProps, 'min' | 'max' | 'step' | 'formatOptions'> & {
    readonly formatValue?: (value: NumberRangeValue) => ReactNode
  }

export const RangeDashlet = forwardRef<HTMLDivElement, RangeDashletProps>(function RangeDashlet(
  { field, min = 0, max = 100, step = 1, formatOptions, formatValue, ...props },
  ref,
) {
  validateBounds(min, max)
  validateStep(step)
  return (
    <Dashlet {...props} ref={ref} field={field} layout={props.layout ?? 'block'}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as NumberRangeValue
        const value = (binding.draftValue ?? canonical) as NumberRangeValue
        const mismatch = !rangeCompatible(canonical, min, max)
        return (
          <>
            {mismatch ? (
              <output
                id={binding.controlId}
                data-picodash-dashlist-range-value
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true)}
              >
                {formatValue ? formatValue(canonical) : rangeText(canonical)}
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
                aria-describedby={describedBy(context, false)}
              />
            )}
            {mismatch ? (
              <PresentationWarning context={context}>
                The current range ({rangeText(canonical)}) is outside the configured range.
              </PresentationWarning>
            ) : null}
          </>
        )
      }}
    </Dashlet>
  )
})

export type MeterDashletProps<F extends AnyField = AnyField> = Omit<
  Shell,
  'readOnly' | 'disabled'
> &
  FieldProps<F, number> &
  Pick<MeterProps, 'min' | 'max' | 'formatOptions'> & {
    readonly formatValue?: (value: number) => ReactNode
  }

export const MeterDashlet = forwardRef<HTMLDivElement, MeterDashletProps>(function MeterDashlet(
  { field, min = 0, max = 100, formatOptions, formatValue, ...props },
  ref,
) {
  validateBounds(min, max)
  return (
    <Dashlet {...props} ref={ref} field={field} mode="display">
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as number
        const mismatch = canonical < min || canonical > max
        return (
          <>
            {mismatch ? (
              <output
                id={binding.controlId}
                data-picodash-dashlist-meter-value
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true)}
              >
                {formatValue ? formatValue(canonical) : String(canonical)}
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
                aria-describedby={describedBy(context, false)}
              />
            )}
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

export type ProgressDashletProps<F extends AnyField = AnyField> = Omit<
  Shell,
  'readOnly' | 'disabled'
> &
  FieldProps<F, number> &
  Pick<ProgressBarProps, 'min' | 'max' | 'formatOptions'> & {
    readonly formatValue?: (value: number) => ReactNode
  }

export const ProgressDashlet = forwardRef<HTMLDivElement, ProgressDashletProps>(
  function ProgressDashlet(
    { field, min = 0, max = 100, formatOptions, formatValue, ...props },
    ref,
  ) {
    validateBounds(min, max)
    return (
      <Dashlet {...props} ref={ref} field={field} mode="display">
        {(context: any) => {
          const binding = context.binding
          const canonical = binding.value as number
          const mismatch = canonical < min || canonical > max
          return (
            <>
              {mismatch ? (
                <output
                  id={binding.controlId}
                  data-picodash-dashlist-progress-value
                  aria-labelledby={context.labelId}
                  aria-describedby={describedBy(context, true)}
                >
                  {formatValue ? formatValue(canonical) : String(canonical)}
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
                  aria-describedby={describedBy(context, false)}
                />
              )}
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
  },
)

type StatusChoice<T extends string | number> = StatusOption<T>
export type StatusDashletProps<F extends AnyField = AnyField> = Omit<
  Shell,
  'readOnly' | 'disabled'
> &
  (FieldValue<F> extends string | number ? { readonly field: F } : { readonly field: never }) & {
    readonly options: readonly StatusChoice<string | number>[]
  }

function validateStatusOptions<T extends string | number>(
  options: readonly StatusChoice<T>[],
): void {
  const seen = new Set<string>()
  for (const option of options) {
    const key = `${typeof option.value}:${String(option.value)}`
    if (seen.has(key)) throw new TypeError('options must contain unique values.')
    seen.add(key)
    if (typeof option.label !== 'string' && !option.textValue)
      throw new TypeError('non-text status labels require textValue.')
  }
}

function StatusDashletInner<F extends AnyField = AnyField>(
  props: StatusDashletProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  validateStatusOptions(props.options)
  const { field, options, ...shell } = props
  return (
    <Dashlet {...shell} ref={ref} field={field} mode="display">
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
              aria-describedby={describedBy(context, !compatible)}
            />
            {!compatible ? (
              <PresentationWarning context={context}>
                The current value ({String(canonical)}) is not in the configured status options.
              </PresentationWarning>
            ) : null}
          </>
        )
      }}
    </Dashlet>
  )
}
export const StatusDashlet = forwardRef(StatusDashletInner) as <F extends AnyField = AnyField>(
  props: StatusDashletProps<F> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

type TemporalCommon = Pick<
  DateFieldProps,
  'min' | 'max' | 'locale' | 'hourCycle' | 'shouldForceLeadingZeros'
>
export type DateDashletProps<F extends AnyField = AnyField> = Shell &
  FieldProps<F, string> &
  TemporalCommon

export const DateDashlet = forwardRef<HTMLDivElement, DateDashletProps>(function DateDashlet(
  { field, min, max, locale, hourCycle, shouldForceLeadingZeros, ...props },
  ref,
) {
  if (min !== undefined && max !== undefined && min > max)
    throw new TypeError('min must be less than or equal to max.')
  return (
    <Dashlet {...props} ref={ref} field={field}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as string
        let compatible = true
        try {
          const parsed = parseDate(canonical)
          if (min !== undefined && parsed.compare(parseDate(min)) < 0) compatible = false
          if (max !== undefined && parsed.compare(parseDate(max)) > 0) compatible = false
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
                hourCycle={hourCycle}
                shouldForceLeadingZeros={shouldForceLeadingZeros}
                disabled={context.disabled}
                readOnly={context.readOnly}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, false)}
              />
            ) : (
              <output
                id={binding.controlId}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true)}
              >
                {canonical}
              </output>
            )}
            {!compatible ? (
              <PresentationWarning context={context}>
                The current value ({String(canonical)}) cannot be represented by the configured date
                field.
              </PresentationWarning>
            ) : null}
          </>
        )
      }}
    </Dashlet>
  )
})

export type TimeDashletProps<F extends AnyField = AnyField> = Shell &
  FieldProps<F, string> &
  Pick<
    TimeFieldProps,
    'min' | 'max' | 'locale' | 'granularity' | 'hourCycle' | 'shouldForceLeadingZeros'
  >

export const TimeDashlet = forwardRef<HTMLDivElement, TimeDashletProps>(function TimeDashlet(
  { field, min, max, locale, granularity, hourCycle, shouldForceLeadingZeros, ...props },
  ref,
) {
  if (min !== undefined && max !== undefined && min > max)
    throw new TypeError('min must be less than or equal to max.')
  return (
    <Dashlet {...props} ref={ref} field={field}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as string
        let compatible = true
        try {
          const parsed = parseTime(canonical)
          if (min !== undefined && parsed.compare(parseTime(min)) < 0) compatible = false
          if (max !== undefined && parsed.compare(parseTime(max)) > 0) compatible = false
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
                aria-describedby={describedBy(context, false)}
              />
            ) : (
              <output
                id={binding.controlId}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true)}
              >
                {canonical}
              </output>
            )}
            {!compatible ? (
              <PresentationWarning context={context}>
                The current value ({String(canonical)}) cannot be represented by the configured time
                field.
              </PresentationWarning>
            ) : null}
          </>
        )
      }}
    </Dashlet>
  )
})

export type DateTimeDashletProps<F extends AnyField = AnyField> = Shell &
  FieldProps<F, string> &
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

export const DateTimeDashlet = forwardRef<HTMLDivElement, DateTimeDashletProps>(
  function DateTimeDashlet(
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
    },
    ref,
  ) {
    if (!timeZone || typeof timeZone !== 'string') throw new TypeError('timeZone is required.')
    return (
      <Dashlet {...props} ref={ref} field={field}>
        {(context: any) => {
          const binding = context.binding
          const canonical = binding.value as string
          let compatible = true
          try {
            const parsed = parseAbsolute(canonical, timeZone)
            if (min && parsed.compare(parseAbsolute(min, timeZone)) < 0) compatible = false
            if (max && parsed.compare(parseAbsolute(max, timeZone)) > 0) compatible = false
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
                  aria-describedby={describedBy(context, false)}
                />
              ) : (
                <output
                  id={binding.controlId}
                  aria-labelledby={context.labelId}
                  aria-describedby={describedBy(context, true)}
                >
                  {canonical}
                </output>
              )}
              {!compatible ? (
                <PresentationWarning context={context}>
                  The current value ({String(canonical)}) cannot be represented by the configured
                  date-time field.
                </PresentationWarning>
              ) : null}
            </>
          )
        }}
      </Dashlet>
    )
  },
)

export type DateRangeDashletProps<F extends AnyField = AnyField> = Shell &
  FieldProps<F, { start: string; end: string }> &
  Pick<DateRangeFieldProps, 'locale' | 'shouldForceLeadingZeros'>

export const DateRangeDashlet = forwardRef<HTMLDivElement, DateRangeDashletProps>(
  function DateRangeDashlet({ field, locale, shouldForceLeadingZeros, ...props }, ref) {
    return (
      <Dashlet {...props} ref={ref} field={field} layout={props.layout ?? 'block'}>
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
                  aria-describedby={describedBy(context, false)}
                />
              ) : (
                <output
                  id={binding.controlId}
                  aria-labelledby={context.labelId}
                  aria-describedby={describedBy(context, true)}
                >
                  {JSON.stringify(canonical)}
                </output>
              )}
              {!compatible ? (
                <PresentationWarning context={context}>
                  The current date range cannot be represented by the configured date range field.
                </PresentationWarning>
              ) : null}
            </>
          )
        }}
      </Dashlet>
    )
  },
)

export type ColorDashletProps<F extends AnyField = AnyField> = Shell &
  FieldProps<F, string> & {
    readonly format?: ColorFormat
  }

export const ColorDashlet = forwardRef<HTMLDivElement, ColorDashletProps>(function ColorDashlet(
  { field, format = 'hex', ...props },
  ref,
) {
  return (
    <Dashlet {...props} ref={ref} field={field}>
      {(context: any) => {
        const binding = context.binding
        const canonical = binding.value as string
        let compatible = true
        try {
          const parsed = parseColor(canonical)
          parsed.toFormat(format)
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
                aria-describedby={describedBy(context, false)}
              />
            ) : (
              <output
                id={binding.controlId}
                aria-labelledby={context.labelId}
                aria-describedby={describedBy(context, true)}
              >
                {canonical}
              </output>
            )}
            {!compatible ? (
              <PresentationWarning context={context}>
                The current color ({String(canonical)}) cannot be edited in the configured color
                format.
              </PresentationWarning>
            ) : null}
          </>
        )
      }}
    </Dashlet>
  )
})
