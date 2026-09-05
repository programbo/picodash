// @vitest-environment jsdom
import {
  act,
  createElement,
  StrictMode,
  useState,
  type ComponentProps,
  type ReactElement,
} from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import {
  createDomTestRenderer as create,
  type DomTestInstance,
  type DomTestRenderer,
} from '../../../test/dom-renderer.ts'
import { createPicodashNexus, PicodashContractError } from '@picodash/nexus'
import { usePicodashRootNexus, usePicodashScope } from '@picodash/nexus/react'
import {
  DashPanel,
  DashPanelLauncher,
  DashPanelProvider,
  DashPanelTrigger,
  useDashPanel,
  type DashPanelStyle,
} from '../src/index.tsx'
import { useDashPanelPolicy, type DashPanelPolicy } from '../src/runtime/panel-policy-context.tsx'
import { useDashPanelRuntime } from '../src/runtime/panel-runtime-context.tsx'
import {
  useDashPanelProviderPolicy,
  type DashPanelProviderPolicy,
} from '../src/runtime/provider-policy-context.tsx'

function createMockElement() {
  const element = document.createElement('button')
  element.getBoundingClientRect = () =>
    ({
      bottom: 32,
      height: 32,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect
  document.body.append(element)
  return element
}

const makeNexus = () =>
  createPicodashNexus({
    valueOwner: 'nexus',
    fields: { count: { defaultValue: 0 } },
  })

function render(element: ReactElement): DomTestRenderer {
  let renderer!: DomTestRenderer
  act(() => {
    renderer = create(element)
  })
  return renderer
}

const renderWithHostNodes = render

function panel(nexus: ReturnType<typeof makeNexus>, children?: ReactElement, id = 'panel') {
  return createElement(DashPanelProvider, {
    nexus,
    children: createElement(DashPanel, { id, title: 'Inspector', children }),
  })
}

function pressButton(button: DomTestInstance) {
  act(() => button.element.click())
}

describe('@picodash/dashpanel alpha shell', () => {
  it('exposes the Nexus-backed nearest controller and durable layout commands', () => {
    const nexus = makeNexus()
    let controller!: ReturnType<typeof useDashPanel>
    function Probe() {
      controller = useDashPanel()
      return null
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
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
    let placementResult!: ReturnType<typeof controller.setPlacement>
    act(() => {
      placementResult = controller.setPlacement({
        mode: 'fixed',
        disposition: { kind: 'docked', position: 'full-right' },
      })
    })
    expect(placementResult.status).toBe('executed')
    expect(nexus.getState().scopes.get('panel')?.dashPanel?.placement).toEqual({
      mode: 'fixed',
      disposition: { kind: 'docked', position: 'full-right' },
    })
    act(() => {
      expect(controller.resetLayout().status).toBe('executed')
    })
    expect(nexus.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('targets nearest, explicit, and unavailable panels while transient commands stay out of Nexus', () => {
    const nexus = makeNexus()
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
        nexus,
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
    act(() => {
      expect(nearest.show().status).toBe('executed')
      expect(nearest.activate().status).toBe('executed')
      expect(nearest.hide().status).toBe('executed')
      expect(nearest.expand().status).toBe('executed')
      expect(nearest.collapse().status).toBe('executed')
      expect(nearest.toggleCollapsed().status).toBe('executed')
    })
    expect(nexus.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('keeps a policy-disabled durable dock dormant and also enforces policy on its fallback', () => {
    const nexus = makeNexus()
    nexus.setDashPanelLayout('panel', {
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
        nexus,
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
    expect(nexus.getState().scopes.get('panel')?.dashPanel?.preferredPosition).toEqual({
      x: 12,
      y: 18,
    })
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('uses the accessible move control for keyboard and pointer commit/cancel without preview persistence', () => {
    const nexus = makeNexus()
    const renderer = renderWithHostNodes(
      createElement(DashPanelProvider, {
        nexus,
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
          placementOptions: { snapProximity: 0 },
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
    expect(nexus.getState().scopes.get('panel')?.dashPanel).toBeUndefined()

    void keyEvent('Enter')
    void keyEvent('ArrowRight', true)
    void act(() => move.props.onBlur())
    expect(nexus.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    expect(renderer.root.findByType('aside').props['data-picodash-placement']).toBe(
      'floating-snapped',
    )

    void keyEvent('Enter')
    void keyEvent('ArrowDown')
    void keyEvent('Enter')
    expect(nexus.getState().scopes.get('panel')?.dashPanel?.placement).toEqual({
      mode: 'floating',
      disposition: { kind: 'free' },
    })

    act(() =>
      renderer.update(
        createElement(DashPanelProvider, {
          nexus,
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
      nexus.scope('panel').resetDashPanelLayout()
    })
    const pointerMove = renderer.root.findByProps({ 'aria-label': 'Move panel Inspector' })
    const pointerTarget = createMockElement()
    act(() => {
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
    expect(nexus.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    act(() => {
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
    expect(nexus.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('preserves Hybrid mode and begins keyboard movement from rendered dock geometry', () => {
    const nexus = makeNexus()
    const renderer = renderWithHostNodes(
      createElement(DashPanelProvider, {
        nexus,
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
          placementOptions: { detachDistance: 1 },
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
    expect(nexus.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    move = renderer.root.findByProps({ 'aria-label': 'Move panel Inspector' })
    act(() => {
      void move.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    move = renderer.root.findByProps({ 'aria-label': 'Move panel Inspector' })
    act(() => {
      void move.props.onKeyDown({ key: 'ArrowRight', preventDefault() {} })
      void move.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    expect(nexus.getState().scopes.get('panel')?.dashPanel).toEqual({
      placement: { mode: 'hybrid', disposition: { kind: 'free' } },
      preferredPosition: { x: 1, y: 0 },
    })
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('keeps the move control unavailable for Fixed Panels instead of changing placement mode', () => {
    const nexus = makeNexus()
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
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
        currentTarget: createMockElement(),
      })
    })
    expect(nexus.getState().scopes.get('panel')?.dashPanel).toBeUndefined()
    expect(renderer.root.findByType('aside').props['data-picodash-placement']).toBe('fixed-docked')
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('requires a root Nexus and rejects scoped Nexuses', () => {
    const nexus = makeNexus()
    expect(() => render(createElement(DashPanel, { id: 'outside', title: 'Outside' }))).toThrow(
      /missing-nexus-context/,
    )
    expect(() =>
      render(
        createElement(DashPanelProvider, {
          nexus: nexus.scope('nested') as never,
          children: null,
        }),
      ),
    ).toThrow('DashPanelProvider requires a root Nexus')
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('defaults the Provider id and rejects duplicate active Providers', () => {
    const nexus = makeNexus()
    const first = render(panel(nexus))
    expect(() => render(panel(nexus, undefined, 'other'))).toThrow(/duplicate-provider/)
    act(() => first.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('propagates root and scoped Nexus context, and nests relationships by scope', () => {
    const nexus = makeNexus()
    function Probe() {
      const root = usePicodashRootNexus()
      const scope = usePicodashScope()
      return createElement(
        'output',
        { 'data-scope': scope.scopeId },
        root === scope.root ? 'root' : 'wrong',
      )
    }
    const renderer = render(panel(nexus, createElement(Probe)))
    const output = renderer.root.findByType('output')
    expect(output.props['data-scope']).toBe('panel')
    expect(output.children).toEqual(['root'])
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('resets Nexus ancestry for nested Providers and tears down safely in Strict Mode', () => {
    const nexus = makeNexus()
    function Probe() {
      return createElement('output', { 'data-scope': usePicodashScope().scopeId })
    }
    const nested = createElement(DashPanelProvider, {
      nexus,
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
          nexus,
          children: createElement(DashPanel, { id: 'outer', title: 'Outer', children: nested }),
        }),
      ),
    )
    expect(renderer.root.findByType('output').props['data-scope']).toBe('inner')
    expect(() => nexus.destroy()).toThrow(/root-has-active-leases/)
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('publishes frozen default Provider policy without adding DOM or Nexus behavior', () => {
    const nexus = makeNexus()
    let observed!: DashPanelProviderPolicy
    function Probe() {
      observed = useDashPanelProviderPolicy()
      return createElement('section', { 'data-policy-probe': true }, 'content')
    }
    const renderer = render(
      createElement(DashPanelProvider, { nexus, children: createElement(Probe) }),
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
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('retains boundary identity, validates live refs, and publishes dynamic policy synchronously', () => {
    const nexus = makeNexus()
    const boundaryRef = { current: null as Element | null }
    let observed!: DashPanelProviderPolicy
    function Probe() {
      observed = useDashPanelProviderPolicy()
      return null
    }
    const makeProvider = (boundaryInset: unknown, dockPositions: unknown) =>
      createElement(DashPanelProvider, {
        nexus,
        boundary: boundaryRef,
        boundaryInset: boundaryInset as never,
        dockPositions: dockPositions as never,
        children: createElement(Probe),
      })
    let renderer = render(makeProvider([1, 2], ['center-bottom', 'top-left', 'center-bottom']))
    expect(observed.boundary).toBe(boundaryRef)
    expect(observed.boundaryInset).toEqual({ top: 1, right: 2, bottom: 1, left: 2 })
    expect(observed.dockPositions).toEqual(['top-left', 'center-bottom'])

    const element = createMockElement()
    boundaryRef.current = element
    act(() => renderer.update(makeProvider([3, 4, 5], [])))
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
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('resets policy at nested Providers and keeps nearest context', () => {
    const nexus = makeNexus()
    const outerBoundary = createMockElement()
    const observed = new Map<string, DashPanelProviderPolicy>()
    function Probe({ name }: { name: string }) {
      observed.set(name, useDashPanelProviderPolicy())
      return null
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
        boundary: outerBoundary,
        boundaryInset: 8,
        dockPositions: ['top-left'],
        children: createElement(
          'div',
          null,
          createElement(Probe, { name: 'outer' }),
          createElement(DashPanelProvider, {
            nexus,
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
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('accepts an explicit empty dock set and rejects invalid policy representatives', () => {
    const emptyNexus = makeNexus()
    let emptyObserved!: DashPanelProviderPolicy
    function EmptyProbe() {
      emptyObserved = useDashPanelProviderPolicy()
      return null
    }
    const emptyRenderer = render(
      createElement(DashPanelProvider, {
        nexus: emptyNexus,
        dockPositions: [],
        children: createElement(EmptyProbe),
      }),
    )
    expect(emptyObserved.dockPositions).toEqual([])
    act(() => emptyRenderer.unmount())
    expect(() => emptyNexus.destroy()).not.toThrow()

    const invalid: Array<Record<string, unknown>> = [
      { boundary: '#selector' },
      { boundary: { current: 'invalid' } },
      { boundaryInset: null },
      { boundaryInset: [-1] },
      { dockPositions: ['middle-left'] },
    ]
    for (const policyProps of invalid) {
      const nexus = makeNexus()
      const props = { nexus, ...policyProps, children: null } as never
      expect(() => render(createElement(DashPanelProvider, props))).toThrow(TypeError)
      expect(() => nexus.destroy()).not.toThrow()
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
    const nexus = makeNexus()
    const providerBoundary = createMockElement()
    const panelBoundary = createMockElement()
    let observed!: DashPanelPolicy
    function Probe() {
      observed = useDashPanelPolicy()
      return null
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
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

    act(() =>
      renderer.update(
        createElement(DashPanelProvider, {
          nexus,
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
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('keeps Panel and Provider boundary refs live without rerendering', () => {
    const nexus = makeNexus()
    const providerRef = { current: null as Element | null }
    const panelRef = { current: null as Element | null }
    let observed!: DashPanelPolicy
    function Probe() {
      observed = useDashPanelPolicy()
      return null
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
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
    const panelElement = createMockElement()
    const providerElement = createMockElement()
    panelRef.current = panelElement
    expect(observed.getBoundary()).toBe(panelElement)
    panelRef.current = null
    expect(observed.getBoundary()).toBeNull()
    providerRef.current = providerElement
    expect(observed.getBoundary()).toBe(providerElement)
    panelRef.current = panelElement
    expect(observed.getBoundary()).toBe(panelElement)
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
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
      const nexus = makeNexus()
      const props = {
        nexus,
        dockPositions: ['top-left'] as const,
        children: createElement(DashPanel, {
          id: 'invalid-policy',
          title: 'Invalid policy',
          children: null,
          ...policyProps,
        }),
      } as never
      expect(() => render(createElement(DashPanelProvider, props))).toThrow(TypeError)
      expect(() => nexus.destroy()).not.toThrow()
    }
  })

  it('uses Provider defaults for nested Panels and resets at nested Providers', () => {
    const nexus = makeNexus()
    const outerBoundary = createMockElement()
    const observed = new Map<string, DashPanelPolicy>()
    function Probe({ name }: { name: string }) {
      observed.set(name, useDashPanelPolicy())
      return null
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
        boundary: outerBoundary,
        boundaryInset: 8,
        dockPositions: ['top-left'],
        children: createElement(DashPanel, {
          id: 'outer-policy',
          title: 'Outer policy',
          boundary: createMockElement(),
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
              nexus,
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
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rejects the private Panel policy hook outside an active Panel', () => {
    function Probe() {
      useDashPanelPolicy()
      return null
    }
    const nexus = makeNexus()
    expect(() =>
      render(createElement(DashPanelProvider, { nexus, children: createElement(Probe) })),
    ).toThrow('DashPanel policy requires an active DashPanel')
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('renders a named semantic aside with visible heading, arbitrary children, and no scope DOM id', () => {
    const nexus = makeNexus()
    const ref = { current: null as HTMLElement | null }
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
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
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('requires aria-label for non-text titles', () => {
    const nexus = makeNexus()
    expect(() =>
      render(
        createElement(DashPanelProvider, {
          nexus,
          children: createElement(DashPanel, {
            id: 'icon',
            title: createElement('span', null, 'I'),
          }),
        }),
      ),
    ).toThrow('DashPanel non-text titles require an explicit aria-label')
    expect(() => nexus.destroy()).not.toThrow()

    const labelledNexus = makeNexus()
    const labelled = render(
      createElement(DashPanelProvider, {
        nexus: labelledNexus,
        providerId: 'labelled',
        children: createElement(DashPanel, {
          id: 'icon',
          title: createElement('span', null, 'I'),
          'aria-label': 'Inspector',
        }),
      }),
    )
    expect(labelled.root.findByType('aside').props['aria-label']).toBe('Inspector')
    act(() => labelled.unmount())
    expect(() => labelledNexus.destroy()).not.toThrow()

    const blankNexus = makeNexus()
    expect(() =>
      render(
        createElement(DashPanelProvider, {
          nexus: blankNexus,
          providerId: 'blank',
          children: createElement(DashPanel, { id: 'blank', title: [' ', ''] }),
        }),
      ),
    ).toThrow('DashPanel titles require non-empty text or an explicit aria-label')
    expect(() => blankNexus.destroy()).not.toThrow()

    const blankLabelledNexus = makeNexus()
    const blankLabelled = render(
      createElement(DashPanelProvider, {
        nexus: blankLabelledNexus,
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
    act(() => blankLabelled.unmount())
    expect(() => blankLabelledNexus.destroy()).not.toThrow()
  })

  it('writes width to the public token while preserving style and rejects reserved style keys', () => {
    const nexus = makeNexus()
    const customStyle = { opacity: 0.8, '--consumer-token': 'ok' } as DashPanelStyle
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
        children: createElement(DashPanel, {
          id: 'sized',
          title: 'Sized',
          width: '24rem',
          style: customStyle,
        }),
      }),
    )
    expect(renderer.root.findByType('aside').props.style).toMatchObject({
      opacity: 0.8,
      '--consumer-token': 'ok',
      '--picodash-panel-width': '24rem',
    })
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()

    for (const reserved of [
      'width',
      'inlineSize',
      'maxInlineSize',
      'blockSize',
      'maxBlockSize',
      'minWidth',
      'minInlineSize',
      'minHeight',
      'minBlockSize',
    ] as const) {
      const next = makeNexus()
      expect(() =>
        render(
          createElement(DashPanelProvider, {
            nexus: next,
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
    const nexus = makeNexus()
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
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
      (node: DomTestInstance) => node.props['data-picodash-theme'] !== undefined,
    )
    expect(
      carriers.map((node: DomTestInstance) => [
        node.props['data-picodash-theme'],
        node.props['data-picodash-density'],
      ]),
    ).toEqual([
      ['light', 'regular'],
      ['dark', 'compact'],
    ])
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('renders an expanded collapsible Panel with its accessible control and body relationship', () => {
    const nexus = makeNexus()
    const renderer = render(panel(nexus))
    const aside = renderer.root.findByType('aside')
    const header = renderer.root.findByProps({ 'data-picodash-panel-drag-surface': true })
    const button = renderer.root.findByProps({ 'aria-label': 'Collapse panel Inspector' })
    const move = renderer.root.findByProps({ 'aria-label': 'Move panel Inspector' })
    const body = renderer.root.findByProps({ 'data-picodash-panel-body': true })
    expect(aside.props['data-collapsed']).toBe('false')
    expect(header.props.onPointerDown).toBeTypeOf('function')
    expect(move.props['data-icon-only']).toBeUndefined()
    expect(button.props).toMatchObject({
      'aria-label': 'Collapse panel Inspector',
      'aria-expanded': true,
      'aria-controls': body.props.id,
    })
    expect(button.element.querySelector('svg')?.getAttribute('data-expanded')).toBe('true')
    expect(body.props.hidden).toBe(false)
    expect(body.props.inert).toBeUndefined()
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('keeps collapsed children mounted and inert while preserving their state across expand', () => {
    const nexus = makeNexus()
    let nextToken = 0
    function Child() {
      const [token] = useState(() => ++nextToken)
      return createElement('output', { 'data-child': true }, `child-state-${token}`)
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
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
    expect(() => nexus.destroy()).toThrow(/root-has-active-leases/)
    pressButton(button)
    expect(renderer.root.findByType('aside').props['data-collapsed']).toBe('false')
    expect(renderer.root.findByProps({ 'data-picodash-panel-body': true }).props.hidden).toBe(false)
    expect(renderer.root.findByProps({ 'data-child': true }).children[0]).toBe(childToken)
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('retracts a docked Panel behind a detached, direction-aware Reveal control', () => {
    const nexus = makeNexus()
    let runtime!: ReturnType<typeof useDashPanelRuntime>
    function Probe() {
      runtime = useDashPanelRuntime()
      return null
    }
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
        children: createElement(DashPanel, {
          id: 'docked-collapse',
          title: 'Inspector',
          defaultLayout: {
            placement: {
              mode: 'fixed',
              disposition: { kind: 'docked', position: 'bottom-left' },
            },
          },
          children: createElement(
            'div',
            { 'data-child': true },
            createElement(Probe),
            'Retained content',
          ),
        }),
      }),
    )

    const aside = renderer.root.findByType('aside')
    const minimize = renderer.root.findByProps({ 'aria-label': 'Minimize panel Inspector' })
    const revealCarrier = renderer.root.findByProps({ 'data-picodash-panel-reveal': true })
    const reveal = renderer.root.findByProps({ 'aria-label': 'Reveal panel Inspector' })
    expect(
      minimize.element.querySelector('svg')?.getAttribute('data-picodash-arrow-direction'),
    ).toBe('down-left')
    expect(revealCarrier.props).toMatchObject({
      'aria-hidden': true,
      'data-picodash-boundary-contact': 'bottom-left',
      'data-visible': 'false',
      inert: true,
    })
    expect(reveal.props.isDisabled).toBe(true)
    expect(reveal.element.querySelector('svg')?.getAttribute('data-picodash-arrow-direction')).toBe(
      'down-left',
    )
    pressButton(minimize)

    expect(aside.props).toMatchObject({
      'aria-hidden': true,
      'data-picodash-docked-minimized': 'true',
      inert: true,
    })
    expect(aside.props.style).toMatchObject({
      opacity: 0,
      transform: 'translate3d(-100%, 100%, 0)',
    })
    const body = renderer.root.findByProps({ 'data-picodash-panel-body': true })
    expect(body.props.hidden).toBe(false)
    expect(body.props.inert).toBe(true)
    expect(renderer.root.findByProps({ 'data-child': true })).toBeDefined()

    expect(revealCarrier.props).toMatchObject({
      'aria-hidden': undefined,
      'data-visible': 'true',
      inert: undefined,
    })
    expect(reveal.props.isDisabled).not.toBe(true)
    expect(reveal.element.querySelector('svg')?.getAttribute('data-picodash-arrow-direction')).toBe(
      'up-right',
    )
    act(() => {
      expect(runtime.hide('docked-collapse').status).toBe('executed')
    })
    expect(aside.props.hidden).toBe(true)
    expect(revealCarrier.props).toMatchObject({
      'aria-hidden': true,
      'data-visible': 'false',
      inert: true,
    })
    expect(reveal.props.isDisabled).toBe(true)
    act(() => {
      expect(runtime.show('docked-collapse').status).toBe('executed')
    })
    expect(revealCarrier.props).toMatchObject({
      'aria-hidden': undefined,
      'data-visible': 'true',
      inert: undefined,
    })
    expect(reveal.props.isDisabled).not.toBe(true)
    pressButton(reveal)
    expect(renderer.root.findByType('aside').props).toMatchObject({
      'data-collapsed': 'false',
      'data-picodash-docked-minimized': undefined,
      inert: undefined,
    })
    expect(revealCarrier.props).toMatchObject({
      'aria-hidden': true,
      'data-visible': 'false',
      inert: true,
    })
    expect(reveal.props.isDisabled).toBe(true)
    expect(reveal.element.querySelector('svg')?.getAttribute('data-picodash-arrow-direction')).toBe(
      'down-left',
    )

    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('calls the collapse callback only for committed transitions and ignores default changes after mount', () => {
    const nexus = makeNexus()
    const callback = vi.fn()
    let renderer = render(
      createElement(DashPanelProvider, {
        nexus,
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
    act(() =>
      renderer.update(
        createElement(DashPanelProvider, {
          nexus,
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
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('uses the latest callback and expands when dynamic collapsibility is disabled', () => {
    const nexus = makeNexus()
    const initialCallback = vi.fn()
    const latestCallback = vi.fn()
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
        children: createElement(DashPanel, {
          id: 'dynamic',
          title: 'Inspector',
          defaultCollapsed: true,
          onCollapsedChange: initialCallback,
        }),
      }),
    )
    act(() =>
      renderer.update(
        createElement(DashPanelProvider, {
          nexus,
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
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rejects invalid initial collapse policy before acquiring runtime or Nexus leases', () => {
    const nexus = makeNexus()
    expect(() =>
      render(
        createElement(DashPanelProvider, {
          nexus,
          children: createElement(DashPanel, {
            id: 'invalid-collapse',
            title: 'Inspector',
            defaultCollapsed: true,
            collapsible: false,
          }),
        }),
      ),
    ).toThrow('non-collapsible Panel cannot start collapsed')
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('isolates equal scope ids across nested Providers with separate roots', () => {
    const outerNexus = makeNexus()
    const innerNexus = makeNexus()
    const nested = createElement(DashPanelProvider, {
      nexus: innerNexus,
      providerId: 'inner',
      children: createElement(DashPanel, { id: 'shared', title: 'Inner' }),
    })
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus: outerNexus,
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
    const outerHeading = renderer.root
      .findAllByType('h2')
      .find((heading) => heading.props.children === 'Outer')!
    const innerHeading = renderer.root
      .findAllByType('h2')
      .find((heading) => heading.props.children === 'Inner')!
    expect(
      renderer.root.findByProps({ 'aria-labelledby': outerHeading.props.id }).props[
        'data-collapsed'
      ],
    ).toBe('true')
    expect(
      renderer.root.findByProps({ 'aria-labelledby': innerHeading.props.id }).props[
        'data-collapsed'
      ],
    ).toBe('false')
    act(() => renderer.unmount())
    expect(() => outerNexus.destroy()).not.toThrow()
    expect(() => innerNexus.destroy()).not.toThrow()
  })

  it('hides without unmounting, restores retained child state, and reopens from a trigger', () => {
    const nexus = makeNexus()
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
        nexus,
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
        .findAllByType('button')
        .find((button) => button.props.children === 'Open Inspector')!,
    )
    expect(aside.props.hidden).toBe(false)
    expect(aside.props['data-active']).toBe('true')
    expect(
      renderer.root.findByProps({ 'aria-label': 'Increment retained state' }).children,
    ).toEqual(['1'])
    expect(visibility).toHaveBeenLastCalledWith(true)
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('projects active state onto the highest visible panel', () => {
    const nexus = makeNexus()
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
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
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('raises the most recently focused Panel or the Panel where pointer interaction starts', async () => {
    const nexus = makeNexus()
    const onPointerDownCapture = vi.fn()
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
        children: [
          createElement(DashPanel, {
            key: 'first',
            id: 'first',
            title: 'First',
            onPointerDownCapture,
          }),
          createElement(DashPanel, { key: 'second', id: 'second', title: 'Second' }),
        ],
      }),
    )
    let asides = renderer.root.findAllByType('aside')
    await act(async () => asides[0]?.props.onPointerDownCapture({}))
    asides = renderer.root.findAllByType('aside')
    expect(onPointerDownCapture).toHaveBeenCalledOnce()
    expect(asides[0]?.props['data-active']).toBe('true')
    expect(asides[1]?.props['data-active']).toBeUndefined()

    await act(async () => asides[1]?.props.onFocusCapture({ relatedTarget: null }))
    asides = renderer.root.findAllByType('aside')
    expect(asides[0]?.props['data-active']).toBeUndefined()
    expect(asides[1]?.props['data-active']).toBe('true')
    await act(async () => renderer.unmount())
    nexus.destroy()
  })

  it('focuses an already-visible Panel when show activates it', () => {
    const nexus = makeNexus()
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
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
      renderer.root
        .findAllByType('button')
        .find((button) => button.props.children === 'Show First')!,
    )
    expect(renderer.root.findAllByType('aside')[0]?.props['data-active']).toBe('true')
    expect(scheduleFocus).toHaveBeenCalledOnce()
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('seeds hidden visibility without focus and disables unavailable launcher targets', () => {
    const nexus = makeNexus()
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
        children: [
          createElement(DashPanelLauncher, {
            key: 'launcher',
            label: 'Panels',
            items: [
              { panelId: 'hidden', label: 'Hidden panel' },
              { panelId: 'missing', label: 'Missing panel' },
              {
                panelId: 'missing-icon',
                label: createElement('span', { 'aria-hidden': true }, 'H'),
                accessibleName: 'Unavailable panel icon',
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
    const buttons = renderer.root.findAllByType('button')
    const hiddenTrigger = buttons.find((button) => button.props.children === 'Hidden panel')!
    const missingTrigger = buttons.find((button) => button.props.children === 'Missing panel')!
    expect(hiddenTrigger.props.isDisabled).toBeFalsy()
    expect(missingTrigger.props.isDisabled).toBe(true)
    expect(
      buttons.find((button) => button.props['aria-label'] === 'Unavailable panel icon'),
    ).toBeTruthy()
    pressButton(hiddenTrigger)
    expect(renderer.root.findByType('aside').props.hidden).toBe(false)
    act(() => renderer.unmount())
  })

  it('preserves launcher trigger identity when panel targets reorder', () => {
    const nexus = makeNexus()
    const launcher = (items: ComponentProps<typeof DashPanelLauncher>['items']) =>
      createElement(DashPanelProvider, {
        nexus,
        children: [
          createElement(DashPanelLauncher, { key: 'launcher', label: 'Panels', items }),
          createElement(DashPanel, { key: 'first', id: 'first', title: 'First' }),
          createElement(DashPanel, { key: 'second', id: 'second', title: 'Second' }),
        ],
      })
    const first = { itemId: 'second', panelId: 'first', label: 'First panel' }
    const second = { panelId: 'second', label: 'Second panel' }
    const firstIcon = {
      itemId: 'first-icon',
      panelId: 'first',
      label: createElement('span', { 'aria-hidden': true }, 'F'),
      accessibleName: 'First panel icon',
    }
    const renderer = render(launcher([first, second, firstIcon]))
    const secondTrigger = renderer.root.findByProps({ children: 'Second panel' }).element
    const iconTrigger = renderer.root.findByProps({ 'aria-label': 'First panel icon' }).element
    act(() => iconTrigger.focus())

    act(() => renderer.update(launcher([firstIcon, first, second])))

    expect(renderer.root.findByProps({ children: 'Second panel' }).element).toBe(secondTrigger)
    expect(renderer.root.findByProps({ 'aria-label': 'First panel icon' }).element).toBe(
      iconTrigger,
    )
    expect(document.activeElement).toBe(iconTrigger)
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('restores focus after a committed visibility callback throws', () => {
    const nexus = makeNexus()
    const boundary = createMockElement()
    const renderer = render(
      createElement(DashPanelProvider, {
        nexus,
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
    const close = renderer.root.findByProps({ 'aria-label': 'Close panel Throwing visibility' })
    expect(() =>
      act(() =>
        close.rawProps.onClick({
          button: 0,
          currentTarget: close.element,
          target: close.element,
          nativeEvent: { detail: 0, pointerType: '' },
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        }),
      ),
    ).toThrow('visibility callback failed')
    expect(document.activeElement).toBe(boundary)
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('rejects invalid launcher labels and item identities', () => {
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
    expect(() =>
      render(
        createElement(DashPanelLauncher, {
          label: 'Panels',
          items: [
            { panelId: 'repeated', label: 'First trigger' },
            { panelId: 'repeated', label: 'Second trigger' },
          ],
        }),
      ),
    ).toThrowError('DashPanelLauncher items with repeated panelId values require itemId.')
    expect(() =>
      render(
        createElement(DashPanelLauncher, {
          label: 'Panels',
          items: [
            { itemId: 'duplicate', panelId: 'first', label: 'First trigger' },
            { itemId: 'duplicate', panelId: 'second', label: 'Second trigger' },
          ],
        }),
      ),
    ).toThrowError('DashPanelLauncher items require unique itemId values.')
    expect(() =>
      render(
        createElement(DashPanelLauncher, {
          label: 'Panels',
          items: [{ itemId: '   ', panelId: 'blank-item', label: 'Blank item ID' }],
        }),
      ),
    ).toThrowError('DashPanelLauncher itemId must not be empty.')
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

  it('keeps the Nexus contract error type visible for provider conflicts', () => {
    const nexus = makeNexus()
    const first = render(panel(nexus))
    try {
      render(panel(nexus, undefined, 'other'))
    } catch (error) {
      expect(error).toBeInstanceOf(PicodashContractError)
    }
    act(() => first.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })
})
