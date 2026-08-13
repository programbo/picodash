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
export {
  CheckboxDashlet,
  CheckboxGroupDashlet,
  ColorDashlet,
  ComboboxDashlet,
  DashGroup,
  DashList,
  Dashlet,
  DateDashlet,
  DateRangeDashlet,
  DateTimeDashlet,
  DisplayDashlet,
  MeterDashlet,
  MultiSelectDashlet,
  NumberDashlet,
  ProgressDashlet,
  RadioGroupDashlet,
  RangeDashlet,
  SearchDashlet,
  SegmentedDashlet,
  SelectDashlet,
  SliderDashlet,
  StatusDashlet,
  SwitchDashlet,
  TextDashlet,
  TimeDashlet,
} from '@picodash/dashlist'
export { createPicodashNexus } from '@picodash/nexus'
export { usePicodashNexusSelector } from '@picodash/nexus/react'

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
  CheckboxDashletProps,
  CheckboxGroupDashletProps,
  ColorDashletProps,
  ComboboxDashletProps,
  DashletChoiceOption,
  DateDashletProps,
  DateRangeDashletProps,
  DateTimeDashletProps,
  DisplayDashletProps,
  MeterDashletProps,
  MultiSelectDashletProps,
  NumberDashletProps,
  ProgressDashletProps,
  RadioGroupDashletProps,
  RangeDashletProps,
  SearchDashletProps,
  SegmentedDashletProps,
  SelectDashletProps,
  SliderDashletMark,
  SliderDashletProps,
  StatusDashletProps,
  SwitchDashletProps,
  TextDashletProps,
  TimeDashletProps,
} from '@picodash/dashlist'
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
