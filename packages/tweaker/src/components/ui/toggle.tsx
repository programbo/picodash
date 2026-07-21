'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { ToggleButton as TogglePrimitive, type ToggleButtonProps } from 'react-aria-components'

import { cn } from '#lib/utils'

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-(--tweaker-space-1) rounded-tweaker-control text-(length:--tweaker-font-size-md) leading-(--tweaker-line-none) font-(--tweaker-font-medium) whitespace-nowrap text-tweaker-muted transition-colors duration-(--tweaker-duration-fast) outline-none data-hovered:bg-tweaker-surface-muted data-hovered:text-tweaker-text data-focus-visible:ring-2 data-focus-visible:ring-tweaker-focus data-selected:bg-tweaker-accent data-selected:text-tweaker-accent-text data-disabled:pointer-events-none data-disabled:opacity-(--tweaker-opacity-disabled-soft) aria-invalid:border-tweaker-danger aria-invalid:ring-2 aria-invalid:ring-tweaker-danger/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--tweaker-icon-sm)",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-tweaker-control bg-transparent data-hovered:bg-tweaker-surface-muted',
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
