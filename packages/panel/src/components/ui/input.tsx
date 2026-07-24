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
          'rounded-picodash-control border-picodash-control text-picodash-text file:text-picodash-text placeholder:text-picodash-muted data-focused:bg-picodash-canvas data-focus-visible:ring-picodash-focus aria-invalid:border-picodash-danger aria-invalid:ring-picodash-danger/20 flex h-(--picodash-control-height-md) w-full min-w-0 border-0 border-b bg-transparent px-(--picodash-space-2-5) py-(--picodash-space-1) text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) shadow-none transition-colors duration-(--picodash-duration-fast) outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium aria-invalid:ring-2 data-disabled:cursor-not-allowed data-disabled:opacity-(--picodash-opacity-disabled) data-focus-visible:ring-2',
          className,
        ),
      )}
      {...props}
    />
  )
}

export { Input }
