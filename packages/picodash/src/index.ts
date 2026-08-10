'use client'

export { PicodashProvider } from './picodash-provider.tsx'

export {
  ActionMenu,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  DashHeader,
  DashPanel,
} from '@picodash/dashpanel'
export { DashGroup, DashList, Dashlet } from '@picodash/dashlist'
export { createPicodashStore } from '@picodash/store'
export { usePicodashStoreSelector } from '@picodash/store/react'

export type { PicodashProviderProps, PicodashDockPosition } from './picodash-provider.tsx'

export type {
  DashPanelProps,
  DashPanelStyle,
  DashPanelBoundary,
  DashPanelBoundaryInset,
  DashPanelSnapPosition,
  DashPanelDockPosition,
  DashPanelPlacement,
  DashPanelDefaultLayout,
  DashPanelPlacementOptions,
  DashPanelPresentation,
} from '@picodash/dashpanel'
export type { DashListProps, DashGroupProps, DashletProps } from '@picodash/dashlist'
export type {
  DashHeaderProps,
  DashHeaderSlots,
  ActionMenuConfirmation,
  ActionMenuConfirmationGuard,
  ActionMenuItemProps,
  ActionMenuItemVariant,
  ActionMenuProps,
  ActionMenuSeparatorProps,
  ActionSubmenuProps,
} from '@picodash/dashpanel'
