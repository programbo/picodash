// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import { fireEvent } from '@testing-library/react'
import { createPicodashNexus } from '@picodash/nexus'
import { PicodashOverlayProvider, PicodashThemeProvider } from '@picodash/ui'
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
import {
  Checkbox,
  CheckboxGroup,
  Combobox,
  MultiSelect,
  RadioGroup,
  SearchField,
  Select,
  SegmentedControl,
  type SelectOption,
} from '../src/ui.tsx'
import { choiceKey, removeMultiSelectValues } from '../src/ui-choices.tsx'

type DirectChoiceOptions = readonly SelectOption<string | number>[]
type DirectChoiceControl = {
  readonly name: string
  readonly render: (options: DirectChoiceOptions) => ReactElement
}

const directChoiceControls: readonly DirectChoiceControl[] = [
  {
    name: 'RadioGroup',
    render: (options) =>
      createElement(RadioGroup, {
        'aria-label': 'Choices',
        value: 'one',
        onChange: () => undefined,
        options,
      }),
  },
  {
    name: 'Combobox',
    render: (options) =>
      createElement(Combobox, {
        'aria-label': 'Choices',
        value: 'one',
        onChange: () => undefined,
        options,
      }),
  },
  {
    name: 'CheckboxGroup',
    render: (options) =>
      createElement(CheckboxGroup, {
        'aria-label': 'Choices',
        value: ['one'],
        onChange: () => undefined,
        options,
      }),
  },
  {
    name: 'MultiSelect',
    render: (options) =>
      createElement(MultiSelect, {
        'aria-label': 'Choices',
        value: ['one'],
        onChange: () => undefined,
        options,
      }),
  },
  {
    name: 'Select',
    render: (options) =>
      createElement(Select, {
        'aria-label': 'Choices',
        value: 'one',
        onChange: () => undefined,
        options,
      }),
  },
  {
    name: 'SegmentedControl',
    render: (options) =>
      createElement(SegmentedControl, {
        'aria-label': 'Choices',
        value: 'one',
        onChange: () => undefined,
        options,
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

describe('choice controls', () => {
  it('rejects invalid option declarations before every direct choice control renders', () => {
    const invalidCases: readonly {
      readonly name: string
      readonly options: DirectChoiceOptions
      readonly message: string
    }[] = [
      {
        name: 'duplicate values',
        options: [
          { value: 'one', label: 'One' },
          { value: 'one', label: 'Duplicate one' },
        ],
        message: 'options must contain unique values.',
      },
      {
        name: 'non-text labels without textValue',
        options: [{ value: 'one', label: createElement('span', null, 'One') }],
        message: 'non-text option labels require textValue.',
      },
      ...[Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].map((value) => ({
        name: `non-finite value ${String(value)}`,
        options: [value],
        message: 'option values must be finite strings or numbers.',
      })),
    ]

    for (const invalidCase of invalidCases)
      for (const control of directChoiceControls)
        expect(
          () => render(control.render(invalidCase.options)),
          `${control.name} should reject ${invalidCase.name}`,
        ).toThrowError(new TypeError(`${invalidCase.message}`))
  })

  it('rejects runtime-escaped non-string and non-number option values for every direct choice control', () => {
    const runtimeEscapes: readonly {
      readonly name: string
      readonly options: readonly unknown[]
    }[] = [
      { name: 'boolean', options: [true] },
      { name: 'null', options: [null] },
      { name: 'object', options: [{ value: {} }] },
    ]

    for (const runtimeEscape of runtimeEscapes)
      for (const control of directChoiceControls)
        expect(
          () => render(control.render(runtimeEscape.options as unknown as DirectChoiceOptions)),
          `${control.name} should reject a runtime-escaped ${runtimeEscape.name} option value`,
        ).toThrowError(new TypeError('option values must be finite strings or numbers.'))
  })

  it('keeps React Aria choice roots stateful and names non-text options from textValue', () => {
    const icon = createElement('span', { 'aria-hidden': true }, '●')
    const view = render(
      createElement(
        'div',
        null,
        createElement(RadioGroup, {
          'aria-label': 'Modes',
          value: 'icon-radio',
          onChange: () => undefined,
          options: [{ value: 'icon-radio', label: icon, textValue: 'Icon radio' }],
        }),
        createElement(CheckboxGroup, {
          'aria-label': 'Flags',
          value: ['icon-checkbox'],
          onChange: () => undefined,
          options: [{ value: 'icon-checkbox', label: icon, textValue: 'Icon checkbox' }],
        }),
        createElement(SegmentedControl, {
          'aria-label': 'Modes segmented',
          value: 'icon-segment',
          onChange: () => undefined,
          options: [{ value: 'icon-segment', label: icon, textValue: 'Icon segment' }],
        }),
      ),
    )

    expect(view.root.element.querySelector('input[type="radio"]')?.getAttribute('aria-label')).toBe(
      'Icon radio',
    )
    expect(
      view.root.element.querySelector('input[type="checkbox"]')?.getAttribute('aria-label'),
    ).toBe('Icon checkbox')
    const segment = view.root.element.querySelector('[data-picodash-dashlist-segment]')
    expect(segment).not.toBeNull()
    expect(segment?.hasAttribute('data-selected')).toBe(true)
    expect(segment?.querySelector('input[type="radio"]')?.getAttribute('aria-label')).toBe(
      'Icon segment',
    )
    act(() => view.unmount())
  })

  it('preserves valid non-text labels and strict primitive identity across direct controls', () => {
    const icon = createElement('span', { 'aria-hidden': true }, '●')
    const validNonTextOptions: DirectChoiceOptions = [
      { value: 'icon', label: icon, textValue: 'Icon choice' },
    ]
    const primitiveOptions: DirectChoiceOptions = [
      { value: '1', label: 'String one' },
      { value: 1, label: 'Number one' },
    ]

    for (const control of directChoiceControls) {
      const validView = render(control.render(validNonTextOptions))
      expect(
        validView.root.element.querySelector('[aria-label="Choices"]'),
        `${control.name} should render valid non-text choices`,
      ).not.toBeNull()
      act(() => validView.unmount())

      const primitiveView = render(control.render(primitiveOptions))
      expect(
        primitiveView.root.element.querySelector('[aria-label="Choices"]'),
        `${control.name} should render mixed primitive choices`,
      ).not.toBeNull()
      act(() => primitiveView.unmount())
    }
  })

  it('rejects duplicate controlled MultiSelect values under typed choice identity', () => {
    const duplicateValues: readonly {
      readonly name: string
      readonly value: readonly (string | number)[]
    }[] = [
      { name: 'string', value: ['one', 'one'] },
      { name: 'number', value: [1, 1] },
    ]

    for (const duplicate of duplicateValues)
      expect(
        () =>
          render(
            createElement(MultiSelect, {
              'aria-label': 'Choices',
              value: duplicate.value,
              onChange: () => undefined,
              options: ['one', 1],
            }),
          ),
        `MultiSelect should reject duplicate ${duplicate.name} values`,
      ).toThrowError(new TypeError('MultiSelect value must contain unique values.'))
  })

  it('preserves mixed and unavailable MultiSelect values in controlled order', () => {
    const changes: (string | number)[][] = []
    const view = render(
      createElement(MultiSelect, {
        'aria-label': 'Choices',
        value: ['1', 1, 'unavailable'],
        onChange: (next) => changes.push([...next]),
        options: [
          { value: '1', label: 'String one' },
          { value: 1, label: 'Number one' },
        ],
      }),
    )

    expect(
      [...view.root.element.querySelectorAll('[data-picodash-dashlist-tag-remove]')].map((button) =>
        button.getAttribute('aria-label'),
      ),
    ).toEqual(['Remove String one', 'Remove Number one', 'Remove unavailable'])

    act(() => {
      void fireEvent.click(view.root.element.querySelector('[aria-label="Remove unavailable"]')!)
    })
    expect(changes).toEqual([['1', 1]])
    act(() => view.unmount())
  })

  it('hosts every detached choice popup in the Provider portal with resolved presentation', () => {
    const cases: readonly {
      readonly name: string
      readonly rootClassName: string
      readonly render: (onChange: (value: unknown) => void) => ReactElement
      readonly expectedChange: unknown
    }[] = [
      {
        name: 'Select',
        rootClassName: 'picodash-dashlist-select',
        render: (onChange) =>
          createElement(Select, {
            'aria-label': 'Select choice',
            value: 'one',
            onChange,
            options: ['one', 'two'],
          }),
        expectedChange: 'two',
      },
      {
        name: 'Combobox',
        rootClassName: 'picodash-dashlist-combobox',
        render: (onChange) =>
          createElement(Combobox, {
            'aria-label': 'Combobox choice',
            value: 'one',
            onChange,
            options: ['one', 'two'],
          }),
        expectedChange: 'two',
      },
      {
        name: 'MultiSelect',
        rootClassName: 'picodash-dashlist-multi-select',
        render: (onChange) =>
          createElement(MultiSelect, {
            'aria-label': 'MultiSelect choice',
            value: ['one'],
            onChange,
            options: ['one', 'two'],
          }),
        expectedChange: ['one', 'two'],
      },
    ]

    for (const choiceCase of cases) {
      const changes: unknown[] = []
      const portal = document.createElement('section')
      document.body.append(portal)
      const view = render(
        <PicodashThemeProvider theme="light" density="compact">
          <PicodashOverlayProvider portalContainer={portal} layerBase={321}>
            {choiceCase.render((value) => changes.push(value))}
          </PicodashOverlayProvider>
        </PicodashThemeProvider>,
      )
      const control = view.root.element.querySelector(`.${choiceCase.rootClassName}`)
      const trigger = control?.querySelector('button')
      expect(trigger, `${choiceCase.name} should render a popup trigger`).not.toBeNull()

      act(() => {
        fireEvent.click(trigger!)
      })

      const popup = portal.querySelector('.picodash-dashlist-popover') as HTMLElement | null
      expect(popup, `${choiceCase.name} should use the Provider portal`).not.toBeNull()
      expect(control?.contains(popup)).toBe(false)
      expect(popup?.dataset.picodashTheme).toBe('light')
      expect(popup?.dataset.picodashDensity).toBe('compact')
      expect(popup?.style.zIndex).toBe('max(var(--picodash-layer-popover), 321)')
      expect(portal.hasAttribute('data-picodash-theme')).toBe(false)
      expect(portal.hasAttribute('data-picodash-density')).toBe(false)

      const option = [...portal.querySelectorAll('[role="option"]')].find(
        (candidate) => candidate.textContent === 'two',
      )
      expect(option, `${choiceCase.name} should render the second option`).not.toBeUndefined()
      act(() => {
        fireEvent.click(option!)
      })
      expect(changes).toEqual([choiceCase.expectedChange])

      act(() => view.unmount())
      portal.remove()
    }
  })

  it('forwards declared ids to controls and class names to public roots', () => {
    const controls: ReactElement[] = [
      createElement(Checkbox, {
        id: 'choice-checkbox',
        className: 'choice-checkbox-hook',
        isSelected: false,
        onChange: () => undefined,
      }),
      createElement(RadioGroup, {
        id: 'choice-radio',
        className: 'choice-radio-hook',
        value: 'one',
        onChange: () => undefined,
        options: ['one', 'two'],
      }),
      createElement(SegmentedControl, {
        id: 'choice-segmented',
        className: 'choice-segmented-hook',
        value: 'one',
        onChange: () => undefined,
        options: ['one', 'two'],
      }),
      createElement(Combobox, {
        id: 'choice-combobox',
        className: 'choice-combobox-hook',
        value: 'one',
        onChange: () => undefined,
        options: ['one', 'two'],
      }),
      createElement(CheckboxGroup, {
        id: 'choice-checkbox-group',
        className: 'choice-checkbox-group-hook',
        value: ['one'],
        onChange: () => undefined,
        options: ['one', 'two'],
      }),
      createElement(MultiSelect, {
        id: 'choice-multi',
        className: 'choice-multi-hook',
        value: ['one'],
        onChange: () => undefined,
        options: ['one', 'two'],
      }),
      createElement(SearchField, {
        id: 'choice-search',
        className: 'choice-search-hook',
        value: '',
        onChange: () => undefined,
      }),
    ]
    const view = render(createElement('div', null, controls))
    for (const id of [
      'choice-checkbox',
      'choice-radio',
      'choice-segmented',
      'choice-combobox',
      'choice-checkbox-group',
      'choice-multi',
      'choice-search',
    ])
      expect(view.root.element.querySelector(`#${id}`)).not.toBeNull()
    for (const [className, structuralClassName] of [
      ['choice-checkbox-hook', 'picodash-dashlist-checkbox'],
      ['choice-radio-hook', 'picodash-dashlist-radio-group'],
      ['choice-segmented-hook', 'picodash-dashlist-segmented'],
      ['choice-combobox-hook', 'picodash-dashlist-combobox'],
      ['choice-checkbox-group-hook', 'picodash-dashlist-checkbox-group'],
      ['choice-multi-hook', 'picodash-dashlist-multi-select'],
      ['choice-search-hook', 'picodash-dashlist-search-field'],
    ])
      expect(view.root.element.querySelector(`.${structuralClassName}.${className}`)).not.toBeNull()
    act(() => view.unmount())
  })

  it('does not expose MultiSelect removal actions when disabled or read-only', () => {
    const changes: string[][] = []
    const view = render(
      createElement(
        'div',
        null,
        createElement(MultiSelect, {
          id: 'disabled-multi',
          value: ['one'],
          onChange: (next) => changes.push(next.map(String)),
          options: ['one', 'two'],
          disabled: true,
        }),
        createElement(MultiSelect, {
          id: 'readonly-multi',
          value: ['one'],
          onChange: (next) => changes.push(next.map(String)),
          options: ['one', 'two'],
          readOnly: true,
        }),
      ),
    )
    expect(view.root.element.querySelectorAll('[slot="remove"]')).toHaveLength(0)
    expect(changes).toEqual([])
    act(() => view.unmount())
  })

  it('keeps disabled selected MultiSelect options unavailable through the listbox and tags', () => {
    const changes: (string | number)[][] = []
    const view = render(
      createElement(MultiSelect, {
        value: ['1', 1],
        onChange: (next) => changes.push([...next]),
        options: [
          { value: '1', label: 'String one' },
          { value: 1, label: 'Number one', disabled: true },
        ],
        'aria-label': 'Choices',
      }),
    )

    const tags = [...view.root.element.querySelectorAll('.picodash-dashlist-tag')]
    const stringTag = tags.find((tag) => tag.textContent?.includes('String one'))
    const lockedTag = tags.find((tag) => tag.textContent?.includes('Number one'))
    expect(stringTag?.hasAttribute('data-disabled')).toBe(false)
    expect(lockedTag?.hasAttribute('data-disabled')).toBe(true)
    expect(view.root.element.querySelector('[aria-label="Remove String one"]')).not.toBeNull()
    expect(view.root.element.querySelector('[aria-label="Remove Number one"]')).toBeNull()

    act(() => {
      void fireEvent.keyDown(lockedTag!, { key: 'Delete' })
    })
    expect(changes).toEqual([])

    const showChoices = view.root.element.querySelector('[aria-label="Show choices"]')
    act(() => {
      void fireEvent.click(showChoices!)
    })
    const lockedOption = [...view.root.element.querySelectorAll('[role="option"]')].find(
      (option) => option.textContent === 'Number one',
    )
    expect(lockedOption?.getAttribute('aria-disabled')).toBe('true')
    act(() => {
      void fireEvent.click(lockedOption!)
    })
    expect(changes).toEqual([])

    const removeString = view.root.element.querySelector('[aria-label="Remove String one"]')
    act(() => {
      void fireEvent.click(removeString!)
    })
    expect(changes).toEqual([[1]])
    act(() => view.unmount())
  })

  it('filters disabled keys from MultiSelect bulk tag removal in controlled order', () => {
    const value = ['first', 'locked', 'last'] as const
    const disabledKeys = new Set([choiceKey('locked')])

    expect(
      removeMultiSelectValues(
        value,
        new Set([choiceKey('first'), choiceKey('locked'), choiceKey('last')]),
        disabledKeys,
      ),
    ).toEqual(['locked'])
    expect(removeMultiSelectValues(value, new Set([choiceKey('locked')]), disabledKeys)).toEqual(
      value,
    )
  })

  it('emits one ordered MultiSelect change for keyboard removal of an enabled tag', () => {
    const changes: string[][] = []
    const view = render(
      createElement(MultiSelect, {
        value: ['first', 'locked', 'last'],
        onChange: (next) => changes.push(next.map(String)),
        options: [
          { value: 'first', label: 'First' },
          { value: 'locked', label: 'Locked', disabled: true },
          { value: 'last', label: 'Last' },
        ],
        'aria-label': 'Choices',
      }),
    )

    const firstTag = [...view.root.element.querySelectorAll('.picodash-dashlist-tag')].find((tag) =>
      tag.textContent?.includes('First'),
    )
    act(() => {
      void fireEvent.keyDown(firstTag!, { key: 'Delete' })
    })
    expect(changes).toEqual([['locked', 'last']])
    act(() => view.unmount())
  })

  it('uses selected option text alternatives for MultiSelect tags and removal actions', () => {
    const icon = createElement('span', { 'aria-hidden': true }, '●')
    const view = render(
      createElement(MultiSelect, {
        value: ['internal-code'],
        onChange: () => undefined,
        options: [
          {
            value: 'internal-code',
            label: icon,
            textValue: 'Readable choice',
          },
        ],
        'aria-label': 'Choices',
      }),
    )
    const tag = view.root.element.querySelector('.picodash-dashlist-tag')
    expect(tag).not.toBeNull()
    expect(tag?.textContent).not.toContain('internal-code')
    expect(view.root.element.querySelector('[aria-label="Remove Readable choice"]')).not.toBeNull()
    expect(view.root.element.querySelector('[aria-label="Remove internal-code"]')).toBeNull()
    act(() => view.unmount())
  })

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
    expect(view.root.element.textContent).toContain(
      'Values must be configured, unique, and in declared option order.',
    )
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

  it('treats duplicate and out-of-order array choices as presentation mismatches', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        duplicate: { defaultValue: ['one', 'one'] },
        reversed: { defaultValue: ['two', 'one'] },
      },
    })
    const view = render(
      createElement(
        DashList,
        { id: 'array-mismatch', nexus },
        createElement(MultiSelectDashlet, {
          id: 'duplicate',
          field: nexus.fields.duplicate,
          label: 'Duplicate',
          options: ['one', 'two'],
        }),
        createElement(CheckboxGroupDashlet, {
          id: 'reversed',
          field: nexus.fields.reversed,
          label: 'Reversed',
          options: ['one', 'two'],
        }),
      ),
    )
    expect(
      view.root.element.querySelectorAll('[data-picodash-dashlet-presentation-warning]'),
    ).toHaveLength(2)
    expect(view.root.element.textContent).toContain('["one","one"]')
    expect(view.root.element.textContent).toContain('["two","one"]')
    expect(view.root.element.textContent).toContain(
      'Values must be configured, unique, and in declared option order.',
    )
    expect(view.root.element.textContent).not.toContain(
      'contains values that are not in the configured choices',
    )
    expect(nexus.getState().values).toEqual({
      duplicate: ['one', 'one'],
      reversed: ['two', 'one'],
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
