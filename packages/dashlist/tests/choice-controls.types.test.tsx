import { createElement } from 'react'
import { createPicodashNexus } from '@picodash/nexus'
import {
  CheckboxDashlet,
  CheckboxGroupDashlet,
  ComboboxDashlet,
  MultiSelectDashlet,
  RadioGroupDashlet,
  SearchDashlet,
  type MultiSelectDashletProps,
  type RadioGroupDashletProps,
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

void createElement(CheckboxDashlet, {
  id: 'enabled',
  field: nexus.fields.enabled,
  label: 'Enabled',
})
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
