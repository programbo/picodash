'use client'

import {
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  CollapseAllItem,
  CopyJsonItem,
  CopySubmenu,
  CopyYamlItem,
  ExpandAllItem,
  ExportJsonItem,
  ExportSubmenu,
  ExportYamlItem,
  ImportItem,
  PicodashPanel,
  PicodashPanelLauncher,
  PicodashPanelTrigger,
  PicodashProvider,
  ResetItem,
  usePicodashPanel,
  type PicodashPanelProps,
} from './panel/index.js'

/**
 * A draggable, dockable panel for arbitrary application content.
 *
 * DashPanel owns the panel shell and placement lifecycle. Its children are rendered directly;
 * Dashlet list composition belongs to `@picodash/dashlist`.
 */
export function DashPanel<TValues extends object>({ children, ...props }: DashPanelProps<TValues>) {
  return (
    <PicodashPanel {...props} contentMode="plain">
      {children}
    </PicodashPanel>
  )
}

export {
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  CollapseAllItem,
  CopyJsonItem,
  CopySubmenu,
  CopyYamlItem,
  ExpandAllItem,
  ExportJsonItem,
  ExportSubmenu,
  ExportYamlItem,
  ImportItem,
  PicodashPanelLauncher as DashPanelLauncher,
  PicodashPanelTrigger as DashPanelTrigger,
  PicodashProvider as DashPanelProvider,
  ResetItem,
  usePicodashPanel as useDashPanel,
}

export type {
  ActionMenuConfirmation,
  ActionMenuItemProps,
  ActionMenuSeparatorProps,
  ActionSubmenuProps,
  PicodashPanelActionMenu as DashPanelActionMenu,
  PicodashPanelBoundary as DashPanelBoundary,
  PicodashPanelCloseBehavior as DashPanelCloseBehavior,
  PicodashPanelCloseDetails as DashPanelCloseDetails,
  PicodashPanelCloseOptions as DashPanelCloseOptions,
  PicodashPanelController as DashPanelController,
  PicodashPanelCorner as DashPanelCorner,
  PicodashPanelDefaultPlacement as DashPanelDefaultPlacement,
  PicodashPanelDockedDisposition as DashPanelDockedDisposition,
  PicodashPanelDockedPosition as DashPanelDockedPosition,
  PicodashPanelFreeDisposition as DashPanelFreeDisposition,
  PicodashPanelHybridDockPosition as DashPanelHybridDockPosition,
  PicodashPanelPlacement as DashPanelPlacement,
  PicodashPanelPlacementOptions as DashPanelPlacementOptions,
  PicodashPanelIdentity as DashPanelIdentity,
  PicodashPanelLauncherItem as DashPanelLauncherItem,
  PicodashPanelLauncherProps as DashPanelLauncherProps,
  PicodashPanelTriggerProps as DashPanelTriggerProps,
  PicodashResolvedTheme as DashPanelResolvedTheme,
  PicodashPanelSnappedDisposition as DashPanelSnappedDisposition,
  PicodashPanelSnappedPosition as DashPanelSnappedPosition,
  PicodashProviderProps as DashPanelProviderProps,
  PicodashTheme,
  PicodashThemeOption,
} from './panel/index.js'

export type DashPanelProps<TValues extends object = Record<string, never>> = Omit<
  PicodashPanelProps<TValues>,
  'contentMode'
>

// The DashPanel package owns the extracted implementation and keeps the
// Picodash-prefixed names available for aggregate consumers during the rename.
export * from './panel/index.js'
