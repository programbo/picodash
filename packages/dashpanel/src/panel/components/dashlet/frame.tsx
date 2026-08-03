import * as React from 'react'

import { cn } from '../../lib/utils.js'

export type FrameProps = React.ComponentProps<'section'>

function Frame({ className, ...props }: FrameProps) {
  return (
    <section
      {...props}
      data-slot="dashlet-frame"
      className={cn('text-picodash-text flex min-w-0 flex-col gap-(--picodash-space-3)', className)}
    />
  )
}

export { Frame }
