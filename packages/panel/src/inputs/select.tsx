import type { ReactNode } from 'react'
import {
  TweakerControl,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlProps,
} from '../tweaker-control.js'
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
  const firstValue = optionValue(options[0])

  return (
    <TweakerControl<string> {...controlProps} defaultValue={defaultValue ?? firstValue}>
      {(control) => (
        <Select
          disabled={control.disabled || control.readOnly}
          value={
            typeof control.value === 'string' ? control.value : (defaultValue ?? firstValue ?? '')
          }
          onValueChange={control.setValue}
        >
          <SelectTrigger id={control.inputId} className="col-span-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => {
              const value = optionValue(option)
              if (value === undefined) return null

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
      )}
    </TweakerControl>
  )
}

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
