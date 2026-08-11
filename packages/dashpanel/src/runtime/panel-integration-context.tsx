import { createContext, useContext } from 'react'
import type { DashPanelDefaultActionItems } from '../integration.tsx'

export const DashPanelDefaultActionItemsContext = createContext<
  DashPanelDefaultActionItems | undefined
>(undefined)

export function useDashPanelDefaultActionItems(): DashPanelDefaultActionItems | undefined {
  return useContext(DashPanelDefaultActionItemsContext)
}
