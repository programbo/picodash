import { TweakerControl, type TweakerControlProps } from '../tweaker-control.js'
import { Switch } from '../ui.js'

export interface TweakerSwitchProps extends Omit<
  TweakerControlProps<boolean>,
  'children' | 'defaultValue'
> {
  defaultValue?: boolean
}

export function TweakerSwitch({ defaultValue = false, ...controlProps }: TweakerSwitchProps) {
  return (
    <TweakerControl<boolean> {...controlProps} defaultValue={defaultValue}>
      {(control) => (
        <Switch
          aria-labelledby={`${control.id}:label`}
          checked={typeof control.value === 'boolean' ? control.value : defaultValue}
          disabled={control.disabled || control.readOnly}
          onCheckedChange={control.setValue}
        />
      )}
    </TweakerControl>
  )
}
