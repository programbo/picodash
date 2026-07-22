import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '#lib/utils'

const badgeVariants = cva(
  'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-2xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-picodash-focus focus-visible:ring-[3px] focus-visible:ring-picodash-focus/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-picodash-danger aria-invalid:ring-picodash-danger/20 dark:aria-invalid:ring-picodash-danger/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default: 'bg-picodash-accent text-picodash-accent-text [a]:hover:bg-picodash-accent/80',
        secondary:
          'bg-picodash-surface-muted text-picodash-text [a]:hover:bg-picodash-surface-muted/80',
        destructive:
          'bg-picodash-danger/10 text-picodash-danger focus-visible:ring-picodash-danger/20 dark:bg-picodash-danger/20 dark:focus-visible:ring-picodash-danger/40 [a]:hover:bg-picodash-danger/20',
        outline:
          'border-picodash-border text-picodash-text [a]:hover:bg-picodash-surface-muted [a]:hover:text-picodash-muted',
        ghost:
          'hover:bg-picodash-surface-muted hover:text-picodash-muted dark:hover:bg-picodash-surface-muted/50',
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
