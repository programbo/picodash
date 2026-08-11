'use client'

import type { ReactElement } from 'react'
import type { PicodashFieldDefinitions } from '@picodash/nexus'
import {
  DashPanelProvider,
  type DashPanelDockPosition,
  type DashPanelProviderProps,
} from '@picodash/dashpanel'

export type PicodashDockPosition = Exclude<
  DashPanelDockPosition,
  'full-top' | 'center-top' | 'full-bottom' | 'center-bottom'
>

export type PicodashProviderProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  CustomTheme extends string = never,
> = Omit<DashPanelProviderProps<Fields, CustomTheme>, 'dockPositions'> & {
  dockPositions?: readonly PicodashDockPosition[]
}

const DEFAULT_DOCK_POSITIONS: readonly PicodashDockPosition[] = Object.freeze([
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
  'full-left',
  'center-left',
  'full-right',
  'center-right',
])

const PICODASH_DOCK_POSITIONS = new Set<PicodashDockPosition>(DEFAULT_DOCK_POSITIONS)

function resolveDockPositions(value: unknown): readonly PicodashDockPosition[] {
  if (value === undefined) return DEFAULT_DOCK_POSITIONS
  if (!Array.isArray(value)) throw new TypeError('PicodashProvider dockPositions must be an array.')
  const seen = new Set<PicodashDockPosition>()
  for (const position of value) {
    if (
      typeof position !== 'string' ||
      !PICODASH_DOCK_POSITIONS.has(position as PicodashDockPosition)
    )
      throw new TypeError(
        `PicodashProvider contains an invalid dock position: ${String(position)}.`,
      )
    seen.add(position as PicodashDockPosition)
  }
  return Object.freeze(DEFAULT_DOCK_POSITIONS.filter((position) => seen.has(position)))
}

export function PicodashProvider<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  CustomTheme extends string = never,
>({ dockPositions, children, ...props }: PicodashProviderProps<Fields, CustomTheme>): ReactElement {
  const resolvedDockPositions = resolveDockPositions(dockPositions)
  return (
    <DashPanelProvider
      {...(props as DashPanelProviderProps<Fields, CustomTheme>)}
      dockPositions={resolvedDockPositions}
    >
      {children}
    </DashPanelProvider>
  )
}
