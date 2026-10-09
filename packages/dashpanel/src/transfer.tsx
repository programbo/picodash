'use client'
import { createContext, type ReactNode } from 'react'
import type { PicodashFieldDefinitions, ScopedNexus } from '@picodash/nexus'
export type DashPanelTransferPoint = {
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
}
export interface DashPanelTransferDriver {
  place(left: number, top: number): void
  begin(point: DashPanelTransferPoint): void
  cancel(): void
}
export interface DashPanelTransfer {
  readonly layoutNexus: ScopedNexus<PicodashFieldDefinitions>
  readonly returnLabel: string
  readonly returnHome: () => void
  readonly register: (driver: DashPanelTransferDriver) => () => void
  /** True reserves the gesture for the host's return target instead of Panel docking. */
  readonly pointer: (phase: 'move' | 'drop' | 'cancel', point: DashPanelTransferPoint) => boolean
}
export const DashPanelTransferContext = createContext<DashPanelTransfer | null>(null)
export function DashPanelTransferBoundary({
  transfer,
  children,
}: {
  readonly transfer: DashPanelTransfer
  readonly children: ReactNode
}) {
  return (
    <DashPanelTransferContext.Provider value={transfer}>
      {children}
    </DashPanelTransferContext.Provider>
  )
}
