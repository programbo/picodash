import * as React from 'react'

import { cn } from '../../utilities/utils.js'

export type HeaderProps = React.ComponentProps<'header'>

function Header({ className, ...props }: HeaderProps) {
  return (
    <header
      {...props}
      data-slot="dashlet-header"
      className={cn(
        'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-(--picodash-space-3) gap-y-(--picodash-space-1) has-data-[slot=dashlet-description]:grid-rows-[auto_auto]',
        className,
      )}
    />
  )
}

export type HeadingProps = React.ComponentProps<'h3'>

function Heading({ className, ...props }: HeadingProps) {
  return (
    <h3
      {...props}
      data-slot="dashlet-heading"
      className={cn(
        'text-picodash-text-strong min-w-0 text-(length:--picodash-font-size-xl) leading-(--picodash-line-tight) font-(--picodash-font-medium)',
        className,
      )}
    />
  )
}

export type DescriptionProps = React.ComponentProps<'p'>

function Description({ className, ...props }: DescriptionProps) {
  return (
    <p
      {...props}
      data-slot="dashlet-description"
      className={cn(
        'text-picodash-muted col-start-1 row-start-2 min-w-0 text-(length:--picodash-font-size-md) leading-(--picodash-line-normal)',
        className,
      )}
    />
  )
}

export type ActionsProps = React.ComponentProps<'div'>

function Actions({ className, ...props }: ActionsProps) {
  return (
    <div
      {...props}
      data-slot="dashlet-actions"
      className={cn(
        'col-start-2 row-span-2 row-start-1 flex min-w-0 items-center justify-end gap-(--picodash-space-1-5)',
        className,
      )}
    />
  )
}

export { Actions, Description, Header, Heading }
