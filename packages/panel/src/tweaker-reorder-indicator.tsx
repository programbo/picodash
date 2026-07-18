import { GripVertical } from 'lucide-react'

export interface TweakerReorderIndicatorProps {
  reorderable: boolean
}

export function TweakerReorderIndicator({ reorderable }: TweakerReorderIndicatorProps) {
  return reorderable ? (
    <GripVertical
      className="size-(--tweaker-chrome-icon-size)"
      data-tweaker-reorder-indicator="grip"
      aria-hidden="true"
    />
  ) : (
    <span
      className="size-(--tweaker-reorder-static-marker-size) bg-(--tweaker-reorder-static-marker-color) opacity-(--tweaker-reorder-static-marker-opacity)"
      data-tweaker-reorder-indicator="static"
      aria-hidden="true"
    />
  )
}
