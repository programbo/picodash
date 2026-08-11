import { createElement, type ReactElement } from 'react'
import { describe, it } from 'vite-plus/test'
import {
  ActionMenu,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  type ActionMenuConfirmation,
  type ActionMenuItemProps,
  type ActionMenuItemVariant,
  type ActionMenuProps,
  type ActionMenuSeparatorProps,
  type ActionSubmenuProps,
} from '../src/index.tsx'

describe('@picodash/ui ActionMenu types', () => {
  it('accepts the exact public surface and rejects raw or retired props', () => {
    const confirmation: ActionMenuConfirmation = {
      title: 'Reset?',
      description: 'Restore defaults.',
      actionLabel: 'Reset values',
      guard: {
        fingerprint: 'values:a',
        getFingerprint: () => 'values:a',
        subscribe: () => () => undefined,
      },
    }
    const variant: ActionMenuItemVariant = 'destructive'
    const itemProps: ActionMenuItemProps = {
      label: 'Reset',
      onAction: async () => {},
      confirmation,
      variant,
    }
    const submenuProps: ActionSubmenuProps = { label: 'More', children: null }
    const separatorProps: ActionMenuSeparatorProps = { className: 'separator' }
    const menuProps: ActionMenuProps = {
      label: 'Actions',
      children: null,
      trigger: createElement('button', { type: 'button' }, 'Open'),
      portalContainer: null,
      layerBase: 10,
      defaultOpen: false,
      onOpenChange: () => {},
    }

    void ActionMenu
    void ActionMenuItem
    void ActionMenuSeparator
    void ActionSubmenu
    void itemProps
    void submenuProps
    void separatorProps
    void menuProps

    // @ts-expect-error raw React Aria menu props are not public ActionMenu props.
    const rawMenu: ActionMenuProps = { label: 'Actions', children: null, placement: 'bottom' }
    // @ts-expect-error refs are not part of the ActionMenu root contract.
    const refMenu: ActionMenuProps = { label: 'Actions', children: null, ref: null }
    const retiredDisabled: ActionMenuItemProps = {
      label: 'Run',
      onAction: () => {},
      // @ts-expect-error ActionMenuItem does not accept the retired disabled alias.
      disabled: true,
    }
    // @ts-expect-error orientation is fixed horizontal for ActionMenuSeparator.
    const verticalSeparator: ActionMenuSeparatorProps = { orientation: 'vertical' }
    // @ts-expect-error submenu delay is private and fixed by React Aria composition.
    const delayedSubmenu: ActionSubmenuProps = { label: 'More', children: null, delay: 0 }
    // @ts-expect-error nested submenu has no public command callback.
    const submenuAction: ActionSubmenuProps = { label: 'More', children: null, onAction: () => {} }

    void rawMenu
    void refMenu
    void retiredDisabled
    void verticalSeparator
    void delayedSubmenu
    void submenuAction

    const element: ReactElement = createElement(ActionMenu, menuProps)
    void element
  })
})
