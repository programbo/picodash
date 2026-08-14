import { createElement, type ComponentProps } from 'react'
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
import {
  createPicodashNexus,
  type PicodashExactFieldOf,
  type PicodashField,
  type PicodashFieldOf,
  type RootNexus,
} from '@picodash/nexus'
import { describe, expectTypeOf, it } from 'vite-plus/test'

const narrowStringField = null as unknown as PicodashExactFieldOf<'fixed'>

const nexus = createPicodashNexus({
  valueOwner: 'nexus',
  fields: {
    range: { defaultValue: { start: 1, end: 2 } },
    status: { defaultValue: 'ready' },
    numericStatus: { defaultValue: 1 },
    date: { defaultValue: '2026-08-13' },
    time: { defaultValue: '12:30:00' },
    dateTime: { defaultValue: '2026-08-13T12:30:00+08:00' },
    dateRange: { defaultValue: { start: '2026-08-01', end: '2026-08-13' } },
    color: { defaultValue: '#ff0000' },
    progress: { defaultValue: 25 },
  },
})

type AnnotatedCompoundDefinitions = {
  readonly range: {
    readonly defaultValue: { readonly start: number; readonly end: number }
  }
  readonly dateRange: {
    readonly defaultValue: { readonly start: string; readonly end: string }
  }
}

const annotatedNexus: RootNexus<AnnotatedCompoundDefinitions> = createPicodashNexus({
  valueOwner: 'nexus',
  fields: {
    range: { defaultValue: { start: 1, end: 2 } },
    dateRange: { defaultValue: { start: '2026-08-01', end: '2026-08-13' } },
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
const anyField = null as any

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

type ExactCompoundField<Key extends keyof ExactCompoundCompatibilityValues> = PicodashExactFieldOf<
  ExactCompoundCompatibilityValues[Key]
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
    type ExtractedValueFields = {
      readonly range: ComponentProps<typeof RangeDashlet>['field']
      readonly meter: ComponentProps<typeof MeterDashlet>['field']
      readonly progress: ComponentProps<typeof ProgressDashlet>['field']
      readonly status: ComponentProps<typeof StatusDashlet>['field']
      readonly date: ComponentProps<typeof DateDashlet>['field']
      readonly time: ComponentProps<typeof TimeDashlet>['field']
      readonly dateTime: ComponentProps<typeof DateTimeDashlet>['field']
      readonly dateRange: ComponentProps<typeof DateRangeDashlet>['field']
      readonly color: ComponentProps<typeof ColorDashlet>['field']
    }
    type AliasValueFields = {
      readonly range: RangeDashletProps['field']
      readonly meter: MeterDashletProps['field']
      readonly progress: ProgressDashletProps['field']
      readonly status: StatusDashletProps['field']
      readonly date: DateDashletProps['field']
      readonly time: TimeDashletProps['field']
      readonly dateTime: DateTimeDashletProps['field']
      readonly dateRange: DateRangeDashletProps['field']
      readonly color: ColorDashletProps['field']
    }
    type ForbiddenShellProp<Props> = Props extends unknown
      ? Extract<keyof Props, 'defaultValue' | 'onChange'>
      : never
    type ValueReadyMadeProps =
      | RangeDashletProps
      | MeterDashletProps
      | ProgressDashletProps
      | StatusDashletProps
      | DateDashletProps
      | TimeDashletProps
      | DateTimeDashletProps
      | DateRangeDashletProps
      | ColorDashletProps
    expectTypeOf<ForbiddenShellProp<ValueReadyMadeProps>>().toEqualTypeOf<never>()
    const extractedValueFields: ExtractedValueFields = {
      range: nexus.fields.range,
      meter: nexus.fields.progress,
      progress: nexus.fields.progress,
      status: nexus.fields.status,
      date: nexus.fields.date,
      time: nexus.fields.time,
      dateTime: nexus.fields.dateTime,
      dateRange: nexus.fields.dateRange,
      color: nexus.fields.color,
    }
    expectTypeOf<ExtractedValueFields>().toEqualTypeOf<AliasValueFields>()
    void extractedValueFields

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
      field={annotatedNexus.fields.range}
      id="annotated-range"
      label="Annotated range"
    />
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
      field={annotatedNexus.fields.dateRange}
      id="annotated-date-range"
      label="Annotated date range"
    />
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
    void createElement(RangeDashlet, {
      field: nexus.fields.range,
      id: 'range-element',
      label: 'Range element',
    })
    void createElement(StatusDashlet, {
      field: nexus.fields.status,
      id: 'status-element',
      label: 'Status element',
      options: [{ value: 'ready', label: 'Ready', tone: 'success' }],
    })
    void createElement(ColorDashlet, {
      field: nexus.fields.color,
      id: 'color-element',
      label: 'Color element',
      // @ts-expect-error Ready-made Dashlets do not expose inherited HTML default values.
      defaultValue: '#000000',
    })

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
    // @ts-expect-error StatusDashlet rejects string options paired with a number field.
    ;<StatusDashlet
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
    // @ts-expect-error DateDashlet can emit strings outside a literal field domain.
    ;<DateDashlet field={narrowStringField} id="date-narrow" label="Narrow date" />
    // @ts-expect-error TimeDashlet rejects a number field at a direct JSX call site.
    ;<TimeDashlet field={nexus.fields.progress} id="time-mismatch" label="Mismatch" />
    // @ts-expect-error TimeDashlet can emit strings outside a literal field domain.
    ;<TimeDashlet field={narrowStringField} id="time-narrow" label="Narrow time" />
    ;<DateTimeDashlet
      // @ts-expect-error incompatible field value.
      field={nexus.fields.progress}
      id="date-time-mismatch"
      label="Mismatch"
      timeZone="Australia/Perth"
    />
    ;<DateTimeDashlet
      // @ts-expect-error DateTimeDashlet can emit strings outside a literal field domain.
      field={narrowStringField}
      id="date-time-narrow"
      label="Narrow date time"
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
    // @ts-expect-error ColorDashlet can emit strings outside a literal field domain.
    ;<ColorDashlet field={narrowStringField} id="color-narrow" label="Narrow color" />
    // `any` deliberately escapes the concrete React fallback overload.
    ;<ColorDashlet field={anyField} id="color-any" label="Color any" />

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
    const annotatedRangeProps: RangeDashletProps<typeof annotatedNexus.fields.range> = {
      field: annotatedNexus.fields.range,
      id: 'annotated-range-props',
      label: 'Annotated range props',
    }
    const annotatedDateRangeProps: DateRangeDashletProps<typeof annotatedNexus.fields.dateRange> = {
      field: annotatedNexus.fields.dateRange,
      id: 'annotated-date-range-props',
      label: 'Annotated date range props',
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
      // @ts-expect-error Explicit aliases do not expose inherited HTML default values.
      defaultValue: '#000000',
    }
    void rangeProps
    void annotatedRangeProps
    void annotatedDateRangeProps
    void meterProps
    void progressProps
    void statusProps
    void wrongStatus
    void dateProps
    void timeProps
    void dateTimeProps
    void dateRangeProps
    void colorProps

    const rangeAliasProps: RangeDashletProps = {
      id: 'range-alias',
      field: nexus.fields.range,
      label: 'Range alias',
    }
    const wrongRangeAliasProps: RangeDashletProps = {
      id: 'wrong-range-alias',
      // @ts-expect-error unspecialized compound aliases retain the exact range constraint.
      field: exactCompoundFields.rangeWithRequiredExtra,
      label: 'Wrong range alias',
    }
    const anyColorAliasProps: ColorDashletProps<any> = {
      id: 'any-color-alias',
      // @ts-expect-error explicitly specializing the field to any fails closed.
      field: nexus.fields.color,
      label: 'Any color alias',
    }
    const anyRangeAliasProps: RangeDashletProps<any> = {
      id: 'any-range-alias',
      // @ts-expect-error explicitly specializing an exact compound field to any fails closed.
      field: nexus.fields.range,
      label: 'Any range alias',
    }
    const anyStatusAliasProps: StatusDashletProps<string, any> = {
      id: 'any-status-alias',
      // @ts-expect-error explicitly specializing a status field to any fails closed.
      field: nexus.fields.status,
      label: 'Any status alias',
      options: [{ value: 'ready', label: 'Ready', tone: 'success' }],
    }
    const neverRangeAliasProps: RangeDashletProps<never> = {
      id: 'never-range-alias',
      // @ts-expect-error explicitly specializing the field to never fails closed.
      field: nexus.fields.range,
      label: 'Never range alias',
    }
    const extractedRangeProps: ComponentProps<typeof RangeDashlet> = {
      id: 'extracted-range',
      field: nexus.fields.range,
      label: 'Extracted range',
    }
    const wrongExtractedRangeProps: ComponentProps<typeof RangeDashlet> = {
      id: 'wrong-extracted-range',
      // @ts-expect-error ComponentProps retains the exact range constraint.
      field: exactCompoundFields.rangeWithRequiredExtra,
      label: 'Wrong extracted range',
    }
    const extractedProgressProps: ComponentProps<typeof ProgressDashlet> = {
      id: 'extracted-progress',
      field: nexus.fields.progress,
      label: 'Extracted progress',
    }
    const wrongExtractedProgressProps: ComponentProps<typeof ProgressDashlet> = {
      id: 'wrong-extracted-progress',
      // @ts-expect-error ComponentProps retains the numeric field constraint.
      field: nexus.fields.status,
      label: 'Wrong extracted progress',
    }
    const extractedStatusProps: ComponentProps<typeof StatusDashlet> = {
      id: 'extracted-status',
      field: nexus.fields.status,
      label: 'Extracted status',
      options: [{ value: 'ready', label: 'Ready', tone: 'success' }],
    }
    // @ts-expect-error unspecialized Status props correlate number fields with number options.
    const numericStatusWithStringOptions: ComponentProps<typeof StatusDashlet> = {
      id: 'numeric-status-string-options',
      field: nexus.fields.numericStatus,
      label: 'Numeric status with string options',
      options: [{ value: 'ready', label: 'Ready', tone: 'success' }],
    }
    // @ts-expect-error unspecialized Status props correlate string fields with string options.
    const stringStatusWithNumberOptions: ComponentProps<typeof StatusDashlet> = {
      id: 'string-status-number-options',
      field: nexus.fields.status,
      label: 'String status with number options',
      options: [{ value: 1, label: 'One', tone: 'neutral' }],
    }
    const wrongExtractedStatusProps: ComponentProps<typeof StatusDashlet> = {
      id: 'wrong-extracted-status',
      // @ts-expect-error ComponentProps rejects fields outside the primitive status domain.
      field: nexus.fields.range,
      label: 'Wrong extracted status',
      options: [{ value: 'ready', label: 'Ready', tone: 'success' }],
    }
    const extractedDateProps: ComponentProps<typeof DateDashlet> = {
      id: 'extracted-date',
      field: nexus.fields.date,
      label: 'Extracted date',
      // @ts-expect-error ComponentProps does not restore inherited HTML change handlers.
      onChange: () => undefined,
    }
    const wrongExtractedDateProps: ComponentProps<typeof DateDashlet> = {
      id: 'wrong-extracted-date',
      // @ts-expect-error ComponentProps retains the temporal string field constraint.
      field: nexus.fields.progress,
      label: 'Wrong extracted date',
    }
    const extractedDateRangeProps: ComponentProps<typeof DateRangeDashlet> = {
      id: 'extracted-date-range',
      field: nexus.fields.dateRange,
      label: 'Extracted date range',
    }
    const wrongExtractedDateRangeProps: ComponentProps<typeof DateRangeDashlet> = {
      id: 'wrong-extracted-date-range',
      // @ts-expect-error ComponentProps retains the exact date range constraint.
      field: exactCompoundFields.dateRangeWithRequiredExtra,
      label: 'Wrong extracted date range',
    }
    const extractedColorProps: ComponentProps<typeof ColorDashlet> = {
      id: 'extracted-color',
      field: nexus.fields.color,
      label: 'Extracted color',
    }
    const wrongExtractedColorProps: ComponentProps<typeof ColorDashlet> = {
      id: 'wrong-extracted-color',
      // @ts-expect-error ComponentProps retains the color string field constraint.
      field: nexus.fields.progress,
      label: 'Wrong extracted color',
    }
    const narrowExtractedColorProps: ComponentProps<typeof ColorDashlet> = {
      id: 'narrow-extracted-color',
      // @ts-expect-error ComponentProps rejects narrowed writable string fields.
      field: narrowStringField,
      label: 'Narrow extracted color',
    }
    void rangeAliasProps
    void wrongRangeAliasProps
    void anyColorAliasProps
    void anyRangeAliasProps
    void anyStatusAliasProps
    void neverRangeAliasProps
    void extractedRangeProps
    void wrongExtractedRangeProps
    void extractedProgressProps
    void wrongExtractedProgressProps
    void extractedStatusProps
    void numericStatusWithStringOptions
    void stringStatusWithNumberOptions
    void wrongExtractedStatusProps
    void extractedDateProps
    void wrongExtractedDateProps
    void extractedDateRangeProps
    void wrongExtractedDateRangeProps
    void extractedColorProps
    void wrongExtractedColorProps
    void narrowExtractedColorProps

    void createElement(DateTimeDashlet, {
      id: 'narrow-date-time-element',
      // @ts-expect-error unannotated createElement rejects narrowed writable string fields.
      field: narrowStringField,
      label: 'Narrow date time element',
      timeZone: 'Australia/Perth',
    })

    function RangeWrapper<
      F extends PicodashExactFieldOf<{ readonly start: number; readonly end: number }>,
    >(props: RangeDashletProps<F>) {
      return <RangeDashlet<F> {...props} />
    }
    ;<RangeWrapper id="wrapped-range" field={nexus.fields.range} label="Wrapped range" />
    ;<RangeWrapper
      id="wrapped-range-default"
      field={nexus.fields.range}
      label="Wrapped range default"
      // @ts-expect-error Generic wrappers preserve the ready-made shell exclusions.
      defaultValue="ignored"
    />

    function StatusWrapper<F extends PicodashFieldOf<string>>(
      props: StatusDashletProps<string, F>,
    ) {
      return <StatusDashlet<string, F> {...props} />
    }
    ;<StatusWrapper
      id="wrapped-status"
      field={nexus.fields.status}
      label="Wrapped status"
      options={[{ value: 'ready', label: 'Ready', tone: 'success' }]}
    />

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
    ;<ColorDashlet
      field={nexus.fields.color}
      id="color"
      label="Color"
      // @ts-expect-error Ready-made Dashlets do not expose inherited HTML change handlers.
      onChange={() => undefined}
    />
    // @ts-expect-error DateDashlet does not expose hourCycle.
    ;<DateDashlet field={nexus.fields.date} id="date-hour-cycle" label="Date" hourCycle={24} />
    // @ts-expect-error Display-only Dashlets do not expose disabled.
    ;<MeterDashlet field={nexus.fields.progress} id="meter-disabled" label="Meter" disabled />

    nexus.destroy()
    annotatedNexus.destroy()
  })
})
