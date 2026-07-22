import { GripVertical } from 'lucide-react'

export interface PicodashReorderIndicatorProps {
  reorderable: boolean
}

export function PicodashReorderIndicator({ reorderable }: PicodashReorderIndicatorProps) {
  return reorderable ? (
    <GripVertical
      className="size-(--picodash-icon-sm)"
      data-picodash-reorder-indicator="grip"
      aria-hidden="true"
    />
  ) : (
    <span
      className="bg-picodash-muted size-(--picodash-space-1-5) opacity-(--picodash-opacity-subtle)"
      data-picodash-reorder-indicator="static"
      aria-hidden="true"
    />
  )
}
