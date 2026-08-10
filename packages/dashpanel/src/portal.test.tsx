// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashStore } from '@picodash/store'
import { usePicodashScope } from '@picodash/store/react'
import { PicodashOverlayProvider } from '@picodash/ui'
import { DashPanel, DashPanelProvider } from './index.tsx'
import { useDashPanelRuntime } from './runtime/panel-runtime-context.tsx'

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

  it('re-registers the mounted Panel element when portal ownership changes', async () => {
    const store = makeStore()
    const firstPortal = document.createElement('div')
    const secondPortal = document.createElement('div')
    document.body.append(firstPortal, secondPortal)
    let runtime!: ReturnType<typeof useDashPanelRuntime>
    function Probe() {
      runtime = useDashPanelRuntime()
      return null
    }
    const provider = (portalContainer: HTMLElement) => (
      <DashPanelProvider store={store} portalContainer={portalContainer}>
        <DashPanel id="inspector" title="Inspector" />
        <Probe />
      </DashPanelProvider>
    )
    await render(provider(firstPortal))
    const firstPanel = firstPortal.querySelector('[data-picodash-panel]') as HTMLElement
    expect(runtime.getElement('inspector')).toBe(firstPanel)

    await render(provider(secondPortal))
    const secondPanel = secondPortal.querySelector('[data-picodash-panel]') as HTMLElement
    expect(firstPanel.isConnected).toBe(false)
    expect(runtime.getElement('inspector')).toBe(secondPanel)

    await act(async () => root.unmount())
    firstPortal.remove()
    secondPortal.remove()
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

  it('remeasures placement when the boundary or Panel size changes', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const boundary = document.createElement('div')
    let boundaryWidth = 300
    let boundaryLeft = 0
    let panelWidth = 50
    let resize!: ResizeObserverCallback
    let animationFrame!: FrameRequestCallback
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback
        }
        observe = observe
        disconnect = disconnect
      },
    )
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrame = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundary)
          return {
            top: 0,
            right: boundaryLeft + boundaryWidth,
            bottom: 200,
            left: boundaryLeft,
            width: boundaryWidth,
            height: 200,
          } as DOMRect
        if (this.hasAttribute('data-picodash-panel'))
          return {
            top: 0,
            right: panelWidth,
            bottom: 40,
            left: 0,
            width: panelWidth,
            height: 40,
          } as DOMRect
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
            preferredPosition: { x: 250, y: 0 },
          }}
        />
      </DashPanelProvider>,
    )
    const panel = portal.querySelector('[data-picodash-panel]') as HTMLElement
    expect(observe).toHaveBeenCalledWith(boundary)
    expect(observe).toHaveBeenCalledWith(panel)
    expect(panel.style.left).toBe('250px')

    boundaryWidth = 120
    await act(async () => resize([], {} as ResizeObserver))
    expect(panel.style.left).toBe('70px')

    panelWidth = 80
    await act(async () => resize([], {} as ResizeObserver))
    expect(panel.style.left).toBe('40px')

    boundaryLeft = 30
    await act(async () => animationFrame(0))
    expect(panel.style.left).toBe('70px')
    await act(async () => root.unmount())
    expect(disconnect).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('uses and tracks the visual viewport when no element boundary is declared', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const listeners = new Map<string, EventListener>()
    const visualViewport = {
      width: 240,
      height: 160,
      offsetLeft: 30,
      offsetTop: 20,
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        listeners.set(type, listener)
      }),
      removeEventListener: vi.fn((type: string, listener: EventListener) => {
        if (listeners.get(type) === listener) listeners.delete(type)
      }),
    }
    vi.stubGlobal('visualViewport', visualViewport)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this.hasAttribute('data-picodash-panel'))
          return { top: 0, right: 80, bottom: 40, left: 0, width: 80, height: 40 } as DOMRect
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect
      },
    )
    await render(
      <DashPanelProvider store={store} portalContainer={portal}>
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
    expect(panel.style.left).toBe('190px')
    expect(panel.style.top).toBe('20px')
    expect(visualViewport.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(visualViewport.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))

    visualViewport.width = 200
    visualViewport.offsetLeft = 50
    visualViewport.offsetTop = 25
    await act(async () => listeners.get('scroll')?.(new Event('scroll')))
    expect(panel.style.left).toBe('170px')
    expect(panel.style.top).toBe('25px')

    await act(async () => root.unmount())
    expect(visualViewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(visualViewport.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('uses current geometry when native move listeners finish after boundary drift', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const firstBoundary = document.createElement('div')
    const secondBoundary = document.createElement('div')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === firstBoundary)
          return { top: 0, right: 300, bottom: 200, left: 0, width: 300, height: 200 } as DOMRect
        if (this === secondBoundary)
          return { top: 50, right: 350, bottom: 250, left: 50, width: 300, height: 200 } as DOMRect
        if (this.hasAttribute('data-picodash-panel'))
          return { top: 8, right: 88, bottom: 48, left: 8, width: 80, height: 40 } as DOMRect
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect
      },
    )
    const provider = (boundary: HTMLElement) => (
      <DashPanelProvider store={store} boundary={boundary} portalContainer={portal}>
        <DashPanel id="inspector" title="Inspector" />
      </DashPanelProvider>
    )
    await render(provider(firstBoundary))
    const move = portal.querySelector('[aria-label="Move panel Inspector"]') as HTMLElement
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y })
      Object.defineProperty(event, 'pointerId', { value: 7 })
      return event
    }
    await act(async () => {
      move.dispatchEvent(pointer('pointerdown', 10, 10))
      window.dispatchEvent(pointer('pointermove', 30, 10))
    })
    expect(
      portal.querySelector('[data-picodash-panel]')?.getAttribute('data-picodash-placement'),
    ).toBe('floating-free-preview')
    await render(provider(secondBoundary))
    await act(async () => window.dispatchEvent(pointer('pointerup', 30, 10)))
    expect(store.getState().scopes.get('inspector')?.dashPanel).toBeUndefined()

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
        <DashPanel
          id="edge"
          title="Edge"
          defaultLayout={{
            placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-top' } },
          }}
        />
      </DashPanelProvider>,
    )
    const panels = [...portal.querySelectorAll('[data-picodash-panel]')] as HTMLElement[]
    expect(panels[0]?.style.top).toBe('0px')
    expect(panels[0]?.style.maxBlockSize).toBe('100px')
    expect(panels[1]?.style.top).toBe('100px')
    expect(panels[1]?.style.blockSize).toBe('200px')
    expect(panels[2]?.style.left).toBe('80px')
    expect(panels[2]?.style.inlineSize).toBe('220px')
    await act(async () => root.unmount())
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('recomputes full-edge allocation when a corner occupant changes width', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const boundary = document.createElement('div')
    let cornerWidth = 80
    const observers: Array<{
      readonly callback: ResizeObserverCallback
      readonly targets: Element[]
    }> = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        readonly record: (typeof observers)[number]
        constructor(callback: ResizeObserverCallback) {
          this.record = { callback, targets: [] }
          observers.push(this.record)
        }
        observe = (target: Element) => this.record.targets.push(target)
        disconnect = vi.fn()
      },
    )
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundary)
          return { top: 0, right: 300, bottom: 200, left: 0, width: 300, height: 200 } as DOMRect
        if (this.hasAttribute('data-picodash-panel')) {
          const width = this.textContent?.includes('Corner') ? cornerWidth : 80
          return { top: 0, right: width, bottom: 40, left: 0, width, height: 40 } as DOMRect
        }
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
          id="edge"
          title="Edge"
          defaultLayout={{
            placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-top' } },
          }}
        />
      </DashPanelProvider>,
    )
    const corner = [...portal.querySelectorAll('[data-picodash-panel]')].find((panel) =>
      panel.textContent?.includes('Corner'),
    ) as HTMLElement
    const edge = [...portal.querySelectorAll('[data-picodash-panel]')].find((panel) =>
      panel.textContent?.includes('Edge'),
    ) as HTMLElement
    expect(edge.style.left).toBe('80px')
    expect(edge.style.inlineSize).toBe('220px')

    cornerWidth = 120
    const cornerObserver = observers.find((observer) => observer.targets.includes(corner))!
    await act(async () =>
      cornerObserver.callback(
        [{ target: corner } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    )
    expect(edge.style.left).toBe('120px')
    expect(edge.style.inlineSize).toBe('180px')

    await act(async () => root.unmount())
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('restores the preferred intrinsic width after leaving a full horizontal dock', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const boundary = document.createElement('div')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundary)
          return { top: 0, right: 300, bottom: 200, left: 0, width: 300, height: 200 } as DOMRect
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
            placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-top' } },
          }}
        />
      </DashPanelProvider>,
    )
    const panel = portal.querySelector('[data-picodash-panel]') as HTMLElement
    expect(panel.style.inlineSize).toBe('300px')
    await act(async () => {
      store.scope('inspector').setDashPanelLayout({
        placement: { mode: 'floating', disposition: { kind: 'snapped', position: 'top-left' } },
        preferredPosition: { x: 0, y: 0 },
      })
    })
    expect(panel.style.inlineSize).toBe('')
    expect(panel.style.maxInlineSize).toBe('80px')
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
