import type * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  Button as ButtonPrimitive,
  Link as LinkPrimitive,
  type ButtonProps as ButtonPrimitiveProps,
  type LinkProps as LinkPrimitiveProps,
} from 'react-aria-components'

import { cn } from '#lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-(--tweaker-space-1-5) rounded-tweaker-control border border-transparent bg-clip-padding text-(length:--tweaker-font-size-xl) leading-(--tweaker-line-normal) font-(--tweaker-font-medium) whitespace-nowrap text-tweaker-text transition-colors duration-(--tweaker-duration-fast) outline-none select-none data-focus-visible:ring-2 data-focus-visible:ring-tweaker-focus data-focus-visible:ring-offset-1 data-focus-visible:ring-offset-tweaker-canvas data-disabled:pointer-events-none data-disabled:opacity-(--tweaker-opacity-disabled) data-pressed:not-aria-[haspopup]:translate-y-px aria-invalid:border-tweaker-danger aria-invalid:ring-2 aria-invalid:ring-tweaker-danger/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--tweaker-icon-sm)",
  {
    variants: {
      variant: {
        default: 'bg-tweaker-accent text-tweaker-accent-text hover:bg-tweaker-accent/80',
        outline:
          'border-tweaker-border bg-tweaker-canvas hover:bg-tweaker-surface-muted hover:text-tweaker-text aria-expanded:bg-tweaker-surface-muted aria-expanded:text-tweaker-text dark:bg-transparent dark:hover:bg-tweaker-control/30',
        secondary:
          'bg-tweaker-surface-muted text-tweaker-text hover:bg-[color-mix(in_oklch,var(--tweaker-color-surface-muted),var(--tweaker-color-text)_5%)] aria-expanded:bg-tweaker-surface-muted aria-expanded:text-tweaker-text',
        ghost:
          'hover:bg-tweaker-surface-muted hover:text-tweaker-text aria-expanded:bg-tweaker-surface-muted aria-expanded:text-tweaker-text dark:hover:bg-tweaker-surface-muted/50',
        subtle: 'bg-tweaker-surface-muted text-tweaker-text hover:bg-tweaker-surface-muted/80',
        destructive:
          'bg-tweaker-danger/10 text-tweaker-danger hover:bg-tweaker-danger/20 focus-visible:border-tweaker-danger/40 focus-visible:ring-tweaker-danger/20 dark:bg-tweaker-danger/20 dark:hover:bg-tweaker-danger/30 dark:focus-visible:ring-tweaker-danger/40',
        link: 'text-tweaker-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-(--tweaker-control-height-lg) px-(--tweaker-space-3)',
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-(--tweaker-control-height-md) px-(--tweaker-space-2-5)',
        md: 'h-(--tweaker-control-height-lg) px-(--tweaker-space-3)',
        lg: 'h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        icon: 'size-8',
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-7',
        'icon-lg': 'size-9',
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
