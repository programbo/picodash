'use client'

import {
  Button,
  Group,
  Input,
  ListBox,
  ListBoxItem,
  NumberField as AriaNumberField,
  Radio,
  RadioGroup,
  Select as AriaSelect,
  SelectValue,
  Slider as AriaSlider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  Switch as AriaSwitch,
  TextArea,
  TextField as AriaTextField,
} from 'react-aria-components'
import { useRef, type CSSProperties, type ReactNode } from 'react'
import { usePrimaryControlRef, useReadOnlyDescription } from './control-accessibility.js'
import { ChoiceOptionContent } from './choice-option-content.js'
import { validateChoiceOptions } from './ui-choices.js'
import { composeControlClassName } from './ui-class-name.js'
import { ChoicePopover } from './ui-popover.js'

export type DashlistControlProps = {
  readonly id?: string
  readonly 'aria-label'?: string
  readonly 'aria-labelledby'?: string
  readonly 'aria-describedby'?: string
  readonly 'aria-invalid'?: boolean | 'true' | 'false'
  readonly 'aria-errormessage'?: string
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly className?: string
}

export type TextFieldProps = DashlistControlProps & {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly multiline?: boolean
  readonly minRows?: number
  readonly placeholder?: string
}

function validateTextFieldConfiguration(multiline: boolean, minRows: number | undefined) {
  if (minRows !== undefined && (!multiline || !Number.isInteger(minRows) || minRows <= 0))
    throw new TypeError('minRows must be a positive integer when multiline is true.')
}

export function TextField({
  value,
  onChange,
  multiline = false,
  minRows,
  placeholder,
  ...props
}: TextFieldProps) {
  validateTextFieldConfiguration(multiline, minRows)
  const inputRef = usePrimaryControlRef<HTMLInputElement>()
  const textAreaRef = usePrimaryControlRef<HTMLTextAreaElement>()
  const inputProps = {
    id: props.id,
    disabled: props.disabled,
    readOnly: props.readOnly,
    placeholder,
    className: 'picodash-dashlist-control',
    'aria-invalid': props['aria-invalid'],
    'aria-errormessage': props['aria-errormessage'],
  }
  return (
    <AriaTextField
      className={composeControlClassName('picodash-dashlist-field', props.className)}
      value={value}
      onChange={onChange}
      isDisabled={props.disabled}
      isReadOnly={props.readOnly}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      aria-errormessage={props['aria-errormessage']}
    >
      {multiline ? (
        <TextArea ref={textAreaRef} {...inputProps} rows={minRows} />
      ) : (
        <Input ref={inputRef} {...inputProps} />
      )}
    </AriaTextField>
  )
}

export type NumberFieldProps = DashlistControlProps & {
  readonly value: number
  readonly onChange: (value: number | null) => void
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly placeholder?: string
  readonly formatOptions?: Intl.NumberFormatOptions
}

function validateNumberFieldConfiguration(
  min: number | undefined,
  max: number | undefined,
  step: number | undefined,
): void {
  if (min !== undefined && !Number.isFinite(min)) throw new TypeError('min must be finite.')
  if (max !== undefined && !Number.isFinite(max)) throw new TypeError('max must be finite.')
  if (min !== undefined && max !== undefined && min > max)
    throw new TypeError('min must be less than or equal to max.')
  if (step !== undefined && (!Number.isFinite(step) || step <= 0))
    throw new TypeError('step must be a positive finite number.')
}

function equalNumberFormatOptions(
  left: Intl.NumberFormatOptions | undefined,
  right: Intl.NumberFormatOptions | undefined,
): boolean {
  if (left === right) return true
  if (!left || !right) return false
  const leftEntries = Object.entries(left)
  const rightEntries = Object.entries(right)
  if (leftEntries.length !== rightEntries.length) return false
  return leftEntries.every(([key, value]) => Object.is(right[key as keyof typeof right], value))
}

function isImmediateNumberEditKey(key: string): boolean {
  return ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(key)
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  formatOptions,
  ...props
}: NumberFieldProps) {
  validateNumberFieldConfiguration(min, max, step)
  const inputRef = usePrimaryControlRef<HTMLInputElement>()
  const pendingTextEdit = useRef(false)
  const pendingImmediateEdit = useRef(false)
  const immediateEditGeneration = useRef(0)
  const previousConfiguration = useRef({ value, min, max, step, formatOptions })
  const previous = previousConfiguration.current
  if (
    !Object.is(previous.value, value) ||
    !Object.is(previous.min, min) ||
    !Object.is(previous.max, max) ||
    !Object.is(previous.step, step) ||
    !equalNumberFormatOptions(previous.formatOptions, formatOptions)
  ) {
    pendingTextEdit.current = false
    pendingImmediateEdit.current = false
    immediateEditGeneration.current += 1
    previousConfiguration.current = { value, min, max, step, formatOptions }
  }

  const canEdit = !props.disabled && !props.readOnly
  const markTextEdit = () => {
    if (canEdit) pendingTextEdit.current = true
  }
  const markImmediateEdit = () => {
    if (!canEdit) return
    pendingImmediateEdit.current = true
    const generation = ++immediateEditGeneration.current
    void Promise.resolve().then(() => {
      if (immediateEditGeneration.current === generation) pendingImmediateEdit.current = false
    })
  }
  const handleChange = (next: number) => {
    if (!pendingTextEdit.current && !pendingImmediateEdit.current) return
    pendingTextEdit.current = false
    pendingImmediateEdit.current = false
    immediateEditGeneration.current += 1
    onChange(Number.isNaN(next) ? null : next)
  }

  return (
    <AriaNumberField
      className={composeControlClassName('picodash-dashlist-field', props.className)}
      value={value}
      onChange={handleChange}
      minValue={min}
      maxValue={max}
      step={step}
      formatOptions={formatOptions}
      isDisabled={props.disabled}
      isReadOnly={props.readOnly}
      isInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      aria-errormessage={props['aria-errormessage']}
    >
      <Group>
        <Input
          ref={inputRef}
          id={props.id}
          placeholder={placeholder}
          className="picodash-dashlist-control"
          aria-invalid={props['aria-invalid']}
          aria-errormessage={props['aria-errormessage']}
          onChange={markTextEdit}
          onBeforeInputCapture={markTextEdit}
          onChangeCapture={markTextEdit}
          onInputCapture={markTextEdit}
          onPasteCapture={markTextEdit}
          onCutCapture={markTextEdit}
          onKeyDownCapture={(event) => {
            if (isImmediateNumberEditKey(event.key)) markImmediateEdit()
            else if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete')
              markTextEdit()
          }}
          onWheelCapture={(event) => {
            if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && event.deltaY !== 0)
              markImmediateEdit()
          }}
          onBlur={() => {
            pendingTextEdit.current = false
            pendingImmediateEdit.current = false
            immediateEditGeneration.current += 1
          }}
        />
      </Group>
    </AriaNumberField>
  )
}

export type SliderMark = { readonly value: number; readonly label?: ReactNode }
export type SliderProps = DashlistControlProps & {
  readonly value: number
  readonly onChange: (value: number) => void
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly marks?: readonly SliderMark[]
  readonly formatOptions?: Intl.NumberFormatOptions
}

function sliderMarkPosition(value: number, min: number, max: number) {
  return max === min ? 0 : ((value - min) / (max - min)) * 100
}

function validateSliderConfiguration(
  min: number,
  max: number,
  step: number,
  marks: readonly SliderMark[] | undefined,
): void {
  if (!Number.isFinite(min)) throw new TypeError('min must be finite.')
  if (!Number.isFinite(max)) throw new TypeError('max must be finite.')
  if (min > max) throw new TypeError('min must be less than or equal to max.')
  if (!Number.isFinite(step) || step <= 0)
    throw new TypeError('step must be a positive finite number.')
  if (marks?.some((mark) => !Number.isFinite(mark.value) || mark.value < min || mark.value > max))
    throw new TypeError('marks values must be finite and within the slider bounds.')
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  marks,
  formatOptions,
  ...props
}: SliderProps) {
  validateSliderConfiguration(min, max, step, marks)
  const inputRef = usePrimaryControlRef<HTMLInputElement>()
  const readOnlyDescription = useReadOnlyDescription(props.readOnly, props['aria-describedby'])

  return (
    <>
      <AriaSlider
        id={props.id}
        className={composeControlClassName('picodash-dashlist-slider', props.className)}
        value={value}
        onChange={props.readOnly ? undefined : onChange}
        minValue={min}
        maxValue={max}
        step={step}
        formatOptions={formatOptions}
        isDisabled={props.disabled}
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        aria-describedby={props['aria-describedby']}
        aria-invalid={props['aria-invalid']}
        aria-errormessage={props['aria-errormessage']}
      >
        <SliderOutput>{({ state }) => state.getThumbValueLabel(0)}</SliderOutput>
        <SliderTrack className="picodash-dashlist-slider-track">
          <SliderThumb
            index={0}
            inputRef={inputRef}
            data-picodash-dashlist-slider-thumb
            aria-label={props['aria-label']}
            aria-describedby={readOnlyDescription.describedBy}
            isInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
            aria-errormessage={props['aria-errormessage']}
          />
          {marks?.length ? (
            <span aria-hidden="true" data-picodash-dashlist-slider-marks>
              {marks.map((mark, index) => (
                <span
                  key={index}
                  data-picodash-dashlist-slider-mark={mark.value}
                  style={
                    {
                      '--_picodash-dashlist-slider-mark-position': `${sliderMarkPosition(mark.value, min, max)}%`,
                    } as CSSProperties
                  }
                >
                  {mark.label ?? mark.value}
                </span>
              ))}
            </span>
          ) : null}
        </SliderTrack>
      </AriaSlider>
      {readOnlyDescription.description}
    </>
  )
}

export type SwitchProps = DashlistControlProps & {
  readonly isSelected: boolean
  readonly onChange: (isSelected: boolean) => void
}

export function Switch({ isSelected, onChange, ...props }: SwitchProps) {
  const inputRef = usePrimaryControlRef<HTMLInputElement>()
  return (
    <AriaSwitch
      inputRef={inputRef}
      id={props.id}
      className={composeControlClassName('picodash-dashlist-switch', props.className)}
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={props.disabled}
      isReadOnly={props.readOnly}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      aria-errormessage={props['aria-errormessage']}
    >
      <span aria-hidden="true" data-picodash-dashlist-switch-track>
        <span aria-hidden="true" data-picodash-dashlist-switch-marker />
      </span>
      <span data-picodash-dashlist-switch-label>{props['aria-label']}</span>
    </AriaSwitch>
  )
}

export type SelectOption<T extends string | number> =
  | T
  | {
      readonly value: T
      readonly label?: ReactNode
      readonly textValue?: string
      readonly icon?: ReactNode
      readonly disabled?: boolean
    }

export type SelectProps<T extends string | number> = DashlistControlProps & {
  readonly value: T | undefined
  readonly onChange: (value: T) => void
  readonly options: readonly SelectOption<T>[]
  readonly placeholder?: string
}

function optionParts<T extends string | number>(option: SelectOption<T>) {
  if (typeof option === 'object' && option !== null)
    return {
      value: option.value,
      label: option.label ?? String(option.value),
      textValue:
        option.textValue ??
        (typeof option.label === 'string' ? option.label : String(option.value)),
      disabled: option.disabled,
      icon: option.icon,
    }
  return {
    value: option,
    label: String(option),
    textValue: String(option),
    disabled: false,
    icon: undefined,
  }
}
type OptionParts<T extends string | number> = ReturnType<typeof optionParts<T>>

function choiceKey(value: string | number): string {
  return `${typeof value}:${String(value)}`
}

export function Select<T extends string | number>({
  value,
  onChange,
  options,
  placeholder,
  ...props
}: SelectProps<T>) {
  validateChoiceOptions(options)
  const parts = options.map(optionParts)
  const triggerRef = usePrimaryControlRef<HTMLButtonElement>()
  const readOnlyDescription = useReadOnlyDescription(props.readOnly, props['aria-describedby'])
  return (
    <>
      <AriaSelect<OptionParts<T>>
        className={composeControlClassName('picodash-dashlist-select', props.className)}
        selectedKey={value === undefined ? null : choiceKey(value)}
        placeholder={placeholder}
        onSelectionChange={
          props.readOnly
            ? undefined
            : (key) => {
                if (key !== null) {
                  const match = parts.find((item) => choiceKey(item.value) === key)
                  if (match) onChange(match.value)
                }
              }
        }
        isDisabled={props.disabled}
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        aria-describedby={props['aria-describedby']}
        aria-invalid={props['aria-invalid']}
        aria-errormessage={props['aria-errormessage']}
      >
        <Button
          ref={triggerRef}
          id={props.id}
          className="picodash-dashlist-control"
          aria-describedby={readOnlyDescription.describedBy}
          aria-invalid={props['aria-invalid']}
          aria-errormessage={props['aria-errormessage']}
        >
          <SelectValue<OptionParts<T>>>
            {({ selectedItem, defaultChildren }) =>
              selectedItem === null && value !== undefined ? String(value) : defaultChildren
            }
          </SelectValue>
        </Button>
        <ChoicePopover>
          <ListBox<OptionParts<T>> className="picodash-dashlist-listbox" items={parts}>
            {(item) => (
              <ListBoxItem
                id={choiceKey(item.value)}
                textValue={item.textValue}
                isDisabled={item.disabled}
              >
                <ChoiceOptionContent icon={item.icon} label={item.label} />
              </ListBoxItem>
            )}
          </ListBox>
        </ChoicePopover>
      </AriaSelect>
      {readOnlyDescription.description}
    </>
  )
}

function SegmentedChoice<T extends string | number>({ item }: { readonly item: OptionParts<T> }) {
  const inputRef = usePrimaryControlRef<HTMLInputElement>()
  return (
    <Radio
      inputRef={inputRef}
      value={choiceKey(item.value)}
      isDisabled={item.disabled}
      data-picodash-dashlist-segment
      aria-label={typeof item.label === 'string' ? undefined : item.textValue}
    >
      <span aria-hidden="true" data-picodash-dashlist-segment-marker />
      {item.icon}
      {item.label}
    </Radio>
  )
}

export type SegmentedControlProps<T extends string | number> = DashlistControlProps & {
  readonly value: T | undefined
  readonly onChange: (value: T) => void
  readonly options: readonly SelectOption<T>[]
}

export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  ...props
}: SegmentedControlProps<T>) {
  validateChoiceOptions(options)
  const parts = options.map(optionParts)
  return (
    <RadioGroup
      id={props.id}
      className={composeControlClassName('picodash-dashlist-segmented', props.className)}
      value={value === undefined ? null : choiceKey(value)}
      onChange={(next) => {
        const match = parts.find((item) => choiceKey(item.value) === next)
        if (match) onChange(match.value)
      }}
      orientation="horizontal"
      isDisabled={props.disabled}
      isReadOnly={props.readOnly}
      isInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      aria-errormessage={props['aria-errormessage']}
    >
      {parts.map((item) => (
        <SegmentedChoice key={choiceKey(item.value)} item={item} />
      ))}
    </RadioGroup>
  )
}

export type DisplayProps = DashlistControlProps & {
  readonly value: unknown
  readonly renderedValue?: ReactNode
  readonly isFormatted?: boolean
}

export function Display({ value, renderedValue, isFormatted, ...props }: DisplayProps) {
  const text = isFormatted
    ? renderedValue
    : typeof value === 'object' && value !== null
      ? JSON.stringify(value, null, 2)
      : String(value)
  return (
    <output
      id={props.id}
      className={composeControlClassName('picodash-dashlist-display', props.className)}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      aria-errormessage={props['aria-errormessage']}
      data-picodash-dashlist-display
    >
      {text}
    </output>
  )
}

export {
  Checkbox,
  CheckboxGroup,
  Combobox,
  MultiSelect,
  RadioGroup,
  SearchField,
  type CheckboxGroupProps,
  type CheckboxProps,
  type ComboboxProps,
  type MultiSelectProps,
  type RadioGroupProps,
  type SearchFieldProps,
} from './ui-choices.js'

export {
  ColorField,
  DateField,
  DateRangeField,
  DateTimeField,
  Meter,
  ProgressBar,
  RangeSlider,
  Status,
  TimeField,
} from './ui-values.js'
export type {
  ColorFieldProps,
  ColorFormat,
  DateFieldProps,
  DateRangeFieldProps,
  DateRangeValue,
  DateTimeFieldProps,
  MeterProps,
  NumberRangeValue,
  ProgressBarProps,
  RangeSliderProps,
  StatusOption,
  StatusProps,
  StatusTone,
  TimeFieldProps,
} from './ui-values.js'
