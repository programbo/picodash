'use client'

import {
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
  TextField as AriaTextField,
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
import { useRef, useState, type ComponentProps, type ReactNode } from 'react'
import type { DashlistControlProps } from './ui.js'
import { usePrimaryControlRef, useReadOnlyDescription } from './control-accessibility.js'
import { composeControlClassName } from './ui-class-name.js'
import { choiceKey, sameChoiceValue } from './choice-identity.js'

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

const supportedColorFormats = new Set(['hex', 'hexa', 'rgb', 'rgba', 'hsl', 'hsla', 'hsb', 'hsba'])

export function validateSupportedColorFormat(format: unknown): asserts format is ColorFormat {
  if (typeof format !== 'string' || !supportedColorFormats.has(format))
    throw new TypeError('format must be a supported color format.')
}

export function serializeColor(color: Color, format: ColorFormat): string {
  const preservesAlpha =
    format === 'hexa' || format === 'rgba' || format === 'hsla' || format === 'hsba'
  if (!preservesAlpha && color.getChannelValue('alpha') !== 1)
    throw new TypeError('format must preserve alpha for non-opaque colors.')
  return color.toString(format)
}

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

function dateBound(value: string | undefined): CalendarDate | undefined {
  if (value === undefined) return undefined
  try {
    return parseDate(value)
  } catch {
    throw new TypeError('date bounds must be valid ISO dates.')
  }
}

function timeBound(value: string | undefined): Time | undefined {
  if (value === undefined) return undefined
  try {
    return parseTime(value)
  } catch {
    throw new TypeError('time bounds must be valid ISO local times.')
  }
}

function dateTimeBound(value: string | undefined, timeZone: string): ZonedDateTime | undefined {
  if (value === undefined) return undefined
  try {
    return parseAbsolute(value, timeZone)
  } catch {
    throw new TypeError('date-time bounds must be valid RFC 3339 date-times.')
  }
}

type ComparableTemporal<T> = {
  compare(other: T): number
}

function validateTemporalBounds<T extends ComparableTemporal<T>>(
  min: T | undefined,
  max: T | undefined,
): void {
  if (min && max && min.compare(max) > 0)
    throw new TypeError('min must be less than or equal to max.')
}

type TemporalSegment = ComponentProps<typeof DateSegment>['segment']

function RegisteredDateSegment({ segment }: { readonly segment: TemporalSegment }) {
  const ref = usePrimaryControlRef<HTMLSpanElement>()
  return <DateSegment ref={ref} segment={segment} />
}

function segmentInput(segment: TemporalSegment) {
  if (segment.isEditable) return <RegisteredDateSegment segment={segment} />
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

function validateNumericBounds(min: number, max: number): void {
  if (!Number.isFinite(min)) throw new TypeError('min must be finite.')
  if (!Number.isFinite(max)) throw new TypeError('max must be finite.')
  if (min > max) throw new TypeError('min must be less than or equal to max.')
}

function validateRangeSliderConfiguration(min: number, max: number, step: number): void {
  validateNumericBounds(min, max)
  if (!Number.isFinite(step) || step <= 0)
    throw new TypeError('step must be a positive finite number.')
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
  validateRangeSliderConfiguration(min, max, step)
  const startInputRef = usePrimaryControlRef<HTMLInputElement>()
  const endInputRef = usePrimaryControlRef<HTMLInputElement>()
  const readOnlyDescription = useReadOnlyDescription(props.readOnly, props['aria-describedby'])

  return (
    <>
      <AriaSlider<number[]>
        id={props.id}
        className={composeControlClassName('picodash-dashlist-range-slider', props.className)}
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
            inputRef={startInputRef}
            data-picodash-dashlist-range-slider-thumb
            aria-label="Start"
            aria-describedby={readOnlyDescription.describedBy}
            isInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
            aria-errormessage={props['aria-errormessage']}
          />
          <SliderThumb
            index={1}
            inputRef={endInputRef}
            data-picodash-dashlist-range-slider-thumb
            aria-label="End"
            aria-describedby={readOnlyDescription.describedBy}
            isInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
            aria-errormessage={props['aria-errormessage']}
          />
        </SliderTrack>
      </AriaSlider>
      {readOnlyDescription.description}
    </>
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
  validateNumericBounds(min, max)

  return (
    <AriaMeter
      id={props.id}
      className={composeControlClassName('picodash-dashlist-meter', props.className)}
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
  validateNumericBounds(min, max)

  return (
    <AriaProgressBar
      id={props.id}
      className={composeControlClassName('picodash-dashlist-progress', props.className)}
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
    const key = choiceKey(option.value)
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
  const option = options.find((candidate) => sameChoiceValue(candidate.value, value))
  const label = option?.label ?? String(value)
  const accessible =
    'aria-label' in props
      ? props['aria-label']
      : (option?.textValue ?? (typeof label === 'string' ? label : undefined))
  return (
    <span
      id={props.id}
      className={composeControlClassName('picodash-dashlist-status', props.className)}
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
  const parsedMin = dateBound(min)
  const parsedMax = dateBound(max)
  validateTemporalBounds(parsedMin, parsedMax)

  return localize(
    locale,
    <AriaDateField<CalendarDate>
      className={composeControlClassName('picodash-dashlist-date-field', props.className)}
      value={dateValue(value)}
      onChange={(next) => onChange(next ? next.toString() : null)}
      minValue={parsedMin}
      maxValue={parsedMax}
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
  const parsedMin = timeBound(min)
  const parsedMax = timeBound(max)
  validateTemporalBounds(parsedMin, parsedMax)

  return localize(
    locale,
    <AriaTimeField<Time>
      className={composeControlClassName('picodash-dashlist-time-field', props.className)}
      value={timeValue(value)}
      onChange={(next) => onChange(next ? next.toString() : null)}
      minValue={parsedMin}
      maxValue={parsedMax}
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
  if (typeof timeZone !== 'string' || timeZone.length === 0)
    throw new TypeError('timeZone is required.')
  // Validate the IANA zone eagerly so server and client fail deterministically.
  new Intl.DateTimeFormat('en-US', { timeZone })
  const parsedMin = dateTimeBound(min, timeZone)
  const parsedMax = dateTimeBound(max, timeZone)
  validateTemporalBounds(parsedMin, parsedMax)

  return localize(
    locale,
    <AriaDateField<ZonedDateTime>
      className={composeControlClassName('picodash-dashlist-date-time-field', props.className)}
      value={dateTimeValue(value, timeZone)}
      onChange={(next) => onChange(next ? dateTimeString(next) : null)}
      minValue={parsedMin}
      maxValue={parsedMax}
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
      className={composeControlClassName('picodash-dashlist-date-range-field', props.className)}
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

function controlledColorText(value: string | null, format: ColorFormat): string {
  if (value === null) return ''
  let color
  try {
    color = parseColor(value)
  } catch {
    return value
  }
  return serializeColor(color, format)
}

type ColorDraftState = {
  readonly value: string | null
  readonly format: ColorFormat
  readonly text: string
  readonly pendingEcho: { readonly value: string | null } | null
}

function controlledColorDraft(value: string | null, format: ColorFormat): ColorDraftState {
  return { value, format, text: controlledColorText(value, format), pendingEcho: null }
}

export function ColorField({ value, onChange, format = 'hex', ...props }: ColorFieldProps) {
  validateSupportedColorFormat(format)
  const inputRef = usePrimaryControlRef<HTMLInputElement>()
  const focused = useRef(false)
  const [draftState, setDraftState] = useState(() => controlledColorDraft(value, format))
  let resolvedDraft = draftState
  if (!Object.is(draftState.value, value) || draftState.format !== format) {
    const isCanonicalEcho =
      focused.current &&
      draftState.format === format &&
      draftState.pendingEcho !== null &&
      Object.is(draftState.pendingEcho.value, value)
    resolvedDraft = isCanonicalEcho
      ? { ...draftState, value, pendingEcho: null }
      : controlledColorDraft(value, format)
    setDraftState(resolvedDraft)
  }

  return (
    <AriaTextField
      className={composeControlClassName('picodash-dashlist-color-field', props.className)}
      value={resolvedDraft.text}
      onChange={(next) => {
        if (props.disabled || props.readOnly) return
        let pendingEcho: ColorDraftState['pendingEcho'] = null
        if (next === '') pendingEcho = { value: null }
        else {
          try {
            pendingEcho = { value: serializeColor(parseColor(next), format) }
          } catch {
            // Partial and invalid text remains local until it becomes a complete color.
          }
        }
        setDraftState({ value, format, text: next, pendingEcho })
        if (pendingEcho !== null) onChange(pendingEcho.value)
      }}
      onFocus={() => {
        focused.current = true
      }}
      onBlur={() => {
        focused.current = false
        setDraftState(controlledColorDraft(value, format))
      }}
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
        ref={inputRef}
        id={props.id}
        className="picodash-dashlist-control"
        aria-invalid={props['aria-invalid']}
        aria-errormessage={props['aria-errormessage']}
      />
    </AriaTextField>
  )
}
