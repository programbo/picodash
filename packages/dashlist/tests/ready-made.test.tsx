// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
import { createDomTestRenderer, type DomTestRenderer } from '../../../test/dom-renderer.ts'
import {
  DashList,
  DisplayDashlet,
  NumberDashlet,
  SegmentedDashlet,
  SelectDashlet,
  SliderDashlet,
  SwitchDashlet,
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
    expect(view.root.element.querySelector('option[value="string:1"]')).not.toBeNull()
    expect(view.root.element.querySelector('option[value="number:1"]')).not.toBeNull()
    act(() => view.unmount())
    nexus.destroy()
  })

  it('shows canonical presentation mismatches without writing them', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { number: { defaultValue: 42 }, choice: { defaultValue: 'other' } },
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
    expect(warnings).toHaveLength(2)
    expect(warnings.map((node) => node.textContent)).toEqual([
      'The current value (42) is outside the configured range.',
      'The current value (other) is not in the configured choices.',
    ])
    expect(view.root.element.querySelector('[aria-invalid]')).toBeNull()
    expect(nexus.getState().values).toEqual({ number: 42, choice: 'other' })
    act(() => view.unmount())
    nexus.destroy()
  })

  it('renders formatted ReactNodes directly and slider formatting as a trailing value', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { output: { defaultValue: { count: 2 } }, slider: { defaultValue: 3 } },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'formatting', nexus },
        createElement(DisplayDashlet, {
          id: 'output',
          field: nexus.fields.output,
          label: 'Output',
          formatValue: (value) =>
            createElement('strong', null, `Count ${(value as { count: number }).count}`),
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
    expect(
      view.root.element.querySelector('[data-picodash-dashlist-slider-value]')?.textContent,
    ).toBe('3%')
    act(() => view.unmount())
    nexus.destroy()
  })
})
