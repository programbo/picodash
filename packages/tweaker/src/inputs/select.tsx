import { useMemo, type ReactNode } from 'react'
import {
  TweakerItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerInputItemProps,
} from '../tweaker-control.js'
import type { TweakerParser } from '../tweaker-validation.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select.js'
import {
  canonicalTweakerValue,
  invalidTweakerValue,
  unsetTweakerValue,
} from './built-in-validation.js'

export type TweakerSelectOption =
  | string
  | {
      disabled?: boolean
      label?: ReactNode
      value: string
    }

export interface TweakerSelectProps extends Omit<
  TweakerInputItemProps<string>,
  'children' | 'defaultValue' | 'parse'
> {
  defaultValue?: string
  options: ReactiveProp<TweakerSelectOption[]>
}

export function TweakerSelect({
  defaultValue,
  options: optionsProp,
  ...controlProps
}: TweakerSelectProps) {
  const options = useResolvedPanelProp(optionsProp, []) ?? []
  const optionValuesKey = JSON.stringify(selectOptionValues(options))
  const optionValues = useMemo(() => JSON.parse(optionValuesKey) as string[], [optionValuesKey])
  const normalizedDefaultValue = normalizeSelectValue(defaultValue, options)
  const parse = useMemo<TweakerParser<string>>(
    () => (input, context) => {
      if (typeof input === 'string' && optionValues.includes(input)) {
        return { output: { value: input }, success: true }
      }
      const error =
        optionValues.length === 0
          ? 'Select has no available options, so its field must be unset.'
          : 'Select value must match one of its options.'
      if (context.source === 'import') return invalidTweakerValue(error)
      const fallback =
        normalizedDefaultValue !== undefined && optionValues.includes(normalizedDefaultValue)
          ? normalizedDefaultValue
          : optionValues[0]
      return fallback === undefined
        ? unsetTweakerValue(input, error)
        : canonicalTweakerValue(input, fallback, error)
    },
    [normalizedDefaultValue, optionValues],
  )

  return (
    <TweakerItem<string> {...controlProps} defaultValue={normalizedDefaultValue} parse={parse}>
      {(control) => {
        const value = normalizeSelectValue(control.value, options, normalizedDefaultValue)

        return (
          <>
            <Select
              aria-labelledby={`${control.id}:label`}
              className="col-span-2 w-full"
              isDisabled={control.disabled || control.readOnly}
              selectedKey={value ?? null}
              onSelectionChange={(nextValue) => {
                if (typeof nextValue === 'string') control.setInput(nextValue)
              }}
            >
              <SelectTrigger id={control.inputId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => {
                  const value = optionValue(option)

                  return (
                    <SelectItem
                      key={value}
                      id={value}
                      isDisabled={optionDisabled(option)}
                      textValue={optionTextValue(option)}
                    >
                      {optionLabel(option)}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </>
        )
      }}
    </TweakerItem>
  )
}

export function normalizeSelectValue(
  value: unknown,
  options: readonly TweakerSelectOption[],
  fallback?: string,
) {
  const values = selectOptionValues(options)
  if (typeof value === 'string' && values.includes(value)) return value
  if (fallback !== undefined && values.includes(fallback)) return fallback
  return values[0]
}

export function selectOptionValues(options: readonly TweakerSelectOption[]): string[] {
  return Array.from(new Set(options.map((option) => optionValue(option))))
}

function optionValue(option: TweakerSelectOption): string
function optionValue(option: TweakerSelectOption | undefined): string | undefined
function optionValue(option: TweakerSelectOption | undefined) {
  return typeof option === 'string' ? option : option?.value
}

function optionLabel(option: TweakerSelectOption) {
  return typeof option === 'string' ? option : (option.label ?? option.value)
}

function optionTextValue(option: TweakerSelectOption) {
  const label = optionLabel(option)
  return typeof label === 'string' ? label : optionValue(option)
}

function optionDisabled(option: TweakerSelectOption) {
  return typeof option === 'string' ? false : option.disabled
}
