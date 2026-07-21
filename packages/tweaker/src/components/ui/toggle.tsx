'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { ToggleButton as TogglePrimitive, type ToggleButtonProps } from 'react-aria-components'

import { cn } from '#lib/utils'

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-2xl text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-tweaker-surface-muted hover:text-tweaker-text focus-visible:border-tweaker-focus focus-visible:ring-[3px] focus-visible:ring-tweaker-focus/30 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-tweaker-danger aria-invalid:ring-tweaker-danger/20 aria-pressed:bg-tweaker-surface-muted dark:aria-invalid:ring-tweaker-danger/40 data-selected:bg-tweaker-surface-muted [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border border-tweaker-control bg-transparent hover:bg-tweaker-surface-muted',
      },
      size: {
        default:
          'h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        sm: 'h-7 min-w-7 px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5',
        lg: 'h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Toggle({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ToggleButtonProps & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
