import { useMemo } from 'react'
import { Switch } from '../components/ui/switch.js'
import { TweakerItem, type TweakerInputItemProps } from '../tweaker-control.js'
import type { TweakerParser } from '../tweaker-validation.js'
import { canonicalTweakerValue, invalidTweakerValue } from './built-in-validation.js'

export interface TweakerSwitchProps extends Omit<
  TweakerInputItemProps<boolean>,
  'children' | 'defaultValue' | 'parse'
> {
  defaultValue?: boolean
}

export function TweakerSwitch({ defaultValue = false, ...controlProps }: TweakerSwitchProps) {
  const normalizedDefault = typeof defaultValue === 'boolean' ? defaultValue : false
  const parse = useMemo<TweakerParser<boolean>>(
    () => (input, context) => {
      if (typeof input === 'boolean') return { output: { value: input }, success: true }
      const error = 'Switch value must be a boolean.'
      return context.source === 'import'
        ? invalidTweakerValue(error)
        : canonicalTweakerValue(input, normalizedDefault, error)
    },
    [normalizedDefault],
  )

  return (
    <TweakerItem<boolean> {...controlProps} defaultValue={normalizedDefault} parse={parse}>
      {(control) => (
        <Switch
          aria-labelledby={`${control.id}:label`}
          className="col-span-2"
          isDisabled={control.disabled || control.readOnly}
          isSelected={typeof control.value === 'boolean' ? control.value : normalizedDefault}
          onChange={control.setInput}
        />
      )}
    </TweakerItem>
  )
}
