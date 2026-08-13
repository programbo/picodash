import { createElement } from 'react'
import { describe, it } from 'vite-plus/test'
import { createPicodashNexus, type PicodashField } from '@picodash/nexus'
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

const nexus = createPicodashNexus({
  valueOwner: 'nexus',
  fields: {
    enabled: { defaultValue: false },
    choice: { defaultValue: 'one' },
    selected: { defaultValue: ['one'] },
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

describe('@picodash/dashlist choice control types', () => {
  it('accepts choice control props and rejects invalid bindings', () => {
    void createElement(CheckboxDashlet, {
      id: 'enabled',
      field: nexus.fields.enabled,
      label: 'Enabled',
    })

    const checkboxProps: CheckboxDashletProps<typeof nexus.fields.enabled> = {
      id: 'checkbox-props',
      field: nexus.fields.enabled,
      label: 'Enabled',
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
    void checkboxProps
    void checkboxGroupProps
    void comboboxProps
    void searchProps
    void createElement(RadioGroupDashlet, {
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
    })

    // @ts-expect-error CheckboxDashlet rejects a string field at a direct JSX call site.
    ;<CheckboxDashlet field={nexus.fields.choice} id="checkbox-mismatch" label="Mismatch" />
    ;<CheckboxDashlet
      // @ts-expect-error CheckboxDashlet rejects a boolean|string field whose domain is wider than boolean.
      field={booleanOrStringField}
      id="checkbox-union-mismatch"
      label="Union mismatch"
    />
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
    // @ts-expect-error SearchDashlet rejects a boolean field at a direct JSX call site.
    ;<SearchDashlet field={nexus.fields.enabled} id="search-mismatch" label="Mismatch" />

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

    const wrongRadio: RadioGroupDashletProps<'one', typeof nexus.fields.enabled> = {
      id: 'wrong',
      // @ts-expect-error boolean fields reject string choice Dashlets.
      field: nexus.fields.enabled,
      label: 'Wrong',
      options: ['one'],
    }
    void wrongRadio
    const wrongMulti: MultiSelectDashletProps<'one', typeof nexus.fields.choice> = {
      id: 'wrong-array',
      // @ts-expect-error scalar fields reject array choice Dashlets.
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
    void createElement(RadioGroupDashlet, {
      id: 'bad-focus',
      field: nexus.fields.choice,
      label: 'Bad focus',
      options: ['one'],
      // @ts-expect-error built-in Dashlets do not expose primaryFocusRef overrides.
      primaryFocusRef: { current: null },
    })
  })
})
