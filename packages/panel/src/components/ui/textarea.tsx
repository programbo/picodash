import * as React from 'react'
import { composeRenderProps, TextArea as TextareaPrimitive } from 'react-aria-components'

import { cn } from '#lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<typeof TextareaPrimitive>) {
  return (
    <TextareaPrimitive
      data-slot="textarea"
      className={composeRenderProps(className, (className) =>
        cn(
          'field-sizing-content flex min-h-(--picodash-control-height-lg) w-full resize-y rounded-picodash-control border-0 border-b border-picodash-control bg-transparent px-(--picodash-space-2-5) py-(--picodash-space-1-5) text-(length:--picodash-font-size-lg) leading-(--picodash-line-normal) text-picodash-text shadow-none outline-none transition-colors duration-(--picodash-duration-fast) placeholder:text-picodash-muted data-focused:bg-picodash-canvas data-focus-visible:ring-2 data-focus-visible:ring-picodash-focus data-disabled:cursor-not-allowed data-disabled:opacity-(--picodash-opacity-disabled) aria-invalid:border-picodash-danger aria-invalid:ring-2 aria-invalid:ring-picodash-danger/20',
          className,
        ),
      )}
      {...props}
    />
  )
}

export { Textarea }
