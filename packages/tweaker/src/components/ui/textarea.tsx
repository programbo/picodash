import * as React from 'react'
import { composeRenderProps, TextArea as TextareaPrimitive } from 'react-aria-components'

import { cn } from '#lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<typeof TextareaPrimitive>) {
  return (
    <TextareaPrimitive
      data-slot="textarea"
      className={composeRenderProps(className, (className) =>
        cn(
          'field-sizing-content flex min-h-(--tweaker-control-height-lg) w-full resize-y rounded-tweaker-control border-0 border-b border-tweaker-control bg-transparent px-(--tweaker-space-2-5) py-(--tweaker-space-1-5) text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-normal) text-tweaker-text shadow-none outline-none transition-colors duration-(--tweaker-duration-fast) placeholder:text-tweaker-muted data-focused:bg-tweaker-canvas data-focus-visible:ring-2 data-focus-visible:ring-tweaker-focus data-disabled:cursor-not-allowed data-disabled:opacity-(--tweaker-opacity-disabled) aria-invalid:border-tweaker-danger aria-invalid:ring-2 aria-invalid:ring-tweaker-danger/20',
          className,
        ),
      )}
      {...props}
    />
  )
}

export { Textarea }
