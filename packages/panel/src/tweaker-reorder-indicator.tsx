import { GripVertical } from 'lucide-react'

export interface TweakerReorderIndicatorProps {
  reorderable: boolean
}

export function TweakerReorderIndicator({ reorderable }: TweakerReorderIndicatorProps) {
  return reorderable ? (
    <GripVertical
      className="size-(--tweaker-icon-sm)"
      data-tweaker-reorder-indicator="grip"
      aria-hidden="true"
    />
  ) : (
    <span
      className="bg-tweaker-muted size-(--tweaker-space-1-5) opacity-(--tweaker-opacity-subtle)"
      data-tweaker-reorder-indicator="static"
      aria-hidden="true"
    />
  )
}
