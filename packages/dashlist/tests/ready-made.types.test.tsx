import { createElement } from 'react'
import { createPicodashNexus } from '@picodash/nexus'
import {
  DisplayDashlet,
  NumberDashlet,
  SelectDashlet,
  SliderDashlet,
  TextDashlet,
  type NumberDashletProps,
} from '../src/index.tsx'

const nexus = createPicodashNexus({
  valueOwner: 'nexus',
  fields: {
    text: { defaultValue: '' },
    number: { defaultValue: 1 },
    choice: { defaultValue: 'a' },
  },
})
void createElement(TextDashlet, { id: 'text', field: nexus.fields.text, label: 'Text' })
void createElement(NumberDashlet, { id: 'number', field: nexus.fields.number, label: 'Number' })
void createElement(SliderDashlet, { id: 'slider', field: nexus.fields.number, label: 'Slider' })
void createElement(SelectDashlet, {
  id: 'choice',
  field: nexus.fields.choice,
  label: 'Choice',
  options: ['a', 'b'],
})
void createElement(DisplayDashlet, { id: 'display', field: nexus.fields.number, label: 'Display' })

const wrongNumber: NumberDashletProps<typeof nexus.fields.text> = {
  id: 'wrong',
  // @ts-expect-error wrong field type is rejected by the explicit prop type.
  field: nexus.fields.text,
  label: 'Wrong',
}
void wrongNumber
// @ts-expect-error ready-made controls do not accept alternate value authorities
void createElement(TextDashlet, { id: 'bad', field: nexus.fields.text, label: 'Bad', value: 'x' })
const badChildren = createElement(TextDashlet, {
  id: 'bad-children',
  field: nexus.fields.text,
  label: 'Bad',
  // @ts-expect-error ready-made controls do not accept children
  children: 'x',
})
void badChildren
