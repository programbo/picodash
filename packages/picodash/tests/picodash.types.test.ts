import { createElement, type ComponentProps } from 'react'
import { describe, expect, expectTypeOf, it } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
import {
  DashPanel as OwnerDashPanel,
  type DashPanelProps as OwnerDashPanelProps,
} from '@picodash/dashpanel'
import {
  CheckboxDashlet as OwnerCheckboxDashlet,
  CheckboxGroupDashlet as OwnerCheckboxGroupDashlet,
  ColorDashlet as OwnerColorDashlet,
  ComboboxDashlet as OwnerComboboxDashlet,
  DateDashlet as OwnerDateDashlet,
  DateRangeDashlet as OwnerDateRangeDashlet,
  DateTimeDashlet as OwnerDateTimeDashlet,
  DashGroup as OwnerDashGroup,
  DashList as OwnerDashList,
  Dashlet as OwnerDashlet,
  DisplayDashlet as OwnerDisplayDashlet,
  MeterDashlet as OwnerMeterDashlet,
  MultiSelectDashlet as OwnerMultiSelectDashlet,
  NumberDashlet as OwnerNumberDashlet,
  ProgressDashlet as OwnerProgressDashlet,
  RadioGroupDashlet as OwnerRadioGroupDashlet,
  RangeDashlet as OwnerRangeDashlet,
  SearchDashlet as OwnerSearchDashlet,
  SegmentedDashlet as OwnerSegmentedDashlet,
  SelectDashlet as OwnerSelectDashlet,
  SliderDashlet as OwnerSliderDashlet,
  StatusDashlet as OwnerStatusDashlet,
  SwitchDashlet as OwnerSwitchDashlet,
  TextDashlet as OwnerTextDashlet,
  TimeDashlet as OwnerTimeDashlet,
  type CheckboxDashletProps as OwnerCheckboxDashletProps,
  type CheckboxGroupDashletProps as OwnerCheckboxGroupDashletProps,
  type ColorDashletProps as OwnerColorDashletProps,
  type ComboboxDashletProps as OwnerComboboxDashletProps,
  type DateDashletProps as OwnerDateDashletProps,
  type DateRangeDashletProps as OwnerDateRangeDashletProps,
  type DateTimeDashletProps as OwnerDateTimeDashletProps,
  type DashGroupProps as OwnerDashGroupProps,
  type DashListProps as OwnerDashListProps,
  type DashletProps as OwnerDashletProps,
  type DisplayDashletProps as OwnerDisplayDashletProps,
  type MeterDashletProps as OwnerMeterDashletProps,
  type MultiSelectDashletProps as OwnerMultiSelectDashletProps,
  type NumberDashletProps as OwnerNumberDashletProps,
  type ProgressDashletProps as OwnerProgressDashletProps,
  type RadioGroupDashletProps as OwnerRadioGroupDashletProps,
  type RangeDashletProps as OwnerRangeDashletProps,
  type SearchDashletProps as OwnerSearchDashletProps,
  type SegmentedDashletProps as OwnerSegmentedDashletProps,
  type SelectDashletProps as OwnerSelectDashletProps,
  type SliderDashletProps as OwnerSliderDashletProps,
  type StatusDashletProps as OwnerStatusDashletProps,
  type SwitchDashletProps as OwnerSwitchDashletProps,
  type TextDashletProps as OwnerTextDashletProps,
  type TimeDashletProps as OwnerTimeDashletProps,
} from '@picodash/dashlist'
import {
  ActionMenu,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  CheckboxDashlet,
  CheckboxGroupDashlet,
  ColorDashlet,
  ComboboxDashlet,
  DateDashlet,
  DateRangeDashlet,
  DateTimeDashlet,
  DashGroup,
  DashHeader,
  DashList,
  DashPanel,
  Dashlet,
  DisplayDashlet,
  MeterDashlet,
  MultiSelectDashlet,
  NumberDashlet,
  PicodashProvider,
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
  type ActionMenuConfirmation,
  type ActionMenuConfirmationGuard,
  type ActionMenuItemProps,
  type ActionMenuItemVariant,
  type ActionMenuProps,
  type ActionMenuSeparatorProps,
  type ActionSubmenuProps,
  type DashGroupProps,
  type DashHeaderProps,
  type DashHeaderSlots,
  type DashListProps,
  type DashPanelBoundary,
  type DashPanelBoundaryInset,
  type DashPanelDefaultLayout,
  type DashPanelDockPosition,
  type DashPanelPlacement,
  type DashPanelPlacementOptions,
  type DashPanelPresentation,
  type DashPanelProps,
  type DashPanelSnapPosition,
  type DashPanelStyle,
  type DashletProps,
  type CheckboxDashletProps,
  type CheckboxGroupDashletProps,
  type ColorDashletProps,
  type ComboboxDashletProps,
  type DateDashletProps,
  type DateRangeDashletProps,
  type DateTimeDashletProps,
  type DisplayDashletProps,
  type MeterDashletProps,
  type MultiSelectDashletProps,
  type NumberDashletProps,
  type PicodashDockPosition,
  type PicodashProviderProps,
  type ProgressDashletProps,
  type RadioGroupDashletProps,
  type RangeDashletProps,
  type SearchDashletProps,
  type SegmentedDashletProps,
  type SelectDashletProps,
  type SliderDashletProps,
  type StatusDashletProps,
  type SwitchDashletProps,
  type TextDashletProps,
  type TimeDashletProps,
} from '../src/index.ts'
import { Popover as OwnerPopover, type PopoverProps as OwnerPopoverProps } from '@picodash/ui'
import { Popover as FacadePopover, type PopoverProps as FacadePopoverProps } from '../src/ui.ts'

const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: { value: { defaultValue: 0 } } })
const readyMadeNexus = createPicodashNexus({
  valueOwner: 'nexus',
  fields: {
    text: { defaultValue: '' },
    number: { defaultValue: 1 },
    flag: { defaultValue: false },
    choices: { defaultValue: ['a'] },
    range: { defaultValue: { start: 1, end: 2 } },
    dateRange: { defaultValue: { start: '2026-08-18', end: '2026-08-24' } },
  },
})

describe('@picodash/picodash facade public types', () => {
  it('reexports the exact shared Popover from the /ui facade', () => {
    const props: FacadePopoverProps = {
      children: null,
      portalContainer: null,
      layerBase: 20,
      placement: 'bottom',
    }
    void props
    expectTypeOf(FacadePopover).toEqualTypeOf(OwnerPopover)
    expectTypeOf<FacadePopoverProps>().toEqualTypeOf<OwnerPopoverProps>()
  })

  it('preserves all ready-made component and prop identities', () => {
    const facadeComponents = {
      CheckboxDashlet,
      CheckboxGroupDashlet,
      ColorDashlet,
      ComboboxDashlet,
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
    }
    const ownerComponents = {
      CheckboxDashlet: OwnerCheckboxDashlet,
      CheckboxGroupDashlet: OwnerCheckboxGroupDashlet,
      ColorDashlet: OwnerColorDashlet,
      ComboboxDashlet: OwnerComboboxDashlet,
      DateDashlet: OwnerDateDashlet,
      DateRangeDashlet: OwnerDateRangeDashlet,
      DateTimeDashlet: OwnerDateTimeDashlet,
      DisplayDashlet: OwnerDisplayDashlet,
      MeterDashlet: OwnerMeterDashlet,
      MultiSelectDashlet: OwnerMultiSelectDashlet,
      NumberDashlet: OwnerNumberDashlet,
      ProgressDashlet: OwnerProgressDashlet,
      RadioGroupDashlet: OwnerRadioGroupDashlet,
      RangeDashlet: OwnerRangeDashlet,
      SearchDashlet: OwnerSearchDashlet,
      SegmentedDashlet: OwnerSegmentedDashlet,
      SelectDashlet: OwnerSelectDashlet,
      SliderDashlet: OwnerSliderDashlet,
      StatusDashlet: OwnerStatusDashlet,
      SwitchDashlet: OwnerSwitchDashlet,
      TextDashlet: OwnerTextDashlet,
      TimeDashlet: OwnerTimeDashlet,
    }
    expect(facadeComponents).toEqual(ownerComponents)
    expectTypeOf(facadeComponents).toEqualTypeOf(ownerComponents)

    type FacadeReadyMadeProps = {
      text: TextDashletProps<typeof readyMadeNexus.fields.text>
      number: NumberDashletProps<typeof readyMadeNexus.fields.number>
      slider: SliderDashletProps<typeof readyMadeNexus.fields.number>
      switch: SwitchDashletProps<typeof readyMadeNexus.fields.flag>
      select: SelectDashletProps<string, typeof readyMadeNexus.fields.text>
      segmented: SegmentedDashletProps<string, typeof readyMadeNexus.fields.text>
      display: DisplayDashletProps<typeof readyMadeNexus.fields.number>
      checkbox: CheckboxDashletProps<typeof readyMadeNexus.fields.flag>
      radioGroup: RadioGroupDashletProps<string, typeof readyMadeNexus.fields.text>
      combobox: ComboboxDashletProps<string, typeof readyMadeNexus.fields.text>
      checkboxGroup: CheckboxGroupDashletProps<string, typeof readyMadeNexus.fields.choices>
      multiSelect: MultiSelectDashletProps<string, typeof readyMadeNexus.fields.choices>
      search: SearchDashletProps<typeof readyMadeNexus.fields.text>
      range: RangeDashletProps<typeof readyMadeNexus.fields.range>
      meter: MeterDashletProps<typeof readyMadeNexus.fields.number>
      progress: ProgressDashletProps<typeof readyMadeNexus.fields.number>
      status: StatusDashletProps<string, typeof readyMadeNexus.fields.text>
      date: DateDashletProps<typeof readyMadeNexus.fields.text>
      time: TimeDashletProps<typeof readyMadeNexus.fields.text>
      dateTime: DateTimeDashletProps<typeof readyMadeNexus.fields.text>
      dateRange: DateRangeDashletProps<typeof readyMadeNexus.fields.dateRange>
      color: ColorDashletProps<typeof readyMadeNexus.fields.text>
    }
    type OwnerReadyMadeProps = {
      text: OwnerTextDashletProps<typeof readyMadeNexus.fields.text>
      number: OwnerNumberDashletProps<typeof readyMadeNexus.fields.number>
      slider: OwnerSliderDashletProps<typeof readyMadeNexus.fields.number>
      switch: OwnerSwitchDashletProps<typeof readyMadeNexus.fields.flag>
      select: OwnerSelectDashletProps<string, typeof readyMadeNexus.fields.text>
      segmented: OwnerSegmentedDashletProps<string, typeof readyMadeNexus.fields.text>
      display: OwnerDisplayDashletProps<typeof readyMadeNexus.fields.number>
      checkbox: OwnerCheckboxDashletProps<typeof readyMadeNexus.fields.flag>
      radioGroup: OwnerRadioGroupDashletProps<string, typeof readyMadeNexus.fields.text>
      combobox: OwnerComboboxDashletProps<string, typeof readyMadeNexus.fields.text>
      checkboxGroup: OwnerCheckboxGroupDashletProps<string, typeof readyMadeNexus.fields.choices>
      multiSelect: OwnerMultiSelectDashletProps<string, typeof readyMadeNexus.fields.choices>
      search: OwnerSearchDashletProps<typeof readyMadeNexus.fields.text>
      range: OwnerRangeDashletProps<typeof readyMadeNexus.fields.range>
      meter: OwnerMeterDashletProps<typeof readyMadeNexus.fields.number>
      progress: OwnerProgressDashletProps<typeof readyMadeNexus.fields.number>
      status: OwnerStatusDashletProps<string, typeof readyMadeNexus.fields.text>
      date: OwnerDateDashletProps<typeof readyMadeNexus.fields.text>
      time: OwnerTimeDashletProps<typeof readyMadeNexus.fields.text>
      dateTime: OwnerDateTimeDashletProps<typeof readyMadeNexus.fields.text>
      dateRange: OwnerDateRangeDashletProps<typeof readyMadeNexus.fields.dateRange>
      color: OwnerColorDashletProps<typeof readyMadeNexus.fields.text>
    }
    expectTypeOf<FacadeReadyMadeProps>().toEqualTypeOf<OwnerReadyMadeProps>()

    type ExtractedFacadeReadyMadeProps = {
      checkbox: ComponentProps<typeof CheckboxDashlet>
      checkboxGroup: ComponentProps<typeof CheckboxGroupDashlet>
      color: ComponentProps<typeof ColorDashlet>
      combobox: ComponentProps<typeof ComboboxDashlet>
      date: ComponentProps<typeof DateDashlet>
      dateRange: ComponentProps<typeof DateRangeDashlet>
      dateTime: ComponentProps<typeof DateTimeDashlet>
      display: ComponentProps<typeof DisplayDashlet>
      meter: ComponentProps<typeof MeterDashlet>
      multiSelect: ComponentProps<typeof MultiSelectDashlet>
      number: ComponentProps<typeof NumberDashlet>
      progress: ComponentProps<typeof ProgressDashlet>
      radioGroup: ComponentProps<typeof RadioGroupDashlet>
      range: ComponentProps<typeof RangeDashlet>
      search: ComponentProps<typeof SearchDashlet>
      segmented: ComponentProps<typeof SegmentedDashlet>
      select: ComponentProps<typeof SelectDashlet>
      slider: ComponentProps<typeof SliderDashlet>
      status: ComponentProps<typeof StatusDashlet>
      switch: ComponentProps<typeof SwitchDashlet>
      text: ComponentProps<typeof TextDashlet>
      time: ComponentProps<typeof TimeDashlet>
    }
    type ExtractedOwnerReadyMadeProps = {
      checkbox: ComponentProps<typeof OwnerCheckboxDashlet>
      checkboxGroup: ComponentProps<typeof OwnerCheckboxGroupDashlet>
      color: ComponentProps<typeof OwnerColorDashlet>
      combobox: ComponentProps<typeof OwnerComboboxDashlet>
      date: ComponentProps<typeof OwnerDateDashlet>
      dateRange: ComponentProps<typeof OwnerDateRangeDashlet>
      dateTime: ComponentProps<typeof OwnerDateTimeDashlet>
      display: ComponentProps<typeof OwnerDisplayDashlet>
      meter: ComponentProps<typeof OwnerMeterDashlet>
      multiSelect: ComponentProps<typeof OwnerMultiSelectDashlet>
      number: ComponentProps<typeof OwnerNumberDashlet>
      progress: ComponentProps<typeof OwnerProgressDashlet>
      radioGroup: ComponentProps<typeof OwnerRadioGroupDashlet>
      range: ComponentProps<typeof OwnerRangeDashlet>
      search: ComponentProps<typeof OwnerSearchDashlet>
      segmented: ComponentProps<typeof OwnerSegmentedDashlet>
      select: ComponentProps<typeof OwnerSelectDashlet>
      slider: ComponentProps<typeof OwnerSliderDashlet>
      status: ComponentProps<typeof OwnerStatusDashlet>
      switch: ComponentProps<typeof OwnerSwitchDashlet>
      text: ComponentProps<typeof OwnerTextDashlet>
      time: ComponentProps<typeof OwnerTimeDashlet>
    }
    expectTypeOf<ExtractedFacadeReadyMadeProps>().toEqualTypeOf<ExtractedOwnerReadyMadeProps>()
  })

  it('keeps owner identities and the narrowed Provider contract explicit', () => {
    const provider: PicodashProviderProps = {
      nexus,
      children: null,
      dockPositions: ['top-left', 'center-right'],
      boundary: null,
      density: 'compact',
    }
    const dock: PicodashDockPosition = 'full-left'
    const panelDock: DashPanelDockPosition = 'center-bottom'
    const panelProps: DashPanelProps = { id: 'panel', title: 'Panel' }
    const listProps: DashListProps = { id: 'list', nexus, children: null }
    const groupProps: DashGroupProps = { id: 'group', label: 'Group' }
    const dashletProps: DashletProps = { id: 'item', label: 'Item' }
    const style: DashPanelStyle = { color: 'red' }
    const boundary: DashPanelBoundary = {} as Element
    const inset: DashPanelBoundaryInset = [1, 2, 3, 4]
    const snap: DashPanelSnapPosition = 'top-right'
    const placement: DashPanelPlacement = {
      mode: 'fixed',
      disposition: { kind: 'docked', position: panelDock },
    }
    const layout: DashPanelDefaultLayout = { placement }
    const options: DashPanelPlacementOptions = { snapOffset: 4 }
    const presentation: DashPanelPresentation = { kind: 'panel' }
    const confirmation: ActionMenuConfirmation = {
      title: 'Confirm',
      description: 'Confirm the action.',
      actionLabel: 'Confirm',
    }
    const confirmationGuard: ActionMenuConfirmationGuard = {
      fingerprint: 'facade:v1',
      getFingerprint: () => 'facade:v1',
      subscribe: () => () => undefined,
    }
    void confirmationGuard
    const menuItem: ActionMenuItemProps = { label: 'Action', onAction: () => {}, confirmation }
    const variant: ActionMenuItemVariant = 'destructive'
    const menu: ActionMenuProps = { label: 'Actions', children: null }
    const separator: ActionMenuSeparatorProps = {}
    const submenu: ActionSubmenuProps = { label: 'More', children: null }
    const header: DashHeaderProps = { slots: {} as DashHeaderSlots }
    void provider
    void dock
    void panelProps
    void listProps
    void groupProps
    void dashletProps
    void style
    void boundary
    void inset
    void snap
    void layout
    void options
    void presentation
    void menuItem
    void variant
    void menu
    void separator
    void submenu
    void header

    void createElement(PicodashProvider, provider)
    void createElement(DashPanel, panelProps)
    void createElement(DashList, listProps)
    void createElement(DashGroup, groupProps)
    void createElement(Dashlet, dashletProps)
    void ActionMenu
    void ActionMenuItem
    void ActionMenuSeparator
    void ActionSubmenu
    void DashHeader

    expectTypeOf(DashPanel).toEqualTypeOf(OwnerDashPanel)
    expectTypeOf(DashList).toEqualTypeOf(OwnerDashList)
    expectTypeOf(DashGroup).toEqualTypeOf(OwnerDashGroup)
    expectTypeOf(Dashlet).toEqualTypeOf(OwnerDashlet)
    expectTypeOf<DashPanelProps>().toEqualTypeOf<OwnerDashPanelProps>()
    expectTypeOf<DashListProps>().toEqualTypeOf<OwnerDashListProps>()
    expectTypeOf<DashGroupProps>().toEqualTypeOf<OwnerDashGroupProps>()
    expectTypeOf<DashletProps>().toEqualTypeOf<OwnerDashletProps>()

    // @ts-expect-error a scoped Nexus cannot be supplied to the facade Provider.
    const scopedProvider: PicodashProviderProps = { nexus: nexus.scope('scope'), children: null }
    void scopedProvider
    const forbiddenTop: PicodashProviderProps = {
      nexus,
      children: null,
      // @ts-expect-error Picodash excludes full-top from its Provider dock policy.
      dockPositions: ['full-top'],
    }
    void forbiddenTop
    const forbiddenCenterTop: PicodashProviderProps = {
      nexus,
      children: null,
      // @ts-expect-error Picodash excludes center-top from its Provider dock policy.
      dockPositions: ['center-top'],
    }
    void forbiddenCenterTop
    const forbiddenBottom: PicodashProviderProps = {
      nexus,
      children: null,
      // @ts-expect-error Picodash excludes full-bottom from its Provider dock policy.
      dockPositions: ['full-bottom'],
    }
    void forbiddenBottom
    const forbiddenCenterBottom: PicodashProviderProps = {
      nexus,
      children: null,
      // @ts-expect-error Picodash excludes center-bottom from its Provider dock policy.
      dockPositions: ['center-bottom'],
    }
    void forbiddenCenterBottom
    // @ts-expect-error retired Provider extension props are not part of the alpha facade.
    const retired: PicodashProviderProps = { nexus, children: null, storageKey: 'old' }
    void retired
  })

  it('does not expose legacy aliases or unlanded facade surfaces', async () => {
    const runtime = await import('../src/index.ts')
    for (const retired of [
      'PicodashPanel',
      'PicodashList',
      'PicodashGroup',
      'PicodashItem',
      'Dashlist',
      'DashletGroup',
      'DashPanelProvider',
      'useDashPanel',
      'useDashListActions',
      'catalog',
    ]) {
      if (retired in runtime) throw new Error(`retired export remains: ${retired}`)
    }
  })
})
