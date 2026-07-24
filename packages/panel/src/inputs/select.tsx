import { useMemo, type ReactNode } from 'react'
import {
  PicodashItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type PicodashInputItemProps,
} from '../components/panel/PicodashItem.js'
import type { PicodashParser } from '../validation/picodash-validation.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select.js'
import {
  canonicalPicodashValue,
  invalidPicodashValue,
  unsetPicodashValue,
} from './internal/built-in-validation.js'

export type PicodashSelectOption =
  | string
  | {
      disabled?: boolean
      label?: ReactNode
      value: string
    }

export interface PicodashSelectProps extends Omit<
  PicodashInputItemProps<string>,
  'children' | 'defaultValue' | 'parse'
> {
  defaultValue?: string
  options: ReactiveProp<PicodashSelectOption[]>
}

export function PicodashSelect({
  defaultValue,
  options: optionsProp,
  ...controlProps
}: PicodashSelectProps) {
  const options = useResolvedPanelProp(optionsProp, []) ?? []
  const optionValuesKey = JSON.stringify(selectOptionValues(options))
  const optionValues = useMemo(() => JSON.parse(optionValuesKey) as string[], [optionValuesKey])
  const normalizedDefaultValue = normalizeSelectValue(defaultValue, options)
  const parse = useMemo<PicodashParser<string>>(
    () => (input, context) => {
      if (typeof input === 'string' && optionValues.includes(input)) {
        return { output: { value: input }, success: true }
      }
      const error =
        optionValues.length === 0
          ? 'Select has no available options, so its field must be unset.'
          : 'Select value must match one of its options.'
      if (context.source === 'import') return invalidPicodashValue(error)
      const fallback =
        normalizedDefaultValue !== undefined && optionValues.includes(normalizedDefaultValue)
          ? normalizedDefaultValue
          : optionValues[0]
      return fallback === undefined
        ? unsetPicodashValue(input, error)
        : canonicalPicodashValue(input, fallback, error)
    },
    [normalizedDefaultValue, optionValues],
  )

  return (
    <PicodashItem<string> {...controlProps} defaultValue={normalizedDefaultValue} parse={parse}>
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
    </PicodashItem>
  )
}

export function normalizeSelectValue(
  value: unknown,
  options: readonly PicodashSelectOption[],
  fallback?: string,
) {
  const values = selectOptionValues(options)
  if (typeof value === 'string' && values.includes(value)) return value
  if (fallback !== undefined && values.includes(fallback)) return fallback
  return values[0]
}

export function selectOptionValues(options: readonly PicodashSelectOption[]): string[] {
  return Array.from(new Set(options.map((option) => optionValue(option))))
}

function optionValue(option: PicodashSelectOption): string
function optionValue(option: PicodashSelectOption | undefined): string | undefined
function optionValue(option: PicodashSelectOption | undefined) {
  return typeof option === 'string' ? option : option?.value
}

function optionLabel(option: PicodashSelectOption) {
  return typeof option === 'string' ? option : (option.label ?? option.value)
}

function optionTextValue(option: PicodashSelectOption) {
  const label = optionLabel(option)
  return typeof label === 'string' ? label : optionValue(option)
}

function optionDisabled(option: PicodashSelectOption) {
  return typeof option === 'string' ? false : option.disabled
}
