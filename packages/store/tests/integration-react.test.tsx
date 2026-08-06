import { createElement, StrictMode, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it } from 'vite-plus/test'
import { createPicodashStore, PicodashContractError } from '../src/index.ts'
import { PicodashStoreEntityBoundary, PicodashStoreProviderBoundary } from '../src/integration.ts'
import {
  usePicodashRootSelector,
  usePicodashRootStore,
  usePicodashScope,
  usePicodashScopeSelector,
  usePicodashStore,
} from '../src/react.ts'

const makeStore = () =>
  createPicodashStore({
    valueOwner: 'store',
    fields: { count: { defaultValue: 0 }, label: { defaultValue: 'initial' } },
  })

const render = (element: ReactElement): ReactTestRenderer => {
  let renderer!: ReactTestRenderer
  void act(() => {
    renderer = create(element)
  })
  return renderer
}

const expectContract = (run: () => unknown, code: string, context: Record<string, string>) => {
  try {
    run()
    throw new Error('expected failure')
  } catch (error) {
    expect(error).toBeInstanceOf(PicodashContractError)
    expect((error as PicodashContractError).code).toBe(code)
    expect((error as PicodashContractError).context).toEqual(context)
  }
}

describe('Store React boundaries and contextual hooks', () => {
  it('provides root and scoped context through committed boundaries', () => {
    const store = makeStore()
    function Probe() {
      const root = usePicodashRootStore()
      const nearest = usePicodashStore()
      const scope = usePicodashScope()
      return createElement('output', null, `${root.kind}:${nearest.kind}:${scope.scopeId}`)
    }
    const renderer = render(
      createElement(PicodashStoreProviderBoundary, {
        store,
        children: createElement(PicodashStoreEntityBoundary, {
          store: store.scope('settings'),
          kind: 'dashList',
          children: createElement(Probe),
        }),
      }),
    )
    expect(renderer.toJSON()).toMatchObject({ type: 'output', children: ['root:scoped:settings'] })
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('opts a rootless DashList boundary into standalone hosting', () => {
    const store = makeStore()
    function Probe() {
      const root = usePicodashRootStore()
      const nearest = usePicodashStore()
      const scope = usePicodashScope()
      return createElement('output', null, `${root.kind}:${nearest.kind}:${scope.scopeId}`)
    }
    const renderer = render(
      createElement(PicodashStoreEntityBoundary, {
        store: store.scope('standalone'),
        kind: 'dashList',
        allowStandalone: true,
        children: createElement(Probe),
      }),
    )
    expect(renderer.toJSON()).toMatchObject({
      type: 'output',
      children: ['root:scoped:standalone'],
    })
    expect(() => store.destroy()).toThrow()
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('traverses standalone descendants and preserves the nearest scope', () => {
    const store = makeStore()
    let scopeId = ''
    function Probe() {
      scopeId = usePicodashScope().scopeId
      return null
    }
    const renderer = render(
      createElement(PicodashStoreEntityBoundary, {
        store: store.scope('root'),
        kind: 'dashList',
        allowStandalone: true,
        children: createElement(PicodashStoreEntityBoundary, {
          store: store.scope('child'),
          kind: 'dashList',
          children: createElement(Probe),
        }),
      }),
    )
    expect(scopeId).toBe('child')
    expect(() => store.destroy()).toThrow()
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('rejects same-scope nested standalone entities exactly', () => {
    const store = makeStore()
    expectContract(
      () =>
        render(
          createElement(PicodashStoreEntityBoundary, {
            store: store.scope('same'),
            kind: 'dashList',
            allowStandalone: true,
            children: createElement(PicodashStoreEntityBoundary, {
              store: store.scope('same'),
              kind: 'dashList',
              children: null,
            }),
          }),
        ),
      'duplicate-entity',
      { scopeId: 'same', entityKind: 'dashList' },
    )
    expect(() => store.destroy()).not.toThrow()
  })

  it('ignores standalone opt-in inside an inherited Provider host', () => {
    const store = makeStore()
    const renderer = render(
      createElement(PicodashStoreProviderBoundary, {
        store,
        children: createElement(PicodashStoreEntityBoundary, {
          store: store.scope('provided'),
          kind: 'dashList',
          allowStandalone: true,
          children: null,
        }),
      }),
    )
    expect(() => store.destroy()).toThrow()
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('rejects standalone and Provider host conflicts without leaking leases', () => {
    const store = makeStore()
    const standalone = render(
      createElement(PicodashStoreEntityBoundary, {
        store: store.scope('shared'),
        kind: 'dashList',
        allowStandalone: true,
        children: null,
      }),
    )
    expectContract(
      () =>
        render(
          createElement(PicodashStoreProviderBoundary, {
            store,
            providerId: 'conflict',
            children: createElement(PicodashStoreEntityBoundary, {
              store: store.scope('shared'),
              kind: 'dashPanel',
              children: null,
            }),
          }),
        ),
      'scope-host-conflict',
      { scopeId: 'shared' },
    )
    void act(() => standalone.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('rejects a direct DashPanel child under standalone DashList with exact context', () => {
    const store = makeStore()
    expectContract(
      () =>
        render(
          createElement(PicodashStoreEntityBoundary, {
            store: store.scope('root'),
            kind: 'dashList',
            allowStandalone: true,
            children: createElement(PicodashStoreEntityBoundary, {
              store: store.scope('panel'),
              kind: 'dashPanel',
              children: null,
            }),
          }),
        ),
      'invalid-integration-handle',
      { role: 'host', reason: 'wrong-kind' },
    )
    expect(() => store.destroy()).not.toThrow()
  })

  it('rolls back a foreign standalone root after commit', () => {
    const first = makeStore()
    const second = makeStore()
    expectContract(
      () =>
        render(
          createElement(PicodashStoreEntityBoundary, {
            store: first.scope('root'),
            kind: 'dashList',
            allowStandalone: true,
            children: createElement(PicodashStoreEntityBoundary, {
              store: second.scope('foreign'),
              kind: 'dashList',
              children: null,
            }),
          }),
        ),
      'invalid-integration-handle',
      { role: 'host', reason: 'foreign-root' },
    )
    expect(() => first.destroy()).not.toThrow()
    expect(() => second.destroy()).not.toThrow()
  })

  it('resolves an explicit scope without creating metadata or a relationship', () => {
    const store = makeStore()
    let resolvedScope = ''
    let nearestKind = ''
    function Probe() {
      nearestKind = usePicodashStore().kind
      resolvedScope = usePicodashStore('selected').scopeId
      return null
    }
    const renderer = render(
      createElement(PicodashStoreProviderBoundary, { store, children: createElement(Probe) }),
    )
    expect(resolvedScope).toBe('selected')
    expect(nearestKind).toBe('root')
    expect(store.getState().scopes.has('selected')).toBe(false)
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('delegates root and scope selectors with equality semantics', () => {
    const store = makeStore()
    let rootRenders = 0
    let scopeRenders = 0
    function RootProbe() {
      rootRenders += 1
      return createElement(
        'output',
        null,
        JSON.stringify(usePicodashRootSelector((state) => state.values.count)),
      )
    }
    function ScopeProbe() {
      scopeRenders += 1
      return createElement(
        'output',
        null,
        JSON.stringify(usePicodashScopeSelector((state) => state.values.label)),
      )
    }
    const renderer = render(
      createElement(PicodashStoreProviderBoundary, {
        store,
        children: createElement(PicodashStoreEntityBoundary, {
          store: store.scope('settings'),
          kind: 'dashList',
          children: [createElement(RootProbe), createElement(ScopeProbe)],
        }),
      }),
    )
    const initialRootRenders = rootRenders
    const initialScopeRenders = scopeRenders
    void act(() => {
      store.scope('settings').setDashListRootOrder(['one'])
    })
    expect(rootRenders).toBe(initialRootRenders)
    expect(scopeRenders).toBe(initialScopeRenders)
    void act(() => {
      store.setValues({ count: 1, label: 'updated' })
    })
    expect(rootRenders).toBe(initialRootRenders + 1)
    expect(scopeRenders).toBe(initialScopeRenders + 1)
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('throws exact missing-context errors for hooks and entity boundaries', () => {
    function RootProbe() {
      usePicodashStore()
      return null
    }
    expectContract(() => render(createElement(RootProbe)), 'missing-store-context', {
      required: 'root-or-scoped',
    })

    const store = makeStore()
    function ScopeProbe() {
      usePicodashScope()
      return null
    }
    expectContract(
      () =>
        render(
          createElement(PicodashStoreProviderBoundary, {
            store,
            children: createElement(ScopeProbe),
          }),
        ),
      'missing-store-context',
      { required: 'scoped' },
    )
    expectContract(
      () =>
        render(
          createElement(PicodashStoreEntityBoundary, {
            store: store.scope('outside'),
            kind: 'dashList',
            children: null,
          }),
        ),
      'missing-store-context',
      { required: 'root-or-scoped' },
    )
    expect(() => store.destroy()).not.toThrow()
  })

  it('resets ancestry for a nested same-root Provider', () => {
    const store = makeStore()
    function Probe() {
      return createElement('output', null, usePicodashScope().scopeId)
    }
    const renderer = render(
      createElement(PicodashStoreProviderBoundary, {
        store,
        children: createElement(PicodashStoreEntityBoundary, {
          store: store.scope('outer'),
          kind: 'dashPanel',
          children: createElement(PicodashStoreProviderBoundary, {
            store,
            providerId: 'nested',
            children: createElement(PicodashStoreEntityBoundary, {
              store: store.scope('inner'),
              kind: 'dashList',
              children: createElement(Probe),
            }),
          }),
        }),
      }),
    )
    expect(renderer.toJSON()).toMatchObject({ type: 'output', children: ['inner'] })
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('rejects a foreign-root entity after committed effect setup', () => {
    const first = makeStore()
    const second = makeStore()
    expect(() =>
      render(
        createElement(PicodashStoreProviderBoundary, {
          store: first,
          children: createElement(PicodashStoreEntityBoundary, {
            store: second.scope('foreign'),
            kind: 'dashList',
            children: null,
          }),
        }),
      ),
    ).toThrow(/invalid-integration-handle/)
    expect(() => first.destroy()).not.toThrow()
    expect(() => second.destroy()).not.toThrow()
  })

  it('survives Strict Mode nested effect replay and parent-first cleanup', () => {
    const store = makeStore()
    const renderer = render(
      createElement(
        StrictMode,
        null,
        createElement(PicodashStoreProviderBoundary, {
          store,
          children: createElement(PicodashStoreEntityBoundary, {
            store: store.scope('parent'),
            kind: 'dashPanel',
            children: createElement(PicodashStoreEntityBoundary, {
              store: store.scope('child'),
              kind: 'dashList',
              children: null,
            }),
          }),
        }),
      ),
    )
    expect(() => store.destroy()).toThrow()
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('survives Strict Mode replay for standalone parent and child boundaries', () => {
    const store = makeStore()
    const renderer = render(
      createElement(
        StrictMode,
        null,
        createElement(PicodashStoreEntityBoundary, {
          store: store.scope('strict-root'),
          kind: 'dashList',
          allowStandalone: true,
          children: createElement(PicodashStoreEntityBoundary, {
            store: store.scope('strict-child'),
            kind: 'dashList',
            children: null,
          }),
        }),
      ),
    )
    expect(() => store.destroy()).toThrow()
    void act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('does not acquire during server rendering', () => {
    const store = makeStore()
    const html = renderToStaticMarkup(
      createElement(PicodashStoreProviderBoundary, {
        store,
        children: createElement(PicodashStoreEntityBoundary, {
          store: store.scope('server'),
          kind: 'dashList',
          children: createElement(ServerProbe),
        }),
      }),
    )
    expect(html).toContain('<output>root:server</output>')
    expect(() => store.destroy()).not.toThrow()
  })

  it('does not acquire standalone leases during server rendering', () => {
    const store = makeStore()
    const html = renderToStaticMarkup(
      createElement(PicodashStoreEntityBoundary, {
        store: store.scope('server-standalone'),
        kind: 'dashList',
        allowStandalone: true,
        children: createElement(ServerProbe),
      }),
    )
    expect(html).toContain('<output>root:server-standalone</output>')
    expect(() => store.destroy()).not.toThrow()
  })
})

function ServerProbe() {
  return createElement(
    'output',
    null,
    `${usePicodashRootStore().kind}:${usePicodashScope().scopeId}`,
  )
}
