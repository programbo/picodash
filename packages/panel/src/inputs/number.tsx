import { useEffect, useState, type KeyboardEvent } from 'react'
import { formatNumericValue } from '../number-format.js'
import {
  TweakerControl,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlContextValue,
  type TweakerControlProps,
} from '../tweaker-control.js'
import { Input } from '../ui.js'

export interface TweakerNumberProps extends Omit<
  TweakerControlProps<number>,
  'children' | 'defaultValue'
> {
  defaultValue?: number
  formatOptions?: ReactiveProp<Intl.NumberFormatOptions>
  max?: ReactiveProp<number>
  min?: ReactiveProp<number>
  placeholder?: string
  step?: ReactiveProp<number>
}

export function TweakerNumber({
  defaultValue,
  formatOptions: formatOptionsProp,
  max: maxProp,
  min: minProp,
  placeholder,
  step: stepProp,
  ...controlProps
}: TweakerNumberProps) {
  const formatOptions = useResolvedPanelProp(formatOptionsProp)
  const min = useResolvedPanelProp(minProp)
  const max = useResolvedPanelProp(maxProp)
  const step = useResolvedPanelProp(stepProp, 1)

  return (
    <TweakerControl<number> {...controlProps} defaultValue={defaultValue}>
      {(control) => (
        <FormattedNumberInput
          control={control}
          defaultValue={defaultValue}
          formatOptions={formatOptions}
          max={max}
          min={min}
          placeholder={placeholder}
          step={step}
        />
      )}
    </TweakerControl>
  )
}

function FormattedNumberInput({
  control,
  defaultValue,
  formatOptions,
  max,
  min,
  placeholder,
  step = 1,
}: {
  control: TweakerControlContextValue<number>
  defaultValue: number | undefined
  formatOptions: Intl.NumberFormatOptions | undefined
  max: number | undefined
  min: number | undefined
  placeholder: string | undefined
  step: number | undefined
}) {
  const value = typeof control.value === 'number' ? control.value : defaultValue
  const [focused, setFocused] = useState(false)
  const [draftValue, setDraftValue] = useState(value === undefined ? '' : String(value))

  useEffect(() => {
    if (!focused) {
      setDraftValue(value === undefined ? '' : String(value))
    }
  }, [focused, value])

  const displayValue = focused
    ? draftValue
    : value === undefined
      ? ''
      : formatNumericValue(value, { formatOptions, step })

  return (
    <Input
      id={control.inputId}
      className="col-span-2"
      disabled={control.disabled}
      inputMode="decimal"
      max={max}
      min={min}
      placeholder={placeholder}
      readOnly={control.readOnly}
      step={step}
      type="text"
      value={displayValue}
      onBlur={() => {
        setFocused(false)
      }}
      onChange={(event) => {
        const nextDraftValue = event.currentTarget.value
        setDraftValue(nextDraftValue)

        if (nextDraftValue.trim() === '') return

        const nextValue = Number(nextDraftValue)
        if (Number.isFinite(nextValue)) {
          control.setValue(nextValue)
        }
      }}
      onFocus={(event) => {
        const nextDraftValue = value === undefined ? '' : String(value)
        event.currentTarget.value = nextDraftValue
        event.currentTarget.select()
        setFocused(true)
        setDraftValue(nextDraftValue)
      }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
      }}
    />
  )
}
