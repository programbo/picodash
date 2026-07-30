import { Switch } from '../components/ui/switch.js'
import { PicodashItem, type PicodashInputItemProps } from '../components/panel/PicodashItem.js'

export interface PicodashSwitchProps extends Omit<
  PicodashInputItemProps<boolean>,
  'children' | 'defaultValue' | 'parse'
> {
  defaultValue?: boolean
}

export function PicodashSwitch({ defaultValue = false, ...controlProps }: PicodashSwitchProps) {
  const normalizedDefault = typeof defaultValue === 'boolean' ? defaultValue : false

  return (
    <PicodashItem<boolean> {...controlProps}>
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
