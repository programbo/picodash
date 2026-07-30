import * as React from 'react'

import { cn } from '#lib/utils'

function Card({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<'div'> & { size?: 'default' | 'sm' }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        'group/card bg-picodash-surface text-picodash-text ring-picodash-border rounded-picodash-surface shadow-picodash-sm *:[img:first-child]:rounded-t-picodash-surface *:[img:last-child]:rounded-b-picodash-surface flex flex-col gap-(--card-spacing) overflow-hidden py-(--card-spacing) text-(length:--picodash-font-size-lg) ring-1 [--card-spacing:var(--picodash-space-5)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:var(--picodash-space-4)]',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'group/card-header rounded-t-picodash-surface @container/card-header grid auto-rows-min items-start gap-(--picodash-space-1-5) px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        'text-(length:--picodash-font-size-xl) leading-(--picodash-line-normal) font-(--picodash-font-medium)',
        className,
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn(
        'text-picodash-muted text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight)',
        className,
      )}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-content" className={cn('px-(--card-spacing)', className)} {...props} />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'rounded-b-picodash-surface flex items-center px-(--card-spacing) [.border-t]:pt-(--card-spacing)',
        className,
      )}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
