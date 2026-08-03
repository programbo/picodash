import * as React from 'react'

import { cn } from '../../utilities/utils.js'

const stateClassName =
  'text-picodash-muted border-picodash-control flex min-h-(--picodash-field-surface-min-height) min-w-0 flex-col items-center justify-center gap-(--picodash-space-2) rounded-picodash-control border border-dashed bg-(--picodash-color-well) px-(--picodash-space-3) py-(--picodash-space-4) text-center text-(length:--picodash-font-size-lg) leading-(--picodash-line-normal)'

export type EmptyStateProps = React.ComponentProps<'div'> & {
  icon?: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
}

function EmptyState({
  className,
  icon,
  title,
  description,
  children,
  role = 'status',
  'aria-live': ariaLive = 'polite',
  ...props
}: EmptyStateProps) {
  return (
    <div
      {...props}
      role={role}
      aria-live={ariaLive}
      data-slot="dashlet-empty-state"
      className={cn(stateClassName, className)}
    >
      {icon ? <span data-slot="dashlet-empty-state-icon">{icon}</span> : null}
      {title ? (
        <p
          data-slot="dashlet-empty-state-title"
          className="text-picodash-text font-(--picodash-font-medium)"
        >
          {title}
        </p>
      ) : null}
      {description ? (
        <p
          data-slot="dashlet-empty-state-description"
          className="text-picodash-muted text-(length:--picodash-font-size-md) leading-(--picodash-line-normal)"
        >
          {description}
        </p>
      ) : null}
      {children}
    </div>
  )
}

export type LoadingStateProps = React.ComponentProps<'div'>

function LoadingState({
  className,
  role = 'status',
  'aria-live': ariaLive = 'polite',
  'aria-busy': ariaBusy = true,
  ...props
}: LoadingStateProps) {
  return (
    <div
      {...props}
      role={role}
      aria-live={ariaLive}
      aria-busy={ariaBusy}
      data-slot="dashlet-loading-state"
      className={cn(stateClassName, className)}
    />
  )
}

export type ErrorStateProps = React.ComponentProps<'div'>

function ErrorState({ className, role = 'alert', ...props }: ErrorStateProps) {
  return (
    <div
      {...props}
      role={role}
      data-slot="dashlet-error-state"
      className={cn(stateClassName, 'border-picodash-danger text-picodash-danger', className)}
    />
  )
}

export { EmptyState, ErrorState, LoadingState }
