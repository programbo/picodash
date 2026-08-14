// @vitest-environment jsdom
import { act, createElement, StrictMode, type ReactElement } from 'react'
import { fireEvent } from '@testing-library/react'
import { createPicodashNexus } from '@picodash/nexus'
import { describe, expect, it } from 'vite-plus/test'
import { createDomTestRenderer, type DomTestRenderer } from '../../../test/dom-renderer.ts'
import { Dashlet, DashList, SwitchDashlet } from '../src/index.tsx'
import {
  Checkbox,
  CheckboxGroup,
  ColorField,
  Combobox,
  DateField,
  DateRangeField,
  DateTimeField,
  Display,
  Meter,
  MultiSelect,
  NumberField,
  ProgressBar,
  RadioGroup,
  RangeSlider,
  SearchField,
  SegmentedControl,
  Select,
  Slider,
  Status,
  Switch,
  TextField,
  TimeField,
  type NumberFieldProps,
  type SelectOption,
  type SliderProps,
} from '../src/ui.js'

type ControlCase = {
  readonly name: string
  readonly structuralClassName: string
  readonly render: (className?: string) => ReactElement
}

const options: readonly SelectOption<string>[] = ['one', 'two']
const statusOptions = [{ value: 'ready', label: 'Ready', tone: 'success' as const }]

const controls: readonly ControlCase[] = [
  {
    name: 'TextField',
    structuralClassName: 'picodash-dashlist-field',
    render: (className) =>
      createElement(TextField, {
        className,
        value: 'value',
        onChange: () => undefined,
        'aria-label': 'Text',
      }),
  },
  {
    name: 'NumberField',
    structuralClassName: 'picodash-dashlist-field',
    render: (className) =>
      createElement(NumberField, {
        className,
        value: 1,
        onChange: () => undefined,
        'aria-label': 'Number',
      }),
  },
  {
    name: 'Slider',
    structuralClassName: 'picodash-dashlist-slider',
    render: (className) =>
      createElement(Slider, {
        className,
        value: 1,
        onChange: () => undefined,
        'aria-label': 'Slider',
      }),
  },
  {
    name: 'Switch',
    structuralClassName: 'picodash-dashlist-switch',
    render: (className) =>
      createElement(Switch, {
        className,
        isSelected: true,
        onChange: () => undefined,
        'aria-label': 'Switch',
      }),
  },
  {
    name: 'Select',
    structuralClassName: 'picodash-dashlist-select',
    render: (className) =>
      createElement(Select, {
        className,
        value: 'one',
        onChange: () => undefined,
        options,
        'aria-label': 'Select',
      }),
  },
  {
    name: 'SegmentedControl',
    structuralClassName: 'picodash-dashlist-segmented',
    render: (className) =>
      createElement(SegmentedControl, {
        className,
        value: 'one',
        onChange: () => undefined,
        options,
        'aria-label': 'Segmented',
      }),
  },
  {
    name: 'Display',
    structuralClassName: 'picodash-dashlist-display',
    render: (className) => createElement(Display, { className, value: 'Ready' }),
  },
  {
    name: 'Checkbox',
    structuralClassName: 'picodash-dashlist-checkbox',
    render: (className) =>
      createElement(Checkbox, {
        className,
        isSelected: true,
        onChange: () => undefined,
        'aria-label': 'Checkbox',
      }),
  },
  {
    name: 'RadioGroup',
    structuralClassName: 'picodash-dashlist-radio-group',
    render: (className) =>
      createElement(RadioGroup, {
        className,
        value: 'one',
        onChange: () => undefined,
        options,
        'aria-label': 'Radio group',
      }),
  },
  {
    name: 'Combobox',
    structuralClassName: 'picodash-dashlist-combobox',
    render: (className) =>
      createElement(Combobox, {
        className,
        value: 'one',
        onChange: () => undefined,
        options,
        'aria-label': 'Combobox',
      }),
  },
  {
    name: 'CheckboxGroup',
    structuralClassName: 'picodash-dashlist-checkbox-group',
    render: (className) =>
      createElement(CheckboxGroup, {
        className,
        value: ['one'],
        onChange: () => undefined,
        options,
        'aria-label': 'Checkbox group',
      }),
  },
  {
    name: 'MultiSelect',
    structuralClassName: 'picodash-dashlist-multi-select',
    render: (className) =>
      createElement(MultiSelect, {
        className,
        value: ['one'],
        onChange: () => undefined,
        options,
        'aria-label': 'Multi select',
      }),
  },
  {
    name: 'SearchField',
    structuralClassName: 'picodash-dashlist-search-field',
    render: (className) =>
      createElement(SearchField, {
        className,
        value: 'query',
        onChange: () => undefined,
        'aria-label': 'Search',
      }),
  },
  {
    name: 'RangeSlider',
    structuralClassName: 'picodash-dashlist-range-slider',
    render: (className) =>
      createElement(RangeSlider, {
        className,
        value: { start: 1, end: 2 },
        onChange: () => undefined,
        'aria-label': 'Range',
      }),
  },
  {
    name: 'Meter',
    structuralClassName: 'picodash-dashlist-meter',
    render: (className) => createElement(Meter, { className, value: 1, 'aria-label': 'Meter' }),
  },
  {
    name: 'ProgressBar',
    structuralClassName: 'picodash-dashlist-progress',
    render: (className) =>
      createElement(ProgressBar, { className, value: 1, 'aria-label': 'Progress' }),
  },
  {
    name: 'Status',
    structuralClassName: 'picodash-dashlist-status',
    render: (className) =>
      createElement(Status, { className, value: 'ready', options: statusOptions }),
  },
  {
    name: 'DateField',
    structuralClassName: 'picodash-dashlist-date-field',
    render: (className) =>
      createElement(DateField, {
        className,
        value: '2026-08-13',
        onChange: () => undefined,
        'aria-label': 'Date',
      }),
  },
  {
    name: 'TimeField',
    structuralClassName: 'picodash-dashlist-time-field',
    render: (className) =>
      createElement(TimeField, {
        className,
        value: '12:30:00',
        onChange: () => undefined,
        'aria-label': 'Time',
      }),
  },
  {
    name: 'DateTimeField',
    structuralClassName: 'picodash-dashlist-date-time-field',
    render: (className) =>
      createElement(DateTimeField, {
        className,
        value: '2026-08-13T12:30:00+08:00',
        timeZone: 'Australia/Perth',
        onChange: () => undefined,
        'aria-label': 'Date time',
      }),
  },
  {
    name: 'DateRangeField',
    structuralClassName: 'picodash-dashlist-date-range-field',
    render: (className) =>
      createElement(DateRangeField, {
        className,
        value: { start: '2026-08-01', end: '2026-08-13' },
        onChange: () => undefined,
        'aria-label': 'Date range',
      }),
  },
  {
    name: 'ColorField',
    structuralClassName: 'picodash-dashlist-color-field',
    render: (className) =>
      createElement(ColorField, {
        className,
        value: '#ff0000',
        onChange: () => undefined,
        'aria-label': 'Color',
      }),
  },
]

function render(element: ReactElement): DomTestRenderer {
  let renderer!: DomTestRenderer
  act(() => {
    renderer = createDomTestRenderer(element)
  })
  return renderer
}

describe('/ui structural class composition', () => {
  it.each(controls)(
    'keeps the structural root class and appends a caller class: $name',
    (control) => {
      const callerClassName = 'caller-owned-control'
      const view = render(control.render(callerClassName))
      const root = view.root.element.querySelector(
        `.${control.structuralClassName}.${callerClassName}`,
      )
      expect(root, `${control.name} should compose classes on one root`).not.toBeNull()
      act(() => view.unmount())
    },
  )

  it.each(controls)(
    'retains the structural root class for omitted and empty className: $name',
    (control) => {
      for (const className of [undefined, '']) {
        const view = render(control.render(className))
        expect(
          view.root.element.querySelector(`.${control.structuralClassName}`),
          `${control.name} should retain its structural class for ${className === undefined ? 'omitted' : 'empty'} className`,
        ).not.toBeNull()
        act(() => view.unmount())
      }
    },
  )

  it('composes the caller class for valid and invalid controlled ColorField values', () => {
    const validView = render(
      createElement(ColorField, {
        className: 'valid-color-hook',
        value: '#ff0000',
        onChange: () => undefined,
        'aria-label': 'Valid color',
      }),
    )
    expect(
      validView.root.element.querySelector('.picodash-dashlist-color-field.valid-color-hook'),
    ).not.toBeNull()
    act(() => validView.unmount())

    const rawView = render(
      createElement(ColorField, {
        className: 'raw-color-hook',
        value: 'not-a-color',
        onChange: () => undefined,
        'aria-label': 'Raw color',
      }),
    )
    const rawRoot = rawView.root.element.querySelector(
      '.picodash-dashlist-color-field.raw-color-hook input',
    )
    expect(rawRoot).not.toBeNull()
    act(() => rawView.unmount())
  })
})

describe('/ui TextField configuration', () => {
  it('renders a declared positive multiline row count', () => {
    const view = render(
      createElement(TextField, {
        value: 'Notes',
        onChange: () => undefined,
        multiline: true,
        minRows: 3,
        'aria-label': 'Notes',
      }),
    )

    expect(view.root.element.querySelector('textarea')?.getAttribute('rows')).toBe('3')
    act(() => view.unmount())
  })

  it.each([
    { multiline: false, minRows: 1 },
    { multiline: true, minRows: 0 },
    { multiline: true, minRows: -1 },
    { multiline: true, minRows: 1.5 },
    { multiline: true, minRows: Number.NaN },
    { multiline: true, minRows: Number.POSITIVE_INFINITY },
  ])('rejects invalid minRows configuration: $multiline/$minRows', ({ multiline, minRows }) => {
    expect(() =>
      render(
        createElement(TextField, {
          value: 'Notes',
          onChange: () => undefined,
          multiline,
          minRows,
          'aria-label': 'Notes',
        }),
      ),
    ).toThrowError(new TypeError('minRows must be a positive integer when multiline is true.'))
  })
})

describe('/ui primary focus registration', () => {
  it('registers the exact basic-control focus nodes and uses the shell for a readout', () => {
    const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
    const view = render(
      createElement(
        DashList,
        { id: 'ui-focus-targets', nexus },
        createElement(
          Dashlet,
          { id: 'text-focus', label: 'Text focus' },
          createElement(TextField, {
            value: 'Text',
            onChange: () => undefined,
            'aria-label': 'Text control',
          }),
        ),
        createElement(
          Dashlet,
          { id: 'number-focus', label: 'Number focus' },
          createElement(NumberField, {
            value: 2,
            onChange: () => undefined,
            'aria-label': 'Number control',
          }),
        ),
        createElement(
          Dashlet,
          { id: 'slider-focus', label: 'Slider focus' },
          createElement(Slider, {
            value: 2,
            onChange: () => undefined,
            'aria-label': 'Slider control',
          }),
        ),
        createElement(
          Dashlet,
          { id: 'switch-focus', label: 'Switch focus' },
          createElement(Switch, {
            isSelected: false,
            onChange: () => undefined,
            'aria-label': 'Switch control',
          }),
        ),
        createElement(
          Dashlet,
          { id: 'select-focus', label: 'Select focus' },
          createElement(Select, {
            value: 'one',
            onChange: () => undefined,
            options,
            'aria-label': 'Select control',
          }),
        ),
        createElement(
          Dashlet,
          { id: 'segment-focus', label: 'Segment focus' },
          createElement(SegmentedControl, {
            value: 'two',
            onChange: () => undefined,
            options: [{ value: 'one', disabled: true }, 'two'],
            'aria-label': 'Segment control',
          }),
        ),
        createElement(
          Dashlet,
          { id: 'display-focus', label: 'Display focus' },
          createElement(Display, { value: 'Ready' }),
        ),
      ),
    )

    const cases: readonly { readonly id: string; readonly target: string }[] = [
      { id: 'text-focus', target: 'input' },
      { id: 'number-focus', target: 'input' },
      { id: 'slider-focus', target: 'input[type="range"]' },
      { id: 'switch-focus', target: 'input[type="checkbox"]' },
      { id: 'select-focus', target: '.picodash-dashlist-select button' },
      { id: 'segment-focus', target: 'input[type="radio"]:not(:disabled)' },
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

    const display = view.root.element.querySelector<HTMLElement>(
      '[data-picodash-dashlet="display-focus"]',
    )!
    fireEvent.click(display.querySelector('[data-picodash-dashlet-label]')!)
    expect(display.ownerDocument.activeElement).toBe(
      display.querySelector('[data-picodash-dashlet-shell]'),
    )

    act(() => view.unmount())
    nexus.destroy()
  })

  it('describes read-only Slider and Select on their actual focus targets', () => {
    const sliderChanges: number[] = []
    const selectChanges: Array<string | number> = []
    const view = render(
      createElement(
        'div',
        null,
        createElement(Slider, {
          value: 4,
          onChange: (next) => sliderChanges.push(next),
          readOnly: true,
          'aria-label': 'Read-only slider',
          'aria-describedby': 'slider-context',
        }),
        createElement(Select, {
          value: 'one',
          onChange: (next) => selectChanges.push(next),
          options,
          readOnly: true,
          'aria-label': 'Read-only select',
          'aria-describedby': 'select-context',
        }),
      ),
    )
    const slider = view.root.element.querySelector<HTMLInputElement>('input[type="range"]')!
    const select = view.root.element.querySelector<HTMLButtonElement>(
      '.picodash-dashlist-select button',
    )!
    for (const [control, existing] of [
      [slider, 'slider-context'],
      [select, 'select-context'],
    ] as const) {
      const ids = control.getAttribute('aria-describedby')?.split(' ') ?? []
      expect(ids).toContain(existing)
      expect(
        ids.some((id) => control.ownerDocument.getElementById(id)?.textContent === 'Read only.'),
      ).toBe(true)
      expect(control.hasAttribute('aria-readonly')).toBe(false)
    }
    expect(view.root.element.querySelector('[aria-readonly]')).toBeNull()
    fireEvent.change(slider, { target: { value: '5' } })
    fireEvent.click(select)
    expect(sliderChanges).toEqual([])
    expect(selectChanges).toEqual([])
    act(() => view.unmount())
  })
})

describe('Switch state presentation', () => {
  it('renders an inert positional marker for both direct states', () => {
    const changes: boolean[] = []
    const view = render(
      createElement(
        'div',
        null,
        createElement(Switch, {
          isSelected: false,
          onChange: (value) => changes.push(value),
          'aria-label': 'Direct off',
        }),
        createElement(Switch, {
          isSelected: true,
          onChange: (value) => changes.push(value),
          'aria-label': 'Direct on',
        }),
      ),
    )

    const switches = [...view.root.element.querySelectorAll('[role="switch"]')]
    const roots = switches.map((control) => control.closest('.picodash-dashlist-switch'))
    expect(switches).toHaveLength(2)
    expect(switches.map((control) => (control as HTMLInputElement).checked)).toEqual([false, true])

    for (const [index, root] of roots.entries()) {
      const track = root?.querySelector('[data-picodash-dashlist-switch-track]')
      const marker = track?.querySelector('[data-picodash-dashlist-switch-marker]')
      expect(track?.getAttribute('aria-hidden'), `direct state ${index} track`).toBe('true')
      expect(marker?.getAttribute('aria-hidden'), `direct state ${index} marker`).toBe('true')
      expect(marker?.getAttribute('tabindex'), `direct state ${index} marker`).toBeNull()
      expect(marker?.querySelector('button, input, a, [tabindex]')).toBeNull()
    }

    fireEvent.click(switches[0]!)
    expect(changes).toEqual([true])
    act(() => view.unmount())
  })

  it('keeps the marker when composed by SwitchDashlet', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { enabled: { defaultValue: true } },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'switch-marker', nexus },
        createElement(SwitchDashlet, {
          id: 'enabled',
          field: nexus.fields.enabled,
          label: 'Enabled',
        }),
      ),
    )
    const control = view.root.element.querySelector<HTMLInputElement>(
      '[data-picodash-dashlet="enabled"] [role="switch"]',
    )
    expect(control?.checked).toBe(true)
    expect(
      control
        ?.closest('.picodash-dashlist-switch')
        ?.querySelector(
          '[data-picodash-dashlist-switch-track] [data-picodash-dashlist-switch-marker]',
        ),
    ).not.toBeNull()
    expect(control?.getAttribute('aria-labelledby')).toBeTruthy()
    act(() => view.unmount())
    nexus.destroy()
  })
})

describe('NumberField configuration and behavior', () => {
  it('does not emit formatted replacements when untouched decimal, currency, percent, and unit values blur', () => {
    const cases: readonly {
      readonly name: string
      readonly value: number
      readonly formatOptions?: Intl.NumberFormatOptions
    }[] = [
      { name: 'decimal', value: 1.234567 },
      { name: 'currency', value: 1.234567, formatOptions: { style: 'currency', currency: 'USD' } },
      { name: 'percent', value: 0.123456, formatOptions: { style: 'percent' } },
      { name: 'unit', value: 1.234567, formatOptions: { style: 'unit', unit: 'kilometer' } },
    ]
    for (const numberCase of cases) {
      const changes: Array<number | null> = []
      const view = render(
        createElement(StrictMode, {
          children: createElement(NumberField, {
            value: numberCase.value,
            formatOptions: numberCase.formatOptions,
            onChange: (next) => changes.push(next),
            'aria-label': `${numberCase.name} number`,
          }),
        }),
      )
      const input = view.root.element.querySelector<HTMLInputElement>('input')!
      fireEvent.focus(input)
      fireEvent.blur(input)
      expect(changes, numberCase.name).toEqual([])
      act(() => view.unmount())
    }
  })

  it('forwards explicit text, clear, arrow, and wheel edits without stale intent', async () => {
    const changes: Array<number | null> = []
    const renderField = (value: number, formatOptions?: Intl.NumberFormatOptions) =>
      createElement(NumberField, {
        value,
        formatOptions,
        onChange: (next) => changes.push(next),
        'aria-label': 'Editable number',
      })
    const view = render(renderField(10))
    const input = () => view.root.element.querySelector<HTMLInputElement>('input')!

    fireEvent.change(input(), { target: { value: '12.5' } })
    fireEvent.blur(input())
    expect(changes).toEqual([12.5])

    act(() => view.update(renderField(12.5)))
    fireEvent.change(input(), { target: { value: '' } })
    fireEvent.blur(input())
    expect(changes).toEqual([12.5, null])

    act(() => view.update(renderField(4)))
    fireEvent.keyDown(input(), { key: 'ArrowUp' })
    expect(changes).toEqual([12.5, null, 5])

    act(() => view.update(renderField(5)))
    act(() => {
      input().focus()
      fireEvent.focusIn(input())
    })
    act(() => {
      void fireEvent.wheel(input(), { deltaY: 10, deltaX: 0 })
    })
    await act(() => Promise.resolve())
    expect(changes).toEqual([12.5, null, 5, 6])

    act(() => view.update(renderField(6)))
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    expect(changes).toEqual([12.5, null, 5, 6, 5])

    act(() => view.update(renderField(5)))
    input().setSelectionRange(0, input().value.length)
    fireEvent.paste(input(), { clipboardData: { getData: () => '8' } })
    expect(changes).toEqual([12.5, null, 5, 6, 5, 8])

    fireEvent.change(input(), { target: { value: '-' } })
    act(() => view.update(renderField(7, { minimumFractionDigits: 2 })))
    fireEvent.blur(input())
    expect(changes).toEqual([12.5, null, 5, 6, 5, 8])
    act(() => view.unmount())
  })

  it('rejects invalid direct NumberField configuration synchronously', () => {
    const invalidConfigurations: readonly {
      readonly name: string
      readonly props: Pick<NumberFieldProps, 'min' | 'max' | 'step'>
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
            createElement(NumberField, {
              value: 0,
              onChange: () => undefined,
              'aria-label': 'Invalid number',
              ...configuration.props,
            }),
          ),
        configuration.name,
      ).toThrowError(configuration.error)
  })

  it('accepts omitted, one-sided, equal, signed, and non-zero bounds with an optional step', () => {
    const validConfigurations: readonly {
      readonly name: string
      readonly value: number
      readonly props: Pick<NumberFieldProps, 'min' | 'max' | 'step'>
    }[] = [
      { name: 'omitted bounds and step', value: 1, props: {} },
      { name: 'minimum only', value: -2, props: { min: -5 } },
      { name: 'maximum only', value: 2, props: { max: 5 } },
      { name: 'equal bounds', value: 3, props: { min: 3, max: 3 } },
      { name: 'signed range', value: -2.5, props: { min: -10, max: 10, step: 0.5 } },
      { name: 'non-zero range', value: 4, props: { min: 2, max: 8, step: 2 } },
    ]

    for (const configuration of validConfigurations) {
      const view = render(
        createElement(NumberField, {
          value: configuration.value,
          onChange: () => undefined,
          'aria-label': configuration.name,
          ...configuration.props,
        }),
      )
      expect(view.root.element.querySelector('input')).toBeInstanceOf(HTMLInputElement)
      act(() => view.unmount())
    }
  })

  it('preserves controlled edits, formatting, placeholder, classes, and ARIA relationships', () => {
    const changes: Array<number | null> = []
    const formatOptions: Intl.NumberFormatOptions = {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
    const view = render(
      createElement(NumberField, {
        id: 'amount-input',
        className: 'caller-number-field',
        value: 1234.5,
        onChange: (value) => changes.push(value),
        min: -2000,
        max: 2000,
        step: 0.25,
        placeholder: 'Enter an amount',
        formatOptions,
        'aria-labelledby': 'amount-label',
        'aria-describedby': 'amount-description',
        'aria-invalid': true,
        'aria-errormessage': 'amount-error',
      }),
    )

    const root = view.root.element.querySelector('.picodash-dashlist-field.caller-number-field')
    const input = root?.querySelector('input')
    expect(input).toBeInstanceOf(HTMLInputElement)
    expect((input as HTMLInputElement).value).toBe(
      new Intl.NumberFormat(undefined, formatOptions).format(1234.5),
    )
    expect(input?.getAttribute('id')).toBe('amount-input')
    expect(input?.getAttribute('placeholder')).toBe('Enter an amount')
    expect(input?.getAttribute('aria-labelledby')).toBe('amount-label')
    expect(input?.getAttribute('aria-describedby')).toBe('amount-description')
    expect(input?.getAttribute('aria-invalid')).toBe('true')
    expect(input?.getAttribute('aria-errormessage')).toBe('amount-error')

    fireEvent.change(input as HTMLInputElement, { target: { value: '1500.75' } })
    fireEvent.blur(input as HTMLInputElement)
    expect(changes).toEqual([1500.75])
    act(() => view.unmount())
  })

  it('preserves disabled and read-only input behavior', () => {
    const view = render(
      createElement(
        'div',
        null,
        createElement(NumberField, {
          id: 'disabled-number',
          value: 1,
          onChange: () => undefined,
          disabled: true,
          'aria-label': 'Disabled number',
        }),
        createElement(NumberField, {
          id: 'read-only-number',
          value: 2,
          onChange: () => undefined,
          readOnly: true,
          'aria-label': 'Read-only number',
        }),
      ),
    )

    expect(view.root.element.querySelector<HTMLInputElement>('#disabled-number')?.disabled).toBe(
      true,
    )
    expect(view.root.element.querySelector<HTMLInputElement>('#read-only-number')?.readOnly).toBe(
      true,
    )
    act(() => view.unmount())
  })
})

describe('Slider marks', () => {
  it('rejects invalid direct Slider configuration synchronously', () => {
    const invalidConfigurations: readonly {
      readonly name: string
      readonly props: Pick<SliderProps, 'min' | 'max' | 'step' | 'marks'>
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
      ...[
        { name: 'mark below min', value: -1 },
        { name: 'mark above max', value: 11 },
        { name: 'NaN mark', value: Number.NaN },
        { name: 'positive infinite mark', value: Number.POSITIVE_INFINITY },
        { name: 'negative infinite mark', value: Number.NEGATIVE_INFINITY },
      ].map(({ name, value }) => ({
        name,
        props: { min: 0, max: 10, marks: [{ value }] },
        error: new TypeError('marks values must be finite and within the slider bounds.'),
      })),
    ]

    for (const configuration of invalidConfigurations)
      expect(
        () =>
          render(
            createElement(Slider, {
              value: 0,
              onChange: () => undefined,
              'aria-label': 'Invalid slider',
              ...configuration.props,
            }),
          ),
        configuration.name,
      ).toThrowError(configuration.error)
  })

  it('keeps duplicate authored boundary marks in one inert track layer at signed offsets', () => {
    const changes: number[] = []
    const view = render(
      createElement(Slider, {
        value: 0,
        onChange: (value) => changes.push(value),
        min: -20,
        max: 20,
        step: 10,
        marks: [
          {
            value: 20,
            label: createElement('strong', { 'data-authored-slider-label': 'maximum' }, 'Maximum'),
          },
          { value: -20, label: 'Minimum' },
          { value: 0 },
          { value: 20, label: 'Duplicate maximum' },
        ],
        'aria-label': 'Signed range',
      }),
    )

    const root = view.root.element.querySelector('.picodash-dashlist-slider')
    const track = root?.querySelector('.picodash-dashlist-slider-track')
    const layers = root?.querySelectorAll('[data-picodash-dashlist-slider-marks]')
    expect(layers).toHaveLength(1)
    const layer = layers?.[0]
    expect(layer?.parentElement).toBe(track)
    expect(layer?.getAttribute('aria-hidden')).toBe('true')

    const marks = [...(layer?.querySelectorAll('[data-picodash-dashlist-slider-mark]') ?? [])]
    expect(marks.map((mark) => mark.getAttribute('data-picodash-dashlist-slider-mark'))).toEqual([
      '20',
      '-20',
      '0',
      '20',
    ])
    expect(marks.map((mark) => mark.textContent)).toEqual([
      'Maximum',
      'Minimum',
      '0',
      'Duplicate maximum',
    ])
    expect(
      marks.map((mark) =>
        (mark as HTMLElement).style.getPropertyValue('--_picodash-dashlist-slider-mark-position'),
      ),
    ).toEqual(['100%', '0%', '50%', '100%'])
    expect(layer?.querySelector('[data-authored-slider-label="maximum"]')?.tagName).toBe('STRONG')

    const input = root?.querySelector('input[type="range"]')
    expect(input).toBeInstanceOf(HTMLInputElement)
    fireEvent.change(input as HTMLInputElement, { target: { value: '10' } })
    expect(changes).toEqual([10])
    act(() => view.unmount())
  })

  it('places a zero-span mark at logical start', () => {
    const view = render(
      createElement(Slider, {
        value: 5,
        onChange: () => undefined,
        min: 5,
        max: 5,
        marks: [{ value: 5, label: 'Only value' }],
        'aria-label': 'Fixed value',
      }),
    )
    const mark = view.root.element.querySelector<HTMLElement>(
      '[data-picodash-dashlist-slider-mark="5"]',
    )
    expect(mark?.style.getPropertyValue('--_picodash-dashlist-slider-mark-position')).toBe('0%')
    act(() => view.unmount())
  })
})
