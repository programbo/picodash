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
          'flex h-(--tweaker-control-height-md) w-full min-w-0 rounded-tweaker-control border-0 border-b border-tweaker-control bg-transparent px-(--tweaker-space-2-5) py-(--tweaker-space-1) text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) text-tweaker-text shadow-none outline-none transition-colors duration-(--tweaker-duration-fast) file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-tweaker-text placeholder:text-tweaker-muted data-focused:bg-tweaker-canvas data-focus-visible:ring-2 data-focus-visible:ring-tweaker-focus data-disabled:cursor-not-allowed data-disabled:opacity-(--tweaker-opacity-disabled) aria-invalid:border-tweaker-danger aria-invalid:ring-2 aria-invalid:ring-tweaker-danger/20',
          className,
        ),
      )}
      {...props}
    />
  )
}

export { Input }
