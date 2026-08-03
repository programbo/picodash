'use client'

import * as React from 'react'
import {
  composeRenderProps,
  ProgressBar as ProgressBarPrimitive,
  type ProgressBarRenderProps,
} from 'react-aria-components'

import { cn } from '../../lib/utils.js'

const ProgressValueContext = React.createContext<ProgressBarRenderProps | null>(null)

export type ProgressBarProps = React.ComponentProps<typeof ProgressBarPrimitive>
export type ProgressTrackProps = React.ComponentProps<'div'>
export type ProgressFillProps = React.ComponentProps<'div'>

function ProgressBar({ className, children, ...props }: ProgressBarProps) {
  return (
    <ProgressBarPrimitive
      {...props}
      data-slot="progress-bar"
      className={composeRenderProps(className, (className) =>
        cn('text-picodash-text flex w-full min-w-0 flex-col gap-(--picodash-space-1-5)', className),
      )}
    >
      {composeRenderProps(children, (children, values) => (
        <ProgressValueContext.Provider value={values}>{children}</ProgressValueContext.Provider>
      ))}
    </ProgressBarPrimitive>
  )
}

function ProgressTrack({ className, ...props }: ProgressTrackProps) {
  const values = React.useContext(ProgressValueContext)

  return (
    <div
      {...props}
      data-slot="progress-track"
      data-indeterminate={values?.isIndeterminate || undefined}
      data-percentage={values?.percentage}
      className={cn(
        'bg-picodash-control relative h-(--picodash-space-2) w-full overflow-hidden rounded-full forced-color-adjust-none',
        className,
      )}
    />
  )
}

function ProgressFill({ className, style, ...props }: ProgressFillProps) {
  const values = React.useContext(ProgressValueContext)
  const isIndeterminate = values?.isIndeterminate ?? false

  return (
    <div
      {...props}
      data-slot="progress-fill"
      data-indeterminate={isIndeterminate || undefined}
      data-percentage={values?.percentage}
      className={cn(
        'bg-picodash-accent h-full rounded-full transition-[width] duration-(--picodash-duration-fast) data-indeterminate:animate-pulse motion-reduce:transition-none motion-reduce:data-indeterminate:animate-none forced-colors:bg-[Highlight]',
        className,
      )}
      style={{
        ...style,
        width: isIndeterminate ? '40%' : values?.percentage ? `${values.percentage}%` : '0%',
      }}
    />
  )
}

export { ProgressBar, ProgressFill, ProgressTrack }
