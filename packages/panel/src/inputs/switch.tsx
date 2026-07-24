import { useMemo } from 'react'
import { Switch } from '../components/ui/switch.js'
import { PicodashItem, type PicodashInputItemProps } from '../components/panel/PicodashItem.js'
import type { PicodashParser } from '../validation/picodash-validation.js'
import { canonicalPicodashValue, invalidPicodashValue } from './internal/built-in-validation.js'

export interface PicodashSwitchProps extends Omit<
  PicodashInputItemProps<boolean>,
  'children' | 'defaultValue' | 'parse'
> {
  defaultValue?: boolean
}

export function PicodashSwitch({ defaultValue = false, ...controlProps }: PicodashSwitchProps) {
  const normalizedDefault = typeof defaultValue === 'boolean' ? defaultValue : false
  const parse = useMemo<PicodashParser<boolean>>(
    () => (input, context) => {
      if (typeof input === 'boolean') return { output: { value: input }, success: true }
      const error = 'Switch value must be a boolean.'
      return context.source === 'import'
        ? invalidPicodashValue(error)
        : canonicalPicodashValue(input, normalizedDefault, error)
    },
    [normalizedDefault],
  )

  return (
    <PicodashItem<boolean> {...controlProps} defaultValue={normalizedDefault} parse={parse}>
      {(control) => (
        <Switch
          aria-labelledby={`${control.id}:label`}
          className="col-span-2"
          isDisabled={control.disabled || control.readOnly}
          isSelected={typeof control.value === 'boolean' ? control.value : normalizedDefault}
          onChange={control.setInput}
        />
      )}
    </PicodashItem>
  )
}
