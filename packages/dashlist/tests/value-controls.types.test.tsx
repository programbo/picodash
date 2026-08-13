import {
  ColorField,
  DateField,
  DateRangeField,
  ProgressBar,
  RangeSlider,
  Status,
} from '../src/ui.js'
import {
  ColorDashlet,
  DateDashlet,
  DateRangeDashlet,
  DateTimeDashlet,
  MeterDashlet,
  ProgressDashlet,
  RangeDashlet,
  StatusDashlet,
  TimeDashlet,
  type DateDashletProps,
  type DateRangeDashletProps,
  type DateTimeDashletProps,
  type MeterDashletProps,
  type ProgressDashletProps,
  type RangeDashletProps,
  type StatusDashletProps,
  type TimeDashletProps,
  type ColorDashletProps,
} from '../src/index.tsx'
import { createPicodashNexus, type PicodashField } from '@picodash/nexus'
import { describe, it } from 'vite-plus/test'

const nexus = createPicodashNexus({
  valueOwner: 'nexus',
  fields: {
    range: { defaultValue: { start: 1, end: 2 } },
    status: { defaultValue: 'ready' },
    date: { defaultValue: '2026-08-13' },
    time: { defaultValue: '12:30:00' },
    dateTime: { defaultValue: '2026-08-13T12:30:00+08:00' },
    dateRange: { defaultValue: { start: '2026-08-01', end: '2026-08-13' } },
    color: { defaultValue: '#ff0000' },
    progress: { defaultValue: 25 },
  },
})
type CompatibilityValues = {
  readonly numberOrString: number | string
  readonly rangeOrString: { readonly start: number; readonly end: number } | string
  readonly statusUnion: string | number
}
const numberOrStringField = null as unknown as PicodashField<CompatibilityValues, 'numberOrString'>
const rangeOrStringField = null as unknown as PicodashField<CompatibilityValues, 'rangeOrString'>
const statusUnionField = null as unknown as PicodashField<CompatibilityValues, 'statusUnion'>

type ExactCompoundCompatibilityValues = {
  mutableRange: { start: number; end: number }
  readonlyRange: { readonly start: number; readonly end: number }
  rangeWithRequiredExtra: { start: number; end: number; unit: string }
  rangeWithOptionalExtra: { start: number; end: number; unit?: string }
  indexedRange: { start: number; end: number; [key: string]: number }
  literalRange: { start: 0; end: 100 }
  optionalRangeMember: { start: number; end?: number }
  unionRange: { start: number; end: number } | { start: number; end: number; unit: string }
  mutableDateRange: { start: string; end: string }
  readonlyDateRange: { readonly start: string; readonly end: string }
  dateRangeWithRequiredExtra: { start: string; end: string; calendar: string }
  dateRangeWithOptionalExtra: { start: string; end: string; calendar?: string }
  indexedDateRange: { start: string; end: string; [key: string]: string }
  literalDateRange: { start: '2026-08-01'; end: '2026-08-13' }
  incompatibleDateRange: { start: string; end: string | null }
  unionDateRange: { start: string; end: string } | string
}

type ExactCompoundField<Key extends keyof ExactCompoundCompatibilityValues> = PicodashField<
  ExactCompoundCompatibilityValues,
  Key
>

function exactCompoundField<Key extends keyof ExactCompoundCompatibilityValues>(
  _key: Key,
): ExactCompoundField<Key> {
  return null as unknown as ExactCompoundField<Key>
}

const exactCompoundFields = {
  mutableRange: exactCompoundField('mutableRange'),
  readonlyRange: exactCompoundField('readonlyRange'),
  rangeWithRequiredExtra: exactCompoundField('rangeWithRequiredExtra'),
  rangeWithOptionalExtra: exactCompoundField('rangeWithOptionalExtra'),
  indexedRange: exactCompoundField('indexedRange'),
  literalRange: exactCompoundField('literalRange'),
  optionalRangeMember: exactCompoundField('optionalRangeMember'),
  unionRange: exactCompoundField('unionRange'),
  mutableDateRange: exactCompoundField('mutableDateRange'),
  readonlyDateRange: exactCompoundField('readonlyDateRange'),
  dateRangeWithRequiredExtra: exactCompoundField('dateRangeWithRequiredExtra'),
  dateRangeWithOptionalExtra: exactCompoundField('dateRangeWithOptionalExtra'),
  indexedDateRange: exactCompoundField('indexedDateRange'),
  literalDateRange: exactCompoundField('literalDateRange'),
  incompatibleDateRange: exactCompoundField('incompatibleDateRange'),
  unionDateRange: exactCompoundField('unionDateRange'),
}

describe('@picodash/dashlist value control types', () => {
  it('accepts value control props and rejects invalid overrides', () => {
    ;<RangeSlider value={{ start: 1, end: 2 }} onChange={(value) => value.end} />
    ;<ProgressBar value={25} />
    ;<Status value="ready" options={[{ value: 'ready', label: 'Ready', tone: 'success' }]} />
    ;<DateField value="2026-08-13" onChange={() => undefined} />
    ;<DateRangeField
      value={{ start: '2026-08-01', end: '2026-08-13' }}
      onChange={() => undefined}
    />
    ;<ColorField value="#fff" onChange={() => undefined} format="hex" />

    ;<RangeDashlet field={nexus.fields.range} id="range" label="Range" />
    ;<RangeDashlet
      field={exactCompoundFields.mutableRange}
      id="mutable-range"
      label="Mutable range"
    />
    ;<RangeDashlet
      field={exactCompoundFields.readonlyRange}
      id="readonly-range"
      label="Readonly range"
    />
    ;<ProgressDashlet field={nexus.fields.progress} id="progress" label="Progress" />
    ;<StatusDashlet
      field={nexus.fields.status}
      id="status"
      label="Status"
      options={[{ value: 'ready', label: 'Ready', tone: 'success' }]}
    />
    ;<DateDashlet field={nexus.fields.date} id="date" label="Date" />
    ;<DateTimeDashlet
      field={nexus.fields.dateTime}
      id="date-time"
      label="Date time"
      timeZone="Australia/Perth"
    />
    ;<DateRangeDashlet field={nexus.fields.dateRange} id="date-range" label="Date range" />
    ;<DateRangeDashlet
      field={exactCompoundFields.mutableDateRange}
      id="mutable-date-range"
      label="Mutable date range"
    />
    ;<DateRangeDashlet
      field={exactCompoundFields.readonlyDateRange}
      id="readonly-date-range"
      label="Readonly date range"
    />
    ;<ColorDashlet field={nexus.fields.color} id="color" label="Color" format="rgba" />
    ;<MeterDashlet
      field={nexus.fields.progress}
      id="meter"
      label="Meter"
      formatValue={(value) => value}
    />

    // @ts-expect-error RangeDashlet rejects a number field at a direct JSX call site.
    ;<RangeDashlet field={nexus.fields.progress} id="range-mismatch" label="Mismatch" />
    // @ts-expect-error MeterDashlet rejects a status field at a direct JSX call site.
    ;<MeterDashlet field={nexus.fields.status} id="meter-mismatch" label="Mismatch" />
    // @ts-expect-error MeterDashlet rejects a number|string field whose domain is wider than number.
    ;<MeterDashlet field={numberOrStringField} id="meter-union-mismatch" label="Union mismatch" />
    // @ts-expect-error ProgressDashlet rejects a date field at a direct JSX call site.
    ;<ProgressDashlet field={nexus.fields.date} id="progress-mismatch" label="Mismatch" />
    ;<ProgressDashlet
      // @ts-expect-error ProgressDashlet rejects a number|string field whose domain is wider than number.
      field={numberOrStringField}
      id="progress-union-mismatch"
      label="Union mismatch"
    />
    ;<StatusDashlet
      // @ts-expect-error incompatible field value.
      field={nexus.fields.progress}
      id="status-mismatch"
      label="Mismatch"
      options={[{ value: 'ready', label: 'Ready', tone: 'success' }]}
    />
    ;<StatusDashlet
      // @ts-expect-error mixed scalar fields cannot bind to one primitive status domain.
      field={statusUnionField}
      id="status-union-mismatch"
      label="Union mismatch"
      options={[{ value: 'ready', label: 'Ready', tone: 'success' }]}
    />
    ;<RangeDashlet
      // @ts-expect-error a range|string field cannot bind to a fixed numeric range control.
      field={rangeOrStringField}
      id="range-union-mismatch"
      label="Union mismatch"
    />
    ;<RangeDashlet
      // @ts-expect-error compound range fields cannot contain extra required keys.
      field={exactCompoundFields.rangeWithRequiredExtra}
      id="range-required-extra"
      label="Required extra"
    />
    ;<RangeDashlet
      // @ts-expect-error compound range fields cannot contain extra optional keys.
      field={exactCompoundFields.rangeWithOptionalExtra}
      id="range-optional-extra"
      label="Optional extra"
    />
    ;<RangeDashlet
      // @ts-expect-error compound range fields cannot have an index signature.
      field={exactCompoundFields.indexedRange}
      id="range-index-signature"
      label="Index signature"
    />
    ;<RangeDashlet
      // @ts-expect-error the field must accept every numeric range emitted by the control.
      field={exactCompoundFields.literalRange}
      id="range-literals"
      label="Literal range"
    />
    ;<RangeDashlet
      // @ts-expect-error both compound range members must be required.
      field={exactCompoundFields.optionalRangeMember}
      id="range-optional-member"
      label="Optional member"
    />
    ;<RangeDashlet
      // @ts-expect-error every member of a compound field union must be the exact range value.
      field={exactCompoundFields.unionRange}
      id="range-object-union"
      label="Object union"
    />
    // @ts-expect-error DateDashlet rejects a number field at a direct JSX call site.
    ;<DateDashlet field={nexus.fields.progress} id="date-mismatch" label="Mismatch" />
    // @ts-expect-error TimeDashlet rejects a number field at a direct JSX call site.
    ;<TimeDashlet field={nexus.fields.progress} id="time-mismatch" label="Mismatch" />
    ;<DateTimeDashlet
      // @ts-expect-error incompatible field value.
      field={nexus.fields.progress}
      id="date-time-mismatch"
      label="Mismatch"
      timeZone="Australia/Perth"
    />
    // @ts-expect-error DateRangeDashlet rejects a date field at a direct JSX call site.
    ;<DateRangeDashlet field={nexus.fields.date} id="date-range-mismatch" label="Mismatch" />
    ;<DateRangeDashlet
      // @ts-expect-error compound date ranges cannot contain extra required keys.
      field={exactCompoundFields.dateRangeWithRequiredExtra}
      id="date-range-required-extra"
      label="Required extra"
    />
    ;<DateRangeDashlet
      // @ts-expect-error compound date ranges cannot contain extra optional keys.
      field={exactCompoundFields.dateRangeWithOptionalExtra}
      id="date-range-optional-extra"
      label="Optional extra"
    />
    ;<DateRangeDashlet
      // @ts-expect-error compound date ranges cannot have an index signature.
      field={exactCompoundFields.indexedDateRange}
      id="date-range-index-signature"
      label="Index signature"
    />
    ;<DateRangeDashlet
      // @ts-expect-error the field must accept every date string range emitted by the control.
      field={exactCompoundFields.literalDateRange}
      id="date-range-literals"
      label="Literal range"
    />
    ;<DateRangeDashlet
      // @ts-expect-error compound date range members must have equivalent string domains.
      field={exactCompoundFields.incompatibleDateRange}
      id="date-range-incompatible-member"
      label="Incompatible member"
    />
    ;<DateRangeDashlet
      // @ts-expect-error every member of a compound field union must be the exact date range value.
      field={exactCompoundFields.unionDateRange}
      id="date-range-union"
      label="Union range"
    />
    // @ts-expect-error ColorDashlet rejects a number field at a direct JSX call site.
    ;<ColorDashlet field={nexus.fields.progress} id="color-mismatch" label="Mismatch" />

    const rangeProps: RangeDashletProps<typeof nexus.fields.range> = {
      field: nexus.fields.range,
      id: 'range-props',
      label: 'Range',
      min: 0,
      max: 10,
      step: 1,
      formatOptions: { maximumFractionDigits: 1 },
      formatValue: (value) => `${value.start}-${value.end}`,
    }
    const meterProps: MeterDashletProps<typeof nexus.fields.progress> = {
      field: nexus.fields.progress,
      id: 'meter-props',
      label: 'Meter',
      min: 0,
      max: 100,
    }
    const progressProps: ProgressDashletProps<typeof nexus.fields.progress> = {
      field: nexus.fields.progress,
      id: 'progress-props',
      label: 'Progress',
    }
    const statusProps: StatusDashletProps<'ready', typeof nexus.fields.status> = {
      field: nexus.fields.status,
      id: 'status-props',
      label: 'Status',
      options: [{ value: 'ready', label: 'Ready', tone: 'success' }],
    }
    const wrongStatus: StatusDashletProps<'ready', typeof nexus.fields.status> = {
      field: nexus.fields.status,
      id: 'wrong-status',
      label: 'Status',
      options: [
        {
          // @ts-expect-error status options are typed to the field's scalar value.
          value: 'other',
          label: 'Other',
          tone: 'neutral',
        },
      ],
    }
    const dateProps: DateDashletProps<typeof nexus.fields.date> = {
      field: nexus.fields.date,
      id: 'date-props',
      label: 'Date',
      min: '2026-01-01',
      max: '2026-12-31',
      locale: 'en-AU',
      shouldForceLeadingZeros: true,
    }
    const timeProps: TimeDashletProps<typeof nexus.fields.time> = {
      field: nexus.fields.time,
      id: 'time-props',
      label: 'Time',
      granularity: 'minute',
      hourCycle: 24,
      locale: 'en-AU',
    }
    const dateTimeProps: DateTimeDashletProps<typeof nexus.fields.dateTime> = {
      field: nexus.fields.dateTime,
      id: 'date-time-props',
      label: 'Date time',
      timeZone: 'Australia/Perth',
      granularity: 'second',
      hideTimeZone: true,
    }
    const dateRangeProps: DateRangeDashletProps<typeof nexus.fields.dateRange> = {
      field: nexus.fields.dateRange,
      id: 'date-range-props',
      label: 'Date range',
      locale: 'en-AU',
    }
    const colorProps: ColorDashletProps<typeof nexus.fields.color> = {
      field: nexus.fields.color,
      id: 'color-props',
      label: 'Color',
      format: 'hsba',
    }
    void rangeProps
    void meterProps
    void progressProps
    void statusProps
    void wrongStatus
    void dateProps
    void timeProps
    void dateTimeProps
    void dateRangeProps
    void colorProps

    // @ts-expect-error RangeSlider requires an object value.
    ;<RangeSlider value={2} onChange={() => undefined} />
    // @ts-expect-error ProgressBar value is numeric when provided.
    ;<ProgressBar value="25" />
    // @ts-expect-error DateTimeDashlet requires a time zone.
    ;<DateTimeDashlet field={nexus.fields.dateTime} id="date-time" label="Date time" />
    ;<RangeDashlet
      field={nexus.fields.range}
      id="range"
      label="Range"
      // @ts-expect-error Ready-made Dashlets do not accept generic value props.
      value={{ start: 1, end: 2 }}
    />
    ;<ColorDashlet field={nexus.fields.color} id="color" label="Color" onChange={() => undefined} />
    // @ts-expect-error DateDashlet does not expose hourCycle.
    ;<DateDashlet field={nexus.fields.date} id="date-hour-cycle" label="Date" hourCycle={24} />
    // @ts-expect-error Display-only Dashlets do not expose disabled.
    ;<MeterDashlet field={nexus.fields.progress} id="meter-disabled" label="Meter" disabled />

    nexus.destroy()
  })
})
