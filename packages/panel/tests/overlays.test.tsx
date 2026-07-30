import { createElement } from 'react'
import { expect, test } from 'vite-plus/test'
import { AlertDialog } from '../src/components/ui/alert-dialog.tsx'
import { Dialog } from '../src/components/ui/dialog.tsx'
import { DropdownMenu } from '../src/components/ui/dropdown-menu.tsx'
import { Tooltip } from '../src/components/ui/tooltip.tsx'
import { resolvePortalLayerZIndex } from '../src/lib/portal/portal-layer-context.tsx'

test('public overlays preserve explicit portal overrides', () => {
  const portal = {} as Element
  const dialog = createElement(Dialog, {
    isOpen: true,
    portalContainer: portal,
    children: 'Dialog',
  })
  const alertDialog = createElement(AlertDialog, {
    isOpen: true,
    portalContainer: portal,
    children: 'Alert',
  })
  const menu = createElement(DropdownMenu, {
    portalContainer: portal,
    children: 'Menu',
  })
  const tooltip = createElement(Tooltip, {
    portalContainer: portal,
    children: 'Tooltip',
  })

  expect(dialog.props.portalContainer).toBe(portal)
  expect(alertDialog.props.portalContainer).toBe(portal)
  expect(menu.props.portalContainer).toBe(portal)
  expect(tooltip.props.portalContainer).toBe(portal)
})

test('overlay components remain usable without a provider', () => {
  expect(() => createElement(Dialog, { isOpen: true, children: 'Dialog' })).not.toThrow()
  expect(() => createElement(AlertDialog, { isOpen: true, children: 'Alert' })).not.toThrow()
  expect(() => createElement(DropdownMenu, { children: 'Menu' })).not.toThrow()
  expect(() => createElement(Tooltip, { children: 'Tooltip' })).not.toThrow()
})

test('raises nested overlay layers above their parent portal layer', () => {
  const dialogZIndex = resolvePortalLayerZIndex({
    cssVariable: '--picodash-layer-dialog',
    floor: 1004,
    parentOffset: 4,
  })

  expect(dialogZIndex).toBe('max(var(--picodash-layer-dialog), 1004)')
  expect(
    resolvePortalLayerZIndex({
      cssVariable: '--picodash-layer-menu',
      floor: 1003,
      parentOffset: 3,
      parentZIndex: dialogZIndex,
    }),
  ).toBe('max(var(--picodash-layer-menu), 1003, calc(max(var(--picodash-layer-dialog), 1004) + 3))')
})
