import type * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  Button as ButtonPrimitive,
  Link as LinkPrimitive,
  type ButtonProps as ButtonPrimitiveProps,
  type LinkProps as LinkPrimitiveProps,
} from 'react-aria-components'

import { cn } from '../../lib/utils.js'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-(--picodash-space-1-5) rounded-picodash-control border border-transparent bg-clip-padding text-(length:--picodash-font-size-xl) leading-(--picodash-line-normal) font-(--picodash-font-medium) whitespace-nowrap text-picodash-text transition-colors duration-(--picodash-duration-fast) outline-none select-none focus-visible:ring-2 focus-visible:ring-picodash-focus focus-visible:ring-offset-1 focus-visible:ring-offset-picodash-canvas data-focus-visible:ring-2 data-focus-visible:ring-picodash-focus data-focus-visible:ring-offset-1 data-focus-visible:ring-offset-picodash-canvas data-disabled:pointer-events-none data-disabled:opacity-(--picodash-opacity-disabled) data-pressed:not-aria-[haspopup]:translate-y-px aria-invalid:border-picodash-danger aria-invalid:ring-2 aria-invalid:ring-picodash-danger/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--picodash-icon-sm)",
  {
    variants: {
      variant: {
        default: 'bg-picodash-accent text-picodash-accent-text hover:bg-picodash-accent/80',
        outline:
          'border-picodash-border bg-picodash-canvas hover:bg-picodash-surface-muted hover:text-picodash-text aria-expanded:bg-picodash-surface-muted aria-expanded:text-picodash-text',
        secondary:
          'bg-picodash-surface-muted text-picodash-text hover:bg-[color-mix(in_oklch,var(--picodash-color-surface-muted),var(--picodash-color-text)_5%)] aria-expanded:bg-picodash-surface-muted aria-expanded:text-picodash-text',
        ghost:
          'hover:bg-picodash-surface-muted hover:text-picodash-text aria-expanded:bg-picodash-surface-muted aria-expanded:text-picodash-text',
        subtle: 'bg-picodash-surface-muted text-picodash-text hover:bg-picodash-surface-muted/80',
        destructive:
          'bg-picodash-danger-subtle text-picodash-danger hover:bg-picodash-danger/20 focus-visible:border-picodash-danger/40 focus-visible:ring-picodash-danger/20',
        link: 'text-picodash-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-(--picodash-control-height-lg) px-(--picodash-space-3)',
        xs: "h-(--picodash-control-height-xs) gap-(--picodash-space-1) px-(--picodash-space-2-5) text-(length:--picodash-font-size-sm) has-data-[icon=inline-end]:pr-(--picodash-space-2) has-data-[icon=inline-start]:pl-(--picodash-space-2) [&_svg:not([class*='size-'])]:size-(--picodash-icon-xs)",
        sm: 'h-(--picodash-control-height-md) px-(--picodash-space-2-5)',
        md: 'h-(--picodash-control-height-lg) px-(--picodash-space-3)',
        lg: 'h-(--picodash-control-height-lg) gap-(--picodash-space-1-5) px-(--picodash-space-4) has-data-[icon=inline-end]:pr-(--picodash-space-3) has-data-[icon=inline-start]:pl-(--picodash-space-3)',
        icon: 'size-(--picodash-control-height-lg)',
        'icon-xs':
          "size-(--picodash-control-height-xs) [&_svg:not([class*='size-'])]:size-(--picodash-icon-xs)",
        'icon-sm': 'size-(--picodash-control-height-sm)',
        'icon-lg': 'size-(--picodash-control-height-lg)',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  disabled,
  isDisabled,
  variant = 'default',
  size = 'default',
  type = 'button',
  ...props
}: Omit<ButtonPrimitiveProps, 'className'> &
  React.RefAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    className?: string
    disabled?: boolean
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      isDisabled={isDisabled ?? disabled}
      type={type}
      {...props}
    />
  )
}

function LinkButton({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: Omit<LinkPrimitiveProps, 'className'> &
  VariantProps<typeof buttonVariants> & {
    className?: string
  }) {
  return (
    <LinkPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, LinkButton, buttonVariants }
