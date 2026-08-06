import { createElement, Fragment, StrictMode, type ReactElement, type ReactNode } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it } from 'vite-plus/test'
import { createPicodashStore, PicodashContractError } from '@picodash/store'
import { PicodashStoreProviderBoundary } from '@picodash/store/integration'
import { usePicodashScope } from '@picodash/store/react'
import { DashGroup, DashList, Dashlet } from '../src/index.tsx'

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const makeStore = () =>
  createPicodashStore({ valueOwner: 'store', fields: { value: { defaultValue: 0 } } })

function render(element: ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(element)
  })
  return renderer
}

function expectContract(action: () => unknown, code: string, context: Record<string, string>) {
  try {
    action()
    throw new Error(`Expected ${code} contract error.`)
  } catch (error) {
    expect(error).toBeInstanceOf(PicodashContractError)
    expect((error as PicodashContractError).code).toBe(code)
    expect((error as PicodashContractError).context).toEqual(context)
  }
}

describe('@picodash/dashlist alpha shell', () => {
  it('resolves explicit root/scoped Stores and rejects immutable mismatches', () => {
    const store = makeStore()
    const root = render(
      createElement(DashList, {
        id: 'root-list',
        store,
        children: createElement(Dashlet, { id: 'item', label: 'Item' }),
      }),
    )
    expect(root.root.findByProps({ 'data-picodash-dashlist': true })).toBeDefined()
    act(() => {
      root.update(
        createElement(DashList, {
          id: 'root-list',
          store,
          children: createElement(Dashlet, { id: 'item', label: 'Item' }),
        }),
      )
    })
    expect(() =>
      act(() =>
        root.update(
          createElement(DashList, {
            id: 'changed',
            store,
          }),
        ),
      ),
    ).toThrow('DashList Store and id are immutable while mounted.')
    const scoped = render(
      createElement(DashList, {
        id: 'scope',
        store: store.scope('scope'),
      }),
    )
    expect(scoped.root.findByProps({ 'data-picodash-dashlist': true })).toBeDefined()
    expect(() =>
      render(
        createElement(DashList, {
          id: 'different',
          store: store.scope('scope'),
        }),
      ),
    ).toThrow('DashList scoped Store and id must name the same scope.')
    act(() => root.unmount())
    act(() => scoped.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('keeps the context resolution matrix and exact missing-context errors', () => {
    const noContextStore = makeStore()
    expectContract(() => render(createElement(DashList)), 'missing-store-context', {
      required: 'root-or-scoped',
    })
    expect(() => render(createElement(DashList, { store: noContextStore } as never))).toThrow(
      'DashList requires id when resolving a root Store.',
    )
    const scoped = noContextStore.scope('scoped')
    const omitted = render(createElement(DashList, { store: scoped }))
    act(() => omitted.unmount())
    const same = render(createElement(DashList, { store: scoped, id: 'scoped' }))
    expect(() => render(createElement(DashList, { store: scoped, id: 'other' }))).toThrow(
      'DashList scoped Store and id must name the same scope.',
    )
    act(() => same.unmount())
    expect(() => noContextStore.destroy()).not.toThrow()

    const nearestRoot = makeStore()
    expect(() =>
      render(
        createElement(PicodashStoreProviderBoundary, {
          store: nearestRoot,
          children: createElement(DashList),
        }),
      ),
    ).toThrow('DashList requires id when resolving a root Store.')
    expect(() => nearestRoot.destroy()).not.toThrow()
  })

  it('uses nearest Provider/entity context and nested child relationships', () => {
    const store = makeStore()
    function ScopeProbe() {
      return createElement('output', { 'data-scope': usePicodashScope().scopeId })
    }
    const renderer = render(
      createElement(PicodashStoreProviderBoundary, {
        store,
        children: createElement(
          DashList,
          { id: 'primary' },
          createElement(
            Dashlet,
            { id: 'host', label: 'Host' },
            createElement(ScopeProbe),
            createElement(
              DashList,
              { id: 'child' },
              createElement(Dashlet, { id: 'child-item', label: 'Child' }),
            ),
            createElement(DashList, {
              id: 'explicit',
              store: store.scope('explicit'),
              children: createElement(Dashlet, { id: 'explicit-item', label: 'Explicit' }),
            }),
          ),
        ),
      }),
    )
    expect(renderer.root.findByType('output').props['data-scope']).toBe('primary')
    expect(renderer.root.findAllByProps({ 'data-picodash-dashlist': true })).toHaveLength(3)
    act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('retains children and renders neutral/list/group semantics with labels', () => {
    const store = makeStore()
    const renderer = render(
      createElement(DashList, {
        id: 'semantic',
        store,
        title: 'Settings',
        headingLevel: 3,
        children: [
          createElement(
            Fragment,
            null,
            createElement(DashGroup, {
              id: 'group',
              label: 'General',
              children: createElement(Dashlet, {
                id: 'item',
                label: 'Value',
                children: createElement('input', { defaultValue: 'retained' }),
              }),
            }),
          ),
        ],
      }),
    )
    expect(renderer.root.findByType('h3').children).toEqual(['Settings'])
    expect(renderer.root.findAllByProps({ role: 'list' }).length).toBe(2)
    expect(renderer.root.findAllByProps({ role: 'listitem' }).length).toBe(2)
    expect(renderer.root.findByProps({ role: 'status' }).props['aria-live']).toBe('polite')
    expect(renderer.root.findByType('input').props.defaultValue).toBe('retained')
    act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('rejects invalid declarations and non-text labels synchronously', () => {
    const store = makeStore()
    expect(() =>
      render(
        createElement(DashList, {
          id: 'invalid',
          store,
          children: createElement('div', null, 'not a declaration'),
        }),
      ),
    ).toThrow('DashList children cannot be DOM elements or text wrappers.')
    expect(() =>
      render(
        createElement(DashList, {
          id: 'labels',
          store,
          children: createElement(Dashlet, {
            id: 'item',
            label: createElement('span', null, 'Icon'),
          }),
        }),
      ),
    ).toThrow('Dashlet non-text labels require an explicit aria-label.')
    expect(() =>
      render(
        createElement(DashList, {
          id: 'nested',
          store,
          children: createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            children: createElement(DashGroup, { id: 'nested-group', label: 'Nested' }),
          }),
        }),
      ),
    ).toThrow('DashGroup cannot contain another DashGroup.')
    expect(() => store.destroy()).not.toThrow()
  })

  it('accepts custom declarations and explicit non-text accessible labels', () => {
    const store = makeStore()
    function CustomDeclaration({ id }: { readonly id: string }) {
      return createElement(Dashlet, { id, label: 'Custom' }, 'retained')
    }
    const renderer = render(
      createElement(DashList, {
        id: 'custom-list',
        store,
        children: [
          null,
          false,
          createElement(Fragment, null, createElement(CustomDeclaration, { id: 'custom' })),
          createElement(DashGroup, {
            id: 'icon-group',
            label: createElement('span', null, 'Icon'),
            'aria-label': 'Icon group',
            children: createElement(Dashlet, {
              id: 'icon-item',
              label: createElement('span', null, 'Icon'),
              'aria-label': 'Icon item',
            }),
          }),
        ],
      }),
    )
    expect(renderer.root.findAllByProps({ 'data-picodash-dashlet': 'custom' })).toHaveLength(1)
    expect(renderer.root.findByProps({ 'aria-label': 'Icon group' })).toBeDefined()
    expect(renderer.root.findByProps({ 'aria-label': 'Icon item' })).toBeDefined()
    act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('validates hostile heading values and preserves custom theme props', () => {
    const store = makeStore()
    expect(() =>
      render(
        createElement(DashList, {
          id: 'bad-heading',
          store,
          title: 'Bad',
          headingLevel: 7 as never,
        }),
      ),
    ).toThrow('DashList headingLevel must be an integer from 1 through 6.')
    expect(() =>
      render(
        createElement(DashList, {
          id: 'missing-heading',
          store,
          title: 'Missing',
        } as never),
      ),
    ).toThrow('DashList title requires headingLevel.')
    const ref = { current: null as HTMLDivElement | null }
    const renderer = render(
      createElement(DashList, {
        id: 'custom-theme',
        store,
        theme: 'operator',
        ref,
        children: createElement(Dashlet, { id: 'item', label: 'Item' }),
      }),
    )
    expect(renderer.root.findByProps({ 'data-picodash-dashlist': true })).toBeDefined()
    act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('rejects duplicate active Lists and cleans standalone/provider precedence', () => {
    const duplicateStore = makeStore()
    const first = render(createElement(DashList, { id: 'duplicate', store: duplicateStore }))
    expectContract(
      () => render(createElement(DashList, { id: 'duplicate', store: duplicateStore })),
      'duplicate-entity',
      { scopeId: 'duplicate', entityKind: 'dashList' },
    )
    act(() => first.unmount())
    expect(() => duplicateStore.destroy()).not.toThrow()

    const hostedStore = makeStore()
    const standalone = render(createElement(DashList, { id: 'shared', store: hostedStore }))
    expectContract(
      () =>
        render(
          createElement(PicodashStoreProviderBoundary, {
            store: hostedStore,
            children: createElement(DashList, { id: 'shared' }),
          }),
        ),
      'duplicate-entity',
      { scopeId: 'shared', entityKind: 'dashList' },
    )
    act(() => standalone.unmount())
    expect(() => hostedStore.destroy()).not.toThrow()
  })

  it('releases standalone leases under StrictMode and does not acquire during SSR', async () => {
    const store = makeStore()
    const renderer = render(
      createElement(
        StrictMode,
        null,
        createElement(DashList, {
          id: 'strict',
          store,
          children: createElement(Dashlet, { id: 'item', label: 'Item' }),
        }),
      ),
    )
    expect(() => store.destroy()).toThrow(PicodashContractError)
    act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()

    const { renderToString } = await import('react-dom/server')
    const ssrStore = makeStore()
    renderToString(
      createElement(DashList, {
        id: 'ssr',
        store: ssrStore,
        children: createElement(Dashlet, { id: 'item', label: 'Item' }),
      }),
    )
    expect(() => ssrStore.destroy()).not.toThrow()
  })

  it('settles custom forwarding through StrictMode, keyed reparenting, cleanup, and nested Lists', () => {
    const store = makeStore()
    function CustomDeclaration({ id }: { readonly id: string }) {
      return createElement(Dashlet, { id, label: 'Custom' })
    }
    const first = createElement(
      StrictMode,
      null,
      createElement(
        DashList,
        { id: 'lifecycle', store },
        createElement(DashGroup, {
          id: 'first-group',
          label: 'First',
          children: createElement(CustomDeclaration, { id: 'moving', key: 'moving' }),
        }),
        createElement(
          Dashlet,
          { id: 'host', label: 'Host' },
          createElement(DashList, {
            id: 'nested',
            children: createElement(Dashlet, { id: 'independent', label: 'Independent' }),
          }),
        ),
      ),
    )
    const renderer = render(first)
    expect(renderer.root.findAllByProps({ 'data-picodash-dashlet': 'moving' })).toHaveLength(1)
    act(() => {
      renderer.update(
        createElement(
          StrictMode,
          null,
          createElement(
            DashList,
            { id: 'lifecycle', store },
            createElement(DashGroup, {
              id: 'second-group',
              label: 'Second',
              children: createElement(CustomDeclaration, { id: 'moving', key: 'moving' }),
            }),
            createElement(
              Dashlet,
              { id: 'host', label: 'Host' },
              createElement(DashList, {
                id: 'nested',
                children: createElement(Dashlet, { id: 'independent', label: 'Independent' }),
              }),
            ),
          ),
        ),
      )
    })
    expect(renderer.root.findAllByProps({ 'data-picodash-dashlet': 'moving' })).toHaveLength(1)
    act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('reports deterministic declaration agreement failures after commit', () => {
    const failures: Array<{ readonly name: string; readonly children: ReactNode }> = []
    failures.push(
      ...[
        ['not-string', 42],
        ['empty', ''],
        ['surrounding-whitespace', ' item '],
        ['control-character', 'item\n'],
      ].map(([, id]) => ({
        name: 'invalid-node-id',
        children: createElement(Dashlet, { id: id as string, label: 'Invalid' }),
      })),
    )
    function Missing({ id }: { readonly id: string }) {
      void id
      return null
    }
    function Mismatch({ id }: { readonly id: string }) {
      void id
      return createElement(Dashlet, { id: 'actual', label: 'Mismatch' })
    }
    function Multiple({ id }: { readonly id: string }) {
      return [
        createElement(Dashlet, { id, label: 'One', key: 'one' }),
        createElement(Dashlet, { id: `${id}-two`, label: 'Two', key: 'two' }),
      ]
    }
    function Group({ id }: { readonly id: string }) {
      return createElement(DashGroup, { id, label: 'Nested group' })
    }
    failures.push(
      { name: 'missing-registration', children: createElement(Missing, { id: 'missing' }) },
      { name: 'id-mismatch', children: createElement(Mismatch, { id: 'declared' }) },
      { name: 'multiple-registrations', children: createElement(Multiple, { id: 'many' }) },
      {
        name: 'kind-mismatch',
        children: createElement(DashGroup, {
          id: 'parent-group',
          label: 'Parent',
          children: createElement(Group, { id: 'nested-group' }),
        }),
      },
      {
        name: 'nested-node',
        children: createElement(
          Dashlet,
          { id: 'outer', label: 'Outer' },
          createElement(Dashlet, { id: 'inner', label: 'Inner' }),
        ),
      },
      {
        name: 'duplicate-node-id',
        children: [
          createElement(Dashlet, { id: 'duplicate', label: 'Root', key: 'root' }),
          createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            children: createElement(Dashlet, { id: 'duplicate', label: 'Child' }),
            key: 'group',
          }),
        ],
      },
    )

    for (const failure of failures) {
      const store = makeStore()
      expect(() =>
        render(
          createElement(DashList, {
            id: `failure-${failure.name}`,
            store,
            children: failure.children,
          }),
        ),
      ).toThrow(new RegExp(`DashList node registration failed: ${failure.name}`))
    }
  })
})
