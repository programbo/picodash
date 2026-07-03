import {
  TweakerControl,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlProps,
} from '../tweaker-control.js'
import { Input } from '../ui.js'

export interface TweakerNumberProps extends Omit<
  TweakerControlProps<number>,
  'children' | 'defaultValue'
> {
  defaultValue?: number
  max?: ReactiveProp<number>
  min?: ReactiveProp<number>
  placeholder?: string
  step?: ReactiveProp<number>
}

export function TweakerNumber({
  defaultValue,
  max: maxProp,
  min: minProp,
  placeholder,
  step: stepProp,
  ...controlProps
}: TweakerNumberProps) {
  const min = useResolvedPanelProp(minProp)
  const max = useResolvedPanelProp(maxProp)
  const step = useResolvedPanelProp(stepProp, 1)

  return (
    <TweakerControl<number> {...controlProps} defaultValue={defaultValue}>
      {(control) => (
        <Input
          id={control.inputId}
          disabled={control.disabled}
          max={max}
          min={min}
          placeholder={placeholder}
          readOnly={control.readOnly}
          step={step}
          type="number"
          value={typeof control.value === 'number' ? control.value : (defaultValue ?? '')}
          onChange={(event) => {
            if (event.currentTarget.value === '') return
            control.setValue(event.currentTarget.valueAsNumber)
          }}
        />
      )}
    </TweakerControl>
  )
}
