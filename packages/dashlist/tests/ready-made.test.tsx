// @vitest-environment jsdom
import { act, createElement, StrictMode, type ReactElement } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import { fireEvent } from '@testing-library/react'
import { createPicodashNexus } from '@picodash/nexus'
import { createDomTestRenderer, type DomTestRenderer } from '../../../test/dom-renderer.ts'
import {
  ColorDashlet,
  DashList,
  DateDashlet,
  DateRangeDashlet,
  DateTimeDashlet,
  DisplayDashlet,
  NumberDashlet,
  RangeDashlet,
  SegmentedDashlet,
  SelectDashlet,
  SliderDashlet,
  SwitchDashlet,
  TimeDashlet,
  RadioGroupDashlet,
  TextDashlet,
} from '../src/index.tsx'
import { isNumberCompatible, snapNumberToStep } from '../src/number-compatibility.ts'

function render(element: ReactElement): DomTestRenderer {
  let renderer!: DomTestRenderer
  act(() => {
    renderer = createDomTestRenderer(element)
  })
  return renderer
}

describe('@picodash/dashlist ready-made Dashlets', () => {
  it('matches the installed React Stately step grammar exactly', () => {
    for (const { value, min, max, step } of [
      { value: 0.3, min: 0, max: 1, step: 0.1 },
      { value: -0.3, min: -0.5, max: 0.5, step: 0.2 },
      { value: 3e-7, min: 0, max: 1e-6, step: 1e-7 },
      { value: 2_251_799_813_685_200, min: 0, max: 3e15, step: 100 },
      { value: -0, min: undefined, max: undefined, step: 1 },
    ] as const)
      expect(isNumberCompatible(value, min, max, step)).toBe(true)

    for (const { value, min, max, step } of [
      { value: 22_517_998_136_852.25, min: 0, max: 3e13, step: 1 },
      { value: -0.2, min: -0.5, max: 0.5, step: 0.2 },
      { value: 3.5e-7, min: 0, max: 1e-6, step: 1e-7 },
      { value: Number.MAX_VALUE, min: -Number.MAX_VALUE, max: Number.MAX_VALUE, step: 0.1 },
    ] as const)
      expect(isNumberCompatible(value, min, max, step)).toBe(false)

    for (const { seed, min, max, step } of [
      { seed: 0.29, min: 0, max: 1, step: 0.1 },
      { seed: -0.19, min: -0.5, max: 0.5, step: 0.2 },
      { seed: 3.49e-7, min: 0, max: 1e-6, step: 1e-7 },
      { seed: 22_517_998_136_852.25, min: 0, max: 3e13, step: 1 },
    ] as const) {
      const emitted = snapNumberToStep(seed, min, max, step)
      expect(isNumberCompatible(emitted, min, max, step)).toBe(true)
    }
  })

  it('wires rejected binding input issues to original, choice, and value controls', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        text: {
          defaultValue: 'hello',
          validate: (value) =>
            (value as string) === 'bad' ? [{ message: 'Text is not allowed.' }] : [],
        },
        slider: {
          defaultValue: 4,
          validate: (value) =>
            (value as number) === 9 ? [{ message: 'Nine is not allowed.' }] : [],
        },
        choice: {
          defaultValue: 'one',
          validate: (value) =>
            (value as string) === 'two' ? [{ message: 'Two is not allowed.' }] : [],
        },
      },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'binding-aria', nexus },
        createElement(TextDashlet, {
          id: 'text',
          field: nexus.fields.text,
          label: 'Text',
        }),
        createElement(SliderDashlet, {
          id: 'slider',
          field: nexus.fields.slider,
          label: 'Slider',
        }),
        createElement(RadioGroupDashlet, {
          id: 'choice',
          field: nexus.fields.choice,
          label: 'Choice',
          options: ['one', 'two'],
        }),
      ),
    )
    act(() => {
      fireEvent.input(view.root.element.querySelector('[data-picodash-dashlet="text"] input')!, {
        target: { value: 'bad' },
      })
      fireEvent.change(view.root.element.querySelector('[data-picodash-dashlet="slider"] input')!, {
        target: { value: '9' },
      })
      fireEvent.click(
        view.root.element.querySelectorAll('[data-picodash-dashlet="choice"] input')[1]!,
      )
    })
    for (const [dashletId, message] of [
      ['text', 'Text is not allowed.'],
      ['slider', 'Nine is not allowed.'],
      ['choice', 'Two is not allowed.'],
    ] as const) {
      const control = view.root.element.querySelector(
        `[data-picodash-dashlet="${dashletId}"] [aria-invalid="true"]`,
      )
      expect(control).not.toBeNull()
      const errorId = control?.getAttribute('aria-errormessage')
      expect(errorId).toBeTruthy()
      expect(view.root.element.querySelector(`#${errorId}`)?.textContent).toContain(message)
    }
    act(() => view.unmount())
    nexus.destroy()
  }, 30_000)

  it('shares one rejected range issue across both atomic range thumbs', async () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        range: {
          defaultValue: { start: 2, end: 8 },
          validate: (value) =>
            (value as { end: number }).end === 9 ? [{ message: 'Range is not allowed.' }] : [],
        },
      },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'range-binding-aria', nexus },
        createElement(RangeDashlet, {
          id: 'range',
          field: nexus.fields.range,
          label: 'Range',
          min: 0,
          max: 10,
        }),
      ),
    )
    const inputs = view.root.element.querySelectorAll(
      '[data-picodash-dashlet="range"] input[type="range"]',
    )
    expect(inputs).toHaveLength(2)
    await act(() => fireEvent.change(inputs[1]!, { target: { value: '9' } }))
    const errorIds = [...inputs].map((input) => input.getAttribute('aria-errormessage'))
    expect(errorIds[0]).toBeTruthy()
    expect(errorIds[1]).toBe(errorIds[0])
    for (const input of inputs) expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(
      view.root.element.querySelectorAll(
        '[data-picodash-dashlet="range"] [data-picodash-dashlet-binding-issues]',
      ),
    ).toHaveLength(1)
    expect(view.root.element.querySelector(`#${errorIds[0]}`)?.textContent).toContain(
      'Range is not allowed.',
    )
    expect(nexus.getState().values.range).toEqual({ start: 2, end: 8 })
    act(() => view.unmount())
    nexus.destroy()
  })

  it('renders the complete seven-control slice with semantic controls', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        text: { defaultValue: 'hello' },
        number: { defaultValue: 4 },
        slider: { defaultValue: 4 },
        enabled: { defaultValue: true },
        choice: { defaultValue: 'one' },
        mode: { defaultValue: 1 },
        output: { defaultValue: { ok: true } },
      },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'ready-made', nexus },
        createElement(TextDashlet, {
          id: 'text',
          field: nexus.fields.text,
          label: 'Text',
        }),
        createElement(NumberDashlet, {
          id: 'number',
          field: nexus.fields.number,
          label: 'Number',
        }),
        createElement(SliderDashlet, {
          id: 'slider',
          field: nexus.fields.slider,
          label: 'Slider',
        }),
        createElement(SwitchDashlet, {
          id: 'enabled',
          field: nexus.fields.enabled,
          label: 'Enabled',
        }),
        createElement(SelectDashlet, {
          id: 'choice',
          field: nexus.fields.choice,
          label: 'Choice',
          options: ['one', 'two'],
        }),
        createElement(SegmentedDashlet, {
          id: 'mode',
          field: nexus.fields.mode,
          label: 'Mode',
          options: [1, 2],
        }),
        createElement(DisplayDashlet, {
          id: 'output',
          field: nexus.fields.output,
          label: 'Output',
        }),
      ),
    )
    expect(view.root.element.querySelectorAll('[role="listitem"]')).toHaveLength(7)
    expect(view.root.element.querySelector('input[type="text"]')).not.toBeNull()
    expect(view.root.element.querySelectorAll('.picodash-dashlist-field input')).toHaveLength(2)
    expect(view.root.element.querySelector('.picodash-dashlist-slider')).not.toBeNull()
    expect(view.root.element.querySelector('[role="switch"]')).not.toBeNull()
    expect(view.root.element.querySelector('.picodash-dashlist-select button')).not.toBeNull()
    expect(view.root.element.querySelectorAll('.picodash-dashlist-segmented')).toHaveLength(1)
    expect(
      view.root.element.querySelector('[data-picodash-dashlist-display]')?.textContent,
    ).toContain('"ok": true')
    act(() => view.unmount())
    nexus.destroy()
  })

  it('preserves choice primitive identity and forwards refs through ready-made shells', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { choice: { defaultValue: 1 }, mode: { defaultValue: '1' } },
    })
    const selectRef = { current: null as HTMLDivElement | null }
    const segmentedRef = { current: null as HTMLDivElement | null }
    const view = render(
      createElement(
        DashList,
        { id: 'identity', nexus },
        createElement(SelectDashlet, {
          id: 'choice',
          ref: selectRef,
          field: nexus.fields.choice,
          label: 'Choice',
          options: ['1', 1] as never,
        }),
        createElement(SegmentedDashlet, {
          id: 'mode',
          ref: segmentedRef,
          field: nexus.fields.mode,
          label: 'Mode',
          options: ['1', 1] as never,
        }),
      ),
    )
    expect(selectRef.current?.dataset.picodashDashlet).toBe('choice')
    expect(segmentedRef.current?.dataset.picodashDashlet).toBe('mode')
    expect(segmentedRef.current?.querySelector('[role="radiogroup"]')?.id).toMatch(
      /^picodash-dashlet-control-/,
    )
    expect(view.root.element.querySelector('option[value="string:1"]')).not.toBeNull()
    expect(view.root.element.querySelector('option[value="number:1"]')).not.toBeNull()
    act(() => view.unmount())
    nexus.destroy()
  })

  it('shows canonical presentation mismatches without writing them', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        number: { defaultValue: 42 },
        slider: { defaultValue: 42 },
        choice: { defaultValue: 'other' },
      },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'mismatch', nexus },
        createElement(NumberDashlet, {
          id: 'number',
          field: nexus.fields.number,
          label: 'Number',
          min: 0,
          max: 10,
        }),
        createElement(SliderDashlet, {
          id: 'slider',
          field: nexus.fields.slider,
          label: 'Slider',
          min: 0,
          max: 10,
        }),
        createElement(SelectDashlet, {
          id: 'choice',
          field: nexus.fields.choice,
          label: 'Choice',
          options: ['one', 'two'],
          placeholder: 'Choose a value',
        }),
      ),
    )
    const warnings = [
      ...view.root.element.querySelectorAll('[data-picodash-dashlet-presentation-warning]'),
    ]
    expect(warnings).toHaveLength(3)
    expect(warnings.map((node) => node.textContent)).toEqual([
      'The current value (42) is outside the configured range.',
      'The current value (42) is outside the configured range.',
      'The current value (other) is not in the configured choices.',
    ])
    expect(
      view.root.element.querySelector('[data-picodash-dashlist-number-value]')?.textContent,
    ).toBe('42')
    expect(
      view.root.element.querySelector('[data-picodash-dashlist-slider-canonical]')?.textContent,
    ).toBe('42')
    const unavailableChoice = view.root.element.querySelector<HTMLButtonElement>(
      '[data-picodash-dashlet="choice"] .picodash-dashlist-control',
    )
    expect(unavailableChoice?.textContent).toBe('other')
    expect(unavailableChoice?.disabled).toBe(false)
    expect(view.root.element.querySelector('[aria-invalid]')).toBeNull()
    expect(view.root.element.querySelector('[role="status"]')?.textContent).toBe('')
    expect(nexus.getState().values).toEqual({ number: 42, slider: 42, choice: 'other' })
    act(() => view.unmount())
    nexus.destroy()
  })

  it('announces focused numeric mismatch introductions once through StrictMode transitions', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { number: { defaultValue: 5 } },
    })
    const view = render(
      createElement(
        StrictMode,
        null,
        createElement(
          DashList,
          { id: 'numeric-transitions', nexus },
          createElement(NumberDashlet, {
            id: 'number',
            field: nexus.fields.number,
            label: 'Number',
            min: 0,
            max: 10,
          }),
        ),
      ),
    )
    const status = () => view.root.element.querySelector<HTMLElement>('[role="status"]')!

    const initialStatus = status()
    act(() => void nexus.setValue(nexus.fields.number, 42))
    expect(status()).toBe(initialStatus)
    expect(status().textContent).toBe('')
    expect(
      view.root.element.querySelector('[data-picodash-dashlist-number-value]')?.textContent,
    ).toBe('42')

    act(() => void nexus.setValue(nexus.fields.number, 5))
    act(() => view.root.element.querySelector<HTMLInputElement>('input')!.focus())
    act(() => void nexus.setValue(nexus.fields.number, 42))
    const firstAnnouncement = status()
    expect(firstAnnouncement).not.toBe(initialStatus)
    expect(firstAnnouncement.textContent).toBe(
      'The current value (42) is outside the configured range.',
    )

    act(() => void nexus.setValue(nexus.fields.number, 43))
    expect(status()).toBe(firstAnnouncement)
    expect(status().textContent).toBe('The current value (42) is outside the configured range.')

    act(() => void nexus.setValue(nexus.fields.number, 5))
    act(() => view.root.element.querySelector<HTMLInputElement>('input')!.focus())
    act(() => void nexus.setValue(nexus.fields.number, 42))
    expect(status()).not.toBe(firstAnnouncement)
    expect(status().textContent).toBe('The current value (42) is outside the configured range.')
    expect(view.root.element.querySelector('[aria-invalid]')).toBeNull()
    expect(nexus.getState().values.number).toBe(42)

    act(() => view.unmount())
    nexus.destroy()
  })

  it('renders formatted ReactNodes directly and slider formatting as a trailing value', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { output: { defaultValue: { count: 2 } }, slider: { defaultValue: 3 } },
    })
    let formattedValue: unknown
    const view = render(
      createElement(
        DashList,
        { id: 'formatting', nexus },
        createElement(DisplayDashlet, {
          id: 'output',
          field: nexus.fields.output,
          label: 'Output',
          formatValue: (value) => {
            formattedValue = value
            const output = value as { readonly count: number }
            return createElement('strong', null, `Count ${output.count}`)
          },
        }),
        createElement(SliderDashlet, {
          id: 'slider',
          field: nexus.fields.slider,
          label: 'Slider',
          formatValue: (value) => `${value}%`,
        }),
      ),
    )
    expect(
      view.root.element.querySelector('[data-picodash-dashlist-display] strong')?.textContent,
    ).toBe('Count 2')
    expect(formattedValue).toBe(nexus.getState().values.output)
    expect(
      view.root.element.querySelector('[data-picodash-dashlist-slider-value]')?.textContent,
    ).toBe('3%')
    act(() => view.unmount())
    nexus.destroy()
  })

  it('falls back exactly for off-step numeric values without invoking a snapping control', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        number: { defaultValue: 1.3 },
        slider: { defaultValue: 42.5 },
        huge: { defaultValue: 22_517_998_136_852.25 },
        anchored: { defaultValue: -0.2 },
        range: { defaultValue: { start: 22_517_998_136_852.25, end: 22_517_998_136_854 } },
      },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'off-step', nexus },
        createElement(NumberDashlet, {
          id: 'number',
          field: nexus.fields.number,
          label: 'Number',
          min: 0,
          max: 10,
          step: 0.5,
        }),
        createElement(SliderDashlet, {
          id: 'slider',
          field: nexus.fields.slider,
          label: 'Slider',
        }),
        createElement(NumberDashlet, {
          id: 'huge',
          field: nexus.fields.huge,
          label: 'Huge number',
          min: 0,
          max: 3e13,
          step: 1,
        }),
        createElement(NumberDashlet, {
          id: 'anchored',
          field: nexus.fields.anchored,
          label: 'Anchored number',
          min: -0.5,
          max: 0.5,
          step: 0.2,
        }),
        createElement(RangeDashlet, {
          id: 'range',
          field: nexus.fields.range,
          label: 'Range',
          min: 0,
          max: 3e13,
          step: 1,
        }),
      ),
    )
    for (const [id, canonical] of [
      ['number', '1.3'],
      ['slider', '42.5'],
      ['huge', '22517998136852.25'],
      ['anchored', '-0.2'],
      ['range', '{"start":22517998136852.25,"end":22517998136854}'],
    ] as const) {
      expect(view.root.element.querySelector(`[data-picodash-dashlet="${id}"] input`)).toBeNull()
      expect(
        view.root.element.querySelector(`[data-picodash-dashlet="${id}"] output`)?.textContent,
      ).toBe(canonical)
    }
    expect(
      view.root.element.querySelectorAll('[data-picodash-dashlet-presentation-warning]'),
    ).toHaveLength(5)
    expect(nexus.getState().values).toEqual({
      number: 1.3,
      slider: 42.5,
      huge: 22_517_998_136_852.25,
      anchored: -0.2,
      range: { start: 22_517_998_136_852.25, end: 22_517_998_136_854 },
    })
    act(() => view.unmount())
    nexus.destroy()
  })

  it('repairs focus to the named shell when an external value replaces a focused editor', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        number: { defaultValue: 5 },
        slider: { defaultValue: 5 },
        range: { defaultValue: { start: 2, end: 8 } },
        date: { defaultValue: '2026-08-14' },
        time: { defaultValue: '12:30:00' },
        dateTime: { defaultValue: '2026-08-14T12:30:00+08:00' },
        dateRange: { defaultValue: { start: '2026-08-01', end: '2026-08-14' } },
        color: { defaultValue: '#ff0000' },
      },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'focus-repair', nexus, 'aria-label': 'Focus repair' },
        createElement(NumberDashlet, {
          id: 'number',
          field: nexus.fields.number,
          label: 'Number',
          min: 0,
          max: 10,
        }),
        createElement(SliderDashlet, {
          id: 'slider',
          field: nexus.fields.slider,
          label: 'Slider',
          min: 0,
          max: 10,
        }),
        createElement(RangeDashlet, {
          id: 'range',
          field: nexus.fields.range,
          label: 'Range',
          min: 0,
          max: 10,
        }),
        createElement(DateDashlet, {
          id: 'date',
          field: nexus.fields.date,
          label: 'Date',
        }),
        createElement(TimeDashlet, {
          id: 'time',
          field: nexus.fields.time,
          label: 'Time',
          granularity: 'minute',
        }),
        createElement(DateTimeDashlet, {
          id: 'date-time',
          field: nexus.fields.dateTime,
          label: 'Date time',
          timeZone: 'Australia/Perth',
          granularity: 'minute',
        }),
        createElement(DateRangeDashlet, {
          id: 'date-range',
          field: nexus.fields.dateRange,
          label: 'Date range',
        }),
        createElement(ColorDashlet, {
          id: 'color',
          field: nexus.fields.color,
          label: 'Color',
          format: 'hex',
        }),
      ),
    )

    const transitions = [
      {
        id: 'number',
        focus: 'input',
        update: () => nexus.setValue(nexus.fields.number, 42),
        warning: 'The current value (42) is outside the configured range.',
      },
      {
        id: 'slider',
        focus: 'input[type="range"]',
        update: () => nexus.setValue(nexus.fields.slider, 42),
        warning: 'The current value (42) is outside the configured range.',
      },
      {
        id: 'range',
        focus: 'input[type="range"]',
        update: () => nexus.setValue(nexus.fields.range, { start: -1, end: 8 }),
        warning: 'The current range ({ start: -1, end: 8 }) is outside the configured range.',
      },
      {
        id: 'date',
        focus: '[role="spinbutton"]',
        update: () => nexus.setValue(nexus.fields.date, 'not-a-date'),
        warning:
          'The current value (not-a-date) cannot be represented by the configured date field.',
      },
      {
        id: 'time',
        focus: '[role="spinbutton"]',
        update: () => nexus.setValue(nexus.fields.time, '12:30:01'),
        warning: 'The current value (12:30:01) cannot be represented by the configured time field.',
      },
      {
        id: 'date-time',
        focus: '[role="spinbutton"]',
        update: () => nexus.setValue(nexus.fields.dateTime, '2026-08-14T12:30:01+08:00'),
        warning:
          'The current value (2026-08-14T12:30:01+08:00) cannot be represented by the configured date-time field.',
      },
      {
        id: 'date-range',
        focus: '[role="spinbutton"]',
        update: () =>
          nexus.setValue(nexus.fields.dateRange, {
            start: '2026-08-14',
            end: '2026-08-01',
          }),
        warning: 'The current date range cannot be represented by the configured date range field.',
      },
      {
        id: 'color',
        focus: 'input',
        update: () => nexus.setValue(nexus.fields.color, '#ff000080'),
        warning: 'The current color (#ff000080) cannot be edited in the configured color format.',
      },
    ] as const

    for (const transition of transitions) {
      const item = view.root.element.querySelector<HTMLElement>(
        `[data-picodash-dashlet="${transition.id}"]`,
      )!
      const shell = item.querySelector<HTMLElement>('[data-picodash-dashlet-shell]')!
      const editor = shell.querySelector<HTMLElement>(transition.focus)!
      act(() => editor.focus())
      expect(editor.ownerDocument.activeElement).toBe(editor)
      act(() => void transition.update())
      expect(editor.ownerDocument.activeElement).toBe(shell)
      expect(view.root.element.querySelectorAll('[role="status"]')).toHaveLength(1)
      expect(view.root.element.querySelector('[role="status"]')?.textContent).toBe(
        transition.warning,
      )
    }

    expect(nexus.getState().values).toEqual({
      number: 42,
      slider: 42,
      range: { start: -1, end: 8 },
      date: 'not-a-date',
      time: '12:30:01',
      dateTime: '2026-08-14T12:30:01+08:00',
      dateRange: { start: '2026-08-14', end: '2026-08-01' },
      color: '#ff000080',
    })
    act(() => view.unmount())
    nexus.destroy()
  }, 30_000)

  it('keeps zero, fractional, and opaque alpha editable in alpha-preserving color formats', async () => {
    const expectedByFormat = {
      hexa: (alpha: 0 | 0.5 | 1) => `#336699${alpha === 0 ? '00' : alpha === 0.5 ? '80' : 'FF'}`,
      rgba: (alpha: 0 | 0.5 | 1) => `rgba(51, 102, 153, ${alpha})`,
      hsla: (alpha: 0 | 0.5 | 1) => `hsla(210, 50%, 40%, ${alpha})`,
      hsba: (alpha: 0 | 0.5 | 1) => `hsba(210, 66.67%, 60%, ${alpha})`,
    } as const

    for (const format of ['hexa', 'rgba', 'hsla', 'hsba'] as const) {
      for (const alpha of [0, 0.5, 1] as const) {
        const nexus = createPicodashNexus({
          valueOwner: 'nexus',
          fields: { color: { defaultValue: `rgba(255, 0, 0, ${alpha})` } },
        })
        const view = render(
          createElement(
            DashList,
            { id: `alpha-${format}-${alpha}`, nexus },
            createElement(ColorDashlet, {
              id: 'color',
              field: nexus.fields.color,
              label: 'Color',
              format,
            }),
          ),
        )
        const input = view.root.element.querySelector<HTMLInputElement>(
          '[data-picodash-dashlet="color"] input',
        )!
        expect(input).not.toBeNull()
        expect(
          view.root.element.querySelector('[data-picodash-dashlet-presentation-warning]'),
        ).toBeNull()
        await act(() =>
          fireEvent.change(input, { target: { value: `rgba(51, 102, 153, ${alpha})` } }),
        )
        expect(nexus.getState().values.color).toBe(expectedByFormat[format](alpha))
        act(() => view.unmount())
        nexus.destroy()
      }
    }
  }, 30_000)

  it('rejects non-finite numeric choice options for legacy choice Dashlets', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { select: { defaultValue: 1 }, segmented: { defaultValue: 1 } },
    })
    expect(() =>
      render(
        createElement(
          DashList,
          { id: 'invalid-select-choice', nexus },
          createElement(SelectDashlet, {
            id: 'select',
            field: nexus.fields.select,
            label: 'Select',
            options: [Number.NaN],
          }),
        ),
      ),
    ).toThrow('choice values must be finite strings or numbers.')
    expect(() =>
      render(
        createElement(
          DashList,
          { id: 'invalid-segmented-choice', nexus },
          createElement(SegmentedDashlet, {
            id: 'segmented',
            field: nexus.fields.segmented,
            label: 'Segmented',
            options: [Number.POSITIVE_INFINITY],
          }),
        ),
      ),
    ).toThrow('choice values must be finite strings or numbers.')
    expect(nexus.getState().values).toEqual({ select: 1, segmented: 1 })
    nexus.destroy()
  })

  it('disables an empty SelectDashlet without writing its field', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { choice: { defaultValue: 'one' } },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'empty-select', nexus },
        createElement(SelectDashlet, {
          id: 'choice',
          field: nexus.fields.choice,
          label: 'Choice',
          options: [],
        }),
      ),
    )
    const trigger = view.root.element.querySelector(
      '[data-picodash-dashlet="choice"] .picodash-dashlist-control',
    ) as HTMLButtonElement | null
    expect(trigger).not.toBeNull()
    expect(trigger?.disabled).toBe(true)
    if (trigger) fireEvent.click(trigger)
    expect(nexus.getState().values).toEqual({ choice: 'one' })
    act(() => view.unmount())
    nexus.destroy()
  })

  it('does not leak Select-only placeholder props through SegmentedDashlet', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { mode: { defaultValue: 'one' } },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'segmented-no-placeholder', nexus },
        createElement(SegmentedDashlet, {
          id: 'mode',
          field: nexus.fields.mode,
          label: 'Mode',
          options: ['one', 'two'],
          placeholder: 'Should not reach the DOM',
        } as never),
      ),
    )
    expect(
      view.root.element.querySelector('[data-picodash-dashlet="mode"] [placeholder]'),
    ).toBeNull()
    act(() => view.unmount())
    nexus.destroy()
  })
})
