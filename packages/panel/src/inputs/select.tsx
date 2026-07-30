import type { ReactNode } from 'react'
import {
  PicodashItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type PicodashInputItemProps,
} from '../components/panel/PicodashItem.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select.js'

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
  const normalizedDefaultValue = normalizeSelectValue(defaultValue, options)

  return (
    <PicodashItem<string> {...controlProps}>
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
