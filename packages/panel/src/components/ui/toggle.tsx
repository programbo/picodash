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
          'h-(--picodash-control-height-md) min-w-(--picodash-control-height-md) px-(--picodash-space-2-5) has-data-[icon=inline-end]:pr-(--picodash-space-2) has-data-[icon=inline-start]:pl-(--picodash-space-2)',
        sm: 'h-(--picodash-control-height-sm) min-w-(--picodash-control-height-sm) px-(--picodash-space-2-5) has-data-[icon=inline-end]:pr-(--picodash-space-1-5) has-data-[icon=inline-start]:pl-(--picodash-space-1-5)',
        lg: 'h-(--picodash-control-height-lg) min-w-(--picodash-control-height-lg) px-(--picodash-space-2-5) has-data-[icon=inline-end]:pr-(--picodash-space-2) has-data-[icon=inline-start]:pl-(--picodash-space-2)',
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
