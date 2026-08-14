import { createElement, type ComponentProps } from 'react'
import { describe, expectTypeOf, it } from 'vite-plus/test'
import {
  createPicodashNexus,
  type PicodashExactFieldOf,
  type PicodashField,
  type PicodashFieldOf,
} from '@picodash/nexus'
import {
  CheckboxDashlet,
  CheckboxGroupDashlet,
  ComboboxDashlet,
  MultiSelectDashlet,
  RadioGroupDashlet,
  SearchDashlet,
  type MultiSelectDashletProps,
  type RadioGroupDashletProps,
  type CheckboxDashletProps,
  type CheckboxGroupDashletProps,
  type ComboboxDashletProps,
  type SearchDashletProps,
} from '../src/index.tsx'
import {
  Checkbox,
  CheckboxGroup,
  Combobox,
  MultiSelect,
  RadioGroup,
  SearchField,
} from '../src/ui.tsx'

const fixedTupleSchema = {
  '~standard': {
    version: 1 as const,
    vendor: 'picodash-test',
    validate(value: unknown) {
      return Array.isArray(value) && value.length === 2 && value[0] === 'one' && value[1] === 'two'
        ? { value: ['one', 'two'] as const }
        : { issues: [{ message: 'Expected the fixed tuple.' }] }
    },
  },
}

const nexus = createPicodashNexus({
  valueOwner: 'nexus',
  fields: {
    enabled: { defaultValue: false },
    choice: { defaultValue: 'one' },
    selected: { defaultValue: ['one'] },
    numericSelected: { defaultValue: [1] },
    tupleSelected: {
      defaultValue: ['one', 'two'] as const,
      schema: fixedTupleSchema,
    },
    search: { defaultValue: '' },
  },
})
type CompatibilityValues = {
  readonly booleanOrString: boolean | string
  readonly choiceUnion: string | number
  readonly mixedArray: readonly (string | number)[]
}
const booleanOrStringField = null as unknown as PicodashField<
  CompatibilityValues,
  'booleanOrString'
>
const choiceUnionField = null as unknown as PicodashField<CompatibilityValues, 'choiceUnion'>
const mixedArrayField = null as unknown as PicodashField<CompatibilityValues, 'mixedArray'>
const nonEmptyArrayField = null as unknown as PicodashExactFieldOf<readonly [string, ...string[]]>
const narrowBooleanField = null as unknown as PicodashExactFieldOf<true>
const narrowStringField = null as unknown as PicodashExactFieldOf<'fixed'>
const anyField = null as any

describe('@picodash/dashlist choice control types', () => {
  it('accepts choice control props and rejects invalid bindings', () => {
    type ExtractedChoiceFields = {
      readonly checkbox: ComponentProps<typeof CheckboxDashlet>['field']
      readonly radio: ComponentProps<typeof RadioGroupDashlet>['field']
      readonly combobox: ComponentProps<typeof ComboboxDashlet>['field']
      readonly checkboxGroup: ComponentProps<typeof CheckboxGroupDashlet>['field']
      readonly multiSelect: ComponentProps<typeof MultiSelectDashlet>['field']
      readonly search: ComponentProps<typeof SearchDashlet>['field']
    }
    type AliasChoiceFields = {
      readonly checkbox: CheckboxDashletProps['field']
      readonly radio: RadioGroupDashletProps['field']
      readonly combobox: ComboboxDashletProps['field']
      readonly checkboxGroup: CheckboxGroupDashletProps['field']
      readonly multiSelect: MultiSelectDashletProps['field']
      readonly search: SearchDashletProps['field']
    }
    type ForbiddenShellProp<Props> = Props extends unknown
      ? Extract<keyof Props, 'defaultValue' | 'onChange'>
      : never
    type ChoiceReadyMadeProps =
      | CheckboxDashletProps
      | RadioGroupDashletProps
      | ComboboxDashletProps
      | CheckboxGroupDashletProps
      | MultiSelectDashletProps
      | SearchDashletProps
    expectTypeOf<ForbiddenShellProp<ChoiceReadyMadeProps>>().toEqualTypeOf<never>()
    const extractedChoiceFields: ExtractedChoiceFields = {
      checkbox: nexus.fields.enabled,
      radio: nexus.fields.choice,
      combobox: nexus.fields.choice,
      checkboxGroup: nexus.fields.selected,
      multiSelect: nexus.fields.selected,
      search: nexus.fields.search,
    }
    expectTypeOf<ExtractedChoiceFields>().toEqualTypeOf<AliasChoiceFields>()
    void extractedChoiceFields

    void createElement(CheckboxDashlet, {
      id: 'enabled',
      field: nexus.fields.enabled,
      label: 'Enabled',
    })

    const checkboxProps: CheckboxDashletProps<typeof nexus.fields.enabled> = {
      id: 'checkbox-props',
      field: nexus.fields.enabled,
      label: 'Enabled',
      // @ts-expect-error Explicit aliases do not expose inherited HTML default values.
      defaultValue: 'ignored',
    }
    const checkboxGroupProps: CheckboxGroupDashletProps<string, typeof nexus.fields.selected> = {
      id: 'checkbox-group-props',
      field: nexus.fields.selected,
      label: 'Selected',
      options: ['one', 'two'],
    }
    const comboboxProps: ComboboxDashletProps<string, typeof nexus.fields.choice> = {
      id: 'combobox-props',
      field: nexus.fields.choice,
      label: 'Choice',
      options: ['one', 'two'],
      placeholder: 'Choose',
    }
    const searchProps: SearchDashletProps<typeof nexus.fields.search> = {
      id: 'search-props',
      field: nexus.fields.search,
      label: 'Search',
      placeholder: 'Find',
    }
    const radioProps: RadioGroupDashletProps<string, typeof nexus.fields.choice> = {
      id: 'radio-props',
      field: nexus.fields.choice,
      label: 'Choice',
      options: ['one', 'two'],
    }
    const multiSelectProps: MultiSelectDashletProps<string, typeof nexus.fields.selected> = {
      id: 'multi-select-props',
      field: nexus.fields.selected,
      label: 'Selected',
      options: ['one', 'two'],
    }
    void checkboxProps
    void checkboxGroupProps
    void comboboxProps
    void searchProps
    void radioProps
    void multiSelectProps

    const checkboxAliasProps: CheckboxDashletProps = {
      id: 'checkbox-alias',
      field: nexus.fields.enabled,
      label: 'Checkbox alias',
    }
    const wrongCheckboxAliasProps: CheckboxDashletProps = {
      id: 'wrong-checkbox-alias',
      // @ts-expect-error unspecialized aliases retain the boolean field constraint.
      field: nexus.fields.choice,
      label: 'Wrong checkbox alias',
    }
    const anyCheckboxAliasProps: CheckboxDashletProps<any> = {
      id: 'any-checkbox-alias',
      // @ts-expect-error explicitly specializing the field to any fails closed.
      field: nexus.fields.enabled,
      label: 'Any checkbox alias',
    }
    const anyRadioAliasProps: RadioGroupDashletProps<string, any> = {
      id: 'any-radio-alias',
      // @ts-expect-error explicitly specializing a scalar choice field to any fails closed.
      field: nexus.fields.choice,
      label: 'Any radio alias',
      options: ['one'],
    }
    const anyMultiAliasProps: MultiSelectDashletProps<string, any> = {
      id: 'any-multi-alias',
      // @ts-expect-error explicitly specializing an array choice field to any fails closed.
      field: nexus.fields.selected,
      label: 'Any multi alias',
      options: ['one'],
    }
    // @ts-expect-error explicitly specializing the field to never fails closed.
    const neverSearchAliasProps: SearchDashletProps<never> = {
      id: 'never-search-alias',
      field: nexus.fields.search,
      label: 'Never search alias',
    }
    const extractedRadioProps: ComponentProps<typeof RadioGroupDashlet> = {
      id: 'extracted-radio',
      field: nexus.fields.choice,
      label: 'Extracted radio',
      options: ['one', 'two'],
      // @ts-expect-error ComponentProps does not restore inherited HTML change handlers.
      onChange: () => undefined,
    }
    const wrongExtractedRadioProps: ComponentProps<typeof RadioGroupDashlet> = {
      id: 'wrong-extracted-radio',
      // @ts-expect-error ComponentProps retains the primitive choice field constraint.
      field: nexus.fields.enabled,
      label: 'Wrong extracted radio',
      options: ['one', 'two'],
    }
    const unionExtractedRadioProps: ComponentProps<typeof RadioGroupDashlet> = {
      id: 'union-extracted-radio',
      // @ts-expect-error ComponentProps rejects over-wide mixed primitive choice domains.
      field: choiceUnionField,
      label: 'Union extracted radio',
      options: ['one', 'two'],
    }
    const extractedMultiProps: ComponentProps<typeof MultiSelectDashlet> = {
      id: 'extracted-multi',
      field: nexus.fields.selected,
      label: 'Extracted multi',
      options: ['one', 'two'],
    }
    const wrongExtractedMultiProps: ComponentProps<typeof MultiSelectDashlet> = {
      id: 'wrong-extracted-multi',
      // @ts-expect-error ComponentProps rejects over-wide mixed primitive array domains.
      field: mixedArrayField,
      label: 'Wrong extracted multi',
      options: ['one', 'two'],
    }
    // @ts-expect-error unspecialized MultiSelect props correlate number arrays with number options.
    const numericMultiWithStringOptions: ComponentProps<typeof MultiSelectDashlet> = {
      id: 'numeric-multi-string-options',
      field: nexus.fields.numericSelected,
      label: 'Numeric multi with string options',
      options: ['one', 'two'],
    }
    // @ts-expect-error unspecialized MultiSelect props correlate string arrays with string options.
    const stringMultiWithNumberOptions: ComponentProps<typeof MultiSelectDashlet> = {
      id: 'string-multi-number-options',
      field: nexus.fields.selected,
      label: 'String multi with number options',
      options: [1, 2],
    }
    void checkboxAliasProps
    void wrongCheckboxAliasProps
    void anyCheckboxAliasProps
    void anyRadioAliasProps
    void anyMultiAliasProps
    void neverSearchAliasProps
    void extractedRadioProps
    void wrongExtractedRadioProps
    void unionExtractedRadioProps
    void extractedMultiProps
    void wrongExtractedMultiProps
    void numericMultiWithStringOptions
    void stringMultiWithNumberOptions

    function RadioWrapper<F extends PicodashFieldOf<string>>(
      props: RadioGroupDashletProps<string, F>,
    ) {
      return <RadioGroupDashlet<string, F> {...props} />
    }
    ;<RadioWrapper
      id="wrapped-radio"
      field={nexus.fields.choice}
      label="Wrapped radio"
      options={['one', 'two']}
      // @ts-expect-error Generic wrappers preserve the ready-made shell exclusions.
      defaultValue="one"
    />
    void createElement(RadioGroupDashlet, {
      id: 'explicit-radio-element',
      field: nexus.fields.choice,
      label: 'Explicit radio element',
      options: ['one', 'two'],
    })
    void createElement(RadioGroupDashlet<string, typeof nexus.fields.choice>, {
      id: 'choice',
      field: nexus.fields.choice,
      label: 'Choice',
      options: ['one', 'two'],
      orientation: 'horizontal',
    })
    void createElement(ComboboxDashlet, {
      id: 'combo',
      field: nexus.fields.choice,
      label: 'Combo',
      options: ['one', 'two'],
      placeholder: 'Choose',
    })
    void createElement(CheckboxGroupDashlet, {
      id: 'checked',
      field: nexus.fields.selected,
      label: 'Checked',
      options: ['one', 'two'],
    })
    void createElement(MultiSelectDashlet, {
      id: 'selected',
      field: nexus.fields.selected,
      label: 'Selected',
      options: ['one', 'two'],
      placeholder: 'Choose',
    })
    void createElement(SearchDashlet, {
      id: 'search',
      field: nexus.fields.search,
      label: 'Search',
      // @ts-expect-error Ready-made Dashlets do not expose inherited HTML change handlers.
      onChange: () => undefined,
    })

    ;<RadioGroupDashlet
      id="radio-default-value"
      field={nexus.fields.choice}
      label="Radio default value"
      options={['one', 'two']}
      // @ts-expect-error Ready-made Dashlets do not expose inherited HTML default values.
      defaultValue="one"
    />

    // @ts-expect-error CheckboxDashlet rejects a string field at a direct JSX call site.
    ;<CheckboxDashlet field={nexus.fields.choice} id="checkbox-mismatch" label="Mismatch" />
    ;<CheckboxDashlet
      // @ts-expect-error CheckboxDashlet rejects a boolean|string field whose domain is wider than boolean.
      field={booleanOrStringField}
      id="checkbox-union-mismatch"
      label="Union mismatch"
    />
    // @ts-expect-error CheckboxDashlet can emit false outside a true-only field domain.
    ;<CheckboxDashlet field={narrowBooleanField} id="checkbox-narrow" label="Narrow checkbox" />
    void createElement(RadioGroupDashlet, {
      id: 'choice-narrow-options',
      field: nexus.fields.choice,
      label: 'Choice narrow options',
      options: ['one', 'two'] as const,
    })
    ;<RadioGroupDashlet
      // @ts-expect-error incompatible field value.
      field={nexus.fields.enabled}
      id="radio-mismatch"
      label="Mismatch"
      options={['one', 'two']}
    />
    ;<RadioGroupDashlet
      // @ts-expect-error mixed scalar fields cannot bind to one primitive choice domain.
      field={choiceUnionField}
      id="radio-union-mismatch"
      label="Union mismatch"
      options={['one']}
    />
    ;<ComboboxDashlet
      // @ts-expect-error incompatible field value.
      field={nexus.fields.enabled}
      id="combobox-mismatch"
      label="Mismatch"
      options={['one', 'two']}
    />
    ;<CheckboxGroupDashlet
      // @ts-expect-error mixed string|number arrays cannot bind to a single choice element domain.
      field={mixedArrayField}
      id="checkbox-group-array-union-mismatch"
      label="Array union mismatch"
      options={['one']}
    />
    ;<CheckboxGroupDashlet
      // @ts-expect-error incompatible field value.
      field={nexus.fields.choice}
      id="checkbox-group-mismatch"
      label="Mismatch"
      options={['one', 'two']}
    />
    ;<CheckboxGroupDashlet
      // @ts-expect-error array-choice controls can emit subsets that a fixed tuple field rejects.
      field={nexus.fields.tupleSelected}
      id="checkbox-group-tuple-mismatch"
      label="Tuple mismatch"
      options={['one', 'two']}
    />
    ;<MultiSelectDashlet
      // @ts-expect-error incompatible field value.
      field={nexus.fields.choice}
      id="multi-select-mismatch"
      label="Mismatch"
      options={['one', 'two']}
    />
    ;<MultiSelectDashlet
      // @ts-expect-error mixed string|number arrays cannot bind to a single choice element domain.
      field={mixedArrayField}
      id="multi-select-array-union-mismatch"
      label="Array union mismatch"
      options={['one']}
    />
    ;<MultiSelectDashlet
      // @ts-expect-error array-choice controls can emit an empty array that a non-empty field rejects.
      field={nonEmptyArrayField}
      id="multi-select-non-empty-mismatch"
      label="Non-empty mismatch"
      options={['one', 'two']}
    />
    void createElement(MultiSelectDashlet, {
      id: 'multi-select-tuple-element',
      // @ts-expect-error unannotated createElement rejects Standard Schema tuple fields.
      field: nexus.fields.tupleSelected,
      label: 'Tuple element mismatch',
      options: [],
    })
    const tupleExtractedCheckboxProps: ComponentProps<typeof CheckboxGroupDashlet> = {
      id: 'checkbox-group-tuple-extracted',
      // @ts-expect-error ComponentProps rejects Standard Schema tuple fields.
      field: nexus.fields.tupleSelected,
      label: 'Tuple extracted mismatch',
      options: ['one', 'two'],
    }
    void tupleExtractedCheckboxProps
    // `any` deliberately escapes the concrete fallback overload used by ComponentProps/createElement.
    void anyField
    // @ts-expect-error SearchDashlet rejects a boolean field at a direct JSX call site.
    ;<SearchDashlet field={nexus.fields.enabled} id="search-mismatch" label="Mismatch" />
    // @ts-expect-error SearchDashlet can emit strings outside a literal field domain.
    ;<SearchDashlet field={narrowStringField} id="search-narrow" label="Narrow search" />
    const narrowExtractedSearchProps: ComponentProps<typeof SearchDashlet> = {
      id: 'narrow-extracted-search',
      // @ts-expect-error ComponentProps rejects narrowed writable string fields.
      field: narrowStringField,
      label: 'Narrow extracted search',
    }
    void narrowExtractedSearchProps
    void createElement(CheckboxDashlet, {
      id: 'narrow-checkbox-element',
      // @ts-expect-error unannotated createElement rejects narrowed writable boolean fields.
      field: narrowBooleanField,
      label: 'Narrow checkbox element',
    })

    void createElement(Checkbox, { isSelected: false, onChange: () => undefined })
    void createElement(RadioGroup, {
      value: 'one',
      onChange: () => undefined,
      options: ['one', 'two'],
    })
    void createElement(Combobox, {
      value: 'one',
      onChange: () => undefined,
      options: ['one', 'two'],
    })
    void createElement(CheckboxGroup, {
      value: ['one'],
      onChange: () => undefined,
      options: ['one', 'two'],
    })
    void createElement(MultiSelect, {
      value: ['one'],
      onChange: () => undefined,
      options: ['one', 'two'],
    })
    void createElement(SearchField, { value: '', onChange: () => undefined })

    // @ts-expect-error explicit choice aliases reject boolean field specializations.
    const wrongRadio: RadioGroupDashletProps<'one', typeof nexus.fields.enabled> = {
      id: 'wrong',
      field: nexus.fields.enabled,
      label: 'Wrong',
      options: ['one'],
    }
    void wrongRadio
    // @ts-expect-error explicit array-choice aliases reject scalar field specializations.
    const wrongMulti: MultiSelectDashletProps<'one', typeof nexus.fields.choice> = {
      id: 'wrong-array',
      field: nexus.fields.choice,
      label: 'Wrong',
      options: ['one'],
    }
    void wrongMulti
    void createElement(SearchDashlet, {
      id: 'bad',
      field: nexus.fields.search,
      label: 'Bad',
      // @ts-expect-error bound controls do not accept alternate value authorities.
      value: '',
    })
    void createElement(CheckboxDashlet, {
      id: 'bad-children',
      field: nexus.fields.enabled,
      label: 'Bad',
      // @ts-expect-error bound controls do not accept children.
      children: 'x',
    })
    void createElement(RadioGroupDashlet<string, typeof nexus.fields.choice>, {
      id: 'bad-focus',
      field: nexus.fields.choice,
      label: 'Bad focus',
      options: ['one'],
      // @ts-expect-error built-in Dashlets do not expose primaryFocusRef overrides.
      primaryFocusRef: { current: null },
    })
  })
})
