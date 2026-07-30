import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '#lib/utils'

const surfaceVariants = cva(
  'text-picodash-text relative isolate overflow-hidden rounded-picodash-control border border-picodash-control',
  {
    variants: {
      variant: {
        default: 'bg-(--picodash-color-well)',
        plain: 'border-transparent bg-transparent',
        raised: 'bg-picodash-surface-raised shadow-picodash-sm',
        dashed: 'border-dashed bg-(--picodash-color-well)',
      },
      size: {
        auto: '',
        field: 'min-h-(--picodash-field-surface-min-height)',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'auto',
    },
  },
)

export type SurfaceProps = React.ComponentProps<'div'> & VariantProps<typeof surfaceVariants>

function Surface({ className, variant, size, ...props }: SurfaceProps) {
  return (
    <div
      data-slot="dashlet-surface"
      data-variant={variant ?? 'default'}
      data-size={size ?? 'auto'}
      className={cn(surfaceVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export type CaptionProps = React.ComponentProps<'p'> & {
  tone?: 'muted' | 'default' | 'strong'
}

function Caption({ className, tone = 'muted', ...props }: CaptionProps) {
  return (
    <p
      data-slot="dashlet-caption"
      data-tone={tone}
      className={cn(
        'text-(length:--picodash-font-size-md) leading-(--picodash-line-normal)',
        {
          'text-picodash-muted': tone === 'muted',
          'text-picodash-text': tone === 'default',
          'text-picodash-text-strong font-(--picodash-font-medium)': tone === 'strong',
        },
        className,
      )}
      {...props}
    />
  )
}

export type LegendProps = React.ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical'
}

function Legend({ className, orientation = 'horizontal', ...props }: LegendProps) {
  return (
    <div
      data-slot="dashlet-legend"
      data-orientation={orientation}
      role="list"
      className={cn(
        'text-picodash-muted flex gap-x-(--picodash-space-3) gap-y-(--picodash-space-1) text-(length:--picodash-font-size-md) leading-(--picodash-line-tight)',
        orientation === 'horizontal' ? 'flex-wrap' : 'flex-col',
        className,
      )}
      {...props}
    />
  )
}

export type LegendSwatchProps = React.ComponentProps<'span'> & {
  /** Any CSS color, including one of the Picodash data palette tokens. */
  color?: string
  variant?: 'dot' | 'line'
}

function LegendSwatch({
  className,
  color = 'var(--picodash-color-data-1)',
  variant = 'dot',
  style,
  'aria-hidden': ariaHidden = true,
  ...props
}: LegendSwatchProps) {
  return (
    <span
      {...props}
      aria-hidden={ariaHidden}
      data-slot="dashlet-legend-swatch"
      data-variant={variant}
      className={cn(
        'inline-block shrink-0 bg-(--picodash-color-data-1)',
        variant === 'dot'
          ? 'size-(--picodash-icon-xs) rounded-full'
          : 'h-(--picodash-border-thin) w-(--picodash-space-3)',
        className,
      )}
      style={{ ...style, backgroundColor: color }}
    />
  )
}

export type LegendItemProps = React.ComponentProps<'span'> & {
  color?: string
  marker?: 'dot' | 'line' | false
}

function LegendItem({ children, className, color, marker = 'dot', ...props }: LegendItemProps) {
  return (
    <span
      data-slot="dashlet-legend-item"
      role="listitem"
      className={cn('inline-flex items-center gap-(--picodash-space-1-5)', className)}
      {...props}
    >
      {marker ? <LegendSwatch color={color} variant={marker} /> : null}
      {children}
    </span>
  )
}

export { Caption, Legend, LegendItem, LegendSwatch, Surface }
