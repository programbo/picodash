import { createElement, StrictMode, useState, type ReactElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashStore, PicodashContractError } from '@picodash/store'
import { usePicodashRootStore, usePicodashScope } from '@picodash/store/react'
import { Button } from '@picodash/ui'
import {
  DashPanel,
  DashPanelLauncher,
  DashPanelProvider,
  DashPanelTrigger,
  useDashPanel,
  type DashPanelStyle,
} from '../src/index.tsx'
import { useDashPanelPolicy, type DashPanelPolicy } from '../src/runtime/panel-policy-context.tsx'
import {
  useDashPanelProviderPolicy,
  type DashPanelProviderPolicy,
} from '../src/runtime/provider-policy-context.tsx'

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

class MockHTMLElementBase {
  readonly tagName = 'BUTTON'
  readonly ownerDocument = { defaultView: globalThis }

  getAttribute() {
    return null
  }

  hasAttribute() {
    return false
  }

  setAttribute() {}

  removeAttribute() {}

  contains() {
    return true
  }

  closest() {
    return null
  }

  focus() {
    ;(globalThis.document as { activeElement: unknown }).activeElement = this
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 100, height: 32 } as DOMRect
  }
}

beforeEach(() => {
  const document = {
    body: {},
    activeElement: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    documentElement: { clientWidth: 0, clientHeight: 0 },
  }
  vi.stubGlobal('document', document)
  vi.stubGlobal('window', {
    document,
    HTMLElement: MockHTMLElementBase,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
  vi.stubGlobal('HTMLElement', MockHTMLElementBase)
  vi.stubGlobal('Element', MockHTMLElementBase)
  vi.stubGlobal('SVGElement', class extends MockHTMLElementBase {})
  vi.stubGlobal('HTMLInputElement', class extends MockHTMLElementBase {})
  vi.stubGlobal('HTMLTextAreaElement', class extends MockHTMLElementBase {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const makeStore = () =>
  createPicodashStore({
    valueOwner: 'store',
    fields: { count: { defaultValue: 0 } },
  })

function render(element: ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  void act(() => {
    renderer = create(element)
  })
  return renderer
}

function panel(store: ReturnType<typeof makeStore>, children?: ReactElement, id = 'panel') {
  return createElement(DashPanelProvider, {
    store,
    children: createElement(DashPanel, { id, title: 'Inspector', children }),
  })
}

function pressButton(button: ReactTestInstance) {
  const target = new MockHTMLElementBase()
  void act(() =>
    (button.props.onPress ?? button.props.onClick)({
      target,
      currentTarget: target,
      nativeEvent: { detail: 0, pointerType: '' },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }),
  )
}

describe('@picodash/dashpanel alpha shell', () => {
  it('exposes the Store-backed nearest controller and durable layout commands', () => {
    const store = makeStore()
    let controller!: ReturnType<typeof useDashPanel>
    function Probe() {
      controller = useDashPanel()
      return null
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: createElement(DashPanel, {
          id: 'panel',
          title: 'Panel',
          defaultLayout: {
            placement: { mode: 'floating', disposition: { kind: 'snapped', position: 'top-left' } },
            preferredPosition: { x: 4, y: 6 },
          },
          children: createElement(Probe),
        }),
      }),
    )
    expect(controller.availability).toBe('available')
    if (controller.availability !== 'available') throw new Error('controller unavailable')
    expect(controller.placement).toEqual({
      mode: 'floating',
      disposition: { kind: 'snapped', position: 'top-left' },
    })
    const placementResult = controller.setPlacement({
      mode: 'fixed',
      disposition: { kind: 'docked', position: 'full-right' },
    })
    expect(placementResult.status).toBe('executed')
    expect(store.getState().scopes.get('panel')?.dashPanel?.placement).toEqual({
      mode: 'fixed',
      disposition: { kind: 'docked', position: 'full-right' },
    })
    expect(controller.resetLayout().status).toBe('executed')
    expect(store.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('targets nearest, explicit, and unavailable panels while transient commands stay out of Store', () => {
    const store = makeStore()
    let nearest!: ReturnType<typeof useDashPanel>
    let explicit!: ReturnType<typeof useDashPanel>
    let missing!: ReturnType<typeof useDashPanel>
    function Probe() {
      nearest = useDashPanel()
      explicit = useDashPanel('panel')
      missing = useDashPanel('missing')
      return null
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: createElement(DashPanel, {
          id: 'panel',
          title: 'Panel',
          children: createElement(Probe),
        }),
      }),
    )
    expect(nearest.availability).toBe('available')
    expect(explicit.availability).toBe('available')
    expect(missing.availability).toBe('unavailable')
    expect(nearest.show().status).toBe('executed')
    expect(nearest.activate().status).toBe('executed')
    expect(nearest.hide().status).toBe('executed')
    expect(nearest.expand().status).toBe('executed')
    expect(nearest.collapse().status).toBe('executed')
    expect(nearest.toggleCollapsed().status).toBe('executed')
    expect(store.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('keeps a policy-disabled durable dock dormant and also enforces policy on its fallback', () => {
    const store = makeStore()
    store.setDashPanelLayout('panel', {
      placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-right' } },
      preferredPosition: { x: 12, y: 18 },
    })
    let controller!: ReturnType<typeof useDashPanel>
    function Probe() {
      controller = useDashPanel()
      return null
    }
    const renderedPanel = (dockPositions: readonly ('top-left' | 'bottom-right')[]) =>
      createElement(DashPanelProvider, {
        store,
        children: createElement(DashPanel, {
          id: 'panel',
          title: 'Panel',
          dockPositions,
          defaultLayout: {
            placement: {
              mode: 'fixed',
              disposition: { kind: 'docked', position: 'bottom-right' },
            },
          },
          children: createElement(Probe),
        }),
      })
    const renderer = render(renderedPanel(['top-left', 'bottom-right']))
    expect(controller.availability).toBe('available')
    if (controller.availability !== 'available') throw new Error('controller unavailable')
    expect(controller.placement).toEqual({
      mode: 'fixed',
      disposition: { kind: 'docked', position: 'bottom-right' },
    })
    act(() => renderer.update(renderedPanel(['top-left'])))
    expect(controller.placement).toEqual({
      mode: 'fixed',
      disposition: { kind: 'docked', position: 'top-left' },
    })
    expect(store.getState().scopes.get('panel')?.dashPanel?.preferredPosition).toEqual({
      x: 12,
      y: 18,
    })
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('uses the accessible move control for keyboard and pointer commit/cancel without preview persistence', () => {
    const store = makeStore()
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: createElement(DashPanel, {
          id: 'panel',
          title: 'Inspector',
          defaultLayout: {
            placement: {
              mode: 'floating',
              disposition: { kind: 'snapped', position: 'top-right' },
            },
            preferredPosition: { x: 4, y: 6 },
          },
        }),
      }),
    )
    const move = renderer.root.findByProps({ 'aria-label': 'Move panel Inspector' })
    const keyEvent = (key: string, shiftKey = false) =>
      act(() =>
        move.props.onKeyDown({
          key,
          shiftKey,
          preventDefault: vi.fn(),
        }),
      )
    void keyEvent('Enter')
    void keyEvent('ArrowRight', true)
    void keyEvent('Escape')
    expect(store.getState().scopes.get('panel')?.dashPanel).toBeUndefined()

    void keyEvent('Enter')
    void keyEvent('ArrowRight', true)
    void act(() => move.props.onBlur())
    expect(store.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    expect(renderer.root.findByType('aside').props['data-picodash-placement']).toBe(
      'floating-snapped',
    )

    void keyEvent('Enter')
    void keyEvent('ArrowDown')
    void keyEvent('Enter')
    expect(store.getState().scopes.get('panel')?.dashPanel?.placement).toEqual({
      mode: 'floating',
      disposition: { kind: 'free' },
    })

    void act(() =>
      renderer.update(
        createElement(DashPanelProvider, {
          store,
          children: createElement(DashPanel, {
            id: 'panel',
            title: 'Inspector',
            defaultLayout: {
              placement: {
                mode: 'floating',
                disposition: { kind: 'snapped', position: 'top-right' },
              },
              preferredPosition: { x: 4, y: 6 },
            },
          }),
        }),
      ),
    )
    act(() => {
      store.scope('panel').resetDashPanelLayout()
    })
    const pointerMove = renderer.root.findByProps({ 'aria-label': 'Move panel Inspector' })
    const pointerTarget = new MockHTMLElementBase()
    void act(() => {
      pointerMove.props.onPointerDown({
        button: 0,
        pointerId: 1,
        clientX: 10,
        clientY: 10,
        preventDefault: vi.fn(),
        currentTarget: pointerTarget,
      })
      pointerMove.props.onPointerUpCapture({ pointerId: 1 })
    })
    expect(store.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    void act(() => {
      pointerMove.props.onPointerDown({
        button: 0,
        pointerId: 2,
        clientX: 10,
        clientY: 10,
        preventDefault: vi.fn(),
        currentTarget: pointerTarget,
      })
      pointerMove.props.onPointerCancelCapture({ pointerId: 99 })
    })
    const aside = renderer.root.findByType('aside')
    void act(() => aside.props.onPointerCancel({ pointerId: 2 }))
    expect(store.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('preserves Hybrid mode when keyboard movement commits a free placement', () => {
    const store = makeStore()
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: createElement(DashPanel, {
          id: 'panel',
          title: 'Inspector',
          defaultLayout: {
            placement: {
              mode: 'hybrid',
              disposition: { kind: 'docked', position: 'full-left' },
            },
            preferredPosition: { x: 4, y: 6 },
          },
        }),
      }),
    )
    let move = renderer.root.findByProps({ 'aria-label': 'Move panel Inspector' })
    act(() => {
      void move.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    move = renderer.root.findByProps({ 'aria-label': 'Move panel Inspector' })
    act(() => {
      void move.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    expect(store.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    move = renderer.root.findByProps({ 'aria-label': 'Move panel Inspector' })
    act(() => {
      void move.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    move = renderer.root.findByProps({ 'aria-label': 'Move panel Inspector' })
    act(() => {
      void move.props.onKeyDown({ key: 'ArrowRight', preventDefault() {} })
      void move.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    expect(store.getState().scopes.get('panel')?.dashPanel).toEqual({
      placement: { mode: 'hybrid', disposition: { kind: 'free' } },
      preferredPosition: { x: 4, y: 6 },
    })
    act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('keeps the move control unavailable for Fixed Panels instead of changing placement mode', () => {
    const store = makeStore()
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: createElement(DashPanel, {
          id: 'panel',
          title: 'Inspector',
          defaultLayout: {
            placement: {
              mode: 'fixed',
              disposition: { kind: 'docked', position: 'full-left' },
            },
            preferredPosition: { x: 4, y: 6 },
          },
        }),
      }),
    )
    const move = renderer.root.findByProps({ 'aria-label': 'Move panel Inspector' })
    expect(move.props.isDisabled).toBe(true)
    act(() => {
      void move.props.onKeyDown({ key: 'Enter', preventDefault() {} })
      void move.props.onPointerDown({
        button: 0,
        pointerId: 1,
        preventDefault() {},
        currentTarget: new MockHTMLElementBase(),
      })
    })
    expect(store.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    expect(renderer.root.findByType('aside').props['data-picodash-placement']).toBe('fixed-docked')
    act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('requires a root Store and rejects scoped Stores', () => {
    const store = makeStore()
    expect(() => render(createElement(DashPanel, { id: 'outside', title: 'Outside' }))).toThrow(
      /missing-store-context/,
    )
    expect(() =>
      render(
        createElement(DashPanelProvider, {
          store: store.scope('nested') as never,
          children: null,
        }),
      ),
    ).toThrow('DashPanelProvider requires a root Store')
    expect(() => store.destroy()).not.toThrow()
  })

  it('defaults the Provider id and rejects duplicate active Providers', () => {
    const store = makeStore()
    const first = render(panel(store))
    expect(() => render(panel(store, undefined, 'other'))).toThrow(/duplicate-provider/)
    void act(() => first.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('propagates root and scoped Store context, and nests relationships by scope', () => {
    const store = makeStore()
    function Probe() {
      const root = usePicodashRootStore()
      const scope = usePicodashScope()
      return createElement(
        'output',
        { 'data-scope': scope.scopeId },
        root === scope.root ? 'root' : 'wrong',
      )
    }
    const renderer = render(panel(store, createElement(Probe)))
    const output = renderer.root.findByType('output')
    expect(output.props['data-scope']).toBe('panel')
    expect(output.children).toEqual(['root'])
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('resets Store ancestry for nested Providers and tears down safely in Strict Mode', () => {
    const store = makeStore()
    function Probe() {
      return createElement('output', { 'data-scope': usePicodashScope().scopeId })
    }
    const nested = createElement(DashPanelProvider, {
      store,
      providerId: 'nested',
      children: createElement(DashPanel, {
        id: 'inner',
        title: 'Inner',
        children: createElement(Probe),
      }),
    })
    const renderer = render(
      createElement(
        StrictMode,
        null,
        createElement(DashPanelProvider, {
          store,
          children: createElement(DashPanel, { id: 'outer', title: 'Outer', children: nested }),
        }),
      ),
    )
    expect(renderer.root.findByType('output').props['data-scope']).toBe('inner')
    expect(() => store.destroy()).toThrow(/root-has-active-leases/)
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('publishes frozen default Provider policy without adding DOM or Store behavior', () => {
    const store = makeStore()
    let observed!: DashPanelProviderPolicy
    function Probe() {
      observed = useDashPanelProviderPolicy()
      return createElement('section', { 'data-policy-probe': true }, 'content')
    }
    const renderer = render(
      createElement(DashPanelProvider, { store, children: createElement(Probe) }),
    )
    expect(observed.boundary).toBeNull()
    expect(observed.boundaryInset).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(observed.dockPositions).toEqual([
      'top-left',
      'top-right',
      'bottom-right',
      'bottom-left',
      'full-left',
      'center-left',
      'full-right',
      'center-right',
      'full-top',
      'center-top',
      'full-bottom',
      'center-bottom',
    ])
    expect(Object.isFrozen(observed)).toBe(true)
    expect(Object.isFrozen(observed.boundaryInset)).toBe(true)
    expect(Object.isFrozen(observed.dockPositions)).toBe(true)
    expect(renderer.root.findByProps({ 'data-policy-probe': true }).children).toEqual(['content'])
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('retains boundary identity, validates live refs, and publishes dynamic policy synchronously', () => {
    const store = makeStore()
    const boundaryRef = { current: null as Element | null }
    let observed!: DashPanelProviderPolicy
    function Probe() {
      observed = useDashPanelProviderPolicy()
      return null
    }
    const makeProvider = (boundaryInset: unknown, dockPositions: unknown) =>
      createElement(DashPanelProvider, {
        store,
        boundary: boundaryRef,
        boundaryInset: boundaryInset as never,
        dockPositions: dockPositions as never,
        children: createElement(Probe),
      })
    let renderer = render(makeProvider([1, 2], ['center-bottom', 'top-left', 'center-bottom']))
    expect(observed.boundary).toBe(boundaryRef)
    expect(observed.boundaryInset).toEqual({ top: 1, right: 2, bottom: 1, left: 2 })
    expect(observed.dockPositions).toEqual(['top-left', 'center-bottom'])

    const element = new MockHTMLElementBase() as unknown as Element
    boundaryRef.current = element
    void act(() => renderer.update(makeProvider([3, 4, 5], [])))
    expect(observed.boundary).toBe(boundaryRef)
    expect(observed.boundaryInset).toEqual({ top: 3, right: 4, bottom: 5, left: 4 })
    expect(observed.dockPositions).toEqual([])
    expect(Object.isFrozen(observed.dockPositions)).toBe(true)

    boundaryRef.current = 'invalid' as never
    expect(() =>
      act(() => {
        renderer.update(makeProvider(0, []))
      }),
    ).toThrow(TypeError)
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('resets policy at nested Providers and keeps nearest context', () => {
    const store = makeStore()
    const outerBoundary = new MockHTMLElementBase() as unknown as Element
    const observed = new Map<string, DashPanelProviderPolicy>()
    function Probe({ name }: { name: string }) {
      observed.set(name, useDashPanelProviderPolicy())
      return null
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        boundary: outerBoundary,
        boundaryInset: 8,
        dockPositions: ['top-left'],
        children: createElement(
          'div',
          null,
          createElement(Probe, { name: 'outer' }),
          createElement(DashPanelProvider, {
            store,
            providerId: 'nested-policy',
            children: createElement(Probe, { name: 'inner' }),
          }),
        ),
      }),
    )
    expect(observed.get('outer')?.boundary).toBe(outerBoundary)
    expect(observed.get('outer')?.boundaryInset).toEqual({ top: 8, right: 8, bottom: 8, left: 8 })
    expect(observed.get('outer')?.dockPositions).toEqual(['top-left'])
    expect(observed.get('inner')?.boundary).toBeNull()
    expect(observed.get('inner')?.boundaryInset).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(observed.get('inner')?.dockPositions).toHaveLength(12)
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('accepts an explicit empty dock set and rejects invalid policy representatives', () => {
    const emptyStore = makeStore()
    let emptyObserved!: DashPanelProviderPolicy
    function EmptyProbe() {
      emptyObserved = useDashPanelProviderPolicy()
      return null
    }
    const emptyRenderer = render(
      createElement(DashPanelProvider, {
        store: emptyStore,
        dockPositions: [],
        children: createElement(EmptyProbe),
      }),
    )
    expect(emptyObserved.dockPositions).toEqual([])
    void act(() => emptyRenderer.unmount())
    expect(() => emptyStore.destroy()).not.toThrow()

    const invalid: Array<Record<string, unknown>> = [
      { boundary: '#selector' },
      { boundary: { current: 'invalid' } },
      { boundaryInset: null },
      { boundaryInset: [-1] },
      { dockPositions: ['middle-left'] },
    ]
    for (const policyProps of invalid) {
      const store = makeStore()
      const props = { store, ...policyProps, children: null } as never
      expect(() => render(createElement(DashPanelProvider, props))).toThrow(TypeError)
      expect(() => store.destroy()).not.toThrow()
    }
  })

  it('rejects the private policy hook outside a Provider', () => {
    function Probe() {
      useDashPanelProviderPolicy()
      return null
    }
    expect(() => render(createElement(Probe))).toThrow(
      'DashPanel provider policy requires a DashPanelProvider',
    )
  })

  it('resolves Panel policy inheritance, overrides, narrowing, and frozen records synchronously', () => {
    const store = makeStore()
    const providerBoundary = new MockHTMLElementBase() as unknown as Element
    const panelBoundary = new MockHTMLElementBase() as unknown as Element
    let observed!: DashPanelPolicy
    function Probe() {
      observed = useDashPanelPolicy()
      return null
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        boundary: providerBoundary,
        boundaryInset: [1, 2],
        dockPositions: ['top-left', 'center-bottom'],
        children: createElement(DashPanel, {
          id: 'policy',
          title: 'Policy',
          boundary: panelBoundary,
          boundaryInset: 0,
          dockPositions: ['center-bottom'],
          children: createElement(Probe),
        }),
      }),
    )
    expect(observed.getBoundary()).toBe(panelBoundary)
    expect(observed.boundaryInset).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(observed.dockPositions).toEqual(['center-bottom'])
    expect(Object.isFrozen(observed)).toBe(true)
    expect(Object.isFrozen(observed.boundaryInset)).toBe(true)
    expect(Object.isFrozen(observed.dockPositions)).toBe(true)

    void act(() =>
      renderer.update(
        createElement(DashPanelProvider, {
          store,
          boundary: providerBoundary,
          boundaryInset: [1, 2],
          dockPositions: ['top-left', 'center-bottom'],
          children: createElement(DashPanel, {
            id: 'policy',
            title: 'Policy',
            boundary: null,
            boundaryInset: 0,
            dockPositions: [],
            children: createElement(Probe),
          }),
        }),
      ),
    )
    expect(observed.getBoundary()).toBeNull()
    expect(observed.boundaryInset).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(observed.dockPositions).toEqual([])
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('keeps Panel and Provider boundary refs live without rerendering', () => {
    const store = makeStore()
    const providerRef = { current: null as Element | null }
    const panelRef = { current: null as Element | null }
    let observed!: DashPanelPolicy
    function Probe() {
      observed = useDashPanelPolicy()
      return null
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        boundary: providerRef,
        children: createElement(DashPanel, {
          id: 'live-policy',
          title: 'Live policy',
          boundary: panelRef,
          children: createElement(Probe),
        }),
      }),
    )
    expect(observed.getBoundary()).toBeNull()
    const panelElement = new MockHTMLElementBase() as unknown as Element
    const providerElement = new MockHTMLElementBase() as unknown as Element
    panelRef.current = panelElement
    expect(observed.getBoundary()).toBe(panelElement)
    panelRef.current = null
    expect(observed.getBoundary()).toBeNull()
    providerRef.current = providerElement
    expect(observed.getBoundary()).toBe(providerElement)
    panelRef.current = panelElement
    expect(observed.getBoundary()).toBe(panelElement)
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('rejects invalid Panel policy values and widening dock sets', () => {
    const invalid: Array<Record<string, unknown>> = [
      { boundary: '#selector' },
      { boundary: { current: 'invalid' } },
      { boundaryInset: null },
      { boundaryInset: [-1] },
      { dockPositions: ['center-right'] },
    ]
    for (const policyProps of invalid) {
      const store = makeStore()
      const props = {
        store,
        dockPositions: ['top-left'] as const,
        children: createElement(DashPanel, {
          id: 'invalid-policy',
          title: 'Invalid policy',
          children: null,
          ...policyProps,
        }),
      } as never
      expect(() => render(createElement(DashPanelProvider, props))).toThrow(TypeError)
      expect(() => store.destroy()).not.toThrow()
    }
  })

  it('uses Provider defaults for nested Panels and resets at nested Providers', () => {
    const store = makeStore()
    const outerBoundary = new MockHTMLElementBase() as unknown as Element
    const observed = new Map<string, DashPanelPolicy>()
    function Probe({ name }: { name: string }) {
      observed.set(name, useDashPanelPolicy())
      return null
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        boundary: outerBoundary,
        boundaryInset: 8,
        dockPositions: ['top-left'],
        children: createElement(DashPanel, {
          id: 'outer-policy',
          title: 'Outer policy',
          boundary: new MockHTMLElementBase() as unknown as Element,
          boundaryInset: 2,
          dockPositions: ['top-left'],
          children: createElement(
            'div',
            null,
            createElement(DashPanel, {
              id: 'nested-policy',
              title: 'Nested policy',
              children: createElement(Probe, { name: 'nested' }),
            }),
            createElement(DashPanelProvider, {
              store,
              providerId: 'nested-policy-provider',
              children: createElement(DashPanel, {
                id: 'reset-policy',
                title: 'Reset policy',
                children: createElement(Probe, { name: 'reset' }),
              }),
            }),
          ),
        }),
      }),
    )
    expect(observed.get('nested')?.getBoundary()).toBe(outerBoundary)
    expect(observed.get('nested')?.boundaryInset).toEqual({ top: 8, right: 8, bottom: 8, left: 8 })
    expect(observed.get('nested')?.dockPositions).toEqual(['top-left'])
    expect(observed.get('reset')?.getBoundary()).toBeNull()
    expect(observed.get('reset')?.boundaryInset).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(observed.get('reset')?.dockPositions).toHaveLength(12)
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('rejects the private Panel policy hook outside an active Panel', () => {
    function Probe() {
      useDashPanelPolicy()
      return null
    }
    const store = makeStore()
    expect(() =>
      render(createElement(DashPanelProvider, { store, children: createElement(Probe) })),
    ).toThrow('DashPanel policy requires an active DashPanel')
    expect(() => store.destroy()).not.toThrow()
  })

  it('renders a named semantic aside with visible heading, arbitrary children, and no scope DOM id', () => {
    const store = makeStore()
    const ref = { current: null as HTMLElement | null }
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: createElement(DashPanel, {
          id: 'scope-id',
          title: 'Inspector',
          ref,
          children: createElement('button', { type: 'button' }, 'Apply'),
        }),
      }),
    )
    const aside = renderer.root.findByType('aside')
    const heading = renderer.root.findByType('h2')
    expect(aside.props.id).toBeUndefined()
    expect(aside.props.boundary).toBeUndefined()
    expect(aside.props.boundaryInset).toBeUndefined()
    expect(aside.props.dockPositions).toBeUndefined()
    expect(aside.props['aria-labelledby']).toBe(heading.props.id)
    expect(heading.children).toEqual(['Inspector'])
    expect(
      renderer.root.findAllByType('button').some((button) => button.children.includes('Apply')),
    ).toBe(true)
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('requires aria-label for non-text titles', () => {
    const store = makeStore()
    expect(() =>
      render(
        createElement(DashPanelProvider, {
          store,
          children: createElement(DashPanel, {
            id: 'icon',
            title: createElement('span', null, 'I'),
          }),
        }),
      ),
    ).toThrow('DashPanel non-text titles require an explicit aria-label')
    expect(() => store.destroy()).not.toThrow()

    const labelledStore = makeStore()
    const labelled = render(
      createElement(DashPanelProvider, {
        store: labelledStore,
        providerId: 'labelled',
        children: createElement(DashPanel, {
          id: 'icon',
          title: createElement('span', null, 'I'),
          'aria-label': 'Inspector',
        }),
      }),
    )
    expect(labelled.root.findByType('aside').props['aria-label']).toBe('Inspector')
    void act(() => labelled.unmount())
    expect(() => labelledStore.destroy()).not.toThrow()

    const blankStore = makeStore()
    expect(() =>
      render(
        createElement(DashPanelProvider, {
          store: blankStore,
          providerId: 'blank',
          children: createElement(DashPanel, { id: 'blank', title: [' ', ''] }),
        }),
      ),
    ).toThrow('DashPanel titles require non-empty text or an explicit aria-label')
    expect(() => blankStore.destroy()).not.toThrow()

    const blankLabelledStore = makeStore()
    const blankLabelled = render(
      createElement(DashPanelProvider, {
        store: blankLabelledStore,
        providerId: 'blank-labelled',
        children: createElement(DashPanel, {
          id: 'blank',
          title: '',
          'aria-label': 'Inspector',
        }),
      }),
    )
    expect(blankLabelled.root.findByType('aside').props['aria-label']).toBe('Inspector')
    expect(blankLabelled.root.findByProps({ 'aria-label': 'Close panel Inspector' })).toBeTruthy()
    void act(() => blankLabelled.unmount())
    expect(() => blankLabelledStore.destroy()).not.toThrow()
  })

  it('writes width to the public token while preserving style and rejects reserved style keys', () => {
    const store = makeStore()
    const customStyle = { opacity: 0.8, '--consumer-token': 'ok' } as DashPanelStyle
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: createElement(DashPanel, {
          id: 'sized',
          title: 'Sized',
          width: '24rem',
          style: customStyle,
        }),
      }),
    )
    expect(renderer.root.findByType('aside').props.style).toEqual({
      opacity: 0.8,
      '--consumer-token': 'ok',
      '--picodash-panel-width': '24rem',
    })
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()

    for (const reserved of ['width', 'inlineSize'] as const) {
      const next = makeStore()
      expect(() =>
        render(
          createElement(DashPanelProvider, {
            store: next,
            children: createElement(DashPanel, {
              id: reserved,
              title: 'Reserved',
              style: { [reserved]: '1px' } as DashPanelStyle,
            }),
          }),
        ),
      ).toThrow(`DashPanel style.${reserved} is reserved`)
      expect(() => next.destroy()).not.toThrow()
    }
  })

  it('composes independent theme and density overrides', () => {
    const store = makeStore()
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        theme: 'light',
        density: 'regular',
        children: createElement(DashPanel, {
          id: 'theme',
          title: 'Theme',
          theme: 'dark',
          density: 'compact',
        }),
      }),
    )
    const carriers = renderer.root.findAll(
      (node: ReactTestInstance) => node.props['data-picodash-theme'] !== undefined,
    )
    expect(
      carriers.map((node: ReactTestInstance) => [
        node.props['data-picodash-theme'],
        node.props['data-picodash-density'],
      ]),
    ).toEqual([
      ['light', 'regular'],
      ['dark', 'compact'],
      ['dark', 'compact'],
    ])
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('renders an expanded collapsible Panel with its accessible control and body relationship', () => {
    const store = makeStore()
    const renderer = render(panel(store))
    const aside = renderer.root.findByType('aside')
    const button = renderer.root.findByProps({ 'aria-label': 'Collapse panel Inspector' })
    const body = renderer.root.findByProps({ 'data-picodash-panel-body': true })
    expect(aside.props['data-collapsed']).toBe('false')
    expect(button.props).toMatchObject({
      'aria-label': 'Collapse panel Inspector',
      'aria-expanded': true,
      'aria-controls': body.props.id,
    })
    expect(body.props.hidden).toBe(false)
    expect(body.props.inert).toBeUndefined()
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('keeps collapsed children mounted and inert while preserving their state across expand', () => {
    const store = makeStore()
    let nextToken = 0
    function Child() {
      const [token] = useState(() => ++nextToken)
      return createElement('output', { 'data-child': true }, `child-state-${token}`)
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: createElement(DashPanel, {
          id: 'collapsed',
          title: 'Inspector',
          defaultCollapsed: true,
          children: createElement(Child),
        }),
      }),
    )
    const button = renderer.root.findByProps({ 'aria-label': 'Expand panel Inspector' })
    const body = renderer.root.findByProps({ 'data-picodash-panel-body': true })
    expect(renderer.root.findByType('aside').props['data-collapsed']).toBe('true')
    expect(body.props.hidden).toBe(true)
    expect(body.props.inert).toBe(true)
    const child = renderer.root.findByProps({ 'data-child': true })
    const childToken = child.children[0]
    expect(childToken).toBe('child-state-1')
    expect(() => store.destroy()).toThrow(/root-has-active-leases/)
    pressButton(button)
    expect(renderer.root.findByType('aside').props['data-collapsed']).toBe('false')
    expect(renderer.root.findByProps({ 'data-picodash-panel-body': true }).props.hidden).toBe(false)
    expect(renderer.root.findByProps({ 'data-child': true }).children[0]).toBe(childToken)
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('calls the collapse callback only for committed transitions and ignores default changes after mount', () => {
    const store = makeStore()
    const callback = vi.fn()
    let renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: createElement(DashPanel, {
          id: 'callback',
          title: 'Inspector',
          onCollapsedChange: callback,
        }),
      }),
    )
    expect(callback).not.toHaveBeenCalled()
    const button = renderer.root.findByProps({ 'aria-label': 'Collapse panel Inspector' })
    pressButton(button)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenLastCalledWith(true)
    void act(() =>
      renderer.update(
        createElement(DashPanelProvider, {
          store,
          children: createElement(DashPanel, {
            id: 'callback',
            title: 'Inspector',
            defaultCollapsed: false,
            onCollapsedChange: callback,
          }),
        }),
      ),
    )
    expect(renderer.root.findByType('aside').props['data-collapsed']).toBe('true')
    expect(callback).toHaveBeenCalledTimes(1)
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('uses the latest callback and expands when dynamic collapsibility is disabled', () => {
    const store = makeStore()
    const initialCallback = vi.fn()
    const latestCallback = vi.fn()
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: createElement(DashPanel, {
          id: 'dynamic',
          title: 'Inspector',
          defaultCollapsed: true,
          onCollapsedChange: initialCallback,
        }),
      }),
    )
    void act(() =>
      renderer.update(
        createElement(DashPanelProvider, {
          store,
          children: createElement(DashPanel, {
            id: 'dynamic',
            title: 'Inspector',
            collapsible: false,
            onCollapsedChange: latestCallback,
          }),
        }),
      ),
    )
    expect(renderer.root.findByType('aside').props['data-collapsed']).toBe('false')
    expect(renderer.root.findByProps({ 'aria-label': 'Close panel Inspector' })).toBeTruthy()
    expect(initialCallback).not.toHaveBeenCalled()
    expect(latestCallback).toHaveBeenCalledTimes(1)
    expect(latestCallback).toHaveBeenCalledWith(false)
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('rejects invalid initial collapse policy before acquiring runtime or Store leases', () => {
    const store = makeStore()
    expect(() =>
      render(
        createElement(DashPanelProvider, {
          store,
          children: createElement(DashPanel, {
            id: 'invalid-collapse',
            title: 'Inspector',
            defaultCollapsed: true,
            collapsible: false,
          }),
        }),
      ),
    ).toThrow('non-collapsible Panel cannot start collapsed')
    expect(() => store.destroy()).not.toThrow()
  })

  it('isolates equal scope ids across nested Providers with separate roots', () => {
    const outerStore = makeStore()
    const innerStore = makeStore()
    const nested = createElement(DashPanelProvider, {
      store: innerStore,
      providerId: 'inner',
      children: createElement(DashPanel, { id: 'shared', title: 'Inner' }),
    })
    const renderer = render(
      createElement(DashPanelProvider, {
        store: outerStore,
        children: createElement(DashPanel, {
          id: 'shared',
          title: 'Outer',
          children: nested,
        }),
      }),
    )
    const asides = renderer.root.findAllByType('aside')
    expect(asides).toHaveLength(2)
    pressButton(renderer.root.findByProps({ 'aria-label': 'Collapse panel Outer' }))
    expect(
      renderer.root.findAllByType('aside').map((aside) => aside.props['data-collapsed']),
    ).toEqual(['true', 'false'])
    void act(() => renderer.unmount())
    expect(() => outerStore.destroy()).not.toThrow()
    expect(() => innerStore.destroy()).not.toThrow()
  })

  it('hides without unmounting, restores retained child state, and reopens from a trigger', () => {
    const store = makeStore()
    const visibility = vi.fn()
    function StatefulChild() {
      const [count, setCount] = useState(0)
      return createElement(
        'button',
        { 'aria-label': 'Increment retained state', onClick: () => setCount((value) => value + 1) },
        `${count}`,
      )
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: [
          createElement(DashPanelTrigger, { key: 'trigger', panelId: 'panel' }, 'Open Inspector'),
          createElement(
            DashPanel,
            {
              key: 'panel',
              id: 'panel',
              title: 'Inspector',
              onVisibilityChange: visibility,
            },
            createElement(StatefulChild),
          ),
        ],
      }),
    )
    const aside = renderer.root.findByType('aside')
    pressButton(renderer.root.findByProps({ 'aria-label': 'Increment retained state' }))
    expect(
      renderer.root.findByProps({ 'aria-label': 'Increment retained state' }).children,
    ).toEqual(['1'])
    pressButton(renderer.root.findByProps({ 'aria-label': 'Close panel Inspector' }))
    expect(aside.props).toMatchObject({ hidden: true, inert: true, 'aria-hidden': true })
    expect(
      renderer.root.findByProps({ 'aria-label': 'Increment retained state' }).children,
    ).toEqual(['1'])
    expect(visibility).toHaveBeenLastCalledWith(false)
    pressButton(
      renderer.root
        .findAllByType(Button)
        .find((button) => button.props.children === 'Open Inspector')!,
    )
    expect(aside.props.hidden).toBe(false)
    expect(aside.props['data-active']).toBe('true')
    expect(
      renderer.root.findByProps({ 'aria-label': 'Increment retained state' }).children,
    ).toEqual(['1'])
    expect(visibility).toHaveBeenLastCalledWith(true)
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('projects active state onto the highest visible panel', () => {
    const store = makeStore()
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: [
          createElement(DashPanel, { key: 'first', id: 'first', title: 'First' }),
          createElement(DashPanel, { key: 'second', id: 'second', title: 'Second' }),
        ],
      }),
    )
    let asides = renderer.root.findAllByType('aside')
    expect(asides[0]?.props['data-active']).toBeUndefined()
    expect(asides[1]?.props['data-active']).toBe('true')
    pressButton(renderer.root.findByProps({ 'aria-label': 'Close panel Second' }))
    asides = renderer.root.findAllByType('aside')
    expect(asides[0]?.props['data-active']).toBe('true')
    expect(asides[1]?.props['data-active']).toBeUndefined()
    expect(asides[1]?.props.hidden).toBe(true)
    void act(() => renderer.unmount())
    store.destroy()
  })

  it('focuses an already-visible Panel when show activates it', () => {
    const store = makeStore()
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: [
          createElement(DashPanelTrigger, { key: 'trigger', panelId: 'first' }, 'Show First'),
          createElement(DashPanel, { key: 'first', id: 'first', title: 'First' }),
          createElement(DashPanel, { key: 'second', id: 'second', title: 'Second' }),
        ],
      }),
    )
    const scheduleFocus = vi.fn()
    vi.stubGlobal('queueMicrotask', scheduleFocus)
    pressButton(
      renderer.root.findAllByType(Button).find((button) => button.props.children === 'Show First')!,
    )
    expect(renderer.root.findAllByType('aside')[0]?.props['data-active']).toBe('true')
    expect(scheduleFocus).toHaveBeenCalledOnce()
    void act(() => renderer.unmount())
    store.destroy()
  })

  it('seeds hidden visibility without focus and disables unavailable launcher targets', () => {
    const store = makeStore()
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        children: [
          createElement(DashPanelLauncher, {
            key: 'launcher',
            label: 'Panels',
            items: [
              { panelId: 'hidden', label: 'Hidden panel' },
              { panelId: 'missing', label: 'Missing panel' },
              {
                panelId: 'hidden',
                label: createElement('span', { 'aria-hidden': true }, 'H'),
                accessibleName: 'Hidden panel icon',
              },
            ],
          }),
          createElement(DashPanel, {
            key: 'panel',
            id: 'hidden',
            title: 'Hidden',
            defaultVisible: false,
          }),
        ],
      }),
    )
    expect(renderer.root.findByType('aside').props.hidden).toBe(true)
    const buttons = renderer.root.findAllByType(Button)
    const hiddenTrigger = buttons.find((button) => button.props.children === 'Hidden panel')!
    const missingTrigger = buttons.find((button) => button.props.children === 'Missing panel')!
    expect(hiddenTrigger.props.isDisabled).toBeFalsy()
    expect(missingTrigger.props.isDisabled).toBe(true)
    expect(
      buttons.find((button) => button.props['aria-label'] === 'Hidden panel icon'),
    ).toBeTruthy()
    pressButton(hiddenTrigger)
    expect(renderer.root.findByType('aside').props.hidden).toBe(false)
    void act(() => renderer.unmount())
  })

  it('restores focus after a committed visibility callback throws', () => {
    const store = makeStore()
    const boundary = new MockHTMLElementBase()
    const renderer = render(
      createElement(DashPanelProvider, {
        store,
        boundary: boundary as unknown as HTMLElement,
        children: createElement(DashPanel, {
          id: 'throwing-visibility',
          title: 'Throwing visibility',
          onVisibilityChange: (visible) => {
            if (!visible) throw new Error('visibility callback failed')
          },
        }),
      }),
    )
    expect(() =>
      pressButton(renderer.root.findByProps({ 'aria-label': 'Close panel Throwing visibility' })),
    ).toThrow('visibility callback failed')
    expect(document.activeElement).toBe(boundary)
    void act(() => renderer.unmount())
    store.destroy()
  })

  it('rejects launcher items without a non-empty accessible name', () => {
    expect(() =>
      render(createElement(DashPanelLauncher, { label: '   ', items: [] })),
    ).toThrowError('DashPanelLauncher label must not be empty.')
    expect(() =>
      render(
        createElement(DashPanelLauncher, {
          label: 'Panels',
          items: [{ panelId: 'blank', label: '   ' }],
        }),
      ),
    ).toThrowError('DashPanelLauncher items require a non-empty text label or accessibleName.')
    expect(() =>
      render(
        createElement(DashPanelLauncher, {
          label: 'Panels',
          items: [
            {
              panelId: 'blank-explicit',
              label: createElement('span', null, 'Icon'),
              accessibleName: '   ',
            },
          ],
        }),
      ),
    ).toThrowError('DashPanelLauncher item accessibleName must not be empty.')
  })

  it('reexports shared UI identities without retired aliases', async () => {
    const ui = await import('@picodash/ui')
    const dashpanel = await import('../src/index.tsx')
    expect(dashpanel.DashHeader).toBe(ui.DashHeader)
    expect(dashpanel.ActionMenu).toBe(ui.ActionMenu)
    expect(dashpanel.ActionMenuItem).toBe(ui.ActionMenuItem)
    expect(dashpanel.ActionSubmenu).toBe(ui.ActionSubmenu)
    expect(dashpanel.ActionMenuSeparator).toBe(ui.ActionMenuSeparator)
    expect('PicodashPanel' in dashpanel).toBe(false)
    expect('PicodashProvider' in dashpanel).toBe(false)
  })

  it('keeps the Store contract error type visible for provider conflicts', () => {
    const store = makeStore()
    const first = render(panel(store))
    try {
      render(panel(store, undefined, 'other'))
    } catch (error) {
      expect(error).toBeInstanceOf(PicodashContractError)
    }
    void act(() => first.unmount())
    expect(() => store.destroy()).not.toThrow()
  })
})
