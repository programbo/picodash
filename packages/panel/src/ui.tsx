import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from './utils.js'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        subtle: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      },
      size: {
        icon: 'size-7',
        sm: 'h-8 px-2.5',
        md: 'h-9 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {}

export function Button({ className, size, type = 'button', variant, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ size, variant }), className)} type={type} {...props} />
  )
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cn('text-sm leading-none font-medium text-foreground', className)}
      {...props}
    />
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'flex h-8 w-full rounded-none border-0 border-b border-input bg-transparent px-2.5 py-1 text-xs text-foreground shadow-none outline-none transition-colors placeholder:text-muted-foreground focus:bg-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-7 w-full rounded-none border-0 border-b border-input bg-transparent py-0.5 pr-6 pl-1.5 text-xs text-foreground shadow-none outline-none transition-colors focus:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-popover [&>option]:text-popover-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function Badge({
  children,
  className,
  tone = 'default',
}: {
  children: ReactNode
  className?: string
  tone?: 'default' | 'info' | 'warning' | 'alert' | 'error'
}) {
  const toneClass = {
    default: 'border-border bg-secondary text-secondary-foreground',
    info: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
    warning: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    alert: 'border-orange-400/30 bg-orange-400/10 text-orange-200',
    error: 'border-red-400/30 bg-red-400/10 text-red-200',
  }[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Switch({
  checked,
  className,
  disabled,
  onCheckedChange,
  ...props
}: Omit<ComponentProps<'button'>, 'onChange'> & {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <button
      aria-checked={checked}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-input transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary',
        className,
      )}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      role="switch"
      type="button"
      onClick={() => {
        if (!disabled) onCheckedChange?.(!checked)
      }}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
        )}
        data-state={checked ? 'checked' : 'unchecked'}
      />
    </button>
  )
}
