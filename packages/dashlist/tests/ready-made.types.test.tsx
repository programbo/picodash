import { createElement, createRef } from 'react'
import { describe, it } from 'vite-plus/test'
import { createPicodashNexus, type PicodashField } from '@picodash/nexus'
import {
  DisplayDashlet,
  NumberDashlet,
  RangeDashlet,
  SegmentedDashlet,
  SelectDashlet,
  SliderDashlet,
  SwitchDashlet,
  TextDashlet,
  type NumberDashletProps,
} from '../src/index.tsx'

const nexus = createPicodashNexus({
  valueOwner: 'nexus',
  fields: {
    text: { defaultValue: '' },
    number: { defaultValue: 1 },
    choice: { defaultValue: 'a' },
    object: { defaultValue: { count: 2, labels: ['ready', 'exact'] } },
    array: { defaultValue: [{ id: 'first' }] },
  },
})
type CompatibilityValues = {
  readonly booleanOrString: boolean | string
  readonly numberOrString: number | string
  readonly rangeOrString: { readonly start: number; readonly end: number } | string
}
const booleanOrStringField = null as unknown as PicodashField<
  CompatibilityValues,
  'booleanOrString'
>
const numberOrStringField = null as unknown as PicodashField<CompatibilityValues, 'numberOrString'>
const rangeOrStringField = null as unknown as PicodashField<CompatibilityValues, 'rangeOrString'>
describe('@picodash/dashlist ready-made control types', () => {
  it('accepts ready-made control props and rejects invalid overrides', () => {
    const ref = createRef<HTMLDivElement>()
    void createElement(TextDashlet, { id: 'text', field: nexus.fields.text, label: 'Text', ref })
    void createElement(NumberDashlet, { id: 'number', field: nexus.fields.number, label: 'Number' })
    void createElement(SliderDashlet, { id: 'slider', field: nexus.fields.number, label: 'Slider' })
    void createElement(SelectDashlet, {
      id: 'choice',
      field: nexus.fields.choice,
      label: 'Choice',
      options: ['a', 'b'],
    })
    void createElement(SegmentedDashlet, {
      id: 'mode',
      field: nexus.fields.choice,
      label: 'Mode',
      options: ['a', 'b'],
      // @ts-expect-error SegmentedDashlet does not accept Select-only placeholder props.
      placeholder: 'Choose',
    })
    void createElement(DisplayDashlet, {
      id: 'display',
      field: nexus.fields.number,
      label: 'Display',
      formatValue: (value) => value.toFixed(1),
    })
    void createElement(DisplayDashlet, {
      id: 'display-object',
      field: nexus.fields.object,
      label: 'Display object',
      formatValue: (value) => `${value.count}: ${value.labels.join(', ')}`,
    })
    ;<DisplayDashlet
      id="display-array"
      field={nexus.fields.array}
      label="Display array"
      formatValue={(value) => value.map((item) => item.id).join(', ')}
    />
    ;<DisplayDashlet
      id="display-union"
      field={numberOrStringField}
      label="Display union"
      formatValue={(value) => (typeof value === 'number' ? value.toFixed(1) : value.toUpperCase())}
    />
    ;<DisplayDashlet
      id="display-invalid-assumption"
      field={nexus.fields.number}
      label="Display invalid assumption"
      // @ts-expect-error DisplayDashlet formatters receive the bound field's number value.
      formatValue={(value: string) => value.toUpperCase()}
    />
    // @ts-expect-error TextDashlet rejects a number field at a direct JSX call site.
    ;<TextDashlet field={nexus.fields.number} id="text-mismatch" label="Text mismatch" />
    // @ts-expect-error NumberDashlet rejects a string field at a direct JSX call site.
    ;<NumberDashlet field={nexus.fields.text} id="number-mismatch" label="Number mismatch" />
    // @ts-expect-error SliderDashlet rejects a string field at a direct JSX call site.
    ;<SliderDashlet field={nexus.fields.text} id="slider-mismatch" label="Slider mismatch" />
    // @ts-expect-error SwitchDashlet rejects a string field at a direct JSX call site.
    ;<SwitchDashlet field={nexus.fields.text} id="switch-mismatch" label="Switch mismatch" />
    ;<SwitchDashlet
      // @ts-expect-error SwitchDashlet rejects a boolean|string field whose domain is wider than boolean.
      field={booleanOrStringField}
      id="switch-union-mismatch"
      label="Switch union mismatch"
    />
    ;<NumberDashlet
      // @ts-expect-error NumberDashlet rejects a number|string field whose domain is wider than number.
      field={numberOrStringField}
      id="number-union-mismatch"
      label="Number union mismatch"
    />
    ;<RangeDashlet
      // @ts-expect-error RangeDashlet rejects a range|string field whose domain is wider than the range value.
      field={rangeOrStringField}
      id="range-union-mismatch"
      label="Range union mismatch"
    />
    ;<SelectDashlet
      // @ts-expect-error incompatible field value.
      field={nexus.fields.number}
      id="select-mismatch"
      label="Select mismatch"
      options={['a', 'b']}
    />
    ;<SegmentedDashlet
      // @ts-expect-error incompatible field value.
      field={nexus.fields.number}
      id="segmented-mismatch"
      label="Segmented mismatch"
      options={['a', 'b']}
    />
    const wrongNumber: NumberDashletProps<typeof nexus.fields.text> = {
      id: 'wrong',
      // @ts-expect-error wrong field type is rejected by the explicit prop type.
      field: nexus.fields.text,
      label: 'Wrong',
    }
    void wrongNumber
    void createElement(TextDashlet, {
      id: 'bad',
      field: nexus.fields.text,
      label: 'Bad',
      // @ts-expect-error ready-made controls do not accept alternate value authorities.
      value: 'x',
    })
    const badChildren = createElement(TextDashlet, {
      id: 'bad-children',
      field: nexus.fields.text,
      label: 'Bad',
      // @ts-expect-error ready-made controls do not accept children.
      children: 'x',
    })
    void badChildren
  })
})
