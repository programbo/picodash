// @vitest-environment jsdom
import { readFile } from 'node:fs/promises'
import { URL as FileURL } from 'node:url'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { DialogTrigger } from 'react-aria-components'
import { describe, expect, it } from 'vite-plus/test'
import { dispatchElement, renderReactRoot } from '../../../test/react.ts'
import {
  ActionMenu,
  ActionMenuItem,
  ActionSubmenu,
  Button,
  PicodashOverlayProvider,
  Popover,
} from '../src/index.tsx'

describe('@picodash/ui interactive overlay pointer ownership', () => {
  it('reenables menu, submenu and Popover portals under a pass-through host while preserving caller styles', async () => {
    const style = document.createElement('style')
    style.textContent = await readFile(new FileURL('../style.css', import.meta.url), 'utf8')
    document.head.append(style)
    const host = document.createElement('div')
    host.style.pointerEvents = 'none'
    document.body.append(host)
    const root = createRoot(host)
    try {
      await renderReactRoot(
        root,
        <PicodashOverlayProvider portalContainer={host}>
          <ActionMenu label="Actions" defaultOpen>
            <ActionSubmenu label="More actions">
              <ActionMenuItem label="Run" onAction={() => undefined} />
            </ActionSubmenu>
          </ActionMenu>
        </PicodashOverlayProvider>,
      )
      const menu = host.querySelector('.picodash-action-menu-popover')
      if (!(menu instanceof HTMLElement)) throw new Error('ActionMenu portal was not rendered.')
      expect(getComputedStyle(host).pointerEvents).toBe('none')
      expect(getComputedStyle(menu).pointerEvents).toBe('auto')
      const trigger = host.querySelector('[data-slot="action-submenu"]')
      if (!(trigger instanceof HTMLElement)) throw new Error('Submenu trigger was not rendered.')
      await dispatchElement(
        trigger,
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      )
      const submenu = host.querySelector('.picodash-action-submenu-popover')
      if (!(submenu instanceof HTMLElement)) throw new Error('Submenu portal was not rendered.')
      expect(getComputedStyle(submenu).pointerEvents).toBe('auto')

      await renderReactRoot(
        root,
        <PicodashOverlayProvider portalContainer={host}>
          <DialogTrigger defaultOpen>
            <Button>Open details</Button>
            <Popover>Details</Popover>
          </DialogTrigger>
        </PicodashOverlayProvider>,
      )
      const popover = host.querySelector('[data-slot="popover"]')
      if (!(popover instanceof HTMLElement)) throw new Error('Popover portal was not rendered.')
      expect(getComputedStyle(popover).pointerEvents).toBe('auto')
      await renderReactRoot(
        root,
        <PicodashOverlayProvider portalContainer={host}>
          <DialogTrigger defaultOpen>
            <Button>Open details</Button>
            <Popover style={{ pointerEvents: 'none' }}>Details</Popover>
          </DialogTrigger>
        </PicodashOverlayProvider>,
      )
      expect(getComputedStyle(popover).pointerEvents).toBe('none')
      expect(getComputedStyle(host).pointerEvents).toBe('none')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      style.remove()
    }
  })
})
