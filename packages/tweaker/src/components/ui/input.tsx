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
          'h-8 w-full min-w-0 rounded-2xl border border-transparent bg-tweaker-control/50 px-2.5 py-1 text-base transition-[color,box-shadow] duration-200 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-tweaker-text placeholder:text-tweaker-muted focus-visible:border-tweaker-focus focus-visible:ring-3 focus-visible:ring-tweaker-focus/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-tweaker-danger aria-invalid:ring-3 aria-invalid:ring-tweaker-danger/20 md:text-sm dark:aria-invalid:border-tweaker-danger/50 dark:aria-invalid:ring-tweaker-danger/40',
          className,
        ),
      )}
      {...props}
    />
  )
}

export { Input }
