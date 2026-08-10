// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashStore } from '@picodash/store'
import { usePicodashScope } from '@picodash/store/react'
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

  it('keeps an explicit null portal inline', async () => {
    const store = makeStore()
    await render(
      <DashPanelProvider store={store} portalContainer={null}>
        <DashPanel id="inspector" title="Inspector" />
      </DashPanelProvider>,
    )
    expect(container.querySelector('[data-picodash-panel]')).toBeTruthy()
    await act(async () => root.unmount())
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
