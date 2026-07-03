import { TweakerControl, type TweakerControlProps } from './tweaker-control.js'
import type { TweakerValue } from './tweaker-panel.js'

export interface TweakerFieldProps<TValue extends TweakerValue = TweakerValue> extends Omit<
  TweakerControlProps<TValue>,
  'field'
> {
  field?: string
  fieldId?: string
}

export function TweakerField<TValue extends TweakerValue = TweakerValue>({
  field,
  fieldId,
  ...props
}: TweakerFieldProps<TValue>) {
  return <TweakerControl<TValue> field={field ?? fieldId} {...props} />
}
