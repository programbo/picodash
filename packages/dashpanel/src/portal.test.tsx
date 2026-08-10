// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashStore } from '@picodash/store'
import { usePicodashScope } from '@picodash/store/react'
import { PicodashOverlayProvider } from '@picodash/ui'
import { DashPanel, DashPanelProvider } from './index.tsx'

let root: Root
let container: HTMLDivElement

const makeStore = () => createPicodashStore({ valueOwner: 'store', fields: {} })

async function render(element: React.ReactNode) {
  await act(async () => root.render(element))
  await act(async () => {})
}

describe('DashPanel portal ownership', () => {
  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('portals the Panel root to the exact provider container while retaining Store and theme context', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const Probe = () => <output data-scope={usePicodashScope().scopeId}>content</output>
    await render(
      <DashPanelProvider store={store} portalContainer={portal} theme="light" density="compact">
        <DashPanel id="inspector" title="Inspector">
          <Probe />
        </DashPanel>
      </DashPanelProvider>,
    )
    expect(container.querySelector('[data-picodash-panel]')).toBeNull()
    expect(portal.querySelector('[data-picodash-panel]')).toBeTruthy()
    expect(portal.querySelector('[data-scope="inspector"]')).toBeTruthy()
    expect(portal.querySelector('[data-picodash-theme="light"]')).toBeTruthy()
    expect(portal.querySelector('[data-picodash-density="compact"]')).toBeTruthy()
    await act(async () => root.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('resolves an explicit null portal to document.body', async () => {
    const store = makeStore()
    await render(
      <DashPanelProvider store={store} portalContainer={null}>
        <DashPanel id="inspector" title="Inspector" />
      </DashPanelProvider>,
    )
    const panel = document.body.querySelector('[data-picodash-panel]')
    expect(container.querySelector('[data-picodash-panel]')).toBeNull()
    expect(panel).toBeTruthy()
    expect(panel?.closest('[data-picodash-theme]')?.parentElement).toBe(document.body)
    await act(async () => root.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('inherits the resolved overlay portal when the Panel Provider omits one', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    await render(
      <PicodashOverlayProvider portalContainer={portal}>
        <DashPanelProvider store={store}>
          <DashPanel id="inspector" title="Inspector" />
        </DashPanelProvider>
      </PicodashOverlayProvider>,
    )
    expect(container.querySelector('[data-picodash-panel]')).toBeNull()
    expect(portal.querySelector('[data-picodash-panel]')).toBeTruthy()
    await act(async () => root.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('projects a persisted free anchor into the rendered boundary', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const boundary = document.createElement('div')
    const boundaryRect = {
      top: 20,
      right: 210,
      bottom: 120,
      left: 10,
      width: 200,
      height: 100,
    } as DOMRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundary) return boundaryRect
        if (this.hasAttribute('data-picodash-panel'))
          return { top: 0, right: 80, bottom: 40, left: 0, width: 80, height: 40 } as DOMRect
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect
      },
    )
    await render(
      <DashPanelProvider store={store} boundary={boundary} portalContainer={portal}>
        <DashPanel
          id="inspector"
          title="Inspector"
          defaultLayout={{
            placement: { mode: 'floating', disposition: { kind: 'free' } },
            preferredPosition: { x: 999, y: -100 },
          }}
        />
      </DashPanelProvider>,
    )
    const panel = portal.querySelector('[data-picodash-panel]') as HTMLElement
    expect(panel.style.left).toBe('130px')
    expect(panel.style.top).toBe('20px')
    await act(async () => root.unmount())
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('applies side allocation segments to compatible dock occupants', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const boundary = document.createElement('div')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundary)
          return { top: 0, right: 300, bottom: 300, left: 0, width: 300, height: 300 } as DOMRect
        if (this.hasAttribute('data-picodash-panel'))
          return { top: 0, right: 80, bottom: 240, left: 0, width: 80, height: 240 } as DOMRect
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect
      },
    )
    await render(
      <DashPanelProvider store={store} boundary={boundary} portalContainer={portal}>
        <DashPanel
          id="corner"
          title="Corner"
          defaultLayout={{
            placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'top-left' } },
          }}
        />
        <DashPanel
          id="main"
          title="Main"
          defaultLayout={{
            placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-left' } },
          }}
        />
      </DashPanelProvider>,
    )
    const panels = [...portal.querySelectorAll('[data-picodash-panel]')] as HTMLElement[]
    expect(panels[0]?.style.top).toBe('0px')
    expect(panels[0]?.style.maxBlockSize).toBe('100px')
    expect(panels[1]?.style.top).toBe('100px')
    expect(panels[1]?.style.blockSize).toBe('200px')
    await act(async () => root.unmount())
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('keeps client-space placement coordinates stable across differently positioned portal targets', async () => {
    const store = makeStore()
    const firstPortal = document.createElement('div')
    const secondPortal = document.createElement('div')
    firstPortal.style.transform = 'translate(120px, 40px)'
    secondPortal.style.transform = 'translate(-80px, 15px)'
    const rect = {
      top: 0,
      right: 320,
      bottom: 200,
      left: 0,
      width: 320,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
    const hostRects = new WeakMap<HTMLElement, DOMRect>()
    hostRects.set(firstPortal, {
      top: 40,
      right: 400,
      bottom: 440,
      left: 120,
      width: 280,
      height: 400,
    } as DOMRect)
    hostRects.set(secondPortal, {
      top: 15,
      right: 600,
      bottom: 415,
      left: -80,
      width: 680,
      height: 400,
    } as DOMRect)
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get() {
        return this.hasAttribute('data-picodash-panel') ? this.parentElement?.parentElement : null
      },
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute('data-picodash-panel')
          ? rect
          : (hostRects.get(this) ??
              ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect))
      },
    )
    const panel = (portal: HTMLElement) => (
      <DashPanelProvider store={store} portalContainer={portal}>
        <DashPanel id="inspector" title="Inspector" />
      </DashPanelProvider>
    )
    await render(panel(firstPortal))
    const firstStyle = firstPortal.querySelector('[data-picodash-panel]')?.getAttribute('style')
    const firstPanel = firstPortal.querySelector('[data-picodash-panel]') as HTMLElement
    const firstHostRect = hostRects.get(firstPortal)!
    const firstActual = {
      left: parseFloat(firstPanel.style.left) + firstHostRect.left,
      top: parseFloat(firstPanel.style.top) + firstHostRect.top,
    }
    await act(async () => root.unmount())
    root = createRoot(container)
    await render(panel(secondPortal))
    const secondStyle = secondPortal.querySelector('[data-picodash-panel]')?.getAttribute('style')
    expect(secondStyle).not.toBe(firstStyle)
    const secondPanel = secondPortal.querySelector('[data-picodash-panel]') as HTMLElement
    const secondHostRect = hostRects.get(secondPortal)!
    expect({
      left: parseFloat(secondPanel.style.left) + secondHostRect.left,
      top: parseFloat(secondPanel.style.top) + secondHostRect.top,
    }).toEqual(firstActual)
    await act(async () => root.unmount())
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })
})
