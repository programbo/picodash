import type { ReactNode } from 'react'
import {
  PicodashItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type PicodashDisplayItemProps,
} from '../picodash-control.js'
import type { PicodashValue } from '../picodash-panel.js'
import { cn } from '../utils.js'
import type { DistributiveOmit } from './built-in-validation.js'

export type PicodashDisplayProps = DistributiveOmit<
  PicodashDisplayItemProps<PicodashValue>,
  'children' | 'defaultValue' | 'onValueChange' | 'parse' | 'validate' | 'valueMode'
> & {
  fallback?: ReactNode
  value?: ReactiveProp<ReactNode>
}

export function PicodashDisplay({
  fallback = 'Unset',
  value: valueProp,
  ...controlProps
}: PicodashDisplayProps) {
  const value = useResolvedPanelProp(valueProp)

  return (
    <PicodashItem<PicodashValue> {...controlProps} readOnly valueMode="display">
      {(control) => (
        <div
          className={cn(
            'col-span-2 min-h-0 px-(--picodash-space-1) py-(--picodash-space-0-5) text-(length:--picodash-font-size-lg) leading-(--picodash-line-normal) text-picodash-text',
            control.value === undefined && value === undefined && 'text-picodash-muted',
          )}
        >
          {value ?? valueToDisplay(control.value) ?? fallback}
        </div>
      )}
    </PicodashItem>
  )
}

function valueToDisplay(value: PicodashValue | undefined): ReactNode {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
