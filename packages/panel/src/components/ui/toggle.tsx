'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { ToggleButton as TogglePrimitive, type ToggleButtonProps } from 'react-aria-components'

import { cn } from '#lib/utils'

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-(--picodash-space-1) rounded-picodash-control text-(length:--picodash-font-size-md) leading-(--picodash-line-none) font-(--picodash-font-medium) whitespace-nowrap text-picodash-muted transition-colors duration-(--picodash-duration-fast) outline-none data-hovered:bg-picodash-surface-muted data-hovered:text-picodash-text data-focus-visible:ring-2 data-focus-visible:ring-picodash-focus data-selected:bg-picodash-accent data-selected:text-picodash-accent-text data-disabled:pointer-events-none data-disabled:opacity-(--picodash-opacity-disabled-soft) aria-invalid:border-picodash-danger aria-invalid:ring-2 aria-invalid:ring-picodash-danger/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--picodash-icon-sm)",
  {
    variants: {
      variant: {
        default: '',
        outline: 'border border-picodash-control data-hovered:bg-picodash-surface-muted',
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
