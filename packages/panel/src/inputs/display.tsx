import type { ReactNode } from 'react'
import {
  TweakerItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerDisplayItemProps,
} from '../tweaker-control.js'
import type { TweakerValue } from '../tweaker-panel.js'
import { cn } from '../utils.js'
import type { DistributiveOmit } from './built-in-validation.js'

export type TweakerDisplayProps = DistributiveOmit<
  TweakerDisplayItemProps<TweakerValue>,
  'children' | 'defaultValue' | 'onValueChange' | 'parse' | 'validate' | 'valueMode'
> & {
  fallback?: ReactNode
  value?: ReactiveProp<ReactNode>
}

export function TweakerDisplay({
  fallback = 'Unset',
  value: valueProp,
  ...controlProps
}: TweakerDisplayProps) {
  const value = useResolvedPanelProp(valueProp)

  return (
    <TweakerItem<TweakerValue> {...controlProps} readOnly valueMode="display">
      {(control) => (
        <div
          className={cn(
            'col-span-2 min-h-0 px-(--tweaker-space-1) py-(--tweaker-space-0-5) text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-normal) text-tweaker-text',
            control.value === undefined && value === undefined && 'text-tweaker-muted',
          )}
        >
          {value ?? valueToDisplay(control.value) ?? fallback}
        </div>
      )}
    </TweakerItem>
  )
}

function valueToDisplay(value: TweakerValue | undefined): ReactNode {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
