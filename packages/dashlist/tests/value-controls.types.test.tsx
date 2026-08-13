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
import { createPicodashNexus } from '@picodash/nexus'
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
    // @ts-expect-error ProgressDashlet rejects a date field at a direct JSX call site.
    ;<ProgressDashlet field={nexus.fields.date} id="progress-mismatch" label="Mismatch" />
    ;<StatusDashlet
      // @ts-expect-error incompatible field value.
      field={nexus.fields.progress}
      id="status-mismatch"
      label="Mismatch"
      options={[{ value: 'ready', label: 'Ready', tone: 'success' }]}
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
