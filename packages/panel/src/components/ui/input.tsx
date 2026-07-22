'use client'

import * as React from 'react'
import { composeRenderProps, Input as InputPrimitive } from 'react-aria-components'

import { cn } from '#lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<typeof InputPrimitive>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={composeRenderProps(className, (className) =>
        cn(
          'flex h-(--picodash-control-height-md) w-full min-w-0 rounded-picodash-control border-0 border-b border-picodash-control bg-transparent px-(--picodash-space-2-5) py-(--picodash-space-1) text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) text-picodash-text shadow-none outline-none transition-colors duration-(--picodash-duration-fast) file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-picodash-text placeholder:text-picodash-muted data-focused:bg-picodash-canvas data-focus-visible:ring-2 data-focus-visible:ring-picodash-focus data-disabled:cursor-not-allowed data-disabled:opacity-(--picodash-opacity-disabled) aria-invalid:border-picodash-danger aria-invalid:ring-2 aria-invalid:ring-picodash-danger/20',
          className,
        ),
      )}
      {...props}
    />
  )
}

export { Input }
