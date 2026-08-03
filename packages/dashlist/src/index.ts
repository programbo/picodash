'use client'

import { PicodashGroup } from './components/panel/PicodashGroup.js'
import { PicodashItem } from './components/panel/PicodashItem.js'
import { PicodashList } from './components/panel/PicodashList.js'

export { PicodashGroup, PicodashItem, PicodashList }
export const Dashlet = PicodashItem
export const DashletGroup = PicodashGroup
export const Dashlist = PicodashList

export type {
  PicodashCompoundDisplayFieldContext as DashletCompoundDisplayFieldContext,
  PicodashCompoundFieldContext as DashletCompoundFieldContext,
  PicodashCompoundInputFieldContext as DashletCompoundInputFieldContext,
  PicodashCompoundItemContext as DashletCompoundItemContext,
  PicodashCompoundItemFields as DashletCompoundItemFields,
  PicodashCompoundItemProps as DashletCompoundItemProps,
  PicodashDisplayFieldContext as DashletDisplayFieldContext,
  PicodashDisplayItemContextValue as DashletDisplayItemContextValue,
  PicodashDisplayItemProps as DashletDisplayItemProps,
  PicodashInputFieldContext as DashletInputFieldContext,
  PicodashInputItemProps as DashletInputItemProps,
  PicodashItemBindingContext as DashletItemBindingContext,
  PicodashItemContentLayout as DashletContentLayout,
  PicodashItemContextValue as DashletContextValue,
  PicodashItemFieldBinding as DashletFieldBinding,
  PicodashItemFieldContext as DashletFieldContext,
  PicodashItemProps as DashletProps,
  PicodashItemStates as DashletStates,
  ReactiveProp,
} from './components/panel/PicodashItem.js'
export type { PicodashGroupProps as DashletGroupProps } from './components/panel/PicodashGroup.js'
export type { PicodashListProps as DashlistProps } from './components/panel/PicodashList.js'
export type {
  PicodashControlStates as DashletControlStates,
  PicodashPin as DashletPin,
  PicodashStatus as DashletStatus,
  PicodashValue as DashletValue,
} from './state/panel/picodash-panel-types.js'

export {
  usePicodashListScope as useDashlistScope,
  usePicodashItem as useDashlet,
  usePicodashPanelSelector as useDashlistSelector,
  usePicodashPanelStoreApi as useDashlistStoreApi,
  useRegisterPicodashItem as useRegisterDashlet,
} from './components/panel/PicodashPanel.js'
