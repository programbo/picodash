import type { ReactNode } from 'react'
import {
  TweakerControl,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlProps,
} from '../tweaker-control.js'
import { Select } from '../ui.js'

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
          id={control.inputId}
          className="col-span-2"
          disabled={control.disabled || control.readOnly}
          value={
            typeof control.value === 'string' ? control.value : (defaultValue ?? firstValue ?? '')
          }
          onChange={(event) => control.setValue(event.currentTarget.value)}
        >
          {options.map((option) => {
            const value = optionValue(option)
            if (value === undefined) return null

            return (
              <option key={value} disabled={optionDisabled(option)} value={value}>
                {optionLabel(option)}
              </option>
            )
          })}
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

function optionDisabled(option: TweakerSelectOption) {
  return typeof option === 'string' ? false : option.disabled
}
