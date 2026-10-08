import { createPicodashNexus } from '@picodash/nexus'
import {
  parseAbsolute,
  parseDate,
  parseTime,
  toCalendarDate,
  toTime,
  toZoned,
  CalendarDateTime,
} from '@internationalized/date'
import { styleLabFields } from './style-lab-model'

export const galleryTimeZone = 'Australia/Perth'
export type NumericState = { slider: number; range: { start: number; end: number } }
export type TemporalState = {
  dateTime: string | null
  range: { start: string; end: string } | null
}

export function numericReadouts({ slider, range: { start, end } }: NumericState) {
  return {
    span: end - start,
    // A collapsed range has no distance to traverse. Keep the readout determinate.
    progress: end === start ? 0 : ((slider - start) / (end - start)) * 100,
  }
}

export function changeNumericRange(
  value: NumericState,
  range: NumericState['range'],
): NumericState {
  return { range, slider: Math.min(range.end, Math.max(range.start, value.slider)) }
}

function isNumericState(value: unknown): value is NumericState {
  if (!value || typeof value !== 'object' || !('slider' in value) || !('range' in value))
    return false
  const range = value.range
  return (
    typeof value.slider === 'number' &&
    Number.isFinite(value.slider) &&
    !!range &&
    typeof range === 'object' &&
    'start' in range &&
    'end' in range &&
    typeof range.start === 'number' &&
    typeof range.end === 'number' &&
    range.start >= 0 &&
    range.end <= 100 &&
    range.start <= value.slider &&
    value.slider <= range.end
  )
}

export function temporalParts(value: TemporalState) {
  const zoned = value.dateTime === null ? null : parseAbsolute(value.dateTime, galleryTimeZone)
  return {
    date: zoned ? toCalendarDate(zoned).toString() : null,
    time: zoned ? toTime(zoned).toString() : null,
  }
}

export function changeDate(value: TemporalState, date: string | null): TemporalState {
  if (date === null) return { ...value, dateTime: null }
  const day = parseDate(date)
  const time = parseTime(temporalParts(value).time ?? '00:00:00')
  return {
    ...value,
    dateTime: toZoned(
      new CalendarDateTime(
        day.year,
        day.month,
        day.day,
        time.hour,
        time.minute,
        time.second,
        time.millisecond,
      ),
      galleryTimeZone,
    ).toAbsoluteString(),
  }
}

export function changeTime(value: TemporalState, time: string | null): TemporalState {
  if (time === null) return { ...value, dateTime: null }
  const day = parseDate(temporalParts(value).date ?? value.range?.start ?? '2026-08-20')
  const clock = parseTime(time)
  return {
    ...value,
    dateTime: toZoned(
      new CalendarDateTime(
        day.year,
        day.month,
        day.day,
        clock.hour,
        clock.minute,
        clock.second,
        clock.millisecond,
      ),
      galleryTimeZone,
    ).toAbsoluteString(),
  }
}

export function changeDateRange(
  value: TemporalState,
  range: TemporalState['range'],
): TemporalState {
  const next = { ...value, range }
  const date = temporalParts(value).date
  if (!range || date === null) return next
  // Moving the window keeps the time of day, bringing the date to the nearest endpoint.
  return changeDate(next, date < range.start ? range.start : date > range.end ? range.end : date)
}

export function dateTimeBounds(range: TemporalState['range']) {
  if (!range) return {}
  return {
    min: toZoned(parseDate(range.start), galleryTimeZone).toAbsoluteString(),
    max: toZoned(parseDate(range.end), galleryTimeZone)
      .set({ hour: 23, minute: 59, second: 59, millisecond: 999 })
      .toAbsoluteString(),
  }
}

export function isTemporalState(value: unknown): value is TemporalState {
  if (!value || typeof value !== 'object' || !('dateTime' in value) || !('range' in value))
    return false
  try {
    if (value.dateTime !== null) {
      if (typeof value.dateTime !== 'string') return false
      parseAbsolute(value.dateTime, galleryTimeZone)
    }
    if (value.range !== null) {
      const range = value.range
      if (
        !range ||
        typeof range !== 'object' ||
        !('start' in range) ||
        !('end' in range) ||
        typeof range.start !== 'string' ||
        typeof range.end !== 'string'
      )
        return false
      return (
        parseDate(range.start).toString() === range.start &&
        parseDate(range.end).toString() === range.end &&
        range.start <= range.end
      )
    }
    return true
  } catch {
    return false
  }
}

function validTemporalWindow(value: unknown) {
  if (!isTemporalState(value)) return false
  const date = temporalParts(value).date
  return !date || !value.range || (date >= value.range.start && date <= value.range.end)
}

export function createGalleryNexus() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    nexusId: 'dashlet-gallery',
    schemaVersion: 1,
    fields: {
      search: styleLabFields.search,
      text: styleLabFields.text,
      number: styleLabFields.number,
      switchValue: styleLabFields.switchValue,
      display: styleLabFields.display,
      status: styleLabFields.status,
      color: styleLabFields.color,
      choice: styleLabFields.select,
      selections: styleLabFields.multiSelect,
      bipolar: {
        defaultValue: 0,
        validate: (value: number) =>
          Number.isFinite(value) && value >= -100 && value <= 100
            ? []
            : [{ message: 'Choose a value from -100 to 100.' }],
      },
      numeric: {
        defaultValue: { slider: 48, range: { start: 24, end: 76 } } as NumericState,
        validate: (value: NumericState) =>
          isNumericState(value)
            ? []
            : [{ message: 'Keep the slider inside an ordered range from 0 to 100.' }],
      },
      temporal: {
        defaultValue: {
          dateTime: '2026-08-20T09:30:00+08:00',
          range: { start: '2026-08-18', end: '2026-08-24' },
        } as TemporalState,
        validate: (value: TemporalState) =>
          validTemporalWindow(value)
            ? []
            : [{ message: 'Choose a date and time within the date range.' }],
      },
      notes: { defaultValue: 'A quiet workspace.\nA second line to check spacing.' },
      requiredText: {
        defaultValue: 'Studio',
        validate: (value: string) => (value.trim() ? [] : [{ message: 'Enter a workspace name.' }]),
      },
      structured: { defaultValue: { connected: true, refreshSeconds: 30 } },
    },
  })
}
export type GalleryNexus = ReturnType<typeof createGalleryNexus>
