// @vitest-environment jsdom
import { act, createElement, StrictMode, useState, type ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
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
import type { ColorFormat, RangeSliderProps } from '../src/ui.js'
import type { MeterProps } from '../src/ui.js'
import {
  ColorDashlet,
  Dashlet,
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

function ControlledColorFixture({
  initialValue,
  format,
  changes,
  externalValue,
}: {
  readonly initialValue: string | null
  readonly format: ColorFormat
  readonly changes: Array<string | null>
  readonly externalValue?: string
}) {
  const [value, setValue] = useState(initialValue)
  return createElement(
    'div',
    null,
    createElement(ColorField, {
      value,
      format,
      onChange: (next) => {
        changes.push(next)
        setValue(next)
      },
      'aria-label': `${format} controlled color`,
    }),
    externalValue === undefined
      ? null
      : createElement('button', {
          type: 'button',
          'data-external-color': true,
          onPointerDown: () => setValue(externalValue),
        }),
  )
}

describe('value controls', () => {
  it('serializes all supported color formats and preserves alpha in alpha-bearing formats', () => {
    const formats = [
      {
        format: 'hex',
        value: 'rgb(51, 102, 153)',
        edit: 'rgb(255, 0, 0)',
        initial: '#336699',
        edited: '#FF0000',
      },
      {
        format: 'hexa',
        value: 'rgba(51, 102, 153, 0.5)',
        edit: 'rgba(255, 0, 0, 0.5)',
        initial: '#33669980',
        edited: '#FF000080',
      },
      {
        format: 'rgb',
        value: 'rgb(51, 102, 153)',
        edit: 'rgb(255, 0, 0)',
        initial: 'rgb(51, 102, 153)',
        edited: 'rgb(255, 0, 0)',
      },
      {
        format: 'rgba',
        value: 'rgba(51, 102, 153, 0.5)',
        edit: 'rgba(255, 0, 0, 0.5)',
        initial: 'rgba(51, 102, 153, 0.5)',
        edited: 'rgba(255, 0, 0, 0.5)',
      },
      {
        format: 'hsl',
        value: 'rgb(51, 102, 153)',
        edit: 'rgb(255, 0, 0)',
        initial: 'hsl(210, 50%, 40%)',
        edited: 'hsl(0, 100%, 50%)',
      },
      {
        format: 'hsla',
        value: 'rgba(51, 102, 153, 0.5)',
        edit: 'rgba(255, 0, 0, 0.5)',
        initial: 'hsla(210, 50%, 40%, 0.5)',
        edited: 'hsla(0, 100%, 50%, 0.5)',
      },
      {
        format: 'hsb',
        value: 'rgb(51, 102, 153)',
        edit: 'rgb(255, 0, 0)',
        initial: 'hsb(210, 66.67%, 60%)',
        edited: 'hsb(0, 100%, 100%)',
      },
      {
        format: 'hsba',
        value: 'rgba(51, 102, 153, 0.5)',
        edit: 'rgba(255, 0, 0, 0.5)',
        initial: 'hsba(210, 66.67%, 60%, 0.5)',
        edited: 'hsba(0, 100%, 100%, 0.5)',
      },
    ] as const

    for (const colorCase of formats) {
      const changes: Array<string | null> = []
      const view = render(
        createElement(ColorField, {
          value: colorCase.value,
          format: colorCase.format,
          onChange: (next) => changes.push(next),
          'aria-label': `${colorCase.format} color`,
        }),
      )
      const input = view.root.element.querySelector<HTMLInputElement>('input')!
      expect(input.value, colorCase.format).toBe(colorCase.initial)
      fireEvent.change(input, { target: { value: colorCase.edit } })
      expect(changes, colorCase.format).toEqual([colorCase.edited])
      act(() => view.unmount())
    }

    for (const format of ['hexa', 'rgba', 'hsla', 'hsba'] as const) {
      for (const alpha of [0, 0.5, 1]) {
        const changes: Array<string | null> = []
        const view = render(
          createElement(ColorField, {
            value: '#ff0000',
            format,
            onChange: (next) => changes.push(next),
            'aria-label': `${format} alpha ${alpha}`,
          }),
        )
        const input = view.root.element.querySelector<HTMLInputElement>('input')!
        fireEvent.change(input, {
          target: { value: `rgba(51, 102, 153, ${alpha})` },
        })
        expect(changes).toEqual([
          format === 'hexa'
            ? `#336699${alpha === 0 ? '00' : alpha === 0.5 ? '80' : 'FF'}`
            : format === 'rgba'
              ? `rgba(51, 102, 153, ${alpha})`
              : format === 'hsla'
                ? `hsla(210, 50%, 40%, ${alpha})`
                : `hsba(210, 66.67%, 60%, ${alpha})`,
        ])
        act(() => view.unmount())
      }
    }
  })

  it('rejects alpha loss in direct ColorField values and edits', () => {
    for (const format of ['hex', 'rgb', 'hsl', 'hsb'] as const) {
      for (const alpha of [0, 0.5]) {
        expect(() =>
          renderToString(
            createElement(ColorField, {
              value: `rgba(51, 102, 153, ${alpha})`,
              format,
              onChange: () => undefined,
              'aria-label': `${format} alpha ${alpha}`,
            }),
          ),
        ).toThrowError(new TypeError('format must preserve alpha for non-opaque colors.'))
      }

      const changes: Array<string | null> = []
      const view = render(
        createElement(ColorField, {
          value: 'rgb(51, 102, 153)',
          format,
          onChange: (next) => changes.push(next),
          'aria-label': `${format} opaque color`,
        }),
      )
      const input = view.root.element.querySelector<HTMLInputElement>('input')!
      fireEvent.change(input, { target: { value: 'rgba(255, 0, 0, 0.5)' } })
      expect(changes, format).toEqual([])
      act(() => view.unmount())
    }
  })

  it('preserves character-by-character hex and hexa drafts through canonical echoes', () => {
    const cases = [
      {
        format: 'hex',
        text: '#123abc',
        canonicalChanges: ['#112233', '#123ABC'],
        blurred: '#123ABC',
      },
      {
        format: 'hexa',
        text: '#123abcde',
        canonicalChanges: ['#112233FF', '#112233AA', '#123ABCFF', '#123ABCDE'],
        blurred: '#123ABCDE',
      },
    ] as const

    for (const colorCase of cases) {
      const changes: Array<string | null> = []
      const view = render(
        createElement(StrictMode, {
          children: createElement(ControlledColorFixture, {
            initialValue: null,
            format: colorCase.format,
            changes,
          }),
        }),
      )
      const input = view.root.element.querySelector<HTMLInputElement>('input')!
      act(() => input.focus())
      for (let end = 1; end <= colorCase.text.length; end += 1) {
        const prefix = colorCase.text.slice(0, end)
        fireEvent.change(input, { target: { value: prefix } })
        expect(input.value, `${colorCase.format} prefix ${prefix}`).toBe(prefix)
      }
      expect(changes).toEqual(colorCase.canonicalChanges)
      fireEvent.blur(input)
      expect(input.value).toBe(colorCase.blurred)
      act(() => view.unmount())
    }
  })

  it('preserves character-by-character fractional alpha drafts in every functional format', () => {
    const cases = [
      { format: 'rgba', text: 'rgba(51, 102, 153, 0.5)' },
      { format: 'hsla', text: 'hsla(210, 50%, 40%, 0.5)' },
      { format: 'hsba', text: 'hsba(210, 66.67%, 60%, 0.5)' },
    ] as const

    for (const colorCase of cases) {
      const changes: Array<string | null> = []
      const view = render(
        createElement(ControlledColorFixture, {
          initialValue: null,
          format: colorCase.format,
          changes,
        }),
      )
      const input = view.root.element.querySelector<HTMLInputElement>('input')!
      act(() => input.focus())
      for (let end = 1; end <= colorCase.text.length; end += 1) {
        const prefix = colorCase.text.slice(0, end)
        fireEvent.change(input, { target: { value: prefix } })
        expect(input.value, `${colorCase.format} prefix ${prefix}`).toBe(prefix)
      }
      expect(changes).toEqual([colorCase.text])
      fireEvent.blur(input)
      expect(input.value).toBe(colorCase.text)
      act(() => view.unmount())
    }
  })

  it('replaces a dirty focused color draft for a genuinely external controlled update', () => {
    const changes: Array<string | null> = []
    const view = render(
      createElement(ControlledColorFixture, {
        initialValue: null,
        format: 'hexa',
        changes,
        externalValue: '#abcdef80',
      }),
    )
    const input = view.root.element.querySelector<HTMLInputElement>('input')!
    act(() => input.focus())
    for (const prefix of ['#', '#1', '#12', '#123']) {
      fireEvent.change(input, { target: { value: prefix } })
      expect(input.value).toBe(prefix)
    }
    expect(changes).toEqual(['#112233FF'])
    expect(input.ownerDocument.activeElement).toBe(input)

    fireEvent.pointerDown(view.root.element.querySelector('[data-external-color]')!)
    expect(input.ownerDocument.activeElement).toBe(input)
    expect(input.value).toBe('#ABCDEF80')
    expect(changes).toEqual(['#112233FF'])
    act(() => view.unmount())
  })

  it('keeps disabled and read-only color fields canonical without writes', () => {
    for (const state of ['disabled', 'readOnly'] as const) {
      const changes: Array<string | null> = []
      const renderField = (value: string) =>
        createElement(ColorField, {
          value,
          format: 'hexa',
          onChange: (next) => changes.push(next),
          [state]: true,
          'aria-label': `${state} color`,
        })
      const view = render(renderField('#ff000080'))
      const input = view.root.element.querySelector<HTMLInputElement>('input')!
      fireEvent.change(input, { target: { value: '#123' } })
      expect(changes, state).toEqual([])
      expect(input.value, state).toBe('#FF000080')

      act(() => view.update(renderField('#abcdef80')))
      expect(input.value, state).toBe('#ABCDEF80')
      act(() => view.unmount())
    }
  })

  it('keeps partial color text local, restores it on blur, clears explicitly, and follows controlled updates', () => {
    const changes: Array<string | null> = []
    const renderField = (value: string | null, format: 'hexa' | 'rgba' = 'hexa') =>
      createElement(StrictMode, {
        children: createElement(ColorField, {
          value,
          format,
          onChange: (next) => changes.push(next),
          'aria-label': 'Controlled color',
        }),
      })
    const view = render(renderField('#ff0000'))
    const input = () => view.root.element.querySelector<HTMLInputElement>('input')!
    expect(input().value).toBe('#FF0000FF')

    fireEvent.change(input(), { target: { value: 'rgba(' } })
    expect(input().value).toBe('rgba(')
    expect(changes).toEqual([])
    fireEvent.blur(input())
    expect(input().value).toBe('#FF0000FF')

    fireEvent.change(input(), { target: { value: 'not-yet-valid' } })
    act(() => view.update(renderField('rgba(0, 0, 255, 0.5)')))
    expect(input().value).toBe('#0000FF80')
    fireEvent.blur(input())
    expect(changes).toEqual([])

    act(() => view.update(renderField('rgba(0, 0, 255, 0.5)', 'rgba')))
    expect(input().value).toBe('rgba(0, 0, 255, 0.5)')
    fireEvent.change(input(), { target: { value: '' } })
    expect(changes).toEqual([null])
    act(() => view.unmount())
  })

  it('renders ColorField deterministically on the server', () => {
    const html = renderToString(
      createElement(ColorField, {
        value: 'rgba(51, 102, 153, 0.5)',
        format: 'hsba',
        onChange: () => undefined,
        'aria-label': 'Server color',
      }),
    )
    expect(html).toContain('picodash-dashlist-color-field')
    expect(html).toContain('hsba(210, 66.67%, 60%, 0.5)')
  })

  it('rejects unsupported color formats before parsing or writing', () => {
    const changes: Array<string | null> = []
    expect(() =>
      render(
        createElement(ColorField, {
          value: 'not-a-color',
          format: 'display-p3' as never,
          onChange: (next) => changes.push(next),
          'aria-label': 'Unsupported color format',
        }),
      ),
    ).toThrowError(new TypeError('format must be a supported color format.'))
    expect(changes).toEqual([])

    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { color: { defaultValue: '#ff0000' } },
    })
    expect(() =>
      render(
        createElement(
          DashList,
          { id: 'unsupported-color-format', nexus },
          createElement(ColorDashlet, {
            id: 'color',
            field: nexus.fields.color,
            label: 'Color',
            format: 'display-p3' as never,
          }),
        ),
      ),
    ).toThrowError(new TypeError('format must be a supported color format.'))
    expect(nexus.getState().values).toEqual({ color: '#ff0000' })
    nexus.destroy()
  })

  it('keeps HSL and HSB canonical colors editable through hex serialization', async () => {
    const directChanges: Array<string | null> = []
    const directView = render(
      createElement(ColorField, {
        value: 'hsl(120, 100%, 50%)',
        format: 'hex',
        onChange: (next) => directChanges.push(next),
        'aria-label': 'Direct HSL color',
      }),
    )
    const directInput = directView.root.element.querySelector<HTMLInputElement>('input')!
    expect(directInput).not.toBeNull()
    await act(() => fireEvent.change(directInput, { target: { value: '#0000ff' } }))
    await act(() => fireEvent.blur(directInput))
    expect(directChanges).toEqual(['#0000FF'])
    act(() => directView.unmount())

    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        hsl: { defaultValue: 'hsl(120, 100%, 50%)' },
        hsb: { defaultValue: 'hsb(120, 100%, 100%)' },
      },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'serializable-colors', nexus },
        createElement(ColorDashlet, {
          id: 'hsl',
          field: nexus.fields.hsl,
          label: 'HSL',
          format: 'hex',
        }),
        createElement(ColorDashlet, {
          id: 'hsb',
          field: nexus.fields.hsb,
          label: 'HSB',
          format: 'hex',
        }),
      ),
    )
    expect(view.root.element.querySelectorAll('.picodash-dashlist-color-field')).toHaveLength(2)
    expect(
      view.root.element.querySelectorAll('[data-picodash-dashlet-presentation-warning]'),
    ).toHaveLength(0)
    expect(view.root.element.querySelectorAll('[data-picodash-dashlet] output')).toHaveLength(0)
    expect(nexus.getState().values).toEqual({
      hsl: 'hsl(120, 100%, 50%)',
      hsb: 'hsb(120, 100%, 100%)',
    })

    const hslInput = view.root.element.querySelector<HTMLInputElement>(
      '[data-picodash-dashlet="hsl"] input',
    )!
    await act(() => fireEvent.change(hslInput, { target: { value: '#0000ff' } }))
    await act(() => fireEvent.blur(hslInput))
    expect(nexus.getState().values.hsl).toBe('#0000FF')
    expect(nexus.getState().values.hsb).toBe('hsb(120, 100%, 100%)')

    act(() => view.unmount())
    nexus.destroy()
  })

  it('keeps transparent canonical colors as exact presentation mismatches for lossy formats', () => {
    const formats = ['hex', 'rgb', 'hsl', 'hsb'] as const
    const colors = [
      { name: 'fractional alpha', value: 'rgba(255, 0, 0, 0.5)' },
      { name: 'zero alpha', value: 'rgba(0, 0, 255, 0)' },
    ] as const

    for (const { name, value } of colors) {
      for (const format of formats) {
        const nexus = createPicodashNexus({
          valueOwner: 'nexus',
          fields: { color: { defaultValue: value } },
        })
        const view = render(
          createElement(
            DashList,
            { id: `alpha-mismatch-${name}-${format}`, nexus },
            createElement(ColorDashlet, {
              id: 'color',
              field: nexus.fields.color,
              label: 'Color',
              format,
            }),
          ),
        )
        const dashlet = view.root.element.querySelector('[data-picodash-dashlet="color"]')!
        expect(dashlet.querySelector('output')?.textContent).toBe(value)
        expect(
          dashlet.querySelector('[data-picodash-dashlet-presentation-warning]')?.textContent,
        ).toBe(`The current color (${value}) cannot be edited in the configured color format.`)
        expect(dashlet.querySelector('input')).toBeNull()
        expect(nexus.getState().values).toEqual({ color: value })
        act(() => view.unmount())
        nexus.destroy()
      }
    }
  })

  it('preserves alpha-bearing colors through alpha-preserving formats and keeps opaque colors editable', () => {
    const alphaCases = [
      { format: 'hexa', initial: 'rgba(255, 0, 0, 0.5)' },
      {
        format: 'rgba',
        initial: 'rgba(255, 0, 0, 0.5)',
      },
      {
        format: 'hsla',
        initial: 'rgba(255, 0, 0, 0.5)',
      },
      {
        format: 'hsba',
        initial: 'rgba(255, 0, 0, 0.5)',
      },
    ] as const

    for (const { format, initial } of alphaCases) {
      const nexus = createPicodashNexus({
        valueOwner: 'nexus',
        fields: { color: { defaultValue: initial } },
      })
      const view = render(
        createElement(
          DashList,
          { id: `alpha-preserving-${format}`, nexus },
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
      expect(input.disabled).toBe(false)
      expect(nexus.getState().values).toEqual({ color: initial })
      act(() => view.unmount())
      nexus.destroy()
    }

    for (const format of ['hex', 'rgb', 'hsl', 'hsb'] as const) {
      const nexus = createPicodashNexus({
        valueOwner: 'nexus',
        fields: { color: { defaultValue: '#ff0000' } },
      })
      const view = render(
        createElement(
          DashList,
          { id: `opaque-${format}`, nexus },
          createElement(ColorDashlet, {
            id: 'color',
            field: nexus.fields.color,
            label: 'Color',
            format,
          }),
        ),
      )
      expect(
        view.root.element.querySelector('[data-picodash-dashlet="color"] input'),
      ).not.toBeNull()
      expect(
        view.root.element.querySelector('[data-picodash-dashlet-presentation-warning]'),
      ).toBeNull()
      expect(nexus.getState().values).toEqual({ color: '#ff0000' })
      act(() => view.unmount())
      nexus.destroy()
    }
  })

  it('keeps invalid canonical colors as exact warning fallbacks without writing', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { color: { defaultValue: 'not-a-color' } },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'invalid-color', nexus },
        createElement(ColorDashlet, {
          id: 'color',
          field: nexus.fields.color,
          label: 'Color',
          format: 'hex',
        }),
      ),
    )
    expect(
      view.root.element.querySelector('[data-picodash-dashlet="color"] output')?.textContent,
    ).toBe('not-a-color')
    expect(
      view.root.element.querySelectorAll('[data-picodash-dashlet-presentation-warning]'),
    ).toHaveLength(1)
    expect(view.root.element.querySelector('[data-picodash-dashlet="color"] input')).toBeNull()
    expect(nexus.getState().values).toEqual({ color: 'not-a-color' })
    act(() => view.unmount())
    nexus.destroy()
  })

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

  it('describes read-only range thumbs on the actual focus targets without unsupported ARIA', () => {
    const changes: RangeSliderProps['value'][] = []
    const view = render(
      createElement(RangeSlider, {
        value: { start: 2, end: 8 },
        onChange: (next) => changes.push(next),
        readOnly: true,
        'aria-label': 'Read-only range',
        'aria-describedby': 'range-context',
      }),
    )
    const thumbs = view.root.element.querySelectorAll<HTMLInputElement>('input[type="range"]')
    expect(thumbs).toHaveLength(2)
    for (const thumb of thumbs) {
      const ids = thumb.getAttribute('aria-describedby')?.split(' ') ?? []
      expect(ids).toContain('range-context')
      expect(
        ids.some((id) => thumb.ownerDocument.getElementById(id)?.textContent === 'Read only.'),
      ).toBe(true)
      expect(thumb.hasAttribute('aria-readonly')).toBe(false)
    }
    expect(view.root.element.querySelector('[aria-readonly]')).toBeNull()
    fireEvent.change(thumbs[1]!, { target: { value: '9' } })
    expect(changes).toEqual([])
    act(() => view.unmount())
  })

  it('registers exact range, temporal, and color focus nodes and leaves readouts on the shell', () => {
    const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
    const view = render(
      createElement(
        DashList,
        { id: 'value-focus-targets', nexus },
        createElement(
          Dashlet,
          { id: 'range-focus', label: 'Range focus' },
          createElement(RangeSlider, {
            value: { start: 2, end: 8 },
            onChange: () => undefined,
            'aria-label': 'Range control',
          }),
        ),
        createElement(
          Dashlet,
          { id: 'date-focus', label: 'Date focus' },
          createElement(DateField, {
            value: '2026-08-13',
            onChange: () => undefined,
            'aria-label': 'Date control',
          }),
        ),
        createElement(
          Dashlet,
          { id: 'time-focus', label: 'Time focus' },
          createElement(TimeField, {
            value: '12:30:00',
            onChange: () => undefined,
            'aria-label': 'Time control',
          }),
        ),
        createElement(
          Dashlet,
          { id: 'date-time-focus', label: 'Date time focus' },
          createElement(DateTimeField, {
            value: '2026-08-13T12:30:00+08:00',
            timeZone: 'Australia/Perth',
            onChange: () => undefined,
            'aria-label': 'Date time control',
          }),
        ),
        createElement(
          Dashlet,
          { id: 'date-range-focus', label: 'Date range focus' },
          createElement(DateRangeField, {
            value: { start: '2026-08-01', end: '2026-08-13' },
            onChange: () => undefined,
            'aria-label': 'Date range control',
          }),
        ),
        createElement(
          Dashlet,
          { id: 'color-focus', label: 'Color focus' },
          createElement(ColorField, {
            value: '#ff0000',
            onChange: () => undefined,
            'aria-label': 'Color control',
          }),
        ),
        createElement(
          Dashlet,
          { id: 'meter-focus', label: 'Meter focus' },
          createElement(Meter, { value: 50, 'aria-label': 'Meter control' }),
        ),
      ),
    )

    const cases: readonly { readonly id: string; readonly target: string }[] = [
      { id: 'range-focus', target: 'input[type="range"]' },
      { id: 'date-focus', target: '[role="spinbutton"]' },
      { id: 'time-focus', target: '[role="spinbutton"]' },
      { id: 'date-time-focus', target: '[role="spinbutton"]' },
      { id: 'date-range-focus', target: '[role="spinbutton"]' },
      { id: 'color-focus', target: 'input' },
    ]
    for (const focusCase of cases) {
      const row = view.root.element.querySelector<HTMLElement>(
        `[data-picodash-dashlet="${focusCase.id}"]`,
      )!
      fireEvent.click(row.querySelector('[data-picodash-dashlet-label]')!)
      expect(row.ownerDocument.activeElement, focusCase.id).toBe(
        row.querySelector(focusCase.target),
      )
    }

    const meter = view.root.element.querySelector<HTMLElement>(
      '[data-picodash-dashlet="meter-focus"]',
    )!
    fireEvent.click(meter.querySelector('[data-picodash-dashlet-label]')!)
    expect(meter.ownerDocument.activeElement).toBe(
      meter.querySelector('[data-picodash-dashlet-shell]'),
    )

    act(() => view.unmount())
    nexus.destroy()
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

  it('rejects invalid direct RangeSlider configuration synchronously', () => {
    const invalidConfigurations: readonly {
      readonly name: string
      readonly props: Pick<RangeSliderProps, 'min' | 'max' | 'step'>
      readonly error: TypeError
    }[] = [
      ...[Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].map((min) => ({
        name: `non-finite min ${String(min)}`,
        props: { min },
        error: new TypeError('min must be finite.'),
      })),
      ...[Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].map((max) => ({
        name: `non-finite max ${String(max)}`,
        props: { max },
        error: new TypeError('max must be finite.'),
      })),
      {
        name: 'descending bounds',
        props: { min: 2, max: 1 },
        error: new TypeError('min must be less than or equal to max.'),
      },
      ...[0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].map((step) => ({
        name: `non-positive or non-finite step ${String(step)}`,
        props: { step },
        error: new TypeError('step must be a positive finite number.'),
      })),
    ]

    for (const configuration of invalidConfigurations)
      expect(
        () =>
          render(
            createElement(RangeSlider, {
              value: { start: 0, end: 1 },
              onChange: () => undefined,
              'aria-label': 'Invalid range',
              ...configuration.props,
            }),
          ),
        configuration.name,
      ).toThrowError(configuration.error)
  })

  it('rejects invalid direct Meter and ProgressBar bounds before rendering', () => {
    const invalidBounds: readonly {
      readonly name: string
      readonly props: Pick<MeterProps, 'min' | 'max'>
      readonly error: TypeError
    }[] = [
      ...[Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].map((min) => ({
        name: `non-finite min ${String(min)}`,
        props: { min },
        error: new TypeError('min must be finite.'),
      })),
      ...[Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].map((max) => ({
        name: `non-finite max ${String(max)}`,
        props: { max },
        error: new TypeError('max must be finite.'),
      })),
      {
        name: 'descending bounds',
        props: { min: 2, max: 1 },
        error: new TypeError('min must be less than or equal to max.'),
      },
    ]

    for (const configuration of invalidBounds) {
      expect(
        () =>
          render(
            createElement(Meter, {
              value: 1,
              'aria-label': 'Invalid meter',
              ...configuration.props,
            }),
          ),
        `Meter: ${configuration.name}`,
      ).toThrowError(configuration.error)
      expect(
        () =>
          render(
            createElement(ProgressBar, {
              value: 1,
              'aria-label': 'Invalid progress',
              ...configuration.props,
            }),
          ),
        `ProgressBar: ${configuration.name}`,
      ).toThrowError(configuration.error)
    }
  })

  it('preserves valid Meter and ProgressBar bounds, values, formatting, and indeterminate state', () => {
    const view = render(
      createElement(
        'div',
        null,
        createElement(Meter, {
          className: 'default-meter',
          value: 25,
          'aria-label': 'Default meter',
        }),
        createElement(Meter, {
          className: 'equal-meter',
          value: 5,
          min: 5,
          max: 5,
          'aria-label': 'Equal meter',
        }),
        createElement(Meter, {
          className: 'signed-meter',
          value: 0,
          min: -10,
          max: 10,
          formatValue: (value) => `signed ${value}`,
          'aria-label': 'Signed meter',
        }),
        createElement(ProgressBar, {
          className: 'nonzero-progress',
          value: 15,
          min: 10,
          max: 20,
          'aria-label': 'Non-zero progress',
        }),
        createElement(ProgressBar, {
          className: 'equal-progress',
          value: 5,
          min: 5,
          max: 5,
          'aria-label': 'Equal progress',
        }),
        createElement(ProgressBar, {
          className: 'indeterminate-progress',
          min: -10,
          max: 10,
          'aria-label': 'Indeterminate progress',
        }),
      ),
    )

    expect(view.root.element.querySelector('.default-meter')?.getAttribute('aria-valuemin')).toBe(
      '0',
    )
    expect(view.root.element.querySelector('.default-meter')?.getAttribute('aria-valuemax')).toBe(
      '100',
    )
    expect(
      view.root.element
        .querySelector('.equal-meter .picodash-dashlist-progress-fill')
        ?.getAttribute('style'),
    ).toBe('inline-size: 0%;')
    expect(view.root.element.querySelector('.signed-meter')?.textContent).toContain('signed 0')
    expect(
      view.root.element.querySelector('.nonzero-progress')?.getAttribute('aria-valuemin'),
    ).toBe('10')
    expect(
      view.root.element.querySelector('.nonzero-progress')?.getAttribute('aria-valuemax'),
    ).toBe('20')
    expect(
      view.root.element
        .querySelector('.equal-progress .picodash-dashlist-progress-fill')
        ?.getAttribute('style'),
    ).toBe('inline-size: 0%;')
    const indeterminate = view.root.element.querySelector('.indeterminate-progress')
    expect(indeterminate).not.toBeNull()
    expect(indeterminate?.querySelector('.picodash-dashlist-progress-fill')).not.toBeNull()
    act(() => view.unmount())
  })

  it('preserves valid RangeSlider bounds, formatting, policies, and controlled values', async () => {
    const changes: RangeSliderProps['value'][] = []
    const view = render(
      createElement(I18nProvider, {
        locale: 'en-US',
        children: createElement(
          'div',
          null,
          createElement(RangeSlider, {
            className: 'default-range',
            value: { start: 20, end: 80 },
            onChange: (next) => changes.push(next),
            'aria-label': 'Default range',
          }),
          createElement(RangeSlider, {
            className: 'signed-range',
            value: { start: -5, end: 5 },
            onChange: (next) => changes.push(next),
            min: -10,
            max: 10,
            step: 0.5,
            formatOptions: { style: 'currency', currency: 'USD' },
            'aria-label': 'Signed range',
          }),
          createElement(RangeSlider, {
            className: 'fixed-range',
            value: { start: 5, end: 5 },
            onChange: (next) => changes.push(next),
            min: 5,
            max: 5,
            'aria-label': 'Fixed range',
          }),
          createElement(RangeSlider, {
            className: 'controlled-range',
            value: { start: 12, end: -2 },
            onChange: (next) => changes.push(next),
            min: 0,
            max: 10,
            'aria-label': 'Controlled range',
          }),
          createElement(RangeSlider, {
            className: 'disabled-range',
            value: { start: 2, end: 8 },
            onChange: (next) => changes.push(next),
            disabled: true,
            'aria-label': 'Disabled range',
          }),
          createElement(RangeSlider, {
            className: 'read-only-range',
            value: { start: 2, end: 8 },
            onChange: (next) => changes.push(next),
            readOnly: true,
            'aria-label': 'Read-only range',
          }),
        ),
      }),
    )

    const rangeInputs = (className: string) => [
      ...view.root.element.querySelectorAll<HTMLInputElement>(`.${className} input[type="range"]`),
    ]
    expect(rangeInputs('default-range').map(({ min, max, step }) => ({ min, max, step }))).toEqual([
      { min: '0', max: '80', step: '1' },
      { min: '20', max: '100', step: '1' },
    ])
    expect(rangeInputs('signed-range').map(({ min, max, step }) => ({ min, max, step }))).toEqual([
      { min: '-10', max: '5', step: '0.5' },
      { min: '-5', max: '10', step: '0.5' },
    ])
    expect(view.root.element.querySelector('.signed-range output')?.textContent).toContain('$5.00')
    expect(rangeInputs('fixed-range').map(({ value }) => value)).toEqual(['5', '5'])
    expect(rangeInputs('controlled-range')).toHaveLength(2)
    expect(rangeInputs('disabled-range').every((input) => input.disabled)).toBe(true)
    await act(() =>
      fireEvent.change(rangeInputs('read-only-range')[1]!, { target: { value: '9' } }),
    )
    expect(changes).toEqual([])
    act(() => view.unmount())
  })

  it('forwards declared ids to value controls and class names to public roots', () => {
    const controls: ReactElement[] = [
      createElement(RangeSlider, {
        key: 'range',
        id: 'value-range',
        'aria-label': 'Range',
        className: 'value-range-hook',
        value: { start: 2, end: 8 },
        onChange: () => undefined,
      }),
      createElement(Meter, {
        key: 'meter',
        id: 'value-meter',
        className: 'value-meter-hook',
        value: 4,
        'aria-label': 'Meter',
      }),
      createElement(ProgressBar, {
        key: 'progress',
        id: 'value-progress',
        className: 'value-progress-hook',
        value: 4,
        'aria-label': 'Progress',
      }),
      createElement(Status, {
        key: 'status',
        id: 'value-status',
        className: 'value-status-hook',
        value: 'ready',
        options: [{ value: 'ready', label: 'Ready', tone: 'success' as const }],
      }),
      createElement(DateField, {
        key: 'date',
        id: 'value-date',
        className: 'value-date-hook',
        value: '2026-08-13',
        onChange: () => undefined,
        'aria-label': 'Date',
      }),
      createElement(TimeField, {
        key: 'time',
        id: 'value-time',
        className: 'value-time-hook',
        value: '12:30:00',
        onChange: () => undefined,
        'aria-label': 'Time',
      }),
      createElement(DateTimeField, {
        key: 'date-time',
        id: 'value-date-time',
        className: 'value-date-time-hook',
        value: '2026-08-13T12:30:00+08:00',
        timeZone: 'Australia/Perth',
        onChange: () => undefined,
        'aria-label': 'Date time',
      }),
      createElement(DateRangeField, {
        key: 'date-range',
        id: 'value-date-range',
        className: 'value-date-range-hook',
        value: { start: '2026-08-01', end: '2026-08-13' },
        onChange: () => undefined,
        'aria-label': 'Date range',
      }),
      createElement(ColorField, {
        key: 'color',
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
    for (const [className, structuralClassName] of [
      ['value-range-hook', 'picodash-dashlist-range-slider'],
      ['value-meter-hook', 'picodash-dashlist-meter'],
      ['value-progress-hook', 'picodash-dashlist-progress'],
      ['value-status-hook', 'picodash-dashlist-status'],
      ['value-date-hook', 'picodash-dashlist-date-field'],
      ['value-time-hook', 'picodash-dashlist-time-field'],
      ['value-date-time-hook', 'picodash-dashlist-date-time-field'],
      ['value-date-range-hook', 'picodash-dashlist-date-range-field'],
      ['value-color-hook', 'picodash-dashlist-color-field'],
    ])
      expect(view.root.element.querySelector(`.${structuralClassName}.${className}`)).not.toBeNull()
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

  it('rejects descending direct temporal bounds synchronously', () => {
    const invalidBounds = [
      {
        name: 'DateField',
        element: createElement(DateField, {
          value: '2026-08-13',
          min: '2026-08-14',
          max: '2026-08-13',
          onChange: () => undefined,
          'aria-label': 'Invalid date',
        }),
      },
      {
        name: 'TimeField',
        element: createElement(TimeField, {
          value: '12:30:00',
          min: '13:00:00',
          max: '12:00:00',
          onChange: () => undefined,
          'aria-label': 'Invalid time',
        }),
      },
      {
        name: 'DateTimeField',
        element: createElement(DateTimeField, {
          value: '2026-08-13T12:30:00+08:00',
          timeZone: 'Australia/Perth',
          min: '2026-08-14T12:00:00+08:00',
          max: '2026-08-13T12:00:00+08:00',
          onChange: () => undefined,
          'aria-label': 'Invalid date time',
        }),
      },
    ]

    for (const { name, element } of invalidBounds)
      expect(() => render(element), name).toThrowError(
        new TypeError('min must be less than or equal to max.'),
      )
  })

  it('normalizes malformed direct temporal bounds synchronously', () => {
    const changes: unknown[] = []
    const invalidBounds = [
      {
        name: 'DateField malformed min',
        element: createElement(DateField, {
          value: '2026-08-13',
          min: 'not-a-date',
          onChange: (next) => changes.push(next),
          'aria-label': 'Malformed date min',
        }),
        error: new TypeError('date bounds must be valid ISO dates.'),
      },
      {
        name: 'DateField malformed max',
        element: createElement(DateField, {
          value: '2026-08-13',
          max: 'not-a-date',
          onChange: (next) => changes.push(next),
          'aria-label': 'Malformed date max',
        }),
        error: new TypeError('date bounds must be valid ISO dates.'),
      },
      {
        name: 'TimeField malformed min',
        element: createElement(TimeField, {
          value: '12:30:00',
          min: 'not-a-time',
          onChange: (next) => changes.push(next),
          'aria-label': 'Malformed time min',
        }),
        error: new TypeError('time bounds must be valid ISO local times.'),
      },
      {
        name: 'TimeField malformed max',
        element: createElement(TimeField, {
          value: '12:30:00',
          max: 'not-a-time',
          onChange: (next) => changes.push(next),
          'aria-label': 'Malformed time max',
        }),
        error: new TypeError('time bounds must be valid ISO local times.'),
      },
      {
        name: 'DateTimeField malformed min',
        element: createElement(DateTimeField, {
          value: '2026-08-13T12:30:00+08:00',
          timeZone: 'Australia/Perth',
          min: 'not-a-date-time',
          onChange: (next) => changes.push(next),
          'aria-label': 'Malformed date-time min',
        }),
        error: new TypeError('date-time bounds must be valid RFC 3339 date-times.'),
      },
      {
        name: 'DateTimeField malformed max',
        element: createElement(DateTimeField, {
          value: '2026-08-13T12:30:00+08:00',
          timeZone: 'Australia/Perth',
          max: 'not-a-date-time',
          onChange: (next) => changes.push(next),
          'aria-label': 'Malformed date-time max',
        }),
        error: new TypeError('date-time bounds must be valid RFC 3339 date-times.'),
      },
    ]

    for (const { name, element, error } of invalidBounds)
      expect(() => render(element), name).toThrowError(error)
    expect(changes).toEqual([])
  })

  it('preserves valid direct temporal bounds and presentation without render writes', () => {
    const changes: unknown[] = []
    const validBounds = [
      ...[
        {},
        { min: '2026-08-13' },
        { min: '2026-08-13', max: '2026-08-13' },
        { min: '2026-08-12', max: '2026-08-14' },
      ].map((bounds, index) => ({
        name: `DateField ${index}`,
        className: `valid-date-${index}`,
        element: createElement(DateField, {
          ...bounds,
          className: `valid-date-${index}`,
          value: '2026-08-13',
          onChange: (next) => changes.push(next),
          disabled: true,
          readOnly: true,
          locale: 'en-AU',
          'aria-label': `Valid date ${index}`,
        }),
      })),
      ...[
        {},
        { min: '12:00:00' },
        { min: '12:30:00', max: '12:30:00' },
        { min: '12:00:00', max: '13:00:00' },
      ].map((bounds, index) => ({
        name: `TimeField ${index}`,
        className: `valid-time-${index}`,
        element: createElement(TimeField, {
          ...bounds,
          className: `valid-time-${index}`,
          value: '12:30:00',
          onChange: (next) => changes.push(next),
          disabled: true,
          readOnly: true,
          granularity: 'second' as const,
          hourCycle: 24 as const,
          shouldForceLeadingZeros: true,
          'aria-label': `Valid time ${index}`,
        }),
      })),
      ...[
        {},
        { min: '2026-08-13T12:00:00+08:00' },
        {
          min: '2026-08-13T12:30:00+08:00',
          max: '2026-08-13T12:30:00+08:00',
        },
        {
          min: '2026-08-13T11:00:00+08:00',
          max: '2026-08-13T13:00:00Z',
        },
      ].map((bounds, index) => ({
        name: `DateTimeField ${index}`,
        className: `valid-date-time-${index}`,
        element: createElement(DateTimeField, {
          ...bounds,
          className: `valid-date-time-${index}`,
          value: '2026-08-13T12:30:00+08:00',
          timeZone: 'Australia/Perth',
          onChange: (next) => changes.push(next),
          disabled: true,
          readOnly: true,
          locale: 'en-AU',
          granularity: 'second' as const,
          hourCycle: 24 as const,
          hideTimeZone: true,
          shouldForceLeadingZeros: true,
          'aria-label': `Valid date time ${index}`,
        }),
      })),
    ]

    for (const { name, className, element } of validBounds) {
      const view = render(element)
      const control = view.root.element.querySelector(`.${className}`)
      expect(control, name).not.toBeNull()
      act(() => view.unmount())
    }
    expect(changes).toEqual([])
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

  it('prefers explicit Status names while forwarding aria-labelledby', () => {
    const options = [{ value: 'ready', label: 'Ready', tone: 'success' as const }]
    const view = render(
      createElement(
        'div',
        null,
        createElement('span', { id: 'status-heading' }, 'Deployment'),
        createElement(Status, {
          className: 'explicit-status',
          value: 'ready',
          options,
          'aria-label': 'Build status',
          'aria-labelledby': 'status-heading',
        }),
        createElement(Status, {
          className: 'explicit-text-value-status',
          value: 'ready',
          options: [
            {
              value: 'ready',
              label: createElement('strong', null, 'Ready'),
              textValue: 'Ready to ship',
              tone: 'success' as const,
            },
          ],
          'aria-label': 'Release status',
        }),
        createElement(Status, {
          className: 'empty-explicit-status',
          value: 'ready',
          options,
          'aria-label': '',
        }),
      ),
    )

    const explicit = view.root.element.querySelector('.explicit-status')
    expect(explicit?.getAttribute('aria-label')).toBe('Build status')
    expect(explicit?.getAttribute('aria-labelledby')).toBe('status-heading')
    expect(explicit?.textContent).toBe('Ready')
    expect(
      view.root.element.querySelector('.explicit-text-value-status')?.getAttribute('aria-label'),
    ).toBe('Release status')
    expect(
      view.root.element.querySelector('.empty-explicit-status')?.getAttribute('aria-label'),
    ).toBe('')
    act(() => view.unmount())
  })

  it('derives omitted Status names while preserving presentation and validation', () => {
    const view = render(
      createElement(
        'div',
        null,
        createElement('p', { id: 'status-description' }, 'Reported by the build service.'),
        createElement('p', { id: 'status-error' }, 'The report is stale.'),
        createElement(Status, {
          className: 'string-status',
          value: 'ready',
          options: [{ value: 'ready', label: 'Ready', tone: 'success' as const }],
        }),
        createElement(Status, {
          className: 'text-value-status',
          value: 1,
          options: [
            { value: '1', label: 'String one', tone: 'neutral' as const },
            {
              value: 1,
              label: createElement('strong', null, 'Numeric one'),
              textValue: 'Numeric status one',
              tone: 'warning' as const,
              icon: createElement('span', { 'data-status-icon': true }, '!'),
            },
          ],
          disabled: true,
          readOnly: true,
          'aria-describedby': 'status-description',
          'aria-invalid': true,
          'aria-errormessage': 'status-error',
        }),
        createElement(Status, {
          className: 'unmatched-status',
          value: 'unknown',
          options: [{ value: 'ready', label: 'Ready', tone: 'success' as const }],
        }),
      ),
    )

    expect(view.root.element.querySelector('.string-status')?.getAttribute('aria-label')).toBe(
      'Ready',
    )
    const textValueStatus = view.root.element.querySelector('.text-value-status')
    expect(textValueStatus?.getAttribute('aria-label')).toBe('Numeric status one')
    expect(textValueStatus?.getAttribute('data-tone')).toBe('warning')
    expect(textValueStatus?.getAttribute('aria-disabled')).toBe('true')
    expect(textValueStatus?.getAttribute('aria-readonly')).toBe('true')
    expect(textValueStatus?.getAttribute('aria-describedby')).toBe('status-description')
    expect(textValueStatus?.getAttribute('aria-invalid')).toBe('true')
    expect(textValueStatus?.getAttribute('aria-errormessage')).toBe('status-error')
    expect(textValueStatus?.querySelector('[data-status-icon]')?.textContent).toBe('!')
    expect(textValueStatus?.textContent).toBe('!Numeric one')
    const unmatched = view.root.element.querySelector('.unmatched-status')
    expect(unmatched?.getAttribute('aria-label')).toBe('unknown')
    expect(unmatched?.textContent).toBe('unknown')
    expect(unmatched?.hasAttribute('data-tone')).toBe(false)
    expect(unmatched?.hasAttribute('role')).toBe(false)
    expect(unmatched?.hasAttribute('aria-live')).toBe(false)
    act(() => view.unmount())

    expect(() =>
      render(
        createElement(Status, {
          value: 'ready',
          options: [
            {
              value: 'ready',
              label: createElement('span', null, 'Ready'),
              tone: 'success',
            },
          ],
        }),
      ),
    ).toThrowError(new TypeError('non-text status labels require textValue.'))
  })

  it('uses the configured Status presentation for signed zero', () => {
    const view = render(
      createElement(Status, {
        value: -0,
        options: [{ value: 0, label: 'Zero', tone: 'success' as const }],
      }),
    )

    const status = view.root.element.querySelector('[data-picodash-dashlist-status]')
    expect(status?.textContent).toBe('Zero')
    expect(status?.getAttribute('aria-label')).toBe('Zero')
    expect(status?.getAttribute('data-tone')).toBe('success')
    act(() => view.unmount())
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
        createElement(DateDashlet, {
          id: 'date',
          field: nexus.fields.date,
          label: 'Date',
        }),
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

  it('announces an externally introduced focused value mismatch without repairing it', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { range: { defaultValue: { start: 2, end: 8 } } },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'value-transition', nexus },
        createElement(RangeDashlet, {
          id: 'range',
          field: nexus.fields.range,
          label: 'Range',
          min: 0,
          max: 10,
        }),
      ),
    )
    act(() =>
      view.root.element
        .querySelector<HTMLInputElement>('[data-picodash-dashlet="range"] input')!
        .focus(),
    )
    act(() => void nexus.setValue(nexus.fields.range, { start: -2, end: 8 }))

    const warning = view.root.element.querySelector<HTMLElement>(
      '[data-picodash-dashlet="range"] [role="note"]',
    )!
    const fallback = view.root.element.querySelector<HTMLElement>(
      '[data-picodash-dashlet="range"] [data-picodash-dashlist-range-value]',
    )!
    expect(warning.textContent).toBe(
      'The current range ({ start: -2, end: 8 }) is outside the configured range.',
    )
    expect(fallback.textContent).toBe('{"start":-2,"end":8}')
    expect(fallback.getAttribute('aria-describedby')?.split(' ')).toContain(warning.id)
    expect(fallback.hasAttribute('aria-invalid')).toBe(false)
    expect(view.root.element.querySelector('[role="status"]')?.textContent).toBe(
      'The current range ({ start: -2, end: 8 }) is outside the configured range.',
    )
    expect(nexus.getState().values.range).toEqual({ start: -2, end: 8 })

    act(() => view.unmount())
    nexus.destroy()
  })

  it('requires a valid time zone for date-time fields', () => {
    for (const timeZone of [undefined, null, ''] as const)
      expect(() =>
        render(
          createElement(DateTimeField, {
            value: null,
            timeZone: timeZone!,
            onChange: () => undefined,
            'aria-label': 'Missing zone',
          }),
        ),
      ).toThrowError(new TypeError('timeZone is required.'))

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
