'use client'
import { createContext, type ComponentType, type ReactNode, type RefObject } from 'react'
import type { PicodashFieldDefinitions, ScopedNexus } from '@picodash/nexus'

export type DashGroupPresentation =
  | { readonly location: 'inline' }
  | { readonly location: 'panel'; readonly hostId: string; readonly visible: boolean }
export interface DashGroupHostProps {
  readonly id: string
  readonly name: string
  readonly label: ReactNode
  readonly recordableHotkey: boolean
  readonly mode: 'floating' | 'hybrid'
  readonly scope: ScopedNexus<PicodashFieldDefinitions>
  readonly homeRef: RefObject<HTMLDivElement | null>
  readonly groupRef: RefObject<HTMLDivElement | null>
  readonly actionsRef: RefObject<HTMLDivElement | null>
  readonly contentRef: RefObject<HTMLDivElement | null>
  readonly collapsed: boolean
  readonly children: ReactNode
  readonly present: (presentation: DashGroupPresentation) => void
  readonly registerReveal: (reveal: () => void) => () => void
  readonly reorder: {
    begin(event: PointerEvent, header: HTMLElement): void
    move(event: PointerEvent): void
    end(event: PointerEvent): void
    cancel(): void
  }
}
export const DashGroupHostContext = createContext<ComponentType<DashGroupHostProps> | null>(null)
export function DashStackIntegrationProvider({
  groupHost,
  children,
}: {
  readonly groupHost: ComponentType<DashGroupHostProps>
  readonly children: ReactNode
}) {
  return <DashGroupHostContext.Provider value={groupHost}>{children}</DashGroupHostContext.Provider>
}
