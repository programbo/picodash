import { createElement } from 'react'
import { describe, expectTypeOf, it } from 'vite-plus/test'
import { createPicodashStore } from '@picodash/store'
import {
  DashPanel as OwnerDashPanel,
  type DashPanelProps as OwnerDashPanelProps,
} from '@picodash/dashpanel'
import {
  DashGroup as OwnerDashGroup,
  DashList as OwnerDashList,
  Dashlet as OwnerDashlet,
  type DashGroupProps as OwnerDashGroupProps,
  type DashListProps as OwnerDashListProps,
  type DashletProps as OwnerDashletProps,
} from '@picodash/dashlist'
import {
  ActionMenu,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  DashGroup,
  DashHeader,
  DashList,
  DashPanel,
  Dashlet,
  PicodashProvider,
  type ActionMenuConfirmation,
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
  type PicodashDockPosition,
  type PicodashProviderProps,
} from '../src/index.ts'

const store = createPicodashStore({ valueOwner: 'store', fields: { value: { defaultValue: 0 } } })

describe('@picodash/picodash facade public types', () => {
  it('keeps owner identities and the narrowed Provider contract explicit', () => {
    const provider: PicodashProviderProps = {
      store,
      children: null,
      dockPositions: ['top-left', 'center-right'],
      boundary: null,
      density: 'compact',
    }
    const dock: PicodashDockPosition = 'full-left'
    const panelDock: DashPanelDockPosition = 'center-bottom'
    const panelProps: DashPanelProps = { id: 'panel', title: 'Panel' }
    const listProps: DashListProps = { id: 'list', store, children: null }
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

    // @ts-expect-error a scoped Store cannot be supplied to the facade Provider.
    const scopedProvider: PicodashProviderProps = { store: store.scope('scope'), children: null }
    void scopedProvider
    const forbiddenTop: PicodashProviderProps = {
      store,
      children: null,
      // @ts-expect-error Picodash excludes full-top from its Provider dock policy.
      dockPositions: ['full-top'],
    }
    void forbiddenTop
    const forbiddenCenterTop: PicodashProviderProps = {
      store,
      children: null,
      // @ts-expect-error Picodash excludes center-top from its Provider dock policy.
      dockPositions: ['center-top'],
    }
    void forbiddenCenterTop
    const forbiddenBottom: PicodashProviderProps = {
      store,
      children: null,
      // @ts-expect-error Picodash excludes full-bottom from its Provider dock policy.
      dockPositions: ['full-bottom'],
    }
    void forbiddenBottom
    const forbiddenCenterBottom: PicodashProviderProps = {
      store,
      children: null,
      // @ts-expect-error Picodash excludes center-bottom from its Provider dock policy.
      dockPositions: ['center-bottom'],
    }
    void forbiddenCenterBottom
    // @ts-expect-error retired Provider extension props are not part of the alpha facade.
    const retired: PicodashProviderProps = { store, children: null, storageKey: 'old' }
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
