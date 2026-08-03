import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils.js'

const badgeVariants = cva(
  'group/badge inline-flex h-(--picodash-control-height-xs) w-fit shrink-0 items-center justify-center gap-(--picodash-space-1) overflow-hidden rounded-picodash-control border border-transparent px-(--picodash-space-2) py-(--picodash-space-0-5) text-(length:--picodash-font-size-sm) leading-(--picodash-line-tight) font-(--picodash-font-medium) whitespace-nowrap transition-colors duration-(--picodash-duration-fast) focus-visible:border-picodash-focus focus-visible:ring-2 focus-visible:ring-picodash-focus/50 has-data-[icon=inline-end]:pr-(--picodash-space-1-5) has-data-[icon=inline-start]:pl-(--picodash-space-1-5) aria-invalid:border-picodash-danger aria-invalid:ring-2 aria-invalid:ring-picodash-danger/20 [&>svg]:pointer-events-none [&>svg]:size-(--picodash-icon-xs)',
  {
    variants: {
      variant: {
        default: 'bg-picodash-accent text-picodash-accent-text [a]:hover:bg-picodash-accent/80',
        secondary:
          'bg-picodash-surface-muted text-picodash-text [a]:hover:bg-picodash-surface-muted/80',
        destructive:
          'bg-picodash-danger-subtle text-picodash-danger focus-visible:ring-picodash-danger/20 [a]:hover:bg-picodash-danger/20',
        outline:
          'border-picodash-border text-picodash-text [a]:hover:bg-picodash-surface-muted [a]:hover:text-picodash-muted',
        ghost: 'hover:bg-picodash-surface-muted hover:text-picodash-muted',
        link: 'text-picodash-accent underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    render?: (props: React.HTMLAttributes<HTMLElement>) => React.ReactNode
  }) {
  if (render) {
    const renderProps = {
      'data-slot': 'badge',
      'data-variant': variant,
      className: cn(badgeVariants({ variant }), className),
      ...props,
    }

    return render(renderProps)
  }

  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
