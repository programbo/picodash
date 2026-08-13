'use client'

import {
  ColorField as AriaColorField,
  DateField as AriaDateField,
  DateInput,
  DateRangePicker as AriaDateRangePicker,
  DateSegment,
  Group,
  Input,
  Meter as AriaMeter,
  ProgressBar as AriaProgressBar,
  Slider as AriaSlider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  TimeField as AriaTimeField,
  I18nProvider,
} from 'react-aria-components'
import { parseColor } from 'react-aria-components'
import type { Color } from 'react-aria-components'
import {
  parseAbsolute,
  parseDate,
  parseTime,
  type CalendarDate,
  type Time,
  type ZonedDateTime,
} from '@internationalized/date'
import type { ReactNode } from 'react'
import type { DashlistControlProps } from './ui.js'

export type NumberRangeValue = {
  readonly start: number
  readonly end: number
}

export type DateRangeValue = {
  readonly start: string
  readonly end: string
}

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export type StatusOption<T extends string | number> = {
  readonly value: T
  readonly label: ReactNode
  readonly textValue?: string
  readonly tone: StatusTone
  readonly icon?: ReactNode
}

export type ColorFormat = 'hex' | 'hexa' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'hsb' | 'hsba'

function validateLocale(locale: string | undefined): void {
  if (locale === undefined) return
  try {
    Intl.getCanonicalLocales(locale)
  } catch {
    throw new TypeError('locale must be a valid BCP 47 language tag.')
  }
}

function localize(locale: string | undefined, children: ReactNode): ReactNode {
  validateLocale(locale)
  return locale === undefined ? children : <I18nProvider locale={locale}>{children}</I18nProvider>
}

function commonAriaProps(props: DashlistControlProps) {
  return {
    id: props.id,
    'aria-label': props['aria-label'],
    'aria-labelledby': props['aria-labelledby'],
    'aria-describedby': props['aria-describedby'],
    'aria-invalid': props['aria-invalid'],
    'aria-errormessage': props['aria-errormessage'],
    isDisabled: props.disabled,
    isReadOnly: props.readOnly,
  }
}

function dateTimeString(value: ZonedDateTime): string {
  const serialized = value.toString().replace(/\[.*\]$/, '')
  return serialized.endsWith('Z') ? `${serialized.slice(0, -1)}+00:00` : serialized
}

function dateValue(value: string | null): CalendarDate | null {
  return value === null ? null : parseDate(value)
}

function timeValue(value: string | null): Time | null {
  return value === null ? null : parseTime(value)
}

function dateTimeValue(value: string | null, timeZone: string): ZonedDateTime | null {
  return value === null ? null : parseAbsolute(value, timeZone)
}

function segmentInput(segment: any) {
  return <DateSegment segment={segment} />
}

export type RangeSliderProps = DashlistControlProps & {
  readonly value: NumberRangeValue
  readonly onChange: (value: NumberRangeValue) => void
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly formatOptions?: Intl.NumberFormatOptions
}

export function RangeSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  formatOptions,
  ...props
}: RangeSliderProps) {
  return (
    <AriaSlider<number[]>
      id={props.id}
      className={props.className ?? 'picodash-dashlist-range-slider'}
      value={[value.start, value.end]}
      onChange={
        props.readOnly
          ? undefined
          : (next) => {
              if (Array.isArray(next) && next.length >= 2) {
                onChange({ start: next[0]!, end: next[1]! })
              }
            }
      }
      minValue={min}
      maxValue={max}
      step={step}
      formatOptions={formatOptions}
      isDisabled={props.disabled}
      aria-readonly={props.readOnly || undefined}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      aria-errormessage={props['aria-errormessage']}
    >
      <SliderOutput />
      <SliderTrack className="picodash-dashlist-range-slider-track">
        <SliderThumb
          index={0}
          data-picodash-dashlist-range-slider-thumb
          aria-label="Start"
          isInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
          aria-errormessage={props['aria-errormessage']}
        />
        <SliderThumb index={1} data-picodash-dashlist-range-slider-thumb aria-label="End" />
      </SliderTrack>
    </AriaSlider>
  )
}

export type MeterProps = DashlistControlProps & {
  readonly value: number
  readonly min?: number
  readonly max?: number
  readonly formatOptions?: Intl.NumberFormatOptions
  readonly formatValue?: (value: number) => ReactNode
}

export function Meter({
  value,
  min = 0,
  max = 100,
  formatOptions,
  formatValue,
  ...props
}: MeterProps) {
  return (
    <AriaMeter
      id={props.id}
      className={props.className ?? 'picodash-dashlist-meter'}
      value={value}
      minValue={min}
      maxValue={max}
      formatOptions={formatOptions}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      aria-errormessage={props['aria-errormessage']}
      aria-disabled={props.disabled || undefined}
      aria-readonly={props.readOnly || undefined}
    >
      {({ percentage, valueText }) => (
        <>
          <span className="picodash-dashlist-readout-value">
            {formatValue ? formatValue(value) : valueText}
          </span>
          <span className="picodash-dashlist-progress-track" aria-hidden="true">
            <span
              className="picodash-dashlist-progress-fill"
              style={{ inlineSize: `${percentage}%` }}
            />
          </span>
        </>
      )}
    </AriaMeter>
  )
}

export type ProgressBarProps = DashlistControlProps & {
  readonly value?: number
  readonly min?: number
  readonly max?: number
  readonly formatOptions?: Intl.NumberFormatOptions
  readonly formatValue?: (value: number) => ReactNode
}

export function ProgressBar({
  value,
  min = 0,
  max = 100,
  formatOptions,
  formatValue,
  ...props
}: ProgressBarProps) {
  return (
    <AriaProgressBar
      id={props.id}
      className={props.className ?? 'picodash-dashlist-progress'}
      value={value}
      minValue={min}
      maxValue={max}
      formatOptions={formatOptions}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      aria-errormessage={props['aria-errormessage']}
      aria-disabled={props.disabled || undefined}
      aria-readonly={props.readOnly || undefined}
    >
      {({ percentage, valueText, isIndeterminate }) => (
        <>
          <span className="picodash-dashlist-readout-value">
            {!isIndeterminate && value !== undefined && formatValue
              ? formatValue(value)
              : valueText}
          </span>
          <span className="picodash-dashlist-progress-track" aria-hidden="true">
            <span
              className="picodash-dashlist-progress-fill"
              data-indeterminate={isIndeterminate || undefined}
              style={{ inlineSize: `${isIndeterminate ? 40 : percentage}%` }}
            />
          </span>
        </>
      )}
    </AriaProgressBar>
  )
}

export type StatusProps<T extends string | number> = DashlistControlProps & {
  readonly value: T
  readonly options: readonly StatusOption<T>[]
}

function validateStatusOptions<T extends string | number>(options: readonly StatusOption<T>[]) {
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

export function Status<T extends string | number>({ value, options, ...props }: StatusProps<T>) {
  validateStatusOptions(options)
  const option = options.find((candidate) => Object.is(candidate.value, value))
  const label = option?.label ?? String(value)
  const accessible = option?.textValue ?? (typeof label === 'string' ? label : props['aria-label'])
  return (
    <span
      id={props.id}
      className={props.className ?? 'picodash-dashlist-status'}
      data-picodash-dashlist-status
      data-tone={option?.tone}
      aria-label={accessible}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      aria-errormessage={props['aria-errormessage']}
      aria-disabled={props.disabled || undefined}
      aria-readonly={props.readOnly || undefined}
    >
      {option?.icon}
      {label}
    </span>
  )
}

export type DateFieldProps = DashlistControlProps & {
  readonly value: string | null
  readonly onChange: (value: string | null) => void
  readonly min?: string
  readonly max?: string
  readonly locale?: string
  readonly granularity?: 'day'
  readonly hourCycle?: 12 | 24
  readonly shouldForceLeadingZeros?: boolean
}

export function DateField({
  value,
  onChange,
  min,
  max,
  locale,
  granularity,
  hourCycle,
  shouldForceLeadingZeros,
  ...props
}: DateFieldProps) {
  return localize(
    locale,
    <AriaDateField<CalendarDate>
      className={props.className ?? 'picodash-dashlist-date-field'}
      value={dateValue(value)}
      onChange={(next) => onChange(next ? next.toString() : null)}
      minValue={min ? parseDate(min) : undefined}
      maxValue={max ? parseDate(max) : undefined}
      granularity={granularity}
      hourCycle={hourCycle}
      shouldForceLeadingZeros={shouldForceLeadingZeros}
      isInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
      {...commonAriaProps(props)}
    >
      <DateInput>{segmentInput}</DateInput>
    </AriaDateField>,
  )
}

export type TimeFieldProps = DashlistControlProps & {
  readonly value: string | null
  readonly onChange: (value: string | null) => void
  readonly min?: string
  readonly max?: string
  readonly locale?: string
  readonly granularity?: 'hour' | 'minute' | 'second'
  readonly hourCycle?: 12 | 24
  readonly shouldForceLeadingZeros?: boolean
}

export function TimeField({
  value,
  onChange,
  min,
  max,
  locale,
  granularity,
  hourCycle,
  shouldForceLeadingZeros,
  ...props
}: TimeFieldProps) {
  return localize(
    locale,
    <AriaTimeField<Time>
      className={props.className ?? 'picodash-dashlist-time-field'}
      value={timeValue(value)}
      onChange={(next) => onChange(next ? next.toString() : null)}
      minValue={min ? parseTime(min) : undefined}
      maxValue={max ? parseTime(max) : undefined}
      granularity={granularity}
      hourCycle={hourCycle}
      shouldForceLeadingZeros={shouldForceLeadingZeros}
      isInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
      {...commonAriaProps(props)}
    >
      <DateInput>{segmentInput}</DateInput>
    </AriaTimeField>,
  )
}

export type DateTimeFieldProps = DashlistControlProps & {
  readonly value: string | null
  readonly onChange: (value: string | null) => void
  readonly timeZone: string
  readonly min?: string
  readonly max?: string
  readonly locale?: string
  readonly granularity?: 'hour' | 'minute' | 'second'
  readonly hourCycle?: 12 | 24
  readonly hideTimeZone?: boolean
  readonly shouldForceLeadingZeros?: boolean
}

export function DateTimeField({
  value,
  onChange,
  timeZone,
  min,
  max,
  locale,
  granularity,
  hourCycle,
  hideTimeZone,
  shouldForceLeadingZeros,
  ...props
}: DateTimeFieldProps) {
  // Validate the IANA zone eagerly so server and client fail deterministically.
  new Intl.DateTimeFormat('en-US', { timeZone })
  return localize(
    locale,
    <AriaDateField<ZonedDateTime>
      className={props.className ?? 'picodash-dashlist-date-time-field'}
      value={dateTimeValue(value, timeZone)}
      onChange={(next) => onChange(next ? dateTimeString(next) : null)}
      minValue={min ? parseAbsolute(min, timeZone) : undefined}
      maxValue={max ? parseAbsolute(max, timeZone) : undefined}
      granularity={granularity}
      hourCycle={hourCycle}
      hideTimeZone={hideTimeZone}
      shouldForceLeadingZeros={shouldForceLeadingZeros}
      isInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
      {...commonAriaProps(props)}
    >
      <DateInput>{segmentInput}</DateInput>
    </AriaDateField>,
  )
}

export type DateRangeFieldProps = DashlistControlProps & {
  readonly value: DateRangeValue | null
  readonly onChange: (value: DateRangeValue | null) => void
  readonly locale?: string
  readonly shouldForceLeadingZeros?: boolean
}

export function DateRangeField({
  value,
  onChange,
  locale,
  shouldForceLeadingZeros,
  ...props
}: DateRangeFieldProps) {
  const parsed = value ? { start: parseDate(value.start), end: parseDate(value.end) } : null
  return localize(
    locale,
    <AriaDateRangePicker
      className={props.className ?? 'picodash-dashlist-date-range-field'}
      value={parsed}
      onChange={(next) =>
        onChange(next ? { start: next.start.toString(), end: next.end.toString() } : null)
      }
      shouldForceLeadingZeros={shouldForceLeadingZeros}
      isInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
      {...commonAriaProps(props)}
    >
      <Group>
        <DateInput slot="start">{segmentInput}</DateInput>
        <DateInput slot="end">{segmentInput}</DateInput>
      </Group>
    </AriaDateRangePicker>,
  )
}

export type ColorFieldProps = DashlistControlProps & {
  readonly value: string | null
  readonly onChange: (value: string | null) => void
  readonly format?: ColorFormat
}

export function ColorField({ value, onChange, format = 'hex', ...props }: ColorFieldProps) {
  let parsed: Color | null = null
  if (value !== null) {
    try {
      parsed = parseColor(value)
    } catch {
      parsed = null
    }
  }
  if (value !== null && parsed === null) {
    return (
      <input
        id={props.id}
        className={props.className ?? 'picodash-dashlist-color-field'}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={props.disabled}
        readOnly={props.readOnly}
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        aria-describedby={props['aria-describedby']}
        aria-invalid={props['aria-invalid']}
        aria-errormessage={props['aria-errormessage']}
      />
    )
  }
  return (
    <AriaColorField
      className={props.className ?? 'picodash-dashlist-color-field'}
      value={parsed}
      onChange={(next) => onChange(next ? next.toString(format) : null)}
      isDisabled={props.disabled}
      isReadOnly={props.readOnly}
      isInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      aria-errormessage={props['aria-errormessage']}
    >
      <Input
        id={props.id}
        aria-invalid={props['aria-invalid']}
        aria-errormessage={props['aria-errormessage']}
      />
    </AriaColorField>
  )
}
