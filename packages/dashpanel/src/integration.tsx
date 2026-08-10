import { type ComponentType, type ReactNode } from 'react'
import { DashPanelDefaultActionItemsContext } from './runtime/panel-integration-context.tsx'

export interface DashPanelDefaultActionItemsProps {
  readonly scopeId: string
}

export type DashPanelDefaultActionItems = ComponentType<DashPanelDefaultActionItemsProps>

export interface DashPanelIntegrationProviderProps {
  readonly children: ReactNode
  readonly defaultActionItems?: DashPanelDefaultActionItems
}

export function DashPanelIntegrationProvider({
  children,
  defaultActionItems,
}: DashPanelIntegrationProviderProps) {
  return (
    <DashPanelDefaultActionItemsContext.Provider value={defaultActionItems}>
      {children}
    </DashPanelDefaultActionItemsContext.Provider>
  )
}
