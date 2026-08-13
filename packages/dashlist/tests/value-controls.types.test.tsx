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
  ProgressDashlet,
  RangeDashlet,
  StatusDashlet,
} from '../src/index.tsx'
import { createPicodashNexus } from '@picodash/nexus'

const nexus = createPicodashNexus({
  valueOwner: 'nexus',
  fields: {
    range: { defaultValue: { start: 1, end: 2 } },
    status: { defaultValue: 'ready' },
    date: { defaultValue: '2026-08-13' },
    dateTime: { defaultValue: '2026-08-13T12:30:00+08:00' },
    dateRange: { defaultValue: { start: '2026-08-01', end: '2026-08-13' } },
    color: { defaultValue: '#ff0000' },
    progress: { defaultValue: 25 },
  },
})

;<RangeSlider value={{ start: 1, end: 2 }} onChange={(value) => value.end} />
;<ProgressBar value={25} />
;<Status value="ready" options={[{ value: 'ready', label: 'Ready', tone: 'success' }]} />
;<DateField value="2026-08-13" onChange={() => undefined} />
;<DateRangeField value={{ start: '2026-08-01', end: '2026-08-13' }} onChange={() => undefined} />
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

// @ts-expect-error RangeSlider requires an object value.
;<RangeSlider value={2} onChange={() => undefined} />
// @ts-expect-error ProgressBar value is numeric when provided.
;<ProgressBar value="25" />
// @ts-expect-error DateTimeDashlet requires a time zone.
;<DateTimeDashlet field={nexus.fields.dateTime} id="date-time" label="Date time" />
// @ts-expect-error Ready-made Dashlets do not accept generic value props.
;<RangeDashlet field={nexus.fields.range} id="range" label="Range" value={{ start: 1, end: 2 }} />
;<ColorDashlet field={nexus.fields.color} id="color" label="Color" onChange={() => undefined} />

nexus.destroy()
