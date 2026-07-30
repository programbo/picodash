import { createElement } from 'react'
import { expect, test } from 'vite-plus/test'
import { AlertDialog } from '../src/components/ui/alert-dialog.tsx'
import { Dialog } from '../src/components/ui/dialog.tsx'
import { DropdownMenu } from '../src/components/ui/dropdown-menu.tsx'
import { Tooltip } from '../src/components/ui/tooltip.tsx'

test('public overlays preserve explicit theme and portal overrides', () => {
  const portal = {} as Element
  const dialog = createElement(Dialog, {
    'data-picodash-theme': 'brand',
    isOpen: true,
    portalContainer: portal,
    children: 'Dialog',
  })
  const alertDialog = createElement(AlertDialog, {
    'data-picodash-theme': 'contrast',
    isOpen: true,
    portalContainer: portal,
    children: 'Alert',
  })
  const menu = createElement(DropdownMenu, {
    'data-picodash-theme': 'brand',
    portalContainer: portal,
    children: 'Menu',
  })
  const tooltip = createElement(Tooltip, {
    'data-picodash-theme': 'contrast',
    portalContainer: portal,
    children: 'Tooltip',
  })

  expect(dialog.props['data-picodash-theme']).toBe('brand')
  expect(dialog.props.portalContainer).toBe(portal)
  expect(alertDialog.props['data-picodash-theme']).toBe('contrast')
  expect(alertDialog.props.portalContainer).toBe(portal)
  expect(menu.props['data-picodash-theme']).toBe('brand')
  expect(menu.props.portalContainer).toBe(portal)
  expect(tooltip.props['data-picodash-theme']).toBe('contrast')
  expect(tooltip.props.portalContainer).toBe(portal)
})

test('overlay components remain usable without a provider', () => {
  expect(() => createElement(Dialog, { isOpen: true, children: 'Dialog' })).not.toThrow()
  expect(() => createElement(AlertDialog, { isOpen: true, children: 'Alert' })).not.toThrow()
  expect(() => createElement(DropdownMenu, { children: 'Menu' })).not.toThrow()
  expect(() => createElement(Tooltip, { children: 'Tooltip' })).not.toThrow()
})
