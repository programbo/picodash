import { describe, expect, it } from 'vite-plus/test'
import { fc, test as property } from '@fast-check/vitest'
import { createPicodashStore, PicodashContractError } from '../src/index.ts'
import {
  acquireEntityLease,
  acquireProviderLease,
  acquireRelationshipLease,
} from '../src/integration.ts'

const panel = {
  placement: { mode: 'floating', disposition: { kind: 'free' } },
  preferredPosition: { x: 4, y: 8 },
} as const

describe('Store scoped views and metadata commands', () => {
  it('destroys direct or active descendant metadata without changing values or leases', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const rootSnapshot = store.getState()
    store.setDashListRootOrder('root', ['a'])
    store.setDashListRootOrder('child', ['b'])
    store.setDashListRootOrder('grandchild', ['c'])
    const beforeValues = store.getState().values
    expect(store.destroyScope('root')).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['root'],
    })
    expect(store.getState().scopes.has('child')).toBe(true)
    expect(store.getState().values).toBe(beforeValues)
    expect(store.scope('root').destroyScope({ includeDescendants: true })).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
    })
    expect(store.getState().scopes.size).toBe(2)
    expect(store.getState()).not.toBe(rootSnapshot)
    expect(store.scope('root').destroyScope()).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
    })
  })

  it('validates destroy options atomically and does not invoke accessors', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    store.setDashListRootOrder('keep', ['item'])
    const before = store.getState()
    for (const [hostile, reason] of [
      [null, 'not-object'],
      [[], 'not-object'],
      [1, 'not-object'],
      [() => 1, 'not-object'],
      [{ extra: true }, 'unknown-key'],
      [{ [Symbol('PRIVATE_SENTINEL')]: true }, 'unknown-key'],
      [{ includeDescendants: 1 }, 'invalid-include-descendants'],
    ] as const) {
      try {
        store.destroyScope('keep', hostile as never)
        throw new Error('expected invalid options')
      } catch (error) {
        expect(error).toBeInstanceOf(PicodashContractError)
        expect((error as PicodashContractError).code).toBe('invalid-destroy-options')
        expect((error as PicodashContractError).context).toEqual({ reason })
      }
      expect(store.getState()).toBe(before)
    }
    let invoked = false
    const accessor = Object.defineProperty({}, 'includeDescendants', {
      get() {
        invoked = true
        return true
      },
    })
    try {
      store.destroyScope('keep', accessor as never)
      throw new Error('expected accessor rejection')
    } catch (error) {
      expect((error as PicodashContractError).code).toBe('invalid-destroy-options')
      expect((error as PicodashContractError).context).toEqual({ reason: 'accessor-property' })
    }
    expect(invoked).toBe(false)
    expect(store.getState()).toBe(before)
    try {
      store.destroyScope(' bad ', { extra: true } as never)
      throw new Error('expected invalid scope')
    } catch (error) {
      expect((error as PicodashContractError).code).toBe('invalid-scope-id')
      expect((error as PicodashContractError).context).toEqual({ reason: 'surrounding-whitespace' })
    }
  })

  it('holds the write lock while root and scoped destroy options are reflected', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const nestedCodes: string[] = []
    const options = () =>
      new Proxy(
        { includeDescendants: false },
        {
          ownKeys(target) {
            try {
              store.setValue(store.fields.value, 2)
            } catch (error) {
              nestedCodes.push((error as PicodashContractError).code)
            }
            return Reflect.ownKeys(target)
          },
        },
      )

    expect(store.destroyScope('missing', options())).toMatchObject({ ok: true })
    expect(store.scope('missing').destroyScope(options())).toMatchObject({ ok: true })
    expect(nestedCodes).toEqual(['reentrant-write', 'reentrant-write'])
    expect(store.getState().values.value).toBe(1)
    store.destroy()
  })

  it('refreshes affected snapshots before one callback and leaves unrelated scopes silent', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const first = store.scope('first')
    const second = store.scope('second')
    const unrelated = store.scope('unrelated')
    store.setDashListRootOrder('first', ['a'])
    store.setDashListRootOrder('second', ['b'])
    const seen: string[] = []
    store.subscribe(() => seen.push(`root:${store.getState().scopes.size}`))
    first.subscribe(() => seen.push(`first:${first.getState().scope === undefined}`))
    second.subscribe(() => seen.push(`second:${second.getState().scope === undefined}`))
    unrelated.subscribe(() => seen.push('unrelated'))
    expect(store.destroyScope('first')).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['first'],
    })
    expect(seen).toEqual(['root:1', 'first:true'])
  })

  it('keeps destruction committed and rejects reentrant destruction from listeners', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    store.setDashListRootOrder('first', ['a'])
    let reentrant: PicodashContractError | undefined
    store.subscribe(() => {
      try {
        store.destroyScope('first')
      } catch (error) {
        reentrant = error as PicodashContractError
      }
    })
    expect(store.destroyScope('first').ok).toBe(true)
    expect(reentrant?.code).toBe('reentrant-write')
    expect(store.getState().scopes.size).toBe(0)
  })

  it('refreshes every transitive affected scoped view before root/child callbacks', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    for (const scopeId of ['a', 'b', 'c', 'unrelated'])
      store.setDashListRootOrder(scopeId, [scopeId])
    const provider = acquireProviderLease(store)
    const entities = new Map<string, ReturnType<typeof acquireEntityLease>>()
    for (const scopeId of ['a', 'b', 'c'])
      entities.set(
        scopeId,
        acquireEntityLease(store.scope(scopeId), { kind: 'dashList', host: provider }),
      )
    const ab = acquireRelationshipLease(entities.get('a')!, entities.get('b')!)
    const bc = acquireRelationshipLease(entities.get('b')!, entities.get('c')!)
    const views = ['a', 'b', 'c', 'unrelated'].map((scopeId) => store.scope(scopeId))
    const seen: string[] = []
    store.subscribe(() => {
      seen.push(`root:${views.map((view) => view.getState().scope === undefined).join(',')}`)
    })
    for (const view of views)
      view.subscribe(() => seen.push(`${view.scopeId}:${view.getState().scope === undefined}`))
    expect(store.destroyScope('a', { includeDescendants: true })).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['a', 'b', 'c'],
    })
    expect(seen[0]).toBe('root:true,true,true,false')
    expect(seen.filter((entry) => entry.startsWith('a:'))).toHaveLength(1)
    expect(seen.filter((entry) => entry.startsWith('b:'))).toHaveLength(1)
    expect(seen.filter((entry) => entry.startsWith('c:'))).toHaveLength(1)
    expect(seen.filter((entry) => entry.startsWith('unrelated:'))).toHaveLength(0)
    bc.release()
    ab.release()
    for (const entity of entities.values()) entity.release()
    provider.release()
  })
  it('canonicalizes scopes and classifies invalid IDs without exposing values', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    expect(store.getState().scopes.size).toBe(0)
    expect(store.scope('a b')).toBe(store.scope('a b'))
    expect(store.scope('a b').scope('nested')).toBe(store.scope('nested'))
    expect(store.getState().scopes.size).toBe(0)
    for (const [value, reason] of [
      [1, 'not-string'],
      ['', 'empty'],
      ['   ', 'empty'],
      ['\t', 'empty'],
      [' a', 'surrounding-whitespace'],
      ['a\u0000', 'control-character'],
      ['a\u001f', 'control-character'],
      ['a\u007f', 'control-character'],
      ['a\u009f', 'control-character'],
      [' \u0000', 'surrounding-whitespace'],
    ] as const) {
      try {
        store.scope(value as never)
        throw new Error('expected invalid scope')
      } catch (error) {
        expect(error).toBeInstanceOf(PicodashContractError)
        expect((error as PicodashContractError).code).toBe('invalid-scope-id')
        expect((error as PicodashContractError).context).toEqual({ reason })
      }
    }
  })

  it('shares values and fields, attributes scoped writes, and notifies live views', () => {
    const origins: Array<string | undefined> = []
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          validate: (_value, context) => {
            origins.push(context.originScopeId)
            return []
          },
        },
      },
    })
    const first = store.scope('first')
    const second = store.scope('second')
    let firstCalls = 0
    let secondCalls = 0
    first.subscribe(() => firstCalls++)
    second.subscribe(() => secondCalls++)
    expect(first.fields).toBe(store.fields)
    expect(first.getState().values).toBe(store.getState().values)
    expect(first.setValues({ value: 2 })).toEqual({
      ok: true,
      changedFields: ['value'],
      changedScopeIds: [],
    })
    expect(firstCalls).toBe(1)
    expect(secondCalls).toBe(1)
    expect(origins.at(-1)).toBe('first')
  })

  it('authors and resets metadata atomically, pruning empty products and scopes', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const scoped = store.scope('settings')
    expect(scoped.setDashPanelLayout(panel)).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['settings'],
    })
    expect(scoped.setDashPanelLayout(panel)).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
    })
    expect(scoped.setDashListRootOrder([])).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
    })
    expect(scoped.setDashListGroupOrder('group', ['a', 'b'])).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['settings'],
    })
    expect(scoped.setDashListCollapseOverride('group', true)).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['settings'],
    })
    expect(scoped.resetDashListMetadata()).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['settings'],
    })
    expect(scoped.resetDashPanelLayout()).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['settings'],
    })
    expect(store.getState().scopes.size).toBe(0)
    const invalid = scoped.setDashListGroupOrder('bad', [''])
    expect(invalid.ok).toBe(false)
    expect(store.getState().scopes.size).toBe(0)
  })

  it('refreshes every affected snapshot before listeners and rejects hostile orders privately', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const first = store.scope('first')
    const second = store.scope('second')
    const seen: string[] = []
    store.subscribe(() => {
      seen.push(`root:${first.getState().values.value}:${second.getState().values.value}`)
      expect(() => first.setValues({ value: 3 })).toThrowError(PicodashContractError)
    })
    first.subscribe(() => seen.push(`first:${first.getState().values.value}`))
    second.subscribe(() => seen.push(`second:${second.getState().values.value}`))
    expect(store.setValues({ value: 2 })).toEqual({
      ok: true,
      changedFields: ['value'],
      changedScopeIds: [],
    })
    expect(seen).toEqual(['root:2:2', 'first:2', 'second:2'])

    first.subscribe(() => {
      if (first.getState().scope?.dashPanel)
        expect(() => first.resetDashPanelLayout()).toThrowError(PicodashContractError)
    })
    expect(store.setDashPanelLayout('first', panel).ok).toBe(true)

    const before = store.getState()
    for (const hostile of [new Map(), 'abc', { length: 0 }, Object.create(null)]) {
      const result = store.setDashListRootOrder('first', hostile as never)
      expect(result.ok).toBe(false)
      expect(result.ok ? [] : result.error.issues[0]?.path).toEqual(['scopes', 'first'])
      expect(store.getState()).toBe(before)
    }
  })

  it('keeps interaction maps frozen and stable, and preserves invalid scope privacy', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const scoped = store.scope('punctuation/name')
    const first = scoped.getState()
    expect(scoped.getState().interaction).toBe(first.interaction)
    expect(Object.isFrozen(first.interaction)).toBe(true)
    expect(Object.isFrozen(first.interaction.bindings)).toBe(true)
    expect(Object.isFrozen(first.interaction.items)).toBe(true)
    expect(() => Map.prototype.set.call(first.interaction.items, 'x', {})).toThrow()
    for (const value of ['\u007f', '\u0085', ' a ', '']) {
      expect(() => store.scope(value)).toThrowError(PicodashContractError)
    }
  })

  it('covers every metadata operation through root and scoped APIs', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const scoped = store.scope('scoped')
    expect(scoped.kind).toBe('scoped')
    expect(scoped.root).toBe(store)
    expect(scoped.scopeId).toBe('scoped')
    const run = (api: typeof store | typeof scoped, rootApi: boolean) => {
      const scope = 'scoped'
      const panelSet = rootApi
        ? store.setDashPanelLayout(scope, panel)
        : scoped.setDashPanelLayout(panel)
      expect(panelSet).toEqual({ ok: true, changedFields: [], changedScopeIds: ['scoped'] })
      expect(store.getState().scopes.get('scoped')?.dashPanel).toEqual(panel)
      const rootSet = rootApi
        ? store.setDashListRootOrder(scope, ['one', 'two'])
        : scoped.setDashListRootOrder(['one', 'two'])
      expect(rootSet).toEqual({ ok: true, changedFields: [], changedScopeIds: ['scoped'] })
      const groupSet = rootApi
        ? store.setDashListGroupOrder(scope, 'group', ['child'])
        : scoped.setDashListGroupOrder('group', ['child'])
      expect(groupSet).toEqual({ ok: true, changedFields: [], changedScopeIds: ['scoped'] })
      const collapseSet = rootApi
        ? store.setDashListCollapseOverride(scope, 'group', true)
        : scoped.setDashListCollapseOverride('group', true)
      expect(collapseSet).toEqual({ ok: true, changedFields: [], changedScopeIds: ['scoped'] })
      const listReset = rootApi
        ? store.resetDashListMetadata(scope)
        : scoped.resetDashListMetadata()
      expect(listReset).toEqual({ ok: true, changedFields: [], changedScopeIds: ['scoped'] })
      const rootReadd = rootApi
        ? store.setDashListRootOrder(scope, ['one'])
        : scoped.setDashListRootOrder(['one'])
      expect(rootReadd).toEqual({ ok: true, changedFields: [], changedScopeIds: ['scoped'] })
      const groupReadd = rootApi
        ? store.setDashListGroupOrder(scope, 'group', ['child'])
        : scoped.setDashListGroupOrder('group', ['child'])
      expect(groupReadd).toEqual({ ok: true, changedFields: [], changedScopeIds: ['scoped'] })
      const collapseReadd = rootApi
        ? store.setDashListCollapseOverride(scope, 'group', true)
        : scoped.setDashListCollapseOverride('group', true)
      expect(collapseReadd).toEqual({ ok: true, changedFields: [], changedScopeIds: ['scoped'] })
      const panelReset = rootApi ? store.resetDashPanelLayout(scope) : scoped.resetDashPanelLayout()
      expect(panelReset).toEqual({ ok: true, changedFields: [], changedScopeIds: ['scoped'] })
      const rootRemove = rootApi
        ? store.removeDashListRootOrder(scope)
        : scoped.removeDashListRootOrder()
      expect(rootRemove).toEqual({ ok: true, changedFields: [], changedScopeIds: ['scoped'] })
      const groupRemove = rootApi
        ? store.removeDashListGroupOrder(scope, 'group')
        : scoped.removeDashListGroupOrder('group')
      expect(groupRemove).toEqual({ ok: true, changedFields: [], changedScopeIds: ['scoped'] })
      const collapseRemove = rootApi
        ? store.removeDashListCollapseOverride(scope, 'group')
        : scoped.removeDashListCollapseOverride('group')
      expect(collapseRemove).toEqual({ ok: true, changedFields: [], changedScopeIds: ['scoped'] })
      expect(store.getState().scopes.size).toBe(0)
      void api
    }
    run(store, true)
    run(scoped, false)
  })

  it('keeps root-origin context absent, no-op identities stable, and teardown silent', () => {
    const origins: Array<Record<string, unknown>> = []
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          validate: (_value, context) => {
            origins.push(context)
            return []
          },
        },
      },
    })
    const target = store.scope('target')
    const other = store.scope('other')
    let rootCalls = 0
    let targetCalls = 0
    let otherCalls = 0
    const unsubscribeRoot = store.subscribe(() => rootCalls++)
    const unsubscribeTarget = target.subscribe(() => targetCalls++)
    const unsubscribeOther = other.subscribe(() => otherCalls++)
    const rootBefore = store.getState()
    const targetBefore = target.getState()
    const otherBefore = other.getState()
    expect(store.setValues({ value: 1 })).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
    })
    expect(store.getState()).toBe(rootBefore)
    expect(target.getState()).toBe(targetBefore)
    expect(other.getState()).toBe(otherBefore)
    expect(rootCalls + targetCalls + otherCalls).toBe(0)
    store.setValues({ value: 2 })
    expect(Object.hasOwn(origins.at(-1)!, 'originScopeId')).toBe(false)
    target.setValues({ value: 3 })
    expect(origins.at(-1)?.originScopeId).toBe('target')
    unsubscribeRoot()
    unsubscribeRoot()
    unsubscribeTarget()
    unsubscribeTarget()
    unsubscribeOther()
    unsubscribeOther()
    const counts = [rootCalls, targetCalls, otherCalls]
    store.setValues({ value: 4 })
    expect([rootCalls, targetCalls, otherCalls]).toEqual(counts)
  })

  it('retains an active channel through callbacks without retaining the view object', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    let view = store.scope('retained')
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const read = view.getState
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const subscribe = view.subscribe
    let calls = 0
    const unsubscribe = subscribe(() => {
      calls += 1
      expect(read().values.value).toBe(2)
    })
    view = undefined as never
    store.setValues({ value: 2 })
    expect(read().values.value).toBe(2)
    expect(calls).toBe(1)
    unsubscribe()
    unsubscribe()
    store.setValues({ value: 3 })
    expect(calls).toBe(1)
  })

  it('keeps malformed metadata failures private and atomic', () => {
    const secret = 'PRIVATE_SENTINEL'
    type Target = {
      setDashPanelLayout: (layout: unknown) => unknown
      setDashListRootOrder: (order: unknown) => unknown
      setDashListGroupOrder: (id: string, order: unknown) => unknown
      setDashListCollapseOverride: (id: string, value: unknown) => unknown
    }
    const cases: Array<[string, (target: Target) => unknown]> = [
      ['panel', (target) => target.setDashPanelLayout({ bad: secret } as never)],
      ['root-order', (target) => target.setDashListRootOrder(new Map() as never)],
      ['group-id', (target) => target.setDashListGroupOrder('', ['x'])],
      ['group-order', (target) => target.setDashListGroupOrder('group', new Map() as never)],
      ['collapse-node', (target) => target.setDashListCollapseOverride('', true)],
      ['collapse-value', (target) => target.setDashListCollapseOverride('node', 1 as never)],
    ]
    for (const [label, invoke] of cases) {
      const store = createPicodashStore({
        valueOwner: 'store',
        fields: { value: { defaultValue: 1 } },
      })
      const target = store.scope(`sentinel-${label}`)
      const before = store.getState()
      const targetBefore = target.getState()
      let calls = 0
      store.subscribe(() => calls++)
      const result = invoke(target as never) as {
        ok: false
        error: {
          message: string
          stack?: string
          issues: readonly [{ code: string; message: string; path: readonly unknown[] }]
        }
      }
      expect(result.ok).toBe(false)
      expect(result.error.issues[0]?.code).toBe('invalid_metadata')
      expect(result.error.issues[0]?.path).toEqual(['scopes', `sentinel-${label}`])
      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.error)).toBe(true)
      expect(Object.isFrozen(result.error.issues)).toBe(true)
      expect(Object.isFrozen(result.error.issues[0])).toBe(true)
      expect(Object.isFrozen(result.error.issues[0]?.path)).toBe(true)
      expect(result.error.message).not.toContain(secret)
      expect(result.error.stack ?? '').not.toContain(secret)
      expect(result.error.issues[0]?.message).not.toContain(secret)
      expect(JSON.stringify(result)).not.toContain(secret)
      expect(store.getState()).toBe(before)
      expect(target.getState()).toBe(targetBefore)
      expect(calls).toBe(0)
    }
  })

  property.prop([
    fc.array(
      fc.record({
        scope: fc.constantFrom('a', 'b', 'c'),
        api: fc.boolean(),
        operation: fc.constantFrom(
          'panel-set',
          'panel-reset',
          'root-set',
          'root-remove',
          'group-set',
          'group-remove',
          'collapse-set',
          'collapse-remove',
          'list-reset',
        ),
        order: fc.uniqueArray(fc.constantFrom('x', 'y', 'z'), { maxLength: 3 }),
        collapsed: fc.boolean(),
      }),
      { minLength: 1, maxLength: 30 },
    ),
  ])('maintains full durable metadata model invariants across scopes and APIs', (commands) => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const views = new Map(['a', 'b', 'c'].map((id) => [id, store.scope(id)] as const))
    const notifications = { root: 0, a: 0, b: 0, c: 0 }
    store.subscribe(() => notifications.root++)
    for (const id of ['a', 'b', 'c'] as const) views.get(id)!.subscribe(() => notifications[id]++)
    const model = new Map<
      string,
      {
        panel: boolean
        root?: readonly string[]
        groups: Map<string, readonly string[]>
        collapse: Map<string, boolean>
      }
    >()
    const ensure = (scope: string): typeof model extends Map<string, infer M> ? M : never =>
      model.get(scope) ?? { panel: false, groups: new Map(), collapse: new Map() }
    const projection = () =>
      [...store.getState().scopes.entries()].map(([id, metadata]) => [
        id,
        {
          panel: metadata.dashPanel !== undefined,
          root: metadata.dashList?.rootOrder,
          groups: [...(metadata.dashList?.groupOrders ?? new Map()).entries()],
          collapse: [...(metadata.dashList?.collapseOverrides ?? new Map()).entries()],
        },
      ])
    const modelProjection = () =>
      [...model.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, metadata]) => [
          id,
          {
            panel: metadata.panel,
            root: metadata.root,
            groups: [...metadata.groups.entries()],
            collapse: [...metadata.collapse.entries()],
          },
        ])
    for (const command of commands) {
      const before = JSON.stringify(modelProjection())
      const beforeRoot = store.getState()
      const beforeTarget = views.get(command.scope)!.getState()
      const beforeOther = views.get(command.scope === 'a' ? 'b' : 'a')!.getState()
      const beforeNotifications = { ...notifications }
      const state = ensure(command.scope)
      const api = command.api ? store : views.get(command.scope)!
      let result: ReturnType<typeof store.setDashListRootOrder> | undefined
      if (command.operation === 'panel-set') {
        result =
          api === store
            ? store.setDashPanelLayout(command.scope, panel)
            : views.get(command.scope)!.setDashPanelLayout(panel)
        state.panel = true
      }
      if (command.operation === 'panel-reset') {
        result =
          api === store
            ? store.resetDashPanelLayout(command.scope)
            : views.get(command.scope)!.resetDashPanelLayout()
        state.panel = false
      }
      if (command.operation === 'root-set') {
        result =
          api === store
            ? store.setDashListRootOrder(command.scope, command.order)
            : views.get(command.scope)!.setDashListRootOrder(command.order)
        if (command.order.length) state.root = command.order
        else state.root = undefined
      }
      if (command.operation === 'root-remove') {
        result =
          api === store
            ? store.removeDashListRootOrder(command.scope)
            : views.get(command.scope)!.removeDashListRootOrder()
        state.root = undefined
      }
      if (command.operation === 'group-set') {
        result =
          api === store
            ? store.setDashListGroupOrder(command.scope, 'group', command.order)
            : views.get(command.scope)!.setDashListGroupOrder('group', command.order)
        if (command.order.length) state.groups.set('group', command.order)
        else state.groups.delete('group')
      }
      if (command.operation === 'group-remove') {
        result =
          api === store
            ? store.removeDashListGroupOrder(command.scope, 'group')
            : views.get(command.scope)!.removeDashListGroupOrder('group')
        state.groups.delete('group')
      }
      if (command.operation === 'collapse-set') {
        result =
          api === store
            ? store.setDashListCollapseOverride(command.scope, 'group', command.collapsed)
            : views.get(command.scope)!.setDashListCollapseOverride('group', command.collapsed)
        state.collapse.set('group', command.collapsed)
      }
      if (command.operation === 'collapse-remove') {
        result =
          api === store
            ? store.removeDashListCollapseOverride(command.scope, 'group')
            : views.get(command.scope)!.removeDashListCollapseOverride('group')
        state.collapse.delete('group')
      }
      if (command.operation === 'list-reset') {
        result =
          api === store
            ? store.resetDashListMetadata(command.scope)
            : views.get(command.scope)!.resetDashListMetadata()
        state.root = undefined
        state.groups.clear()
        state.collapse.clear()
      }
      if (
        !state.panel &&
        state.root === undefined &&
        state.groups.size === 0 &&
        state.collapse.size === 0
      )
        model.delete(command.scope)
      else model.set(command.scope, state)
      const changed = before !== JSON.stringify(modelProjection())
      expect(projection()).toEqual(modelProjection())
      expect(result).toEqual({
        ok: true,
        changedFields: [],
        changedScopeIds: changed ? [command.scope] : [],
      })
      expect(store.getState().scopes.has(command.scope)).toBe(model.has(command.scope))
      expect(store.getState() === beforeRoot).toBe(!changed)
      expect(views.get(command.scope)!.getState() === beforeTarget).toBe(!changed)
      expect(views.get(command.scope === 'a' ? 'b' : 'a')!.getState() === beforeOther).toBe(true)
      expect(notifications.root - beforeNotifications.root).toBe(changed ? 1 : 0)
      for (const id of ['a', 'b', 'c'] as const)
        expect(notifications[id] - beforeNotifications[id]).toBe(
          changed && id === command.scope ? 1 : 0,
        )
    }
  })
})
