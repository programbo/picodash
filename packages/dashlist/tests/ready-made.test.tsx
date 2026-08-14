// @vitest-environment jsdom
import { act, createElement, StrictMode, type ReactElement } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import { fireEvent } from '@testing-library/react'
import { createPicodashNexus } from '@picodash/nexus'
import { createDomTestRenderer, type DomTestRenderer } from '../../../test/dom-renderer.ts'
import {
  DashList,
  DisplayDashlet,
  NumberDashlet,
  RangeDashlet,
  SegmentedDashlet,
  SelectDashlet,
  SliderDashlet,
  SwitchDashlet,
  RadioGroupDashlet,
  TextDashlet,
} from '../src/index.tsx'

function render(element: ReactElement): DomTestRenderer {
  let renderer!: DomTestRenderer
  act(() => {
    renderer = createDomTestRenderer(element)
  })
  return renderer
}

describe('@picodash/dashlist ready-made Dashlets', () => {
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
        createElement(TextDashlet, { id: 'text', field: nexus.fields.text, label: 'Text' }),
        createElement(SliderDashlet, { id: 'slider', field: nexus.fields.slider, label: 'Slider' }),
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
        createElement(TextDashlet, { id: 'text', field: nexus.fields.text, label: 'Text' }),
        createElement(NumberDashlet, { id: 'number', field: nexus.fields.number, label: 'Number' }),
        createElement(SliderDashlet, { id: 'slider', field: nexus.fields.slider, label: 'Slider' }),
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
          options: ['1', 1],
        }),
        createElement(SegmentedDashlet, {
          id: 'mode',
          ref: segmentedRef,
          field: nexus.fields.mode,
          label: 'Mode',
          options: ['1', 1],
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
            return createElement('strong', null, `Count ${value.count}`)
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
      fields: { number: { defaultValue: 1.3 }, slider: { defaultValue: 42.5 } },
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
      ),
    )
    expect(view.root.element.querySelector('[data-picodash-dashlet="number"] input')).toBeNull()
    expect(view.root.element.querySelector('[data-picodash-dashlet="slider"] input')).toBeNull()
    expect(
      view.root.element.querySelector('[data-picodash-dashlet="number"] output')?.textContent,
    ).toBe('1.3')
    expect(
      view.root.element.querySelector('[data-picodash-dashlet="slider"] output')?.textContent,
    ).toBe('42.5')
    expect(
      view.root.element.querySelectorAll('[data-picodash-dashlet-presentation-warning]'),
    ).toHaveLength(2)
    expect(nexus.getState().values).toEqual({ number: 1.3, slider: 42.5 })
    act(() => view.unmount())
    nexus.destroy()
  })

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
