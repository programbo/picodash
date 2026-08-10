import { createElement, Fragment, StrictMode, type ReactElement, type ReactNode } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashStore, PicodashContractError } from '@picodash/store'
import {
  acquireDashListNodeLease,
  PicodashStoreProviderBoundary,
} from '@picodash/store/integration'
import { usePicodashScope } from '@picodash/store/react'
import {
  DashGroup,
  DashList,
  Dashlet,
  useDashListActions,
  type SingleFieldDashletRenderContext,
} from '../src/index.tsx'
import { executeDashListActionIfCurrent } from '../src/actions.tsx'
import {
  acquireRegisteredDashListNodeLease,
  createNodeRegistry,
} from '../src/node-registration.tsx'

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

function ActionProbe({
  capture,
  scopeId,
}: {
  readonly capture: (actions: ReturnType<typeof useDashListActions>) => void
  readonly scopeId?: string
}) {
  const actions = useDashListActions(scopeId)
  capture(actions)
  return null
}

describe('@picodash/dashlist alpha shell', () => {
  it('rolls back private node registration when public lease acquisition fails', () => {
    const store = makeStore()
    const scoped = store.scope('rollback')
    const held = acquireDashListNodeLease(scoped, { nodeId: 'node' })
    const registry = createNodeRegistry()
    const failedToken = {}
    const failedGeneration = registry.register(failedToken, {}, 'dashlet', 'node')

    expect(() =>
      acquireRegisteredDashListNodeLease(registry, failedToken, failedGeneration, scoped, 'node'),
    ).toThrowError(expect.objectContaining({ code: 'duplicate-dash-list-node' }))
    const correctedToken = {}
    registry.register(correctedToken, {}, 'dashlet', 'node')
    expect(registry.getFailure()).toBeNull()

    held.release()
    store.destroy()
  })

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
        'aria-label': 'Explicit settings controls',
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
    expect(renderer.root.findByProps({ 'data-picodash-dashlist-list': true }).props).toMatchObject({
      'aria-label': 'Explicit settings controls',
      'aria-labelledby': undefined,
    })
    expect(renderer.root.findByProps({ role: 'status' }).props['aria-live']).toBe('polite')
    expect(renderer.root.findByType('input').props.defaultValue).toBe('retained')
    act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('resolves durable group collapse metadata without unmounting descendants', () => {
    const store = makeStore()
    const scoped = store.scope('collapse')
    scoped.setDashListCollapseOverride('group', true)
    const renderer = render(
      createElement(
        DashList,
        { id: 'collapse', store },
        createElement(DashGroup, {
          id: 'group',
          label: 'Group',
          children: createElement(
            Dashlet,
            { id: 'item', label: 'Item' },
            createElement('input', { defaultValue: 'retained' }),
          ),
        }),
      ),
    )
    let content = renderer.root.findByProps({ 'data-picodash-dashgroup-list': true })
    expect(content.props).toMatchObject({
      hidden: true,
      inert: true,
      'aria-hidden': true,
    })
    expect(renderer.root.findByProps({ 'data-picodash-dashlet': 'item' })).toBeDefined()
    const disclosure = renderer.root.findByProps({ 'aria-label': 'Expand group Group' })
    expect(disclosure.props['aria-expanded']).toBe(false)

    // Returning to the declared default removes the redundant durable override.
    act(() => {
      void disclosure.props.onClick()
    })
    expect(scoped.getState().scope?.dashList?.collapseOverrides.has('group') ?? false).toBe(false)
    content = renderer.root.findByProps({ 'data-picodash-dashgroup-list': true })
    expect(content.props.hidden).toBeUndefined()

    act(() =>
      renderer.update(
        createElement(
          DashList,
          { id: 'collapse', store },
          createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            defaultCollapsed: true,
            children: createElement(Dashlet, { id: 'item', label: 'Item' }),
          }),
        ),
      ),
    )
    content = renderer.root.findByProps({ 'data-picodash-dashgroup-list': true })
    expect(content.props.hidden).toBe(true)

    // Non-collapsible presentation is expanded while preserving dormant metadata.
    act(() => {
      scoped.setDashListCollapseOverride('group', true)
    })
    act(() =>
      renderer.update(
        createElement(
          DashList,
          { id: 'collapse', store },
          createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            collapsible: false,
            children: createElement(Dashlet, { id: 'item', label: 'Item' }),
          }),
        ),
      ),
    )
    content = renderer.root.findByProps({ 'data-picodash-dashgroup-list': true })
    expect(content.props.hidden).toBeUndefined()
    expect(scoped.getState().scope?.dashList?.collapseOverrides.get('group')).toBe(true)
    expect(renderer.root.findAllByProps({ 'aria-expanded': true })).toHaveLength(0)

    // Content policies do not disable the group disclosure control.
    act(() =>
      renderer.update(
        createElement(
          DashList,
          { id: 'collapse', store },
          createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            disabled: true,
            readOnly: true,
            children: createElement(Dashlet, { id: 'item', label: 'Item' }),
          }),
        ),
      ),
    )
    const policyDisclosure = renderer.root.findByProps({ 'aria-label': 'Expand group Group' })
    expect(policyDisclosure.props.disabled).toBeUndefined()
    act(() => {
      void policyDisclosure.props.onClick()
    })
    expect(renderer.root.findByProps({ 'data-picodash-dashgroup-list': true }).props.hidden).toBe(
      undefined,
    )
    act(() => {
      void renderer.root.findByProps({ 'aria-label': 'Collapse group Group' }).props.onClick()
    })
    expect(renderer.root.findByProps({ 'data-picodash-dashgroup-list': true }).props.hidden).toBe(
      true,
    )

    act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('repairs focus to the disclosure before collapsing content', () => {
    const store = makeStore()
    const activeElement = {}
    const documentStub: { activeElement: object } = { activeElement }
    const hiddenWhenFocused: unknown[] = []
    let renderer!: ReactTestRenderer
    const disclosureElement = {
      focus: vi.fn(() => {
        hiddenWhenFocused.push(
          renderer.root.findByProps({ 'data-picodash-dashgroup-list': true }).props.hidden,
        )
        documentStub.activeElement = disclosureElement
      }),
    }
    const content = { contains: vi.fn((element) => element === activeElement) }
    vi.stubGlobal('document', documentStub)
    act(() => {
      renderer = create(
        createElement(
          DashList,
          { id: 'focus-collapse', store },
          createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            children: createElement(Dashlet, { id: 'item', label: 'Item' }),
          }),
        ),
        {
          createNodeMock: (node) => {
            if (node.type === 'button') return disclosureElement
            if (
              node.type === 'div' &&
              (node.props as { readonly 'data-picodash-dashgroup-list'?: boolean })[
                'data-picodash-dashgroup-list'
              ]
            )
              return content
            return null
          },
        },
      )
    })
    const disclosure = renderer.root.findByProps({ 'aria-label': 'Collapse group Group' })
    act(() => {
      void disclosure.props.onClick()
    })
    expect(disclosureElement.focus).toHaveBeenCalledTimes(1)
    expect(renderer.root.findByProps({ 'data-picodash-dashgroup-list': true }).props.hidden).toBe(
      true,
    )
    act(() => {
      void renderer.root.findByProps({ 'aria-label': 'Expand group Group' }).props.onClick()
    })
    documentStub.activeElement = activeElement
    act(() => {
      store.scope('focus-collapse').setDashListCollapseOverride('group', true)
    })
    expect(disclosureElement.focus).toHaveBeenCalledTimes(2)
    expect(hiddenWhenFocused).toEqual([undefined, undefined])
    act(() => renderer.unmount())
    vi.unstubAllGlobals()
    expect(() => store.destroy()).not.toThrow()
  })

  it('exposes stable actions with atomic collapse, stale recheck, and value/list resets', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      initialValues: { value: 5 },
      fields: {
        value: {
          defaultValue: 0,
          parse: (input: unknown) =>
            typeof input === 'number'
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'Draft value rejected.' }] },
        },
      },
    })
    const scoped = store.scope('actions')
    let latest!: ReturnType<typeof useDashListActions>
    const actionHistory: ReturnType<typeof useDashListActions>[] = []
    let binding!: {
      readonly dirty: boolean
      readonly setInput: (value: number) => void
    }
    const renderer = render(
      createElement(
        DashList,
        { id: 'actions', store },
        createElement(DashGroup, {
          id: 'group',
          label: 'Group',
          children: createElement(Dashlet, {
            id: 'item',
            label: 'Item',
            field: store.fields.value as never,
            children(context: SingleFieldDashletRenderContext<number>) {
              binding = context.binding
              return createElement(ActionProbe, {
                scopeId: 'actions',
                capture: (actions) => {
                  latest = actions
                  actionHistory.push(actions)
                },
              })
            },
          }),
        }),
      ),
    )
    expect(latest.collapseAll.availability).toBe('enabled')
    expect(latest.expandAll.availability).toBe('disabled')
    expect(latest.resetValues.availability).toBe('enabled')
    expect(actionHistory.length).toBeGreaterThan(0)
    expect(Reflect.get(actionHistory[0]!.collapseAll, 'execute')).toBe(
      Reflect.get(latest.collapseAll, 'execute'),
    )
    const initialActions = latest
    const stale = latest.collapseAll
    act(() => {
      const result = stale.execute()
      expect(result.status).toBe('executed')
    })
    expect(scoped.getState().scope?.dashList?.collapseOverrides.get('group')).toBe(true)
    expect(latest.expandAll.availability).toBe('enabled')
    expect(latest.collapseAll.availability).toBe('disabled')
    expect(latest.resetValues).toBe(initialActions.resetValues)
    expect(Reflect.get(latest.resetValues, 'execute')).toBe(
      Reflect.get(initialActions.resetValues, 'execute'),
    )

    act(() => {
      scoped.setValue(scoped.fields.value, 5)
    })
    expect(latest.resetValues.availability).toBe('enabled')
    act(() => {
      scoped.resetValue(scoped.fields.value)
    })
    expect(latest.resetValues.availability).toBe('disabled')

    const staleExpand = latest.expandAll
    act(() => {
      scoped.setDashListCollapseOverride('group', false)
    })
    expect(staleExpand.execute()).toEqual({ status: 'not_executed', availability: 'disabled' })

    act(() => binding.setInput('draft' as never))
    expect(scoped.getState().interaction.bindings.size).toBe(1)
    expect(latest.resetValues.availability).toBe('enabled')
    renderer.update(
      createElement(
        DashList,
        { id: 'actions', store },
        createElement(DashGroup, {
          id: 'group',
          label: 'Group',
          children: createElement(Dashlet, {
            id: 'item',
            label: 'Item',
            disabled: true,
            field: store.fields.value as never,
            children(context: SingleFieldDashletRenderContext<number>) {
              binding = context.binding
              return createElement(ActionProbe, {
                scopeId: 'actions',
                capture: (actions) => {
                  latest = actions
                  actionHistory.push(actions)
                },
              })
            },
          }),
        }),
      ),
    )
    expect(binding.dirty).toBe(true)
    scoped.setDashListRootOrder(['group'])
    expect(latest.resetList.availability).toBe('enabled')
    act(() => {
      const result = latest.resetValues.execute()
      expect(result.status).toBe('executed')
    })
    expect(scoped.getState().values.value).toBe(0)
    expect(scoped.getState().interaction.bindings.size).toBe(0)
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['group'])

    act(() => {
      const result = latest.resetList.execute()
      expect(result.status).toBe('executed')
    })
    expect(scoped.getState().scope?.dashList).toBeUndefined()
    expect(scoped.getState().values.value).toBe(0)
    act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('refuses a queued reset callback after its reviewed fingerprint changes', () => {
    const execute = vi.fn(() => ({ status: 'not_executed', availability: 'disabled' }) as const)
    let fingerprint = 'reviewed'
    executeDashListActionIfCurrent(
      { availability: 'enabled', execute },
      {
        fingerprint,
        getFingerprint: () => fingerprint,
        subscribe: () => () => undefined,
      },
    )
    expect(execute).toHaveBeenCalledTimes(1)
    fingerprint = 'changed'
    executeDashListActionIfCurrent(
      { availability: 'enabled', execute },
      {
        fingerprint: 'reviewed',
        getFingerprint: () => fingerprint,
        subscribe: () => () => undefined,
      },
    )
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('announces a rejected built-in value reset', () => {
    let snapshot = { value: 5 }
    let rejectWrites = false
    const listeners = new Set<() => void>()
    const store = createPicodashStore({
      valueOwner: 'external',
      adapter: {
        getSnapshot: () => snapshot,
        subscribe(listener: () => void) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        setValues(next: Readonly<{ value: number }>) {
          if (rejectWrites) throw new Error('adapter rejected reset')
          snapshot = { ...next }
          for (const listener of listeners) listener()
        },
      },
      fields: {
        value: {
          defaultValue: 0,
          parse: (input: unknown) =>
            typeof input === 'number'
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'Expected a number.' }] },
        },
      },
    })
    let latest!: ReturnType<typeof useDashListActions>
    const renderer = render(
      createElement(
        DashList,
        { id: 'rejected-reset', store },
        createElement(Dashlet, {
          id: 'item',
          label: 'Item',
          field: store.fields.value as never,
          children() {
            return createElement(ActionProbe, {
              capture: (actions) => {
                latest = actions
              },
            })
          },
        }),
      ),
    )
    rejectWrites = true
    act(() => {
      const result = latest.resetValues.execute()
      expect(result.status).toBe('executed')
      if (result.status === 'executed') expect(result.result.ok).toBe(false)
    })
    expect(renderer.root.findByProps({ role: 'status' }).children).toEqual([
      'Reset values was rejected.',
    ])
    act(() => renderer.unmount())
    store.destroy()
  })

  it('announces a rejected group disclosure metadata write', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      storeId: 'dashlist-collapse-quarantine',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      initialEnvelope: {
        kind: 'picodash-store-envelope',
        formatVersion: 1,
        storeId: 'dashlist-collapse-quarantine',
        schemaVersion: 1,
        revision: 1,
        writerId: 'fixture',
        valueOwner: 'store',
        values: { value: 1 },
        scopes: [['collapse-quarantine', { dashList: { invalid: true } }]],
      },
    } as never)
    expect(store.metadataRecovery.getState().quarantinedScopes.has('collapse-quarantine')).toBe(
      true,
    )
    const renderer = render(
      createElement(
        DashList,
        { id: 'collapse-quarantine', store },
        createElement(DashGroup, {
          id: 'group',
          label: 'Group',
          children: createElement(Dashlet, { id: 'item', label: 'Item' }),
        }),
      ),
    )
    const disclosure = renderer.root.findByProps({ 'aria-label': 'Collapse group Group' })
    act(() => {
      void disclosure.props.onClick()
    })
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('Group disclosure failed for Group: Scope metadata is quarantined.')
    expect(disclosure.props['aria-expanded']).toBe(true)
    act(() => renderer.unmount())
    store.destroy()
  })

  it('leases committed nodes for active prune exclusion and releases them without auto-delete', () => {
    const store = makeStore()
    const scoped = store.scope('presence')
    scoped.setDashListRootOrder(['active', 'dormant'])
    const renderer = render(
      createElement(
        StrictMode,
        null,
        createElement(
          DashList,
          { id: 'presence', store },
          createElement(Dashlet, { id: 'active', label: 'Active' }),
        ),
      ),
    )
    expect(scoped.createPrunePlan({ mode: 'review' }).candidates).toEqual([
      { nodeId: 'dormant', effects: ['root-order-entry'] },
    ])
    const explicit = scoped.createPrunePlan({
      mode: 'explicit',
      removeNodeIds: ['dormant'],
      keepNodeIds: [],
    })
    expect(scoped.executePrunePlan(explicit)).toMatchObject({ ok: true })
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['active'])

    act(() =>
      renderer.update(
        createElement(
          DashList,
          { id: 'presence', store },
          createElement(Dashlet, { id: 'replacement', label: 'Replacement' }),
        ),
      ),
    )
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['active'])
    expect(scoped.createPrunePlan({ mode: 'review' }).candidates).toEqual([
      { nodeId: 'active', effects: ['root-order-entry'] },
    ])
    const inventory = scoped.createPrunePlan({ mode: 'inventory', knownNodeIds: ['replacement'] })
    expect(scoped.executePrunePlan(inventory)).toMatchObject({ ok: true })
    expect(scoped.getState().scope).toBeUndefined()
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
    let strictActions!: ReturnType<typeof useDashListActions>
    const renderer = render(
      createElement(
        StrictMode,
        null,
        createElement(DashList, {
          id: 'strict',
          store,
          children: createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            children: createElement(Dashlet, {
              id: 'item',
              label: 'Item',
              children: createElement(ActionProbe, {
                capture: (actions) => (strictActions = actions),
              }),
            }),
          }),
        }),
      ),
    )
    expect(strictActions.collapseAll.availability).toBe('enabled')
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
    let ssrActions!: ReturnType<typeof useDashListActions>
    const ssrProbe = render(
      createElement(PicodashStoreProviderBoundary, {
        store: ssrStore,
        children: createElement(ActionProbe, {
          scopeId: 'ssr',
          capture: (actions) => (ssrActions = actions),
        }),
      }),
    )
    expect(ssrActions.expandAll.availability).toBe('unavailable')
    act(() => ssrProbe.unmount())
    expect(() => ssrStore.destroy()).not.toThrow()

    const failedStore = makeStore()
    expect(() =>
      render(
        createElement(
          Fragment,
          null,
          createElement(DashList, { id: 'failed', store: failedStore }),
          createElement(DashList, { id: 'failed', store: failedStore }),
        ),
      ),
    ).toThrow()
    let failedActions!: ReturnType<typeof useDashListActions>
    const failedProbe = render(
      createElement(PicodashStoreProviderBoundary, {
        store: failedStore,
        children: createElement(ActionProbe, {
          scopeId: 'failed',
          capture: (actions) => (failedActions = actions),
        }),
      }),
    )
    expect(failedActions.expandAll.availability).toBe('unavailable')
    act(() => failedProbe.unmount())
    expect(() => failedStore.destroy()).not.toThrow()

    const lateStore = makeStore()
    let lateActions!: ReturnType<typeof useDashListActions>
    const lateProbe = render(
      createElement(PicodashStoreProviderBoundary, {
        store: lateStore,
        children: createElement(ActionProbe, {
          scopeId: 'late',
          capture: (actions) => (lateActions = actions),
        }),
      }),
    )
    expect(lateActions.collapseAll.availability).toBe('unavailable')
    const lateList = render(
      createElement(
        DashList,
        { id: 'late', store: lateStore },
        createElement(DashGroup, { id: 'group', label: 'Group' }),
      ),
    )
    act(() => {})
    expect(lateActions.collapseAll.availability).toBe('enabled')
    act(() => lateList.unmount())
    expect(lateActions.collapseAll.availability).toBe('unavailable')
    act(() => lateProbe.unmount())
    expect(() => lateStore.destroy()).not.toThrow()
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

  it('reorders root siblings with keyboard parity and announces the commit', () => {
    const store = makeStore()
    const scoped = store.scope('order-root')
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-root', store },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    const order = () =>
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet'])
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    const beforePickupPreventDefault = vi.fn()
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault: beforePickupPreventDefault })
      void handle.props.onKeyDown({ key: 'Home', preventDefault: beforePickupPreventDefault })
    })
    expect(beforePickupPreventDefault).not.toHaveBeenCalled()
    expect(order()).toEqual(['first', 'second'])
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('Picked up First, position 1 of 2')
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    expect(order()).toEqual(['second', 'first'])
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('boundary')
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowUp', preventDefault() {} })
    })
    expect(order()).toEqual(['first', 'second'])
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('First moved to position 1 of 2')
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['second', 'first'])
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('Reorder complete: First, position 2 of 2')
    act(() => renderer.unmount())
    store.destroy()
  })

  it('cancels a keyboard reorder when focus leaves its handle', () => {
    const store = makeStore()
    const scoped = store.scope('order-blur')
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-blur', store },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    let first = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void first.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    first = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void first.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    expect(
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet']),
    ).toEqual(['second', 'first'])
    first = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void first.props.onBlur()
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toBeUndefined()
    expect(
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet']),
    ).toEqual(['first', 'second'])
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('cancelled')

    let second = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'second' })
    act(() => {
      void second.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    second = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'second' })
    act(() => {
      void second.props.onKeyDown({ key: 'ArrowUp', preventDefault() {} })
    })
    second = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'second' })
    act(() => {
      void second.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['second', 'first'])
    act(() => renderer.unmount())
    store.destroy()
  })

  it('does not attach another handle pointer to a keyboard reorder session', () => {
    const store = makeStore()
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-modality', store },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    let first = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void first.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    const second = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'second' })
    const preventDefault = vi.fn()
    const setPointerCapture = vi.fn()
    act(() => {
      void second.props.onPointerDown({
        pointerId: 2,
        clientY: 30,
        preventDefault,
        setPointerCapture,
      })
      void second.props.onPointerMove({ pointerId: 2, clientY: 60 })
    })
    expect(preventDefault).not.toHaveBeenCalled()
    expect(setPointerCapture).not.toHaveBeenCalled()
    expect(
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet']),
    ).toEqual(['first', 'second'])

    first = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void first.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    expect(
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet']),
    ).toEqual(['second', 'first'])
    first = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void first.props.onKeyDown({ key: 'Escape', preventDefault() {} })
      renderer.unmount()
    })
    store.destroy()
  })

  it('ignores repeated pickup keys and non-primary pointer buttons', () => {
    const store = makeStore()
    const scoped = store.scope('input-guards')
    const renderer = render(
      createElement(
        DashList,
        { id: 'input-guards', store },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    const repeatedPreventDefault = vi.fn()
    act(() => {
      void handle.props.onKeyDown({ key: 'Enter', repeat: false, preventDefault() {} })
      void handle.props.onKeyDown({
        key: 'Enter',
        repeat: true,
        preventDefault: repeatedPreventDefault,
      })
    })
    expect(repeatedPreventDefault).not.toHaveBeenCalled()
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
      void handle.props.onKeyDown({ key: 'Enter', repeat: false, preventDefault() {} })
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['second', 'first'])

    const setPointerCapture = vi.fn()
    const pointerPreventDefault = vi.fn()
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'second' })
    act(() => {
      void handle.props.onPointerDown({
        button: 2,
        pointerId: 9,
        clientY: 100,
        setPointerCapture,
        preventDefault: pointerPreventDefault,
      })
    })
    expect(setPointerCapture).not.toHaveBeenCalled()
    expect(pointerPreventDefault).not.toHaveBeenCalled()
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('Reorder complete')
    act(() => renderer.unmount())
    store.destroy()
  })

  it('releases the shared reorder coordinator when an active group unmounts', () => {
    const store = makeStore()
    const scoped = store.scope('order-unmount')
    const list = (includeGroup: boolean) =>
      createElement(
        DashList,
        { id: 'order-unmount', store },
        includeGroup
          ? createElement(DashGroup, {
              id: 'group',
              label: 'Group',
              key: 'group',
              children: [
                createElement(Dashlet, { id: 'child-a', label: 'Child A', key: 'child-a' }),
                createElement(Dashlet, { id: 'child-b', label: 'Child B', key: 'child-b' }),
              ],
            })
          : null,
        createElement(Dashlet, { id: 'root-a', label: 'Root A', key: 'root-a' }),
        createElement(Dashlet, { id: 'root-b', label: 'Root B', key: 'root-b' }),
      )
    const renderer = render(list(true))
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'child-a' })
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
      renderer.update(list(false))
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'root-a' })
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'root-a' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'root-a' })
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['root-b', 'root-a'])
    act(() => renderer.unmount())
    store.destroy()
  })

  it('keeps pin bands and supports pointer movement through the same model', () => {
    const store = makeStore()
    const scoped = store.scope('order-pin')
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-pin', store },
        createElement(Dashlet, { id: 'start', label: 'Start', pin: 'start' }),
        createElement(Dashlet, { id: 'auto-a', label: 'Auto A' }),
        createElement(Dashlet, { id: 'auto-b', label: 'Auto B' }),
        createElement(Dashlet, { id: 'auto-c', label: 'Auto C' }),
        createElement(Dashlet, { id: 'auto-d', label: 'Auto D' }),
        createElement(Dashlet, { id: 'end', label: 'End', pin: 'end' }),
      ),
    )
    const order = () =>
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet'])
    const handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'auto-a' })
    const row = (id: string, top: number) => ({
      getAttribute(name: string) {
        return name === 'data-picodash-dashlet' ? id : null
      },
      getBoundingClientRect() {
        return { top, bottom: top + 20 }
      },
    })
    const list = {
      querySelectorAll: () => [
        row('start', -20),
        row('auto-a', 0),
        row('auto-b', 20),
        row('auto-c', 40),
        row('auto-d', 60),
        row('end', 80),
      ],
    }
    const currentTarget = { closest: () => list }
    expect(handle.props['aria-keyshortcuts']).toBe('Enter Space ArrowUp ArrowDown Home End Escape')
    const instructions = renderer.root.findByProps({ id: handle.props['aria-describedby'] })
    expect(JSON.stringify(instructions.children)).toContain('Escape to cancel')
    act(() => {
      void handle.props.onPointerDown({
        pointerId: 1,
        clientY: 19,
        currentTarget,
        preventDefault() {},
      })
    })
    act(() => {
      void handle.props.onPointerMove({ pointerId: 1, clientY: 19 })
    })
    expect(order()).toEqual(['start', 'auto-a', 'auto-b', 'auto-c', 'auto-d', 'end'])
    act(() => {
      void handle.props.onPointerMove({ pointerId: 1, clientY: 40 })
    })
    expect(order()).toEqual(['start', 'auto-b', 'auto-a', 'auto-c', 'auto-d', 'end'])
    const crossedHandle = renderer.root.findByProps({
      'data-picodash-reorder-handle': 'auto-a',
    })
    act(() => {
      void crossedHandle.props.onPointerMove({ pointerId: 1, clientY: 80 })
    })
    const movedHandle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'auto-a' })
    act(() => {
      void movedHandle.props.onPointerUp({ pointerId: 1 })
    })
    expect(order()).toEqual(['start', 'auto-b', 'auto-c', 'auto-d', 'auto-a', 'end'])
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual([
      'start',
      'auto-b',
      'auto-c',
      'auto-d',
      'auto-a',
      'end',
    ])
    act(() => renderer.unmount())
    store.destroy()
  })

  it('uses explicit accessible names for icon-labelled reorder handles', () => {
    const store = makeStore()
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-names', store },
        createElement(Dashlet, {
          id: 'icon',
          label: createElement('span', { 'aria-hidden': true }, '★'),
          'aria-label': 'Favorite metric',
        }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'icon' })
    expect(handle.props['aria-label']).toBe('Reorder Favorite metric')
    act(() => {
      void handle.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'icon' })
    act(() => {
      void handle.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('Reorder complete: Favorite metric, position 1 of 2')
    act(() => renderer.unmount())
    store.destroy()
  })

  it('captures the active pointer and releases it on pointer cancellation without writing', () => {
    const store = makeStore()
    const scoped = store.scope('pointer-cancel')
    const renderer = render(
      createElement(
        DashList,
        { id: 'pointer-cancel', store },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onPointerDown({
        pointerId: 7,
        clientY: 100,
        setPointerCapture,
        releasePointerCapture,
        preventDefault() {},
      })
    })
    expect(setPointerCapture).toHaveBeenCalledWith(7)
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onPointerMove({ pointerId: 8, clientY: 20 })
      void handle.props.onPointerCancel({ pointerId: 8 })
    })
    expect(releasePointerCapture).not.toHaveBeenCalled()
    act(() => {
      void handle.props.onPointerCancel({ pointerId: 7 })
    })
    expect(releasePointerCapture).toHaveBeenCalledWith(7)
    expect(scoped.getState().scope?.dashList?.rootOrder).toBeUndefined()
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('cancelled')
    act(() => renderer.unmount())
    store.destroy()
  })

  it('releases a captured pointer when external order drift cancels the session', () => {
    const store = makeStore()
    const scoped = store.scope('pointer-drift')
    const renderer = render(
      createElement(
        DashList,
        { id: 'pointer-drift', store },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    const firstCapture = vi.fn()
    const firstRelease = vi.fn()
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onPointerDown({
        pointerId: 7,
        clientY: 100,
        setPointerCapture: firstCapture,
        releasePointerCapture: firstRelease,
        preventDefault() {},
      })
    })
    expect(firstCapture).toHaveBeenCalledWith(7)
    act(() => {
      void scoped.setDashListRootOrder(['second', 'first'])
    })
    expect(firstRelease).toHaveBeenCalledWith(7)
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('changed')

    const secondCapture = vi.fn()
    const secondRelease = vi.fn()
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'second' })
    act(() => {
      void handle.props.onPointerDown({
        pointerId: 8,
        clientY: 100,
        setPointerCapture: secondCapture,
        releasePointerCapture: secondRelease,
        preventDefault() {},
      })
    })
    expect(secondCapture).toHaveBeenCalledWith(8)
    act(() => {
      void handle.props.onPointerCancel({ pointerId: 8 })
    })
    expect(secondRelease).toHaveBeenCalledWith(8)
    act(() => renderer.unmount())
    store.destroy()
  })

  it('cancels a root pointer reorder when group collapse changes row geometry', () => {
    const store = makeStore()
    const scoped = store.scope('collapse-drift')
    const renderer = render(
      createElement(
        DashList,
        { id: 'collapse-drift', store },
        createElement(DashGroup, {
          id: 'group',
          label: 'Group',
          children: createElement(Dashlet, { id: 'nested', label: 'Nested' }),
        }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    const releasePointerCapture = vi.fn()
    const handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'group' })
    act(() => {
      void handle.props.onPointerDown({
        pointerId: 7,
        clientY: 100,
        setPointerCapture() {},
        releasePointerCapture,
        preventDefault() {},
      })
    })
    act(() => {
      void scoped.setDashListCollapseOverride('group', true)
    })
    expect(releasePointerCapture).toHaveBeenCalledWith(7)
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('changed')
    expect(scoped.getState().scope?.dashList?.rootOrder).toBeUndefined()
    act(() => renderer.unmount())
    store.destroy()
  })

  it('reorders group children, cancels without a write, and cancels on drift', () => {
    const store = makeStore()
    const scoped = store.scope('order-group')
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-group', store },
        createElement(DashGroup, {
          id: 'group',
          label: 'Group',
          children: [
            createElement(Dashlet, { id: 'one', label: 'One', key: 'one' }),
            createElement(Dashlet, { id: 'two', label: 'Two', key: 'two' }),
          ],
        }),
      ),
    )
    const childOrder = () =>
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet'])
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'one' })
    act(() => {
      void handle.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    expect(childOrder()).toEqual(['two', 'one'])
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'one' })
    act(() => {
      void handle.props.onKeyDown({ key: 'Escape', preventDefault() {} })
    })
    expect(scoped.getState().scope?.dashList?.groupOrders.size ?? 0).toBe(0)
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('cancelled')

    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'one' })
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    act(() => {
      void scoped.setDashListGroupOrder('group', ['two', 'one'])
    })
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('changed')
    expect(scoped.getState().scope?.dashList?.groupOrders.get('group')).toEqual(['two', 'one'])
    act(() => renderer.unmount())
    store.destroy()
  })

  it('does not write on a boundary no-op', () => {
    const store = makeStore()
    const scoped = store.scope('order-noop')
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-noop', store },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowUp', preventDefault() {} })
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toBeUndefined()
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('Reorder complete: First, position 1 of 2')
    act(() => renderer.unmount())
    store.destroy()
  })
})
