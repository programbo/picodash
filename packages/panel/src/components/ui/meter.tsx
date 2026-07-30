'use client'

import * as React from 'react'
import {
  composeRenderProps,
  Meter as MeterPrimitive,
  type MeterRenderProps,
} from 'react-aria-components'

import { cn } from '#lib/utils'

const MeterValueContext = React.createContext<MeterRenderProps | null>(null)

export type MeterProps = React.ComponentProps<typeof MeterPrimitive>
export type MeterTrackProps = React.ComponentProps<'div'>
export type MeterFillProps = React.ComponentProps<'div'>

function Meter({ className, children, ...props }: MeterProps) {
  return (
    <MeterPrimitive
      {...props}
      data-slot="meter"
      className={composeRenderProps(className, (className) =>
        cn('text-picodash-text flex w-full min-w-0 flex-col gap-(--picodash-space-1-5)', className),
      )}
    >
      {composeRenderProps(children, (children, values) => (
        <MeterValueContext.Provider value={values}>{children}</MeterValueContext.Provider>
      ))}
    </MeterPrimitive>
  )
}

function MeterTrack({ className, ...props }: MeterTrackProps) {
  const values = React.useContext(MeterValueContext)

  return (
    <div
      {...props}
      data-slot="meter-track"
      data-percentage={values?.percentage}
      className={cn(
        'bg-picodash-control relative h-(--picodash-space-2) w-full overflow-hidden rounded-full forced-color-adjust-none',
        className,
      )}
    />
  )
}

function MeterFill({ className, style, ...props }: MeterFillProps) {
  const values = React.useContext(MeterValueContext)

  return (
    <div
      {...props}
      data-slot="meter-fill"
      data-percentage={values?.percentage}
      className={cn(
        'bg-picodash-accent h-full rounded-full transition-[width] duration-(--picodash-duration-fast) motion-reduce:transition-none forced-colors:bg-[Highlight]',
        className,
      )}
      style={{
        ...style,
        width: values ? `${values.percentage}%` : undefined,
      }}
    />
  )
}

export { Meter, MeterFill, MeterTrack }
