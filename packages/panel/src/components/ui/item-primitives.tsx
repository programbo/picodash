import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '#lib/utils'

/**
 * A theme-aware surface for custom dashlet content such as charts, previews,
 * drop targets, and interactive canvases.
 */
const itemSurfaceVariants = cva(
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

type ItemSurfaceProps = React.ComponentProps<'div'> & VariantProps<typeof itemSurfaceVariants>

function ItemSurface({ className, variant, size, ...props }: ItemSurfaceProps) {
  return (
    <div
      data-slot="item-surface"
      data-variant={variant ?? 'default'}
      data-size={size ?? 'auto'}
      className={cn(itemSurfaceVariants({ variant, size, className }))}
      {...props}
    />
  )
}

type ItemCaptionProps = React.ComponentProps<'p'> & {
  tone?: 'muted' | 'default' | 'strong'
}

/** A compact caption/helper line that follows the panel's type scale. */
function ItemCaption({ className, tone = 'muted', ...props }: ItemCaptionProps) {
  return (
    <p
      data-slot="item-caption"
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

type ItemLegendProps = React.ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical'
}

/** A compact, wrapping legend layout for data visualizations. */
function ItemLegend({ className, orientation = 'horizontal', ...props }: ItemLegendProps) {
  return (
    <div
      data-slot="item-legend"
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

type ItemLegendSwatchProps = React.ComponentProps<'span'> & {
  /** Any CSS color, including one of the Picodash data palette tokens. */
  color?: string
  variant?: 'dot' | 'line'
}

/** A theme-compatible legend marker; pass a data palette token for consistency. */
function ItemLegendSwatch({
  className,
  color = 'var(--picodash-color-data-1)',
  variant = 'dot',
  style,
  ...props
}: ItemLegendSwatchProps) {
  const swatchStyle = { ...style, backgroundColor: color }

  return (
    <span
      aria-hidden="true"
      data-slot="item-legend-swatch"
      data-variant={variant}
      className={cn(
        'inline-block shrink-0 bg-(--picodash-color-data-1)',
        variant === 'dot'
          ? 'size-(--picodash-icon-xs) rounded-full'
          : 'h-(--picodash-border-thin) w-(--picodash-space-3)',
        className,
      )}
      style={swatchStyle}
      {...props}
    />
  )
}

type ItemLegendItemProps = React.ComponentProps<'span'> & {
  color?: string
  marker?: 'dot' | 'line' | false
}

function ItemLegendItem({
  children,
  className,
  color,
  marker = 'dot',
  ...props
}: ItemLegendItemProps) {
  return (
    <span
      data-slot="item-legend-item"
      role="listitem"
      className={cn('inline-flex items-center gap-(--picodash-space-1-5)', className)}
      {...props}
    >
      {marker ? <ItemLegendSwatch color={color} variant={marker} /> : null}
      {children}
    </span>
  )
}

type ItemEmptyStateProps = React.ComponentProps<'div'> & {
  icon?: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
}

/** A consistent empty/loading/error placeholder for custom dashlets. */
function ItemEmptyState({
  className,
  icon,
  title,
  description,
  children,
  ...props
}: ItemEmptyStateProps) {
  return (
    <div
      data-slot="item-empty-state"
      className={cn(
        'text-picodash-muted rounded-picodash-control border-picodash-control flex min-h-(--picodash-field-surface-min-height) flex-col items-center justify-center gap-(--picodash-space-2) border border-dashed bg-(--picodash-color-well) px-(--picodash-space-3) py-(--picodash-space-4) text-center text-(length:--picodash-font-size-lg) leading-(--picodash-line-normal)',
        className,
      )}
      {...props}
    >
      {icon ? <span data-slot="item-empty-state-icon">{icon}</span> : null}
      {title ? (
        <p
          data-slot="item-empty-state-title"
          className="text-picodash-text font-(--picodash-font-medium)"
        >
          {title}
        </p>
      ) : null}
      {description ? <ItemCaption>{description}</ItemCaption> : null}
      {children}
    </div>
  )
}

export {
  ItemCaption,
  ItemEmptyState,
  ItemLegend,
  ItemLegendItem,
  ItemLegendSwatch,
  ItemSurface,
  itemSurfaceVariants,
}

export type {
  ItemCaptionProps,
  ItemEmptyStateProps,
  ItemLegendItemProps,
  ItemLegendProps,
  ItemLegendSwatchProps,
  ItemSurfaceProps,
}
