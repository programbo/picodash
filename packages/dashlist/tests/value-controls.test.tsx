// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import { fireEvent } from '@testing-library/react'
import { createPicodashNexus } from '@picodash/nexus'
import { createDomTestRenderer, type DomTestRenderer } from '../../../test/dom-renderer.ts'
import {
  ColorField,
  DateField,
  DateRangeField,
  DateTimeField,
  Meter,
  ProgressBar,
  RangeSlider,
  Slider,
  Status,
  TimeField,
} from '../src/ui.js'
import {
  DashList,
  DateDashlet,
  DateTimeDashlet,
  MeterDashlet,
  ProgressDashlet,
  RangeDashlet,
  StatusDashlet,
  TimeDashlet,
} from '../src/index.tsx'
import { I18nProvider } from 'react-aria-components'

function render(element: ReactElement): DomTestRenderer {
  let renderer!: DomTestRenderer
  act(() => {
    renderer = createDomTestRenderer(element)
  })
  return renderer
}

describe('value controls', () => {
  it('marks range slider thumbs on the rendered React Aria roots', () => {
    const view = render(
      createElement(
        'div',
        null,
        createElement(Slider, {
          value: 2,
          onChange: () => undefined,
          'aria-label': 'Single',
        }),
        createElement(RangeSlider, {
          value: { start: 2, end: 8 },
          onChange: () => undefined,
          'aria-label': 'Range',
        }),
      ),
    )
    const sliderThumb = view.root.element.querySelector('[data-picodash-dashlist-slider-thumb]')
    expect(sliderThumb).not.toBeNull()
    expect(sliderThumb?.classList.contains('react-aria-SliderThumb')).toBe(true)
    const thumbs = view.root.element.querySelectorAll('[data-picodash-dashlist-range-slider-thumb]')
    expect(thumbs).toHaveLength(2)
    for (const thumb of thumbs)
      expect(thumb.classList.contains('react-aria-SliderThumb')).toBe(true)
    act(() => view.unmount())
  })

  it('shares invalid and error-message state across both range thumbs', () => {
    const view = render(
      createElement(
        'div',
        null,
        createElement('p', { id: 'range-error' }, 'Range is not allowed.'),
        createElement(RangeSlider, {
          className: 'invalid-range',
          value: { start: 2, end: 8 },
          onChange: () => undefined,
          'aria-label': 'Invalid range',
          'aria-invalid': true,
          'aria-errormessage': 'range-error',
        }),
        createElement(RangeSlider, {
          className: 'valid-range',
          value: { start: 2, end: 8 },
          onChange: () => undefined,
          'aria-label': 'Valid range',
        }),
      ),
    )
    const invalidThumbs = view.root.element.querySelectorAll('.invalid-range input[type="range"]')
    expect(invalidThumbs).toHaveLength(2)
    for (const thumb of invalidThumbs) {
      expect(thumb.getAttribute('aria-invalid')).toBe('true')
      expect(thumb.getAttribute('aria-errormessage')).toBe('range-error')
    }
    expect(view.root.element.querySelectorAll('#range-error')).toHaveLength(1)
    const validThumbs = view.root.element.querySelectorAll('.valid-range input[type="range"]')
    expect(validThumbs).toHaveLength(2)
    for (const thumb of validThumbs) {
      expect(thumb.hasAttribute('aria-invalid')).toBe(false)
      expect(thumb.hasAttribute('aria-errormessage')).toBe(false)
    }
    act(() => view.unmount())
  })

  it('forwards declared ids to value controls and class names to public roots', () => {
    const controls: ReactElement[] = [
      createElement(RangeSlider, {
        id: 'value-range',
        className: 'value-range-hook',
        value: { start: 2, end: 8 },
        onChange: () => undefined,
      }),
      createElement(Meter, {
        id: 'value-meter',
        className: 'value-meter-hook',
        value: 4,
        'aria-label': 'Meter',
      }),
      createElement(ProgressBar, {
        id: 'value-progress',
        className: 'value-progress-hook',
        value: 4,
        'aria-label': 'Progress',
      }),
      createElement(Status, {
        id: 'value-status',
        className: 'value-status-hook',
        value: 'ready',
        options: [{ value: 'ready', label: 'Ready', tone: 'success' as const }],
      }),
      createElement(DateField, {
        id: 'value-date',
        className: 'value-date-hook',
        value: '2026-08-13',
        onChange: () => undefined,
        'aria-label': 'Date',
      }),
      createElement(TimeField, {
        id: 'value-time',
        className: 'value-time-hook',
        value: '12:30:00',
        onChange: () => undefined,
        'aria-label': 'Time',
      }),
      createElement(DateTimeField, {
        id: 'value-date-time',
        className: 'value-date-time-hook',
        value: '2026-08-13T12:30:00+08:00',
        timeZone: 'Australia/Perth',
        onChange: () => undefined,
        'aria-label': 'Date time',
      }),
      createElement(DateRangeField, {
        id: 'value-date-range',
        className: 'value-date-range-hook',
        value: { start: '2026-08-01', end: '2026-08-13' },
        onChange: () => undefined,
        'aria-label': 'Date range',
      }),
      createElement(ColorField, {
        id: 'value-color',
        className: 'value-color-hook',
        value: '#ff0000',
        onChange: () => undefined,
        'aria-label': 'Color',
      }),
    ]
    const view = render(createElement('div', null, controls))
    for (const id of [
      'value-range',
      'value-meter',
      'value-progress',
      'value-status',
      'value-date',
      'value-time',
      'value-date-time',
      'value-date-range',
      'value-color',
    ])
      expect(view.root.element.querySelector(`#${id}`)).not.toBeNull()
    for (const className of [
      'value-range-hook',
      'value-meter-hook',
      'value-progress-hook',
      'value-status-hook',
      'value-date-hook',
      'value-time-hook',
      'value-date-time-hook',
      'value-date-range-hook',
      'value-color-hook',
    ])
      expect(view.root.element.querySelector(`.${className}`)).not.toBeNull()
    act(() => view.unmount())
  })

  it('inherits ambient locale and applies a local locale override', () => {
    const view = render(
      createElement(I18nProvider, {
        locale: 'en-US',
        children: createElement(
          'div',
          null,
          createElement(DateField, {
            value: '2026-08-13',
            onChange: () => undefined,
            'aria-label': 'Ambient',
          }),
          createElement(DateField, {
            value: '2026-08-13',
            onChange: () => undefined,
            locale: 'en-AU',
            'aria-label': 'Override',
          }),
        ),
      }),
    )
    const fields = [...view.root.element.querySelectorAll('.picodash-dashlist-date-field')]
    expect(fields).toHaveLength(2)
    const segmentTypes = (field: Element) =>
      [...field.querySelectorAll('[data-type]')]
        .map((segment) => segment.getAttribute('data-type'))
        .filter((type) => type !== 'literal')
    expect(segmentTypes(fields[0]!)).toEqual(['month', 'day', 'year'])
    expect(segmentTypes(fields[1]!)).toEqual(['day', 'month', 'year'])
    act(() => view.unmount())
  })

  it('rejects invalid locale configuration without touching Nexus', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { date: { defaultValue: '2026-08-13' } },
    })
    expect(() =>
      render(
        createElement(DateDashlet, {
          id: 'invalid-locale',
          field: nexus.fields.date,
          label: 'Date',
          locale: 'not a locale',
        }),
      ),
    ).toThrow(TypeError)
    expect(nexus.getState().values).toEqual({ date: '2026-08-13' })
    nexus.destroy()
  })

  it('renders range, meter, progress, and explicit status semantics', () => {
    const view = render(
      createElement(
        'div',
        null,
        createElement(RangeSlider, {
          value: { start: 2, end: 8 },
          onChange: () => undefined,
          'aria-label': 'Range',
        }),
        createElement(Meter, { value: 4, min: 0, max: 10, 'aria-label': 'Meter' }),
        createElement(ProgressBar, { value: 4, min: 0, max: 10, 'aria-label': 'Progress' }),
        createElement(Status, {
          value: 'ready',
          options: [{ value: 'ready', label: 'Ready', tone: 'success' as const }],
          'aria-label': 'Status',
        }),
      ),
    )
    expect(view.root.element.querySelectorAll('input[type="range"]')).toHaveLength(2)
    expect(view.root.element.querySelector('.picodash-dashlist-meter')).not.toBeNull()
    expect(view.root.element.querySelector('.picodash-dashlist-progress')).not.toBeNull()
    expect(view.root.element.querySelector('[data-tone="success"]')?.textContent).toContain('Ready')
    act(() => view.unmount())
  })

  it('keeps range and temporal updates as complete values and supports clear in /ui', () => {
    const changes: unknown[] = []
    const view = render(
      createElement(
        'div',
        null,
        createElement(DateField, {
          value: '2026-08-13',
          onChange: (next) => changes.push(next),
          'aria-label': 'Date',
        }),
        createElement(TimeField, {
          value: '12:30:00',
          onChange: (next) => changes.push(next),
          'aria-label': 'Time',
        }),
        createElement(DateTimeField, {
          value: '2026-08-13T12:30:00+08:00',
          timeZone: 'Australia/Perth',
          onChange: (next) => changes.push(next),
          'aria-label': 'Date time',
        }),
        createElement(DateRangeField, {
          value: { start: '2026-08-01', end: '2026-08-13' },
          onChange: (next) => changes.push(next),
          'aria-label': 'Date range',
        }),
        createElement(ColorField, {
          value: '#ff0000',
          format: 'hex',
          onChange: (next) => changes.push(next),
          'aria-label': 'Color',
        }),
      ),
    )
    expect(
      view.root.element.querySelectorAll('[role="group"], [role="spinbutton"]'),
    ).not.toHaveLength(0)
    expect(changes).toEqual([])
    act(() => view.unmount())
  })

  it('emits a range edit as one complete object', async () => {
    const changes: unknown[] = []
    const view = render(
      createElement(RangeSlider, {
        value: { start: 2, end: 8 },
        onChange: (next) => changes.push(next),
        min: 0,
        max: 10,
        'aria-label': 'Range',
      }),
    )
    const end = view.root.element.querySelectorAll('input[type="range"]')[1]
    await act(() => fireEvent.change(end!, { target: { value: '9' } }))
    expect(changes).toEqual([{ start: 2, end: 9 }])
    act(() => view.unmount())
  })

  it('round-trips compound and temporal values through a JSON Nexus document', () => {
    const fields = {
      range: { defaultValue: { start: 2, end: 8 } },
      dateRange: { defaultValue: { start: '2026-08-01', end: '2026-08-13' } },
      date: { defaultValue: '2026-08-13' },
      time: { defaultValue: '12:30:00' },
      dateTime: { defaultValue: '2026-08-13T12:30:00+08:00' },
      color: { defaultValue: '#ff0000' },
    } as const
    const source = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'dashlet-value-document',
      schemaVersion: 1,
      fields,
      export: { documents: { defaultFieldPolicy: 'include' } },
    })
    const exported = source.documents.executeExport(source.documents.createExportPlan())
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    const document = JSON.parse(JSON.stringify(exported.document))
    const target = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'dashlet-value-document',
      schemaVersion: 1,
      fields: {
        range: { defaultValue: { start: 0, end: 1 } },
        dateRange: { defaultValue: { start: '2026-01-01', end: '2026-01-02' } },
        date: { defaultValue: '2026-01-01' },
        time: { defaultValue: '00:00:00' },
        dateTime: { defaultValue: '2026-01-01T00:00:00+00:00' },
        color: { defaultValue: '#000000' },
      },
    })
    const analysis = target.documents.analyzeImport(document)
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    expect(target.documents.executeImport(analysis.plan)).toMatchObject({ ok: true })
    expect(target.getState().values).toEqual(source.getState().values)
    source.destroy()
    target.destroy()
  })

  it('shows mismatches without writing canonical range/status/date values', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        range: { defaultValue: { start: -2, end: 4 } },
        status: { defaultValue: 'unknown' },
        date: { defaultValue: 'not-a-date' },
      },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'values', nexus },
        createElement(RangeDashlet, {
          id: 'range',
          field: nexus.fields.range,
          label: 'Range',
          min: 0,
          max: 10,
        }),
        createElement(StatusDashlet, {
          id: 'status',
          field: nexus.fields.status,
          label: 'Status',
          options: [{ value: 'ready', label: 'Ready', tone: 'success' as const }],
        }),
        createElement(DateDashlet, { id: 'date', field: nexus.fields.date, label: 'Date' }),
      ),
    )
    expect(
      view.root.element.querySelectorAll('[data-picodash-dashlet-presentation-warning]'),
    ).toHaveLength(3)
    expect(
      view.root.element.querySelector('[data-picodash-dashlet="status"] [data-tone]'),
    ).toBeNull()
    expect(nexus.getState().values).toEqual({
      range: { start: -2, end: 4 },
      status: 'unknown',
      date: 'not-a-date',
    })
    act(() => view.unmount())
    nexus.destroy()
  })

  it('requires a valid time zone for date-time fields', () => {
    expect(() =>
      render(
        createElement(DateTimeField, {
          value: '2026-08-13T12:30:00+08:00',
          timeZone: 'Not/AZone',
          onChange: () => undefined,
          'aria-label': 'Invalid zone',
        }),
      ),
    ).toThrow()
  })

  it('uses parsed temporal bounds and exact fallbacks for incompatible values', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        sameInstant: { defaultValue: '2026-08-13T10:00:00+00:00' },
        outOfBounds: { defaultValue: '2026-08-13T10:00:01+00:00' },
        invalidTime: { defaultValue: '25:99:00' },
      },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'temporal-bounds', nexus },
        createElement(DateTimeDashlet, {
          id: 'same-instant',
          field: nexus.fields.sameInstant,
          label: 'Same instant',
          timeZone: 'Australia/Perth',
          min: '2026-08-13T18:00:00+08:00',
          max: '2026-08-13T10:00:00Z',
        }),
        createElement(DateTimeDashlet, {
          id: 'out-of-bounds',
          field: nexus.fields.outOfBounds,
          label: 'Out of bounds',
          timeZone: 'Australia/Perth',
          max: '2026-08-13T10:00:00+00:00',
        }),
        createElement(TimeDashlet, {
          id: 'invalid-time',
          field: nexus.fields.invalidTime,
          label: 'Invalid time',
        }),
      ),
    )
    expect(
      view.root.element.querySelector(
        '[data-picodash-dashlet="same-instant"] .picodash-dashlist-date-time-field',
      ),
    ).not.toBeNull()
    expect(
      view.root.element.querySelector('[data-picodash-dashlet="out-of-bounds"] output')
        ?.textContent,
    ).toBe('2026-08-13T10:00:01+00:00')
    expect(
      view.root.element.querySelector('[data-picodash-dashlet="invalid-time"] output')?.textContent,
    ).toBe('25:99:00')
    expect(
      view.root.element.querySelectorAll('[data-picodash-dashlet-presentation-warning]'),
    ).toHaveLength(2)
    expect(nexus.getState().values).toEqual({
      sameInstant: '2026-08-13T10:00:00+00:00',
      outOfBounds: '2026-08-13T10:00:01+00:00',
      invalidTime: '25:99:00',
    })
    act(() => view.unmount())
    nexus.destroy()
  })

  it('uses exact structured and scalar fallbacks without calling formatters', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        range: { defaultValue: { start: -2, end: 4 } },
        meter: { defaultValue: 120 },
        progress: { defaultValue: -1 },
      },
    })
    const throwingFormatter = () => {
      throw new Error('formatter must not run for a mismatch')
    }
    const view = render(
      createElement(
        DashList,
        { id: 'exact-fallbacks', nexus },
        createElement(RangeDashlet, {
          id: 'range',
          field: nexus.fields.range,
          label: 'Range',
          min: 0,
          max: 10,
          formatValue: throwingFormatter,
        }),
        createElement(MeterDashlet, {
          id: 'meter',
          field: nexus.fields.meter,
          label: 'Meter',
          max: 100,
          formatValue: throwingFormatter,
        }),
        createElement(ProgressDashlet, {
          id: 'progress',
          field: nexus.fields.progress,
          label: 'Progress',
          max: 100,
          formatValue: throwingFormatter,
        }),
      ),
    )
    expect(
      view.root.element.querySelector('[data-picodash-dashlist-range-value]')?.textContent,
    ).toBe('{"start":-2,"end":4}')
    expect(
      view.root.element.querySelector('[data-picodash-dashlist-meter-value]')?.textContent,
    ).toBe('120')
    expect(
      view.root.element.querySelector('[data-picodash-dashlist-progress-value]')?.textContent,
    ).toBe('-1')
    expect(nexus.getState().values).toEqual({
      range: { start: -2, end: 4 },
      meter: 120,
      progress: -1,
    })
    act(() => view.unmount())
    nexus.destroy()
  })

  it('treats omitted time granularity as minute precision', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        time: { defaultValue: '12:30:01' },
        dateTime: { defaultValue: '2026-08-13T12:30:00.001+08:00' },
      },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'implicit-minute', nexus },
        createElement(TimeDashlet, {
          id: 'time',
          field: nexus.fields.time,
          label: 'Time',
        }),
        createElement(DateTimeDashlet, {
          id: 'date-time',
          field: nexus.fields.dateTime,
          label: 'Date time',
          timeZone: 'Australia/Perth',
        }),
      ),
    )
    expect(view.root.element.querySelector('[data-picodash-dashlet="time"] input')).toBeNull()
    expect(view.root.element.querySelector('[data-picodash-dashlet="date-time"] input')).toBeNull()
    expect(
      view.root.element.querySelector('[data-picodash-dashlet="time"] output')?.textContent,
    ).toBe('12:30:01')
    expect(
      view.root.element.querySelector('[data-picodash-dashlet="date-time"] output')?.textContent,
    ).toBe('2026-08-13T12:30:00.001+08:00')
    expect(nexus.getState().values).toEqual({
      time: '12:30:01',
      dateTime: '2026-08-13T12:30:00.001+08:00',
    })
    act(() => view.unmount())
    nexus.destroy()
  })
})
