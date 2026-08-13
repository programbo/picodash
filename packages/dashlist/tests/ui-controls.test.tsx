// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import { createDomTestRenderer, type DomTestRenderer } from '../../../test/dom-renderer.ts'
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
  type SelectOption,
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

  it('composes the caller class on both ColorField root paths', () => {
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
      'input.picodash-dashlist-color-field.raw-color-hook',
    )
    expect(rawRoot).not.toBeNull()
    act(() => rawView.unmount())
  })
})
