import { createElement, createRef, type ComponentProps } from 'react'
import { describe, expectTypeOf, it } from 'vite-plus/test'
import {
  createPicodashNexus,
  type PicodashExactFieldOf,
  type PicodashField,
  type PicodashFieldOf,
  type PicodashJsonValue,
} from '@picodash/nexus'
import {
  DisplayDashlet,
  NumberDashlet,
  RangeDashlet,
  SegmentedDashlet,
  SelectDashlet,
  SliderDashlet,
  SwitchDashlet,
  TextDashlet,
  type DisplayDashletProps,
  type NumberDashletProps,
  type SegmentedDashletProps,
  type SelectDashletProps,
  type SliderDashletProps,
  type SwitchDashletProps,
  type TextDashletProps,
} from '../src/index.tsx'

const nexus = createPicodashNexus({
  valueOwner: 'nexus',
  fields: {
    text: { defaultValue: '' },
    number: { defaultValue: 1 },
    enabled: { defaultValue: false },
    choice: { defaultValue: 'a' },
    numericChoice: { defaultValue: 1 },
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
const anyField = null as any
const unresolvedField = null as unknown as PicodashField<Record<string, PicodashJsonValue>, string>
const unionKeyField = null as unknown as PicodashField<
  { readonly first: number; readonly second: number },
  'first' | 'second'
>
const narrowStringField = null as unknown as PicodashExactFieldOf<'fixed'>
const narrowNumberField = null as unknown as PicodashExactFieldOf<1 | 2>
const narrowBooleanField = null as unknown as PicodashExactFieldOf<true>
describe('@picodash/dashlist ready-made control types', () => {
  it('accepts ready-made control props and rejects invalid overrides', () => {
    type ExtractedBasicFields = {
      readonly text: ComponentProps<typeof TextDashlet>['field']
      readonly number: ComponentProps<typeof NumberDashlet>['field']
      readonly slider: ComponentProps<typeof SliderDashlet>['field']
      readonly switch: ComponentProps<typeof SwitchDashlet>['field']
      readonly select: ComponentProps<typeof SelectDashlet>['field']
      readonly segmented: ComponentProps<typeof SegmentedDashlet>['field']
      readonly display: ComponentProps<typeof DisplayDashlet>['field']
    }
    type AliasBasicFields = {
      readonly text: TextDashletProps['field']
      readonly number: NumberDashletProps['field']
      readonly slider: SliderDashletProps['field']
      readonly switch: SwitchDashletProps['field']
      readonly select: SelectDashletProps['field']
      readonly segmented: SegmentedDashletProps['field']
      readonly display: DisplayDashletProps['field']
    }
    type ForbiddenShellProp<Props> = Props extends unknown
      ? Extract<keyof Props, 'defaultValue' | 'onChange'>
      : never
    type BasicReadyMadeProps =
      | TextDashletProps
      | NumberDashletProps
      | SliderDashletProps
      | SwitchDashletProps
      | SelectDashletProps
      | SegmentedDashletProps
      | DisplayDashletProps
    expectTypeOf<ForbiddenShellProp<BasicReadyMadeProps>>().toEqualTypeOf<never>()
    const extractedBasicFields: ExtractedBasicFields = {
      text: nexus.fields.text,
      number: nexus.fields.number,
      slider: nexus.fields.number,
      switch: nexus.fields.enabled,
      select: nexus.fields.choice,
      segmented: nexus.fields.choice,
      display: nexus.fields.object,
    }
    expectTypeOf<ExtractedBasicFields>().toEqualTypeOf<AliasBasicFields>()
    void extractedBasicFields

    const ref = createRef<HTMLDivElement>()
    void createElement(TextDashlet, {
      id: 'text',
      field: nexus.fields.text,
      label: 'Text',
      ref,
    })
    void createElement(NumberDashlet, {
      id: 'number',
      field: nexus.fields.number,
      label: 'Number',
      // @ts-expect-error Ready-made Dashlets do not expose inherited HTML default values.
      defaultValue: 2,
    })
    void createElement(SliderDashlet, {
      id: 'slider',
      field: nexus.fields.number,
      label: 'Slider',
    })
    void createElement(SelectDashlet, {
      id: 'choice',
      field: nexus.fields.choice,
      label: 'Choice',
      options: ['a', 'b'],
    })
    void createElement(SegmentedDashlet<string, typeof nexus.fields.choice>, {
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
    })
    void createElement(DisplayDashlet, {
      id: 'display-object',
      field: nexus.fields.object,
      label: 'Display object',
    })
    ;<DisplayDashlet
      id="display-array"
      field={nexus.fields.array}
      label="Display array"
      formatValue={(value) => value.map((item) => item.id).join(', ')}
    />
    ;<TextDashlet
      id="text-on-change"
      field={nexus.fields.text}
      label="Text on change"
      // @ts-expect-error Ready-made Dashlets do not expose inherited HTML change handlers.
      onChange={() => undefined}
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
    // @ts-expect-error TextDashlet can emit strings outside a literal field domain.
    ;<TextDashlet field={narrowStringField} id="text-narrow" label="Narrow text" />
    // @ts-expect-error NumberDashlet can emit numbers outside a literal field domain.
    ;<NumberDashlet field={narrowNumberField} id="number-narrow" label="Narrow number" />
    // @ts-expect-error SliderDashlet can emit numbers outside a literal field domain.
    ;<SliderDashlet field={narrowNumberField} id="slider-narrow" label="Narrow slider" />
    // @ts-expect-error SwitchDashlet can emit false outside a true-only field domain.
    ;<SwitchDashlet field={narrowBooleanField} id="switch-narrow" label="Narrow switch" />
    ;<RangeDashlet
      // @ts-expect-error RangeDashlet rejects a range|string field whose domain is wider than the range value.
      field={rangeOrStringField}
      id="range-union-mismatch"
      label="Range union mismatch"
    />
    // `any` deliberately escapes the concrete React fallback overload.
    ;<NumberDashlet field={anyField} id="number-any" label="Number any" />
    // @ts-expect-error unresolved record fields fail closed even when their value union includes numbers.
    ;<NumberDashlet field={unresolvedField} id="number-unresolved" label="Number unresolved" />
    ;<DisplayDashlet field={unresolvedField} id="display-unresolved" label="Display unresolved" />
    ;<NumberDashlet field={unionKeyField} id="number-union-key" label="Number union key" />
    // @ts-expect-error SelectDashlet rejects string options paired with a number field.
    ;<SelectDashlet
      field={nexus.fields.number}
      id="select-mismatch"
      label="Select mismatch"
      options={['a', 'b']}
    />
    // @ts-expect-error SegmentedDashlet rejects string options paired with a number field.
    ;<SegmentedDashlet
      field={nexus.fields.number}
      id="segmented-mismatch"
      label="Segmented mismatch"
      options={['a', 'b']}
    />
    // @ts-expect-error incompatible fields do not satisfy the numeric prop alias constraint.
    const wrongNumber: NumberDashletProps<typeof nexus.fields.text> = {
      id: 'wrong',
      field: nexus.fields.text,
      label: 'Wrong',
    }
    void wrongNumber
    const textProps: TextDashletProps<typeof nexus.fields.text> = {
      id: 'text-props',
      field: nexus.fields.text,
      label: 'Text',
      // @ts-expect-error Explicit aliases do not expose inherited HTML change handlers.
      onChange: () => undefined,
    }
    const sliderProps: SliderDashletProps<typeof nexus.fields.number> = {
      id: 'slider-props',
      field: nexus.fields.number,
      label: 'Slider',
    }
    const switchNexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { enabled: { defaultValue: false } },
    })
    const switchProps: SwitchDashletProps<typeof switchNexus.fields.enabled> = {
      id: 'switch-props',
      field: switchNexus.fields.enabled,
      label: 'Switch',
    }
    const selectProps: SelectDashletProps<string, typeof nexus.fields.choice> = {
      id: 'select-props',
      field: nexus.fields.choice,
      label: 'Select',
      options: ['a', 'b'],
    }
    const segmentedProps: SegmentedDashletProps<string, typeof nexus.fields.choice> = {
      id: 'segmented-props',
      field: nexus.fields.choice,
      label: 'Segmented',
      options: ['a', 'b'],
    }
    const displayProps: DisplayDashletProps<typeof nexus.fields.object> = {
      id: 'display-props',
      field: nexus.fields.object,
      label: 'Display',
      formatValue: (value) => value.count,
    }
    void textProps
    void sliderProps
    void switchProps
    void selectProps
    void segmentedProps
    void displayProps

    const numberAliasProps: NumberDashletProps = {
      id: 'number-alias',
      field: nexus.fields.number,
      label: 'Number alias',
    }
    const wrongNumberAliasProps: NumberDashletProps = {
      id: 'wrong-number-alias',
      // @ts-expect-error unspecialized aliases retain the numeric field constraint.
      field: nexus.fields.text,
      label: 'Wrong number alias',
    }
    const anyNumberAliasProps: NumberDashletProps<any> = {
      id: 'any-number-alias',
      // @ts-expect-error explicitly specializing the field to any fails closed.
      field: nexus.fields.number,
      label: 'Any number alias',
    }
    // @ts-expect-error explicitly specializing the field to never fails closed.
    const neverNumberAliasProps: NumberDashletProps<never> = {
      id: 'never-number-alias',
      field: nexus.fields.number,
      label: 'Never number alias',
    }
    const extractedNumberProps: ComponentProps<typeof NumberDashlet> = {
      id: 'extracted-number',
      field: nexus.fields.number,
      label: 'Extracted number',
      // @ts-expect-error ComponentProps does not restore inherited HTML change handlers.
      onChange: () => undefined,
    }
    const wrongExtractedNumberProps: ComponentProps<typeof NumberDashlet> = {
      id: 'wrong-extracted-number',
      // @ts-expect-error ComponentProps retains the numeric field constraint.
      field: nexus.fields.text,
      label: 'Wrong extracted number',
    }
    const narrowExtractedNumberProps: ComponentProps<typeof NumberDashlet> = {
      id: 'narrow-extracted-number',
      // @ts-expect-error ComponentProps rejects narrowed writable numeric fields.
      field: narrowNumberField,
      label: 'Narrow extracted number',
    }
    const extractedSelectProps: ComponentProps<typeof SelectDashlet> = {
      id: 'extracted-select',
      field: nexus.fields.choice,
      label: 'Extracted select',
      options: ['a', 'b'],
    }
    // @ts-expect-error unspecialized Select props correlate number fields with number options.
    const numericSelectWithStringOptions: ComponentProps<typeof SelectDashlet> = {
      id: 'numeric-select-string-options',
      field: nexus.fields.numericChoice,
      label: 'Numeric select with string options',
      options: ['a', 'b'],
    }
    // @ts-expect-error unspecialized Select props correlate string fields with string options.
    const stringSelectWithNumberOptions: ComponentProps<typeof SelectDashlet> = {
      id: 'string-select-number-options',
      field: nexus.fields.choice,
      label: 'String select with number options',
      options: [1, 2],
    }
    const wrongExtractedSelectProps: ComponentProps<typeof SelectDashlet> = {
      id: 'wrong-extracted-select',
      // @ts-expect-error ComponentProps rejects fields outside the primitive choice domain.
      field: switchNexus.fields.enabled,
      label: 'Wrong extracted select',
      options: ['a', 'b'],
    }
    const extractedDisplayProps: ComponentProps<typeof DisplayDashlet> = {
      id: 'extracted-display',
      field: nexus.fields.object,
      label: 'Extracted display',
    }
    void numberAliasProps
    void wrongNumberAliasProps
    void anyNumberAliasProps
    void neverNumberAliasProps
    void extractedNumberProps
    void wrongExtractedNumberProps
    void narrowExtractedNumberProps
    void extractedSelectProps
    void numericSelectWithStringOptions
    void stringSelectWithNumberOptions
    void wrongExtractedSelectProps
    void extractedDisplayProps

    function NumberWrapper<F extends PicodashFieldOf<number>>(props: NumberDashletProps<F>) {
      return <NumberDashlet<F> {...props} />
    }
    ;<NumberWrapper id="wrapped-number" field={nexus.fields.number} label="Wrapped number" />
    ;<NumberWrapper
      id="wrapped-number-default"
      field={nexus.fields.number}
      label="Wrapped number default"
      // @ts-expect-error Generic wrappers preserve the ready-made shell exclusions.
      defaultValue={2}
    />
    void createElement(NumberDashlet<typeof nexus.fields.number>, {
      id: 'explicit-number-element',
      field: nexus.fields.number,
      label: 'Explicit number element',
    })
    void createElement(TextDashlet, {
      id: 'narrow-text-element',
      // @ts-expect-error unannotated createElement rejects narrowed writable string fields.
      field: narrowStringField,
      label: 'Narrow text element',
    })
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
    switchNexus.destroy()
  })
})
