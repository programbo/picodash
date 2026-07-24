import * as React from 'react'
import { composeRenderProps, TextArea as TextareaPrimitive } from 'react-aria-components'

import { cn } from '#lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<typeof TextareaPrimitive>) {
  return (
    <TextareaPrimitive
      data-slot="textarea"
      className={composeRenderProps(className, (className) =>
        cn(
          'rounded-picodash-control border-picodash-control text-picodash-text placeholder:text-picodash-muted data-focused:bg-picodash-canvas data-focus-visible:ring-picodash-focus aria-invalid:border-picodash-danger aria-invalid:ring-picodash-danger/20 flex field-sizing-content min-h-(--picodash-control-height-lg) w-full resize-y border-0 border-b bg-transparent px-(--picodash-space-2-5) py-(--picodash-space-1-5) text-(length:--picodash-font-size-lg) leading-(--picodash-line-normal) shadow-none transition-colors duration-(--picodash-duration-fast) outline-none aria-invalid:ring-2 data-disabled:cursor-not-allowed data-disabled:opacity-(--picodash-opacity-disabled) data-focus-visible:ring-2',
          className,
        ),
      )}
      {...props}
    />
  )
}

export { Textarea }
