import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils.js'

const dataListVariants = cva('m-0 grid min-w-0', {
  variants: {
    density: {
      compact: 'gap-(--picodash-space-1)',
      default: 'gap-(--picodash-space-2)',
    },
  },
  defaultVariants: {
    density: 'default',
  },
})

export type DataListProps = React.ComponentProps<'dl'> & VariantProps<typeof dataListVariants>

function DataList({ className, density, ...props }: DataListProps) {
  return (
    <dl
      {...props}
      data-slot="dashlet-data-list"
      data-density={density ?? 'default'}
      className={cn(dataListVariants({ density, className }))}
    />
  )
}

export type DataRowProps = React.ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical'
}

function DataRow({ className, orientation = 'horizontal', ...props }: DataRowProps) {
  return (
    <div
      {...props}
      data-slot="dashlet-data-row"
      data-orientation={orientation}
      className={cn(
        'min-w-0 gap-(--picodash-space-2)',
        orientation === 'horizontal'
          ? 'grid grid-cols-[minmax(0,1fr)_auto] items-baseline'
          : 'flex flex-col',
        className,
      )}
    />
  )
}

export type DataLabelProps = React.ComponentProps<'dt'>

function DataLabel({ className, ...props }: DataLabelProps) {
  return (
    <dt
      {...props}
      data-slot="dashlet-data-label"
      className={cn(
        'text-picodash-muted min-w-0 text-(length:--picodash-font-size-md) leading-(--picodash-line-normal)',
        className,
      )}
    />
  )
}

export type DataValueProps = React.ComponentProps<'dd'> & {
  align?: 'start' | 'end'
}

function DataValue({ align = 'end', className, ...props }: DataValueProps) {
  return (
    <dd
      {...props}
      data-slot="dashlet-data-value"
      data-align={align}
      className={cn(
        'text-picodash-text m-0 min-w-0 text-(length:--picodash-font-size-md) leading-(--picodash-line-normal) font-(--picodash-font-medium) tabular-nums',
        align === 'end' && 'text-right',
        className,
      )}
    />
  )
}

export { DataLabel, DataList, DataRow, DataValue }
