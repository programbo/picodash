import { useEffect, useMemo, type ReactNode } from 'react'
import {
  TweakerControl,
  TweakerImportAllowedStringValuesProvider,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlContextValue,
  type TweakerControlProps,
} from '../tweaker-control.js'
import { synchronizeOptionalTweakerFieldValue } from '../tweaker-control-value.js'
import { useTweakerPanelStoreApi } from '../tweaker-panel.js'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui.js'

export type TweakerSelectOption =
  | string
  | {
      disabled?: boolean
      label?: ReactNode
      value: string
    }

export interface TweakerSelectProps extends Omit<
  TweakerControlProps<string>,
  'children' | 'defaultValue'
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
  const importAllowedValuesKey = JSON.stringify(selectOptionValues(options))
  const importAllowedValues = useMemo(
    () => JSON.parse(importAllowedValuesKey) as string[],
    [importAllowedValuesKey],
  )
  const normalizedDefaultValue = normalizeSelectValue(defaultValue, options)

  return (
    <TweakerImportAllowedStringValuesProvider values={importAllowedValues}>
      <TweakerControl<string> {...controlProps} defaultValue={normalizedDefaultValue}>
        {(control) => {
          const value = normalizeSelectValue(control.value, options, normalizedDefaultValue)

          return (
            <>
              <TweakerSelectValueSynchronizer
                control={control}
                fallback={normalizedDefaultValue}
                options={options}
              />
              <Select
                disabled={control.disabled || control.readOnly}
                value={value ?? ''}
                onValueChange={control.setValue}
              >
                <SelectTrigger id={control.inputId} className="col-span-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => {
                    const value = optionValue(option)

                    return (
                      <SelectItem
                        key={value}
                        disabled={optionDisabled(option)}
                        textValue={optionTextValue(option)}
                        value={value}
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
      </TweakerControl>
    </TweakerImportAllowedStringValuesProvider>
  )
}

function TweakerSelectValueSynchronizer({
  control,
  fallback,
  options,
}: {
  control: TweakerControlContextValue<string>
  fallback?: string
  options: readonly TweakerSelectOption[]
}) {
  const store = useTweakerPanelStoreApi()

  useEffect(() => {
    synchronizeOptionalTweakerFieldValue(
      control,
      (currentValue) => normalizeSelectValue(currentValue, options, fallback),
      (currentValue, normalizedValue) => currentValue === normalizedValue,
      store,
    )
  }, [control, fallback, options, store])

  return null
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
