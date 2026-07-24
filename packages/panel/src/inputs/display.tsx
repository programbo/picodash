import type { ReactNode } from 'react'
import {
  PicodashItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type PicodashDisplayItemProps,
} from '../components/panel/PicodashItem.js'
import type { PicodashValue } from '../components/panel/PicodashPanel.js'
import { cn } from '../utilities/utils.js'
import type { DistributiveOmit } from './internal/built-in-validation.js'

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
            'text-picodash-text col-span-2 min-h-0 px-(--picodash-space-1) py-(--picodash-space-0-5) text-(length:--picodash-font-size-lg) leading-(--picodash-line-normal)',
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
