'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  TabList as TabListPrimitive,
  TabPanel as TabPanelPrimitive,
  Tab as TabPrimitive,
  Tabs as TabsPrimitive,
} from 'react-aria-components'

import { cn } from '#lib/utils'

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive>) {
  return (
    <TabsPrimitive
      data-slot="tabs"
      className={cn('group/tabs flex gap-(--picodash-space-2) data-horizontal:flex-col', className)}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  'group/tabs-list inline-flex w-fit items-center justify-center rounded-picodash-control p-(--picodash-space-1) text-picodash-muted group-data-horizontal/tabs:h-(--picodash-control-height-md) group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:p-(--picodash-space-1) data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'bg-picodash-surface-muted',
        line: 'gap-(--picodash-space-1) bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function TabsList({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof TabListPrimitive> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabListPrimitive
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabPrimitive>) {
  return (
    <TabPrimitive
      data-slot="tabs-trigger"
      className={cn(
        "text-picodash-muted hover:text-picodash-text focus-visible:border-picodash-focus focus-visible:ring-picodash-focus/50 focus-visible:outline-picodash-focus rounded-picodash-control relative inline-flex h-[calc(100%-1px)] flex-1 cursor-default items-center justify-center gap-(--picodash-space-1-5) border border-transparent! px-(--picodash-space-1-5) py-(--picodash-space-0-5) text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) font-(--picodash-font-medium) whitespace-nowrap transition-colors duration-(--picodash-duration-fast) group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:px-(--picodash-space-3) group-data-vertical/tabs:py-(--picodash-space-0-5) focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-(--picodash-opacity-disabled) data-disabled:pointer-events-none data-disabled:opacity-(--picodash-opacity-disabled) [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--picodash-icon-md)",
        'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-selected:bg-transparent',
        'data-selected:bg-picodash-canvas data-selected:text-picodash-text',
        'after:bg-picodash-text after:absolute after:opacity-0 after:transition-opacity after:duration-(--picodash-duration-fast) group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:-bottom-1.25 group-data-horizontal/tabs:after:h-(--picodash-space-0-5) group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-(--picodash-space-0-5) group-data-[variant=line]/tabs-list:data-selected:after:opacity-100',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabPanelPrimitive>) {
  return (
    <TabPanelPrimitive
      data-slot="tabs-content"
      className={cn(
        'flex-1 text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) outline-none',
        className,
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
