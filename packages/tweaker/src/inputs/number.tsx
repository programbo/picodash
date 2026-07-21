import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { formatNumericValue } from '../number-format.js'
import {
  TweakerItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerItemContextValue,
  type TweakerInputItemProps,
} from '../tweaker-control.js'
import { Input } from '../components/ui/input.js'
import type { TweakerParser } from '../tweaker-validation.js'
import { canonicalTweakerValue, invalidTweakerValue } from './built-in-validation.js'

export interface TweakerNumberProps extends Omit<
  TweakerInputItemProps<number>,
  'children' | 'defaultValue' | 'parse'
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
  const bounds = normalizeNumberBounds(min, max)
  const normalizedDefault =
    typeof defaultValue === 'number' && Number.isFinite(defaultValue)
      ? clampNumber(defaultValue, bounds.min, bounds.max)
      : undefined
  const parse = useMemo<TweakerParser<number>>(
    () => (input, context) => {
      const error = 'Number value must be finite and within its configured bounds.'
      if (typeof input === 'number' && Number.isFinite(input)) {
        return canonicalTweakerValue(input, clampNumber(input, bounds.min, bounds.max), error)
      }
      if (context.source === 'import') return invalidTweakerValue(error)
      return normalizedDefault === undefined
        ? { errors: [error], repair: { unset: true }, success: false }
        : { errors: [error], repair: { value: normalizedDefault }, success: false }
    },
    [bounds.max, bounds.min, normalizedDefault],
  )

  return (
    <TweakerItem<number> {...controlProps} defaultValue={normalizedDefault} parse={parse}>
      {(control) => (
        <FormattedNumberInput
          control={control}
          defaultValue={normalizedDefault}
          formatOptions={formatOptions}
          max={bounds.max}
          min={bounds.min}
          placeholder={placeholder}
          step={step}
        />
      )}
    </TweakerItem>
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
  control: TweakerItemContextValue<number>
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

        const nextValue = Number(nextDraftValue)
        control.setInput(
          nextDraftValue.trim() !== '' && Number.isFinite(nextValue) ? nextValue : nextDraftValue,
        )
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

function normalizeNumberBounds(min: number | undefined, max: number | undefined) {
  const finiteMin = typeof min === 'number' && Number.isFinite(min) ? min : undefined
  const finiteMax = typeof max === 'number' && Number.isFinite(max) ? max : undefined
  if (finiteMin !== undefined && finiteMax !== undefined && finiteMin > finiteMax) {
    return { max: finiteMin, min: finiteMax }
  }
  return { max: finiteMax, min: finiteMin }
}

function clampNumber(value: number, min: number | undefined, max: number | undefined) {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value))
}
