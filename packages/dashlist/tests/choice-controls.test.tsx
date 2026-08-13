// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import { fireEvent } from '@testing-library/react'
import { createPicodashNexus } from '@picodash/nexus'
import { createDomTestRenderer, type DomTestRenderer } from '../../../test/dom-renderer.ts'
import {
  CheckboxDashlet,
  CheckboxGroupDashlet,
  ComboboxDashlet,
  DashList,
  MultiSelectDashlet,
  RadioGroupDashlet,
  SearchDashlet,
} from '../src/index.tsx'
import { Checkbox, CheckboxGroup, RadioGroup } from '../src/ui.tsx'

function render(element: ReactElement): DomTestRenderer {
  let renderer!: DomTestRenderer
  act(() => {
    renderer = createDomTestRenderer(element)
  })
  return renderer
}

describe('choice controls', () => {
  it('renders six bound controls with accessible roles and forwards root refs', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        enabled: { defaultValue: true },
        choice: { defaultValue: 'one' },
        search: { defaultValue: '' },
        checked: { defaultValue: ['one'] },
        selected: { defaultValue: ['one'] },
      },
    })
    const refs = {
      checkbox: { current: null as HTMLDivElement | null },
      radio: { current: null as HTMLDivElement | null },
    }
    const view = render(
      createElement(
        DashList,
        { id: 'choices', nexus },
        createElement(CheckboxDashlet, {
          id: 'enabled',
          ref: refs.checkbox,
          field: nexus.fields.enabled,
          label: 'Enabled',
        }),
        createElement(RadioGroupDashlet, {
          id: 'choice',
          ref: refs.radio,
          field: nexus.fields.choice,
          label: 'Choice',
          options: ['one', 'two'],
        }),
        createElement(ComboboxDashlet, {
          id: 'combo',
          field: nexus.fields.choice,
          label: 'Combo',
          options: ['one', 'two'],
        }),
        createElement(CheckboxGroupDashlet, {
          id: 'checked',
          field: nexus.fields.checked,
          label: 'Checked',
          options: ['one', 'two'],
        }),
        createElement(MultiSelectDashlet, {
          id: 'selected',
          field: nexus.fields.selected,
          label: 'Selected',
          options: ['one', 'two'],
        }),
        createElement(SearchDashlet, {
          id: 'search',
          field: nexus.fields.search,
          label: 'Search',
        }),
      ),
    )
    expect(view.root.element.querySelectorAll('[role="listitem"]')).toHaveLength(6)
    expect(view.root.element.querySelector('input[type="checkbox"]')).not.toBeNull()
    expect(view.root.element.querySelector('[role="radiogroup"]')).not.toBeNull()
    expect(view.root.element.querySelector('[role="combobox"]')).not.toBeNull()
    expect(view.root.element.querySelector('input[type="search"]')).not.toBeNull()
    expect(refs.checkbox.current?.dataset.picodashDashlet).toBe('enabled')
    expect(refs.radio.current?.dataset.picodashDashlet).toBe('choice')
    act(() => view.unmount())
    nexus.destroy()
  })

  it('keeps incompatible canonical values visible as warnings and writes nothing', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        choice: { defaultValue: 'other' },
        selected: { defaultValue: ['other', 'one'] },
        checked: { defaultValue: ['other', 'one'] },
      },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'mismatch', nexus },
        createElement(RadioGroupDashlet, {
          id: 'choice',
          field: nexus.fields.choice,
          label: 'Choice',
          options: ['one', 'two'],
        }),
        createElement(MultiSelectDashlet, {
          id: 'selected',
          field: nexus.fields.selected,
          label: 'Selected',
          options: ['one', 'two'],
        }),
        createElement(CheckboxGroupDashlet, {
          id: 'checkbox-group',
          field: nexus.fields.checked,
          label: 'Checked',
          options: ['one', 'two'],
        }),
      ),
    )
    expect(view.root.element.textContent).toContain(
      'The current value (other) is not in the configured choices.',
    )
    expect(view.root.element.textContent).toContain('["other","one"]')
    expect(
      view.root.element.querySelectorAll('[data-picodash-dashlet-presentation-warning]'),
    ).toHaveLength(3)
    expect(view.root.element.querySelector('[aria-invalid]')).toBeNull()
    expect(
      view.root.element.querySelector('[data-picodash-dashlet="selected"] [data-disabled]'),
    ).not.toBeNull()
    expect(
      view.root.element.querySelector('[data-picodash-dashlet="checkbox-group"] [data-disabled]'),
    ).not.toBeNull()
    expect(nexus.getState().values).toEqual({
      choice: 'other',
      selected: ['other', 'one'],
      checked: ['other', 'one'],
    })
    act(() => view.unmount())
    nexus.destroy()
  })

  it('preserves strict primitive identity and validates option declarations', () => {
    const view = render(
      createElement(Checkbox, {
        'aria-label': 'Strict',
        isSelected: false,
        onChange: () => undefined,
      }),
    )
    expect(view.root.element.querySelector('input[type="checkbox"]')).not.toBeNull()
    act(() => view.unmount())
  })

  it('emits one ordered array write and scalar writes from unbound controls', () => {
    const scalar: string[] = []
    const arrays: string[][] = []
    let selected: readonly string[] = ['one']
    const view = render(
      createElement(
        'div',
        null,
        createElement(RadioGroup, {
          'aria-label': 'Mode',
          value: 'one',
          onChange: (next) => scalar.push(String(next)),
          options: ['one', 'two'],
        }),
        createElement(CheckboxGroup, {
          'aria-label': 'Modes',
          value: selected,
          onChange: (next) => {
            selected = next.map(String)
            arrays.push(next.map(String))
          },
          options: ['one', 'two'],
        }),
      ),
    )
    const radio = view.root.element.querySelectorAll('input[type="radio"]')[1]
    const checkbox = view.root.element.querySelectorAll('input[type="checkbox"]')[1]
    act(() => {
      fireEvent.click(radio)
      fireEvent.click(checkbox)
    })
    expect(scalar).toEqual(['two'])
    expect(arrays).toEqual([['one', 'two']])
    expect(selected).toEqual(['one', 'two'])
    act(() => view.unmount())
  })
})
