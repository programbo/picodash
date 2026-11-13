'use client'

export { PicodashProvider } from './picodash-provider.tsx'

export {
  ActionMenu,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  DashHeader,
  DashPanel,
  DashPanelRestoreSizeItem,
  useDashPanel,
} from '@picodash/dashpanel'
export {
  CheckboxDashlet,
  CheckboxGroupDashlet,
  ColorDashlet,
  ComboboxDashlet,
  DashGroup,
  DashStack,
  useDashStackOrder,
  useDashStackStructure,
  useDashStackGroupOrder,
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
} from '@picodash/dashstack'
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
  DashPanelDimension,
  DashPanelHeight,
  DashPanelResize,
  DashPanelResizeOptions,
  DashPanelResizeTarget,
  DashPanelContentConstraints,
  DashPanelContentMetrics,
  DashPanelManualSize,
  DashPanelSizingState,
  DashPanelSizingConstraint,
  DashPanelSizeRequest,
  DashPanelRestoreSizeOptions,
  DashPanelController,
  DashPanelCommandResult,
  DashPanelLayoutCommandResult,
} from '@picodash/dashpanel'
export type {
  DashStackProps,
  DashGroupProps,
  DashletProps,
  DashStackStructure,
  DashStackNode,
} from '@picodash/dashstack'
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
} from '@picodash/dashstack'
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

export {
  getDashStackStructure,
  subscribeDashStackStructure,
  revealDashlet,
} from '@picodash/dashstack'
export type { DashletRevealResult } from '@picodash/dashstack'
export type {
  NumericGesture,
  NumericGestureOptions,
  NumericGestureEnd,
  NumericGestureCancelReason,
} from '@picodash/nexus'

export { TargetNumberDashlet } from '@picodash/dashstack'
export type { TargetNumberDashletProps, TargetNumberResult } from '@picodash/dashstack'
export { TargetSliderDashlet } from '@picodash/dashstack'
export type { TargetSliderDashletProps, TargetSliderResult } from '@picodash/dashstack'

export type { ItemInteractionSource } from '@picodash/nexus'
