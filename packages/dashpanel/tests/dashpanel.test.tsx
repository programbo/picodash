import { createElement, StrictMode, type ReactElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it } from 'vite-plus/test'
import { createPicodashStore, PicodashContractError } from '@picodash/store'
import { usePicodashRootStore, usePicodashScope } from '@picodash/store/react'
import { DashPanel, DashPanelProvider, type DashPanelStyle } from '../src/index.tsx'

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

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

describe('@picodash/dashpanel alpha shell', () => {
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
    expect(aside.props['aria-labelledby']).toBe(heading.props.id)
    expect(heading.children).toEqual(['Inspector'])
    expect(renderer.root.findByType('button').children).toEqual(['Apply'])
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
    ])
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
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
