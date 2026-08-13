'use client'

import {
  Button,
  Checkbox as AriaCheckbox,
  CheckboxGroup as AriaCheckboxGroup,
  ComboBox as AriaComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Radio,
  RadioGroup as AriaRadioGroup,
  SearchField as AriaSearchField,
  Tag,
  TagGroup,
  TagList,
} from 'react-aria-components'
import type { SelectOption } from './ui.js'

export type ChoiceControlProps = {
  readonly id?: string
  readonly 'aria-label'?: string
  readonly 'aria-labelledby'?: string
  readonly 'aria-describedby'?: string
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly className?: string
}

type ChoiceValue = string | number

function optionParts<T extends ChoiceValue>(option: SelectOption<T>) {
  if (typeof option === 'object' && option !== null) {
    return {
      value: option.value,
      label: option.label ?? String(option.value),
      textValue:
        option.textValue ??
        (typeof option.label === 'string' ? option.label : String(option.value)),
      disabled: option.disabled,
      icon: option.icon,
    }
  }
  return {
    value: option,
    label: String(option),
    textValue: String(option),
    disabled: false,
    icon: undefined,
  }
}
type OptionParts<T extends ChoiceValue> = ReturnType<typeof optionParts<T>>

export function choiceKey(value: ChoiceValue): string {
  return `${typeof value}:${String(value)}`
}

export function validateChoiceOptions<T extends ChoiceValue>(
  options: readonly SelectOption<T>[],
): void {
  const seen = new Set<string>()
  for (const option of options) {
    const value = typeof option === 'object' && option !== null ? option.value : option
    const key = choiceKey(value)
    if (seen.has(key)) throw new TypeError('options must contain unique values.')
    seen.add(key)
    if (
      typeof option === 'object' &&
      option !== null &&
      option.label !== undefined &&
      typeof option.label !== 'string' &&
      !option.textValue
    )
      throw new TypeError('non-text option labels require textValue.')
  }
}

export type CheckboxProps = ChoiceControlProps & {
  readonly isSelected: boolean
  readonly onChange: (isSelected: boolean) => void
}

export function Checkbox({ isSelected, onChange, ...props }: CheckboxProps) {
  return (
    <AriaCheckbox
      className={props.className ?? 'picodash-dashlist-checkbox'}
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={props.disabled}
      isReadOnly={props.readOnly}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
    >
      <span aria-hidden="true" data-picodash-dashlist-checkbox-box />
      {props['aria-label'] ? <span>{props['aria-label']}</span> : null}
    </AriaCheckbox>
  )
}

export type RadioGroupProps<T extends ChoiceValue> = ChoiceControlProps & {
  readonly value: T | undefined
  readonly onChange: (value: T) => void
  readonly options: readonly SelectOption<T>[]
  readonly orientation?: 'vertical' | 'horizontal'
}

export function RadioGroup<T extends ChoiceValue>({
  value,
  onChange,
  options,
  orientation = 'vertical',
  ...props
}: RadioGroupProps<T>) {
  const parts = options.map(optionParts)
  return (
    <AriaRadioGroup
      className={props.className ?? 'picodash-dashlist-radio-group'}
      value={value === undefined ? undefined : choiceKey(value)}
      onChange={(next) => {
        const match = parts.find((item) => choiceKey(item.value) === next)
        if (match) onChange(match.value)
      }}
      orientation={orientation}
      isDisabled={props.disabled}
      isReadOnly={props.readOnly}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
    >
      {parts.map((item) => (
        <Radio
          className="picodash-dashlist-choice"
          key={choiceKey(item.value)}
          value={choiceKey(item.value)}
          isDisabled={item.disabled}
        >
          {item.icon}
          {item.label}
        </Radio>
      ))}
    </AriaRadioGroup>
  )
}

export type ComboboxProps<T extends ChoiceValue> = ChoiceControlProps & {
  readonly value: T | undefined
  readonly onChange: (value: T) => void
  readonly options: readonly SelectOption<T>[]
  readonly placeholder?: string
}

export function Combobox<T extends ChoiceValue>({
  value,
  onChange,
  options,
  placeholder,
  ...props
}: ComboboxProps<T>) {
  const parts = options.map(optionParts)
  return (
    <AriaComboBox
      className={props.className ?? 'picodash-dashlist-combobox'}
      items={parts}
      value={value === undefined ? null : choiceKey(value)}
      onChange={(next) => {
        if (typeof next !== 'string') return
        const match = parts.find((item) => choiceKey(item.value) === next)
        if (match) onChange(match.value)
      }}
      isDisabled={props.disabled}
      isReadOnly={props.readOnly}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
    >
      <Label>{props['aria-label']}</Label>
      <Input id={props.id} placeholder={placeholder} className="picodash-dashlist-control" />
      <Button className="picodash-dashlist-disclosure-button" aria-label="Show choices">
        ▾
      </Button>
      <Popover className="picodash-dashlist-popover">
        <ListBox<OptionParts<T>> className="picodash-dashlist-listbox">
          {(item) => (
            <ListBoxItem
              id={choiceKey(item.value)}
              textValue={item.textValue}
              isDisabled={item.disabled}
            >
              {item.icon}
              {item.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaComboBox>
  )
}

export type CheckboxGroupProps<T extends ChoiceValue> = ChoiceControlProps & {
  readonly value: readonly T[]
  readonly onChange: (value: readonly T[]) => void
  readonly options: readonly SelectOption<T>[]
}

export function CheckboxGroup<T extends ChoiceValue>({
  value,
  onChange,
  options,
  ...props
}: CheckboxGroupProps<T>) {
  const parts = options.map(optionParts)
  const selected = value.map(choiceKey)
  return (
    <AriaCheckboxGroup
      className={props.className ?? 'picodash-dashlist-checkbox-group'}
      value={selected}
      onChange={(keys) => {
        const selectedKeys = new Set(keys)
        const next = parts
          .filter((item) => selectedKeys.has(choiceKey(item.value)))
          .map((item) => item.value)
        onChange(next)
      }}
      isDisabled={props.disabled}
      isReadOnly={props.readOnly}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
    >
      {parts.map((item) => (
        <AriaCheckbox
          className="picodash-dashlist-choice"
          key={choiceKey(item.value)}
          value={choiceKey(item.value)}
          isDisabled={item.disabled}
        >
          {item.icon}
          {item.label}
        </AriaCheckbox>
      ))}
    </AriaCheckboxGroup>
  )
}

export type MultiSelectProps<T extends ChoiceValue> = ChoiceControlProps & {
  readonly value: readonly T[]
  readonly onChange: (value: readonly T[]) => void
  readonly options: readonly SelectOption<T>[]
  readonly placeholder?: string
}

export function MultiSelect<T extends ChoiceValue>({
  value,
  onChange,
  options,
  placeholder,
  ...props
}: MultiSelectProps<T>) {
  const parts = options.map(optionParts)
  const selected = value.map(choiceKey)
  return (
    <AriaComboBox
      className={props.className ?? 'picodash-dashlist-multi-select'}
      selectionMode="multiple"
      items={parts}
      value={selected}
      onChange={(keys) => {
        if (!Array.isArray(keys)) return
        const selectedKeys = new Set(keys)
        const next = parts
          .filter((item) => selectedKeys.has(choiceKey(item.value)))
          .map((item) => item.value)
        onChange(next)
      }}
      isDisabled={props.disabled}
      isReadOnly={props.readOnly}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
    >
      <Label>{props['aria-label']}</Label>
      <Input id={props.id} placeholder={placeholder} className="picodash-dashlist-control" />
      <Button className="picodash-dashlist-disclosure-button" aria-label="Show choices">
        ▾
      </Button>
      <TagGroup
        className="picodash-dashlist-tag-group"
        aria-label={`${props['aria-label'] ?? 'Selected'} values`}
        onRemove={(keys) => {
          const next = value.filter((item) => !keys.has(choiceKey(item)))
          onChange(next)
        }}
      >
        <TagList<{ key: string; value: T }>
          className="picodash-dashlist-tag-list"
          items={value.map((item) => ({ key: choiceKey(item), value: item }))}
        >
          {(item) => (
            <Tag className="picodash-dashlist-tag" id={item.key} textValue={String(item.value)}>
              {parts.find((part) => choiceKey(part.value) === item.key)?.label ??
                String(item.value)}
              <Button slot="remove" aria-label={`Remove ${String(item.value)}`}>
                ×
              </Button>
            </Tag>
          )}
        </TagList>
      </TagGroup>
      <Popover className="picodash-dashlist-popover">
        <ListBox<OptionParts<T>> className="picodash-dashlist-listbox">
          {(item) => (
            <ListBoxItem
              id={choiceKey(item.value)}
              textValue={item.textValue}
              isDisabled={item.disabled}
            >
              {item.icon}
              {item.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaComboBox>
  )
}

export type SearchFieldProps = ChoiceControlProps & {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
}

export function SearchField({ value, onChange, placeholder, ...props }: SearchFieldProps) {
  return (
    <AriaSearchField
      className={props.className ?? 'picodash-dashlist-search-field'}
      value={value}
      onChange={onChange}
      isDisabled={props.disabled}
      isReadOnly={props.readOnly}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
    >
      <Input id={props.id} placeholder={placeholder} className="picodash-dashlist-control" />
      <Button className="picodash-dashlist-clear-button" aria-label="Clear search">
        ×
      </Button>
    </AriaSearchField>
  )
}

export type { SelectOption }
