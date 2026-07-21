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
  "group/button inline-flex shrink-0 items-center justify-center rounded-2xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-tweaker-focus focus-visible:ring-3 focus-visible:ring-tweaker-focus/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-tweaker-danger aria-invalid:ring-3 aria-invalid:ring-tweaker-danger/20 dark:aria-invalid:border-tweaker-danger/50 dark:aria-invalid:ring-tweaker-danger/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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
        destructive:
          'bg-tweaker-danger/10 text-tweaker-danger hover:bg-tweaker-danger/20 focus-visible:border-tweaker-danger/40 focus-visible:ring-tweaker-danger/20 dark:bg-tweaker-danger/20 dark:hover:bg-tweaker-danger/30 dark:focus-visible:ring-tweaker-danger/40',
        link: 'text-tweaker-accent underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-7 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
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
  variant = 'default',
  size = 'default',
  ...props
}: Omit<ButtonPrimitiveProps, 'className'> &
  React.RefAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    className?: string
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
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
