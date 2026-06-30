import {
  Button,
  CheckboxButton,
  CheckboxField,
  Group,
  Input,
  ListBox,
  ListBoxItem,
  NumberField,
  Popover,
  Select,
  SelectValue,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from 'react-aria-components'
import { ChevronDown } from 'lucide-react'
import { clamp as clampNumber, formatDisplayValue, formatSliderValue } from '../control.js'
import type { JsonValue, NormalizedControl, TweakerControlProps } from '../types.js'
import { defineTweakerControl, mergeTweakerControls } from './registry.js'

function DisplayControl({ control, labelId, descriptionId }: TweakerControlProps<string | number>) {
  return (
    <output
      id={control.domId}
      className="tw-display"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
    >
      {formatDisplayValue(control)}
    </output>
  )
}

function CheckboxControl({
  control,
  labelId,
  descriptionId,
  setValue,
}: TweakerControlProps<boolean>) {
  return (
    <CheckboxField
      id={control.domId}
      className="tw-checkbox-field"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      isReadOnly={control.readOnly}
      isSelected={Boolean(control.value)}
      onChange={(selected) => setValue(selected)}
    >
      <CheckboxButton className="tw-checkbox" />
    </CheckboxField>
  )
}

function SelectControl({
  control,
  labelId,
  descriptionId,
  panel,
  setValue,
}: TweakerControlProps<string>) {
  const selectedKey = typeof control.value === 'string' ? control.value : ''
  const setSelectOpenActive = (active: boolean) => {
    if (control.readOnly && active) return
    panel.setInteractionActive(`select:${control.persistId}`, active)
  }

  return (
    <Select
      id={control.domId}
      className="tw-select"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      isDisabled={control.readOnly}
      value={selectedKey}
      onOpenChange={setSelectOpenActive}
      onChange={(key) => {
        if (!control.readOnly) setValue(String(key))
      }}
    >
      <Button className="tw-select__button">
        <SelectValue />
        <ChevronDown aria-hidden size={13} />
      </Button>
      <Popover className="tw-select__popover" style={panel.style} data-theme={panel.theme}>
        <ListBox className="tw-select__list">
          {(control.options ?? []).map((option) => (
            <ListBoxItem key={option.value} id={option.value} textValue={option.label}>
              {option.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  )
}

function SliderControl({ control, labelId, descriptionId, setValue }: TweakerControlProps<number>) {
  return (
    <Slider
      className="tw-slider"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      isDisabled={control.readOnly}
      minValue={control.min}
      maxValue={control.max}
      step={control.step ?? 0.01}
      value={Number(control.value)}
      onChange={(value) => {
        if (!control.readOnly) setValue(value)
      }}
    >
      <SliderTrack className="tw-slider__track">
        <SliderThumb
          id={control.domId}
          className="tw-slider__thumb"
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
        />
      </SliderTrack>
      <SliderOutput className="tw-slider__value">{formatSliderValue(control)}</SliderOutput>
    </Slider>
  )
}

function NumberControl({ control, labelId, descriptionId, setValue }: TweakerControlProps<number>) {
  const numberValue = typeof control.value === 'number' ? control.value : 0

  return (
    <NumberField
      className="tw-number-field"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      isReadOnly={control.readOnly}
      minValue={control.min}
      maxValue={control.max}
      step={control.step}
      formatOptions={control.formatOptions}
      value={numberValue}
      onChange={(value) => {
        if (Number.isFinite(value)) setValue(value)
      }}
    >
      <Group>
        <Input id={control.domId} className="tw-number" inputMode="decimal" />
      </Group>
    </NumberField>
  )
}

function sanitizeNumberValue(value: JsonValue, control: NormalizedControl) {
  const fallback = typeof control.defaultValue === 'number' ? control.defaultValue : 0
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return clampNumber(numeric, control.min, control.max)
}

function sanitizeSelectValue(value: JsonValue, control: NormalizedControl) {
  const options = control.options ?? []
  const isValid = (candidate: unknown): candidate is string =>
    typeof candidate === 'string' && options.some((option) => option.value === candidate)
  if (isValid(value)) return value
  if (isValid(control.defaultValue)) return control.defaultValue
  return options[0]?.value ?? ''
}

function sanitizeCheckboxValue(value: JsonValue, control: NormalizedControl) {
  return typeof value === 'boolean' ? value : Boolean(control.defaultValue)
}

function sanitizeDisplayValue(value: JsonValue, control: NormalizedControl) {
  if (typeof value === 'number' || typeof value === 'string') return value
  return typeof control.defaultValue === 'number' || typeof control.defaultValue === 'string'
    ? control.defaultValue
    : ''
}

export const displayControl = defineTweakerControl<string | number>({
  type: 'display',
  valueMode: 'display',
  component: DisplayControl,
  sanitize: sanitizeDisplayValue,
})

export const checkboxControl = defineTweakerControl<boolean>({
  type: 'checkbox',
  component: CheckboxControl,
  sanitize: sanitizeCheckboxValue,
})

export const selectControl = defineTweakerControl<string>({
  type: 'select',
  component: SelectControl,
  sanitize: sanitizeSelectValue,
})

export const sliderControl = defineTweakerControl<number>({
  type: 'slider',
  component: SliderControl,
  sanitize: sanitizeNumberValue,
})

export const numberControl = defineTweakerControl<number>({
  type: 'number',
  component: NumberControl,
  sanitize: sanitizeNumberValue,
})

export const builtinControls = mergeTweakerControls(
  numberControl,
  sliderControl,
  selectControl,
  checkboxControl,
  displayControl,
)
