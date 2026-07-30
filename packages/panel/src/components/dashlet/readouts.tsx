import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '#lib/utils'

const metricVariants = cva('flex min-w-0 flex-col gap-(--picodash-space-1)', {
  variants: {
    align: {
      start: 'items-start text-left',
      center: 'items-center text-center',
      end: 'items-end text-right',
    },
  },
  defaultVariants: {
    align: 'start',
  },
})

export type MetricProps = React.ComponentProps<'div'> & VariantProps<typeof metricVariants>

function Metric({ align, className, ...props }: MetricProps) {
  return (
    <div
      {...props}
      data-slot="dashlet-metric"
      data-align={align ?? 'start'}
      className={cn(metricVariants({ align, className }))}
    />
  )
}

export type MetricLabelProps = React.ComponentProps<'span'>

function MetricLabel({ className, ...props }: MetricLabelProps) {
  return (
    <span
      {...props}
      data-slot="dashlet-metric-label"
      className={cn(
        'text-picodash-muted text-(length:--picodash-font-size-md) leading-(--picodash-line-tight)',
        className,
      )}
    />
  )
}

export type MetricValueProps = React.ComponentProps<'output'> & {
  emphasis?: 'default' | 'strong'
}

function MetricValue({ className, emphasis = 'strong', ...props }: MetricValueProps) {
  return (
    <output
      {...props}
      data-slot="dashlet-metric-value"
      data-emphasis={emphasis}
      className={cn(
        'text-picodash-text leading-(--picodash-line-tight) tabular-nums',
        emphasis === 'strong'
          ? 'text-picodash-text-strong text-(length:--picodash-font-size-2xl) font-(--picodash-font-semibold)'
          : 'text-(length:--picodash-font-size-xl) font-(--picodash-font-medium)',
        className,
      )}
    />
  )
}

export type MetricTrendProps = React.ComponentProps<'span'> & {
  tone?: 'neutral' | 'positive' | 'negative'
}

function MetricTrend({ className, tone = 'neutral', ...props }: MetricTrendProps) {
  return (
    <span
      {...props}
      data-slot="dashlet-metric-trend"
      data-tone={tone}
      className={cn(
        'text-(length:--picodash-font-size-md) leading-(--picodash-line-tight) font-(--picodash-font-medium) tabular-nums',
        {
          'text-picodash-muted': tone === 'neutral',
          'text-picodash-success': tone === 'positive',
          'text-picodash-danger': tone === 'negative',
        },
        className,
      )}
    />
  )
}

const statusVariants = cva(
  'inline-flex min-w-0 items-center gap-(--picodash-space-1-5) text-(length:--picodash-font-size-md) leading-(--picodash-line-tight) font-(--picodash-font-medium)',
  {
    variants: {
      tone: {
        neutral: 'text-picodash-muted',
        success: 'text-picodash-success',
        warning: 'text-picodash-warning',
        danger: 'text-picodash-danger',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
)

export type StatusProps = React.ComponentProps<'div'> & VariantProps<typeof statusVariants>

function Status({
  className,
  role = 'status',
  'aria-live': ariaLive = 'polite',
  tone,
  ...props
}: StatusProps) {
  return (
    <div
      {...props}
      role={role}
      aria-live={ariaLive}
      data-slot="dashlet-status"
      data-tone={tone ?? 'neutral'}
      className={cn(statusVariants({ tone, className }))}
    />
  )
}

export type StatusIndicatorProps = React.ComponentProps<'span'> & {
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}

function StatusIndicator({
  className,
  tone = 'neutral',
  'aria-hidden': ariaHidden = true,
  ...props
}: StatusIndicatorProps) {
  return (
    <span
      {...props}
      aria-hidden={ariaHidden}
      data-slot="dashlet-status-indicator"
      data-tone={tone}
      className={cn(
        'size-(--picodash-icon-xs) shrink-0 rounded-full',
        {
          'bg-picodash-muted': tone === 'neutral',
          'bg-picodash-success': tone === 'success',
          'bg-picodash-warning': tone === 'warning',
          'bg-picodash-danger': tone === 'danger',
        },
        className,
      )}
    />
  )
}

export { Metric, MetricLabel, MetricTrend, MetricValue, Status, StatusIndicator }
