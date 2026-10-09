'use client'

import {
  Button,
  Group,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  NumberField as AriaNumberField,
  Radio,
  RadioGroup,
  Select as AriaSelect,
  SelectValue,
  SelectionIndicator,
  Slider as AriaSlider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  Switch as AriaSwitch,
  TextArea,
  TextField as AriaTextField,
} from 'react-aria-components'
import { useContext, useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { DetentSlider } from './detent-slider.js'
import { SliderTrackAccessoryContext } from './slider-accessory.js'
import { usePrimaryControlRef, useReadOnlyDescription } from './control-accessibility.js'
import { ChoiceOptionContent } from './choice-option-content.js'
import { validateChoiceOptions } from './ui-choices.js'
import { composeControlClassName } from './ui-class-name.js'
import { ChoicePopover } from './ui-popover.js'
import { useNumericControlGesture, type NumericGestureFactory } from './numeric-control-gesture.js'
import { validateSliderOptions, type SliderOptions } from './slider-options.js'

export type DashStackControlProps = {
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

export type TextFieldProps = DashStackControlProps & {
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
    className: 'picodash-dashstack-control',
    'aria-invalid': props['aria-invalid'],
    'aria-errormessage': props['aria-errormessage'],
  }
  return (
    <AriaTextField
      className={composeControlClassName('picodash-dashstack-field', props.className)}
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

export type NumberFieldProps = DashStackControlProps & {
  readonly value: number
  readonly onChange: (value: number | null) => void
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly placeholder?: string
  readonly unit?: string
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
  unit,
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
      className={composeControlClassName('picodash-dashstack-field', props.className)}
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
      <Group data-picodash-number-shell data-unit={unit ? true : undefined}>
        <Input
          ref={inputRef}
          id={props.id}
          placeholder={placeholder}
          className="picodash-dashstack-control"
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
        {unit ? (
          <span data-picodash-number-unit aria-hidden="true">
            {unit}
          </span>
        ) : null}
      </Group>
    </AriaNumberField>
  )
}

export type SliderMark = { readonly value: number; readonly label?: ReactNode }
export type SliderProps = DashStackControlProps & {
  readonly createGesture?: NumericGestureFactory
} & SliderOptions & {
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

export function Slider(props: SliderProps) {
  const { min = 0, max = 100, step = 1, marks } = props
  validateSliderConfiguration(min, max, step, marks)
  validateSliderOptions(min, max, step, props)
  return props.startDetent || props.endDetent ? (
    <DetentSlider {...props} min={min} max={max} step={step} />
  ) : (
    <ContinuousSlider {...props} />
  )
}

function ContinuousSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  marks,
  formatOptions,
  allowedRange,
  fillOrigin,
  createGesture,
  ...props
}: SliderProps) {
  const accessory = useContext(SliderTrackAccessoryContext)
  const rootRef = useRef<HTMLDivElement>(null)
  const change = useNumericControlGesture({
    ref: rootRef,
    createGesture,
    onChange,
    configuration: JSON.stringify([min, max, step, allowedRange]),
    disabled: !!(props.disabled || props.readOnly),
  })
  const constraintId = useId()
  const lower = allowedRange?.min ?? min
  const upper = allowedRange?.max ?? max
  const fillStart = Math.min(value, fillOrigin ?? value)
  const fillEnd = Math.max(value, fillOrigin ?? value)
  const fillSpan = fillEnd - fillStart
  const availableStart = Math.max(fillStart, lower)
  const availableEnd = Math.min(fillEnd, upper)
  const inputRef = usePrimaryControlRef<HTMLInputElement>()
  const readOnlyDescription = useReadOnlyDescription(props.readOnly, props['aria-describedby'])

  return (
    <>
      <AriaSlider
        ref={rootRef}
        id={props.id}
        className={composeControlClassName('picodash-dashstack-slider', props.className)}
        value={value}
        onChange={
          props.readOnly ? undefined : (next) => change(Math.max(lower, Math.min(upper, next)))
        }
        minValue={min}
        maxValue={max}
        step={step}
        formatOptions={formatOptions}
        isDisabled={props.disabled}
        aria-label={undefined}
        aria-labelledby={props['aria-labelledby']}
        aria-describedby={props['aria-describedby']}
        aria-invalid={props['aria-invalid']}
        aria-errormessage={props['aria-errormessage']}
      >
        {/* A label anchor keeps React Aria from naming the thumb from group contents. */}
        <Label className="picodash-visually-hidden">
          {props['aria-labelledby'] ? null : props['aria-label']}
        </Label>
        <SliderOutput aria-hidden="true">{({ state }) => state.getThumbValueLabel(0)}</SliderOutput>
        <SliderTrack
          className="picodash-dashstack-slider-track"
          data-constrained={allowedRange ? true : undefined}
        >
          {allowedRange && (
            <span
              aria-hidden="true"
              data-picodash-slider-allowed
              style={{
                insetInlineStart: `${sliderMarkPosition(lower, min, max)}%`,
                inlineSize: `${sliderMarkPosition(upper, min, max) - sliderMarkPosition(lower, min, max)}%`,
              }}
            />
          )}
          {fillOrigin !== undefined && (
            <span
              aria-hidden="true"
              data-picodash-slider-fill={value < fillOrigin ? 'negative' : 'positive'}
              data-constrained={allowedRange ? true : undefined}
              style={{
                insetInlineStart: `${sliderMarkPosition(Math.min(value, fillOrigin), min, max)}%`,
                inlineSize: `${Math.abs(sliderMarkPosition(value, min, max) - sliderMarkPosition(fillOrigin, min, max))}%`,
              }}
            >
              {allowedRange && fillSpan > 0 && availableEnd > availableStart && (
                <span
                  data-picodash-slider-fill-available
                  style={{
                    insetInlineStart: `${((availableStart - fillStart) / fillSpan) * 100}%`,
                    inlineSize: `${((availableEnd - availableStart) / fillSpan) * 100}%`,
                  }}
                />
              )}
            </span>
          )}
          <SliderThumb
            index={0}
            inputRef={inputRef}
            data-picodash-dashstack-slider-thumb
            aria-labelledby={props['aria-labelledby']}
            aria-describedby={
              [readOnlyDescription.describedBy, allowedRange ? constraintId : undefined]
                .filter(Boolean)
                .join(' ') || undefined
            }
            isInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
            aria-errormessage={props['aria-errormessage']}
          />
          {accessory}
          {marks?.length ? (
            <span aria-hidden="true" data-picodash-dashstack-slider-marks>
              {marks.map((mark, index) => (
                <span
                  key={index}
                  data-picodash-dashstack-slider-mark={mark.value}
                  style={
                    {
                      '--_picodash-dashstack-slider-mark-position': `${sliderMarkPosition(mark.value, min, max)}%`,
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
      {allowedRange && (
        <span id={constraintId} hidden>
          Allowed range: {lower} to {upper}.
        </span>
      )}
      {readOnlyDescription.description}
    </>
  )
}

export type SwitchProps = DashStackControlProps & {
  readonly isSelected: boolean
  readonly onChange: (isSelected: boolean) => void
}

export function Switch({ isSelected, onChange, ...props }: SwitchProps) {
  const inputRef = usePrimaryControlRef<HTMLInputElement>()
  return (
    <AriaSwitch
      inputRef={inputRef}
      id={props.id}
      className={composeControlClassName('picodash-dashstack-switch', props.className)}
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
      <span aria-hidden="true" data-picodash-dashstack-switch-track>
        <span aria-hidden="true" data-picodash-dashstack-switch-marker />
      </span>
      <span data-picodash-dashstack-switch-label>{props['aria-label']}</span>
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

export type SelectProps<T extends string | number> = DashStackControlProps & {
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
        className={composeControlClassName('picodash-dashstack-select', props.className)}
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
          className="picodash-dashstack-control"
          aria-describedby={readOnlyDescription.describedBy}
          aria-invalid={props['aria-invalid']}
          aria-errormessage={props['aria-errormessage']}
        >
          <SelectValue<OptionParts<T>>>
            {({ selectedItem, defaultChildren }) =>
              selectedItem === null && value !== undefined ? String(value) : defaultChildren
            }
          </SelectValue>
          <span aria-hidden="true" data-picodash-select-disclosure>
            ▾
          </span>
        </Button>
        <ChoicePopover>
          <ListBox<OptionParts<T>> className="picodash-dashstack-listbox" items={parts}>
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
      data-picodash-dashstack-segment
      aria-label={typeof item.label === 'string' ? undefined : item.textValue}
    >
      {({ isSelected }) => (
        <>
          <SelectionIndicator
            isSelected={isSelected}
            aria-hidden="true"
            data-picodash-dashstack-segment-indicator
          />
          <span aria-hidden="true" data-picodash-dashstack-segment-marker />
          {item.icon}
          {item.label}
        </>
      )}
    </Radio>
  )
}

export type SegmentedControlProps<T extends string | number> = DashStackControlProps & {
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
      className={composeControlClassName('picodash-dashstack-segmented', props.className)}
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

export type DisplayProps = DashStackControlProps & {
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
      className={composeControlClassName('picodash-dashstack-display', props.className)}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      aria-errormessage={props['aria-errormessage']}
      data-picodash-dashstack-display
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

export { TargetNumber } from './target-number.js'
export type { TargetNumberProps, TargetNumberResult } from './target-number.js'
export { TargetSlider } from './target-slider.js'
export type { TargetSliderProps, TargetSliderResult } from './target-slider.js'

export type { SliderDetent } from './slider-options.js'
