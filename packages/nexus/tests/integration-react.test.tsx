// @vitest-environment jsdom
import { act, createElement, StrictMode, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vite-plus/test'
import {
  createDomTestRenderer as create,
  type DomTestRenderer,
} from '../../../test/dom-renderer.ts'
import { createPicodashNexus, PicodashContractError } from '../src/index.ts'
import { PicodashNexusEntityBoundary, PicodashNexusProviderBoundary } from '../src/integration.ts'
import {
  usePicodashRootSelector,
  usePicodashRootNexus,
  usePicodashScope,
  usePicodashScopeSelector,
  usePicodashNexus,
} from '../src/react.ts'

const makeNexus = () =>
  createPicodashNexus({
    valueOwner: 'nexus',
    fields: { count: { defaultValue: 0 }, label: { defaultValue: 'initial' } },
  })

const render = (element: ReactElement): DomTestRenderer => {
  let renderer!: DomTestRenderer
  act(() => {
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

describe('Nexus React boundaries and contextual hooks', () => {
  it('provides root and scoped context through committed boundaries', () => {
    const nexus = makeNexus()
    function Probe() {
      const root = usePicodashRootNexus()
      const nearest = usePicodashNexus()
      const scope = usePicodashScope()
      return createElement('output', null, `${root.kind}:${nearest.kind}:${scope.scopeId}`)
    }
    const renderer = render(
      createElement(PicodashNexusProviderBoundary, {
        nexus,
        children: createElement(PicodashNexusEntityBoundary, {
          nexus: nexus.scope('settings'),
          kind: 'dashList',
          children: createElement(Probe),
        }),
      }),
    )
    expect(renderer.toJSON()).toMatchObject({ type: 'output', children: ['root:scoped:settings'] })
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('opts a rootless DashList boundary into standalone hosting', () => {
    const nexus = makeNexus()
    function Probe() {
      const root = usePicodashRootNexus()
      const nearest = usePicodashNexus()
      const scope = usePicodashScope()
      return createElement('output', null, `${root.kind}:${nearest.kind}:${scope.scopeId}`)
    }
    const renderer = render(
      createElement(PicodashNexusEntityBoundary, {
        nexus: nexus.scope('standalone'),
        kind: 'dashList',
        allowStandalone: true,
        children: createElement(Probe),
      }),
    )
    expect(renderer.toJSON()).toMatchObject({
      type: 'output',
      children: ['root:scoped:standalone'],
    })
    expect(() => nexus.destroy()).toThrow()
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('traverses standalone descendants and preserves the nearest scope', () => {
    const nexus = makeNexus()
    let scopeId = ''
    function Probe() {
      scopeId = usePicodashScope().scopeId
      return null
    }
    const renderer = render(
      createElement(PicodashNexusEntityBoundary, {
        nexus: nexus.scope('root'),
        kind: 'dashList',
        allowStandalone: true,
        children: createElement(PicodashNexusEntityBoundary, {
          nexus: nexus.scope('child'),
          kind: 'dashList',
          children: createElement(Probe),
        }),
      }),
    )
    expect(scopeId).toBe('child')
    expect(() => nexus.destroy()).toThrow()
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rejects same-scope nested standalone entities exactly', () => {
    const nexus = makeNexus()
    expectContract(
      () =>
        render(
          createElement(PicodashNexusEntityBoundary, {
            nexus: nexus.scope('same'),
            kind: 'dashList',
            allowStandalone: true,
            children: createElement(PicodashNexusEntityBoundary, {
              nexus: nexus.scope('same'),
              kind: 'dashList',
              children: null,
            }),
          }),
        ),
      'duplicate-entity',
      { scopeId: 'same', entityKind: 'dashList' },
    )
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('ignores standalone opt-in inside an inherited Provider host', () => {
    const nexus = makeNexus()
    const renderer = render(
      createElement(PicodashNexusProviderBoundary, {
        nexus,
        children: createElement(PicodashNexusEntityBoundary, {
          nexus: nexus.scope('provided'),
          kind: 'dashList',
          allowStandalone: true,
          children: null,
        }),
      }),
    )
    expect(() => nexus.destroy()).toThrow()
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rejects standalone and Provider host conflicts without leaking leases', () => {
    const nexus = makeNexus()
    const standalone = render(
      createElement(PicodashNexusEntityBoundary, {
        nexus: nexus.scope('shared'),
        kind: 'dashList',
        allowStandalone: true,
        children: null,
      }),
    )
    expectContract(
      () =>
        render(
          createElement(PicodashNexusProviderBoundary, {
            nexus,
            providerId: 'conflict',
            children: createElement(PicodashNexusEntityBoundary, {
              nexus: nexus.scope('shared'),
              kind: 'dashPanel',
              children: null,
            }),
          }),
        ),
      'scope-host-conflict',
      { scopeId: 'shared' },
    )
    act(() => standalone.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rejects a direct DashPanel child under standalone DashList with exact context', () => {
    const nexus = makeNexus()
    expectContract(
      () =>
        render(
          createElement(PicodashNexusEntityBoundary, {
            nexus: nexus.scope('root'),
            kind: 'dashList',
            allowStandalone: true,
            children: createElement(PicodashNexusEntityBoundary, {
              nexus: nexus.scope('panel'),
              kind: 'dashPanel',
              children: null,
            }),
          }),
        ),
      'invalid-integration-handle',
      { role: 'host', reason: 'wrong-kind' },
    )
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rolls back a foreign standalone root after commit', () => {
    const first = makeNexus()
    const second = makeNexus()
    expectContract(
      () =>
        render(
          createElement(PicodashNexusEntityBoundary, {
            nexus: first.scope('root'),
            kind: 'dashList',
            allowStandalone: true,
            children: createElement(PicodashNexusEntityBoundary, {
              nexus: second.scope('foreign'),
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
    const nexus = makeNexus()
    let resolvedScope = ''
    let nearestKind = ''
    function Probe() {
      nearestKind = usePicodashNexus().kind
      resolvedScope = usePicodashNexus('selected').scopeId
      return null
    }
    const renderer = render(
      createElement(PicodashNexusProviderBoundary, { nexus, children: createElement(Probe) }),
    )
    expect(resolvedScope).toBe('selected')
    expect(nearestKind).toBe('root')
    expect(nexus.getState().scopes.has('selected')).toBe(false)
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('delegates root and scope selectors with equality semantics', () => {
    const nexus = makeNexus()
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
      createElement(PicodashNexusProviderBoundary, {
        nexus,
        children: createElement(PicodashNexusEntityBoundary, {
          nexus: nexus.scope('settings'),
          kind: 'dashList',
          children: [
            createElement(RootProbe, { key: 'root' }),
            createElement(ScopeProbe, { key: 'scope' }),
          ],
        }),
      }),
    )
    const initialRootRenders = rootRenders
    const initialScopeRenders = scopeRenders
    act(() => {
      nexus.scope('settings').setDashListRootOrder(['one'])
    })
    expect(rootRenders).toBe(initialRootRenders)
    expect(scopeRenders).toBe(initialScopeRenders)
    act(() => {
      nexus.setValues({ count: 1, label: 'updated' })
    })
    expect(rootRenders).toBe(initialRootRenders + 1)
    expect(scopeRenders).toBe(initialScopeRenders + 1)
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('throws exact missing-context errors for hooks and entity boundaries', () => {
    function RootProbe() {
      usePicodashNexus()
      return null
    }
    expectContract(() => render(createElement(RootProbe)), 'missing-nexus-context', {
      required: 'root-or-scoped',
    })

    const nexus = makeNexus()
    function ScopeProbe() {
      usePicodashScope()
      return null
    }
    expectContract(
      () =>
        render(
          createElement(PicodashNexusProviderBoundary, {
            nexus,
            children: createElement(ScopeProbe),
          }),
        ),
      'missing-nexus-context',
      { required: 'scoped' },
    )
    expectContract(
      () =>
        render(
          createElement(PicodashNexusEntityBoundary, {
            nexus: nexus.scope('outside'),
            kind: 'dashList',
            children: null,
          }),
        ),
      'missing-nexus-context',
      { required: 'root-or-scoped' },
    )
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('resets ancestry for a nested same-root Provider', () => {
    const nexus = makeNexus()
    function Probe() {
      return createElement('output', null, usePicodashScope().scopeId)
    }
    const renderer = render(
      createElement(PicodashNexusProviderBoundary, {
        nexus,
        children: createElement(PicodashNexusEntityBoundary, {
          nexus: nexus.scope('outer'),
          kind: 'dashPanel',
          children: createElement(PicodashNexusProviderBoundary, {
            nexus,
            providerId: 'nested',
            children: createElement(PicodashNexusEntityBoundary, {
              nexus: nexus.scope('inner'),
              kind: 'dashList',
              children: createElement(Probe),
            }),
          }),
        }),
      }),
    )
    expect(renderer.toJSON()).toMatchObject({ type: 'output', children: ['inner'] })
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rejects a foreign-root entity after committed effect setup', () => {
    const first = makeNexus()
    const second = makeNexus()
    expect(() =>
      render(
        createElement(PicodashNexusProviderBoundary, {
          nexus: first,
          children: createElement(PicodashNexusEntityBoundary, {
            nexus: second.scope('foreign'),
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
    const nexus = makeNexus()
    const renderer = render(
      createElement(
        StrictMode,
        null,
        createElement(PicodashNexusProviderBoundary, {
          nexus,
          children: createElement(PicodashNexusEntityBoundary, {
            nexus: nexus.scope('parent'),
            kind: 'dashPanel',
            children: createElement(PicodashNexusEntityBoundary, {
              nexus: nexus.scope('child'),
              kind: 'dashList',
              children: null,
            }),
          }),
        }),
      ),
    )
    expect(() => nexus.destroy()).toThrow()
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('survives Strict Mode replay for standalone parent and child boundaries', () => {
    const nexus = makeNexus()
    const renderer = render(
      createElement(
        StrictMode,
        null,
        createElement(PicodashNexusEntityBoundary, {
          nexus: nexus.scope('strict-root'),
          kind: 'dashList',
          allowStandalone: true,
          children: createElement(PicodashNexusEntityBoundary, {
            nexus: nexus.scope('strict-child'),
            kind: 'dashList',
            children: null,
          }),
        }),
      ),
    )
    expect(() => nexus.destroy()).toThrow()
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('does not acquire during server rendering', () => {
    const nexus = makeNexus()
    const html = renderToStaticMarkup(
      createElement(PicodashNexusProviderBoundary, {
        nexus,
        children: createElement(PicodashNexusEntityBoundary, {
          nexus: nexus.scope('server'),
          kind: 'dashList',
          children: createElement(ServerProbe),
        }),
      }),
    )
    expect(html).toContain('<output>root:server</output>')
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('does not acquire standalone leases during server rendering', () => {
    const nexus = makeNexus()
    const html = renderToStaticMarkup(
      createElement(PicodashNexusEntityBoundary, {
        nexus: nexus.scope('server-standalone'),
        kind: 'dashList',
        allowStandalone: true,
        children: createElement(ServerProbe),
      }),
    )
    expect(html).toContain('<output>root:server-standalone</output>')
    expect(() => nexus.destroy()).not.toThrow()
  })
})

function ServerProbe() {
  return createElement(
    'output',
    null,
    `${usePicodashRootNexus().kind}:${usePicodashScope().scopeId}`,
  )
}
