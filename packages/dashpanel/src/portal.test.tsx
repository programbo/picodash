// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashStore } from '@picodash/store'
import { usePicodashScope } from '@picodash/store/react'
import { PicodashOverlayProvider } from '@picodash/ui'
import { DashPanel, DashPanelProvider, useDashPanel } from './index.tsx'
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
          return { top: 0, right: 80, bottom: 240, left: 0, width: 80, height: 240 } as DOMRect
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
    expect(panel.style.maxBlockSize).toBe('100px')
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
    const observe = vi.fn()
    const disconnect = vi.fn()
    const requestAnimationFrame = vi.fn(() => 1)
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
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
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

    expect(requestAnimationFrame).not.toHaveBeenCalled()

    boundaryWidth = 120
    await act(async () => resize([], {} as ResizeObserver))
    expect(panel.style.left).toBe('70px')

    panelWidth = 80
    await act(async () => resize([], {} as ResizeObserver))
    expect(panel.style.left).toBe('40px')

    boundaryLeft = 30
    await act(async () => {
      document.dispatchEvent(new Event('transitionend'))
    })
    expect(panel.style.left).toBe('70px')
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    await act(async () => root.unmount())
    expect(disconnect).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('cancels an active move as soon as observed geometry changes', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const boundary = document.createElement('div')
    let boundaryWidth = 300
    let resize!: ResizeObserverCallback
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback
        }
        observe = vi.fn()
        disconnect = vi.fn()
      },
    )
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundary)
          return {
            top: 0,
            right: boundaryWidth,
            bottom: 200,
            left: 0,
            width: boundaryWidth,
            height: 200,
          } as DOMRect
        if (this.hasAttribute('data-picodash-panel')) {
          const left = Number.parseFloat(this.style.left) || 0
          const top = Number.parseFloat(this.style.top) || 0
          return {
            top,
            right: left + 80,
            bottom: top + 40,
            left,
            width: 80,
            height: 40,
          } as DOMRect
        }
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
            preferredPosition: { x: 30, y: 30 },
          }}
        />
      </DashPanelProvider>,
    )
    const panel = portal.querySelector('[data-picodash-panel]') as HTMLElement
    const move = portal.querySelector('[aria-label="Move panel Inspector"]') as HTMLElement
    await act(async () => {
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
    })
    expect(panel.getAttribute('data-picodash-placement')).toBe('floating-free-preview')

    boundaryWidth = 280
    await act(async () =>
      resize([{ target: boundary } as unknown as ResizeObserverEntry], {} as ResizeObserver),
    )
    expect(panel.getAttribute('data-picodash-placement')).toBe('floating-free')
    expect(store.getState().scopes.get('inspector')?.dashPanel).toBeUndefined()

    await act(async () => root.unmount())
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('revalidates dock occupancy when a boundary ref retargets', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const boundaryA = document.createElement('div')
    const boundaryB = document.createElement('div')
    const boundaryRef: { current: HTMLElement | null } = { current: boundaryB }
    const frames = new Set<FrameRequestCallback>()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.add(callback)
      return frames.size
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundaryA)
          return { top: 0, right: 300, bottom: 200, left: 0, width: 300, height: 200 } as DOMRect
        if (this === boundaryB)
          return {
            top: 0,
            right: 700,
            bottom: 200,
            left: 400,
            width: 300,
            height: 200,
          } as DOMRect
        if (this.hasAttribute('data-picodash-panel'))
          return { top: 0, right: 80, bottom: 40, left: 0, width: 80, height: 40 } as DOMRect
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect
      },
    )
    const fixedLeft = {
      placement: {
        mode: 'fixed' as const,
        disposition: { kind: 'docked' as const, position: 'full-left' as const },
      },
    }
    await render(
      <DashPanelProvider store={store} portalContainer={portal}>
        <DashPanel
          id="first"
          title="First"
          boundary={boundaryA}
          dockPositions={['full-left']}
          defaultLayout={fixedLeft}
        />
        <DashPanel
          id="second"
          title="Second"
          boundary={boundaryRef}
          dockPositions={['full-left']}
          defaultLayout={fixedLeft}
        />
      </DashPanelProvider>,
    )
    const second = portal.querySelectorAll<HTMLElement>('[data-picodash-panel]')[1]!
    expect(second.getAttribute('data-picodash-placement')).toBe('fixed-docked')

    boundaryRef.current = boundaryA
    const pending = [...frames]
    frames.clear()
    await act(async () => pending.forEach((callback) => callback(0)))
    expect(second.getAttribute('data-picodash-placement')).toBe('floating-snapped')

    boundaryRef.current = boundaryB
    const nextPending = [...frames]
    frames.clear()
    await act(async () => nextPending.forEach((callback) => callback(1)))
    expect(second.getAttribute('data-picodash-placement')).toBe('fixed-docked')

    await act(async () => root.unmount())
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('cancels an active move when a boundary ref retargets without geometry drift', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const boundaryA = document.createElement('div')
    const boundaryB = document.createElement('div')
    const boundaryRef: { current: HTMLElement | null } = { current: boundaryA }
    const frames = new Set<FrameRequestCallback>()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.add(callback)
      return frames.size
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundaryA || this === boundaryB)
          return { top: 0, right: 300, bottom: 200, left: 0, width: 300, height: 200 } as DOMRect
        if (this.hasAttribute('data-picodash-panel')) {
          const left = Number.parseFloat(this.style.left) || 0
          const top = Number.parseFloat(this.style.top) || 0
          return {
            top,
            right: left + 80,
            bottom: top + 40,
            left,
            width: 80,
            height: 40,
          } as DOMRect
        }
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect
      },
    )
    await render(
      <DashPanelProvider store={store} portalContainer={portal}>
        <DashPanel
          id="inspector"
          title="Inspector"
          boundary={boundaryRef}
          defaultLayout={{
            placement: { mode: 'floating', disposition: { kind: 'free' } },
            preferredPosition: { x: 30, y: 30 },
          }}
        />
      </DashPanelProvider>,
    )
    const panel = portal.querySelector('[data-picodash-panel]') as HTMLElement
    const move = portal.querySelector('[aria-label="Move panel Inspector"]') as HTMLElement
    await act(async () => {
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
    })
    expect(panel.getAttribute('data-picodash-placement')).toBe('floating-free-preview')

    boundaryRef.current = boundaryB
    const pending = [...frames]
    frames.clear()
    await act(async () => pending.forEach((callback) => callback(0)))
    expect(panel.getAttribute('data-picodash-placement')).toBe('floating-free')

    // Enter starts a fresh session after cancellation; it cannot commit the
    // candidate that belonged to the previous boundary identity.
    await act(async () => {
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    })
    expect(store.getState().scopes.get('inspector')?.dashPanel).toBeUndefined()
    await act(async () => {
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
      root.unmount()
    })
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('restores preferred width after a temporary boundary constraint', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const boundary = document.createElement('div')
    let boundaryWidth = 100
    let resize!: ResizeObserverCallback
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback
        }
        observe = vi.fn()
        disconnect = vi.fn()
      },
    )
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundary)
          return {
            top: 0,
            right: boundaryWidth,
            bottom: 200,
            left: 0,
            width: boundaryWidth,
            height: 200,
          } as DOMRect
        if (this.hasAttribute('data-picodash-panel')) {
          const declaredCap = Number.parseFloat(this.style.maxInlineSize)
          const width = Number.isFinite(declaredCap) ? Math.min(180, declaredCap) : 180
          return { top: 0, right: width, bottom: 40, left: 0, width, height: 40 } as DOMRect
        }
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect
      },
    )
    await render(
      <DashPanelProvider store={store} boundary={boundary} portalContainer={portal}>
        <DashPanel id="inspector" title="Inspector" />
      </DashPanelProvider>,
    )
    const panel = portal.querySelector('[data-picodash-panel]') as HTMLElement
    expect(panel.style.maxInlineSize).toBe('100px')

    boundaryWidth = 240
    await act(async () =>
      resize([{ target: boundary } as unknown as ResizeObserverEntry], {} as ResizeObserver),
    )
    expect(panel.style.maxInlineSize).toBe('180px')

    await act(async () => root.unmount())
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

  it('materializes free anchors from the inset visual viewport origin', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    vi.stubGlobal('visualViewport', {
      width: 240,
      height: 160,
      offsetLeft: 30,
      offsetTop: 20,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this.hasAttribute('data-picodash-panel')) {
          const left = Number.parseFloat(this.style.left) || 0
          const top = Number.parseFloat(this.style.top) || 0
          return {
            top,
            right: left + 80,
            bottom: top + 40,
            left,
            width: 80,
            height: 40,
          } as DOMRect
        }
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect
      },
    )
    function FreeControl() {
      const controller = useDashPanel()
      return (
        <button
          type="button"
          data-free-control
          onClick={() =>
            controller.setPlacement({ mode: 'floating', disposition: { kind: 'free' } })
          }
        >
          Free
        </button>
      )
    }
    await render(
      <DashPanelProvider store={store} portalContainer={portal} boundaryInset={100}>
        <DashPanel
          id="inspector"
          title="Inspector"
          defaultLayout={{
            placement: { mode: 'floating', disposition: { kind: 'snapped', position: 'top-left' } },
          }}
        >
          <FreeControl />
        </DashPanel>
      </DashPanelProvider>,
    )
    await act(async () =>
      (portal.querySelector('[data-free-control]') as HTMLButtonElement).click(),
    )
    expect(store.getState().scopes.get('inspector')?.dashPanel).toEqual({
      placement: { mode: 'floating', disposition: { kind: 'free' } },
      preferredPosition: { x: 0, y: 0 },
    })

    await act(async () => root.unmount())
    vi.restoreAllMocks()
    store.destroy()
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

  it('ignores repeated Enter and cancels a move when external layout replaces its origin', async () => {
    const store = makeStore()
    const scoped = store.scope('inspector')
    const portal = document.createElement('div')
    const boundary = document.createElement('div')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundary)
          return { top: 0, right: 300, bottom: 200, left: 0, width: 300, height: 200 } as DOMRect
        if (this.hasAttribute('data-picodash-panel')) {
          const left = Number.parseFloat(this.style.left) || 0
          const top = Number.parseFloat(this.style.top) || 0
          return {
            top,
            right: left + 80,
            bottom: top + 40,
            left,
            width: 80,
            height: 40,
          } as DOMRect
        }
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
            preferredPosition: { x: 30, y: 30 },
          }}
        />
      </DashPanelProvider>,
    )
    const panel = portal.querySelector('[data-picodash-panel]') as HTMLElement
    const move = portal.querySelector('[aria-label="Move panel Inspector"]') as HTMLElement
    await act(async () => {
      move.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', repeat: true }),
      )
    })
    expect(panel.getAttribute('data-picodash-placement')).toBe('floating-free')
    await act(async () => {
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
      move.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', repeat: true }),
      )
    })
    expect(panel.getAttribute('data-picodash-placement')).toBe('floating-free-preview')
    await act(async () => {
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
    })
    expect(panel.getAttribute('data-picodash-placement')).toBe('floating-free-preview')

    await act(async () => {
      scoped.setDashPanelLayout({
        placement: { mode: 'floating', disposition: { kind: 'snapped', position: 'top-left' } },
        preferredPosition: { x: 30, y: 30 },
      })
    })
    expect(panel.getAttribute('data-picodash-placement')).toBe('floating-snapped')
    expect(scoped.getState().scope?.dashPanel?.placement).toEqual({
      mode: 'floating',
      disposition: { kind: 'snapped', position: 'top-left' },
    })

    await act(async () => root.unmount())
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('cancels a move when raw durable placement changes behind the same policy fallback', async () => {
    const store = makeStore()
    const scoped = store.scope('inspector')
    const portal = document.createElement('div')
    const boundary = document.createElement('div')
    scoped.setDashPanelLayout({
      placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-left' } },
      preferredPosition: { x: 30, y: 30 },
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundary)
          return { top: 0, right: 300, bottom: 200, left: 0, width: 300, height: 200 } as DOMRect
        if (this.hasAttribute('data-picodash-panel')) {
          const left = Number.parseFloat(this.style.left) || 0
          const top = Number.parseFloat(this.style.top) || 0
          return {
            top,
            right: left + 80,
            bottom: top + 40,
            left,
            width: 80,
            height: 40,
          } as DOMRect
        }
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect
      },
    )
    await render(
      <DashPanelProvider store={store} boundary={boundary} portalContainer={portal}>
        <DashPanel
          id="inspector"
          title="Inspector"
          dockPositions={[]}
          defaultLayout={{
            placement: { mode: 'floating', disposition: { kind: 'free' } },
            preferredPosition: { x: 30, y: 30 },
          }}
        />
      </DashPanelProvider>,
    )
    const panel = portal.querySelector('[data-picodash-panel]') as HTMLElement
    const move = portal.querySelector('[aria-label="Move panel Inspector"]') as HTMLElement
    await act(async () => {
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
    })
    expect(panel.getAttribute('data-picodash-placement')).toBe('floating-free-preview')

    await act(async () => {
      scoped.setDashPanelLayout({
        placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-right' } },
        preferredPosition: { x: 30, y: 30 },
      })
    })
    expect(panel.getAttribute('data-picodash-placement')).toBe('floating-free')
    await act(async () => {
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    })
    expect(scoped.getState().scope?.dashPanel?.placement).toEqual({
      mode: 'fixed',
      disposition: { kind: 'docked', position: 'full-right' },
    })
    await act(async () => {
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
      root.unmount()
    })
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('projects an unreachable preferred origin before comparing pointer or keyboard movement', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const boundary = document.createElement('div')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundary)
          return { top: 0, right: 100, bottom: 100, left: 0, width: 100, height: 100 } as DOMRect
        if (this.hasAttribute('data-picodash-panel'))
          return { top: 0, right: 100, bottom: 40, left: 60, width: 40, height: 40 } as DOMRect
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect
      },
    )
    await render(
      <DashPanelProvider store={store} boundary={boundary} portalContainer={portal}>
        <DashPanel
          id="inspector"
          title="Inspector"
          defaultLayout={{
            placement: { mode: 'floating', disposition: { kind: 'snapped', position: 'right' } },
            preferredPosition: { x: 120, y: 0 },
          }}
        />
      </DashPanelProvider>,
    )
    const move = portal.querySelector('[aria-label="Move panel Inspector"]') as HTMLElement
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y })
      Object.defineProperty(event, 'pointerId', { value: 7 })
      return event
    }
    await act(async () => {
      move.dispatchEvent(pointer('pointerdown', 90, 10))
      window.dispatchEvent(pointer('pointermove', 110, 10))
      window.dispatchEvent(pointer('pointerup', 110, 10))
    })
    expect(store.getState().scopes.get('inspector')?.dashPanel).toBeUndefined()

    await act(async () => {
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    })
    expect(store.getState().scopes.get('inspector')?.dashPanel).toBeUndefined()

    await act(async () => {
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft' }))
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    })
    expect(store.getState().scopes.get('inspector')?.dashPanel).toBeUndefined()

    await act(async () => root.unmount())
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('detaches a Hybrid full-edge dock using preferred preview geometry', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const boundary = document.createElement('div')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundary)
          return { top: 0, right: 300, bottom: 200, left: 0, width: 300, height: 200 } as DOMRect
        if (this.hasAttribute('data-picodash-panel')) {
          const declaredWidth = Number.parseFloat(this.style.inlineSize)
          const declaredHeight = Number.parseFloat(this.style.blockSize)
          const width = Number.isFinite(declaredWidth) ? declaredWidth : 80
          const height = Number.isFinite(declaredHeight) ? declaredHeight : 40
          return { top: 0, right: width, bottom: height, left: 0, width, height } as DOMRect
        }
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect
      },
    )
    await render(
      <DashPanelProvider store={store} boundary={boundary} portalContainer={portal}>
        <DashPanel
          id="inspector"
          title="Inspector"
          defaultLayout={{
            placement: { mode: 'hybrid', disposition: { kind: 'docked', position: 'full-left' } },
            preferredPosition: { x: 0, y: 0 },
          }}
        />
      </DashPanelProvider>,
    )
    const panel = portal.querySelector('[data-picodash-panel]') as HTMLElement
    const move = portal.querySelector('[aria-label="Move panel Inspector"]') as HTMLElement
    expect(panel.style.blockSize).toBe('200px')
    await act(async () => {
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    })
    expect(store.getState().scopes.get('inspector')?.dashPanel).toBeUndefined()

    await act(async () => {
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
      for (let index = 0; index < 4; index += 1)
        move.dispatchEvent(
          new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight', shiftKey: true }),
        )
      move.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    })
    expect(store.getState().scopes.get('inspector')?.dashPanel).toEqual({
      placement: { mode: 'hybrid', disposition: { kind: 'free' } },
      preferredPosition: { x: 40, y: 0 },
    })

    await act(async () => root.unmount())
    vi.restoreAllMocks()
    expect(() => store.destroy()).not.toThrow()
  })

  it('settles pointer and keyboard movement onto targets within snapProximity', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const boundary = document.createElement('div')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundary)
          return { top: 0, right: 300, bottom: 200, left: 0, width: 300, height: 200 } as DOMRect
        if (this.hasAttribute('data-picodash-panel')) {
          const left = Number.parseFloat(this.style.left) || 0
          const top = Number.parseFloat(this.style.top) || 0
          return {
            top,
            right: left + 80,
            bottom: top + 40,
            left,
            width: 80,
            height: 40,
          } as DOMRect
        }
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect
      },
    )
    const freeLayout = (preferredPosition: { x: number; y: number }) => ({
      placement: { mode: 'floating' as const, disposition: { kind: 'free' as const } },
      preferredPosition,
    })
    await render(
      <DashPanelProvider store={store} boundary={boundary} portalContainer={portal}>
        <DashPanel
          id="pointer"
          title="Pointer"
          defaultLayout={freeLayout({ x: 30, y: 30 })}
          placementOptions={{ snapOffset: 8, snapProximity: 5 }}
        />
        <DashPanel
          id="keyboard"
          title="Keyboard"
          defaultLayout={freeLayout({ x: 40, y: 40 })}
          placementOptions={{ snapOffset: 8, snapProximity: 5 }}
        />
      </DashPanelProvider>,
    )
    const pointerMove = portal.querySelector('[aria-label="Move panel Pointer"]') as HTMLElement
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y })
      Object.defineProperty(event, 'pointerId', { value: 7 })
      return event
    }
    await act(async () => pointerMove.dispatchEvent(pointer('pointerdown', 30, 30)))
    await act(async () => {
      window.dispatchEvent(pointer('pointermove', 10, 8))
      window.dispatchEvent(pointer('pointerup', 10, 8))
    })
    expect(store.getState().scopes.get('pointer')?.dashPanel).toEqual({
      placement: { mode: 'floating', disposition: { kind: 'snapped', position: 'top-left' } },
      preferredPosition: { x: 30, y: 30 },
    })

    const keyboardMove = portal.querySelector('[aria-label="Move panel Keyboard"]') as HTMLElement
    await act(async () => {
      keyboardMove.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
      for (let index = 0; index < 3; index += 1)
        keyboardMove.dispatchEvent(
          new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft', shiftKey: true }),
        )
      for (let index = 0; index < 3; index += 1)
        keyboardMove.dispatchEvent(
          new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp', shiftKey: true }),
        )
      keyboardMove.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    })
    expect(store.getState().scopes.get('keyboard')?.dashPanel).toEqual({
      placement: { mode: 'floating', disposition: { kind: 'snapped', position: 'top-left' } },
      preferredPosition: { x: 40, y: 40 },
    })

    await act(async () => root.unmount())
    vi.restoreAllMocks()
    store.destroy()
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
    expect(panels[2]?.style.maxBlockSize).toBe('240px')
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

  it('reserves a hidden corner after an external placement transition', async () => {
    const store = makeStore()
    const portal = document.createElement('div')
    const boundary = document.createElement('div')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this === boundary)
          return { top: 0, right: 300, bottom: 200, left: 0, width: 300, height: 200 } as DOMRect
        if (this.hasAttribute('data-picodash-panel')) {
          const configuredWidth = Number.parseFloat(
            this.style.getPropertyValue('--picodash-panel-width'),
          )
          const preferredWidth =
            configuredWidth || (this.textContent?.includes('Wide content') ? 140 : 80)
          const width = this.hidden ? 0 : preferredWidth
          return { top: 0, right: width, bottom: 40, left: 0, width, height: 40 } as DOMRect
        }
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect
      },
    )
    await render(
      <DashPanelProvider store={store} boundary={boundary} portalContainer={portal}>
        <DashPanel id="corner" title="Corner" defaultVisible={false} />
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
    expect(corner.hidden).toBe(true)
    expect(edge.style.left).toBe('0px')
    expect(edge.style.inlineSize).toBe('300px')

    await act(async () => {
      store.scope('corner').setDashPanelLayout({
        placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'top-left' } },
        preferredPosition: { x: 0, y: 0 },
      })
    })

    expect(corner.hidden).toBe(true)
    expect(edge.style.left).toBe('80px')
    expect(edge.style.inlineSize).toBe('220px')

    await render(
      <DashPanelProvider store={store} boundary={boundary} portalContainer={portal}>
        <DashPanel id="corner" title="Corner" defaultVisible={false} width="120px" />
        <DashPanel
          id="edge"
          title="Edge"
          defaultLayout={{
            placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-top' } },
          }}
        />
      </DashPanelProvider>,
    )
    expect(corner.hidden).toBe(true)
    expect(corner.style.getPropertyValue('--picodash-panel-width')).toBe('120px')
    expect(edge.style.left).toBe('120px')
    expect(edge.style.inlineSize).toBe('180px')

    await render(
      <DashPanelProvider store={store} boundary={boundary} portalContainer={portal}>
        <DashPanel id="corner" title="Corner" defaultVisible={false}>
          Wide content
        </DashPanel>
        <DashPanel
          id="edge"
          title="Edge"
          defaultLayout={{
            placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-top' } },
          }}
        />
      </DashPanelProvider>,
    )
    expect(corner.hidden).toBe(true)
    expect(edge.style.left).toBe('140px')
    expect(edge.style.inlineSize).toBe('160px')
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
