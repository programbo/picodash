import { describe, expect, it } from 'vite-plus/test'
import { fc, test as property } from '@fast-check/vitest'
import { createPicodashStore, PicodashContractError } from '../src/index.ts'
import {
  acquireEntityLease,
  acquireProviderLease,
  acquireRelationshipLease,
} from '../src/integration.ts'
import type { EntityLease, RelationshipLease } from '../src/integration.ts'
import {
  acquireStoreScopeRelationship,
  createStoreScopeModel,
  destroyStoreScopeState,
  releaseStoreScopeRelationship,
  setStoreScopeMetadata,
  clearStoreScopeMetadata,
} from './support/store-scope-model.ts'

const makeStore = () =>
  createPicodashStore({
    valueOwner: 'store',
    fields: { value: { defaultValue: 1 } },
  })

const failure = (run: () => unknown) => {
  try {
    run()
    throw new Error('expected failure')
  } catch (error) {
    expect(error).toBeInstanceOf(PicodashContractError)
    return error as PicodashContractError
  }
}

describe('Store declarative integration leases', () => {
  it('acquires frozen opaque provider/entity handles and enforces provider IDs', () => {
    const store = makeStore()
    const provider = acquireProviderLease(store)
    expect(Object.keys(provider)).toEqual(['release'])
    expect(Object.isFrozen(provider)).toBe(true)
    expect(failure(() => acquireProviderLease(store)).context).toEqual({ providerId: 'default' })
    expect(failure(() => acquireProviderLease(store, { providerId: ' bad ' })).context).toEqual({
      reason: 'surrounding-whitespace',
    })
    const panel = acquireEntityLease(store.scope('panel'), { kind: 'dashPanel', host: provider })
    expect(Object.keys(panel)).toEqual(['release'])
    panel.release()
    provider.release()
    provider.release()
  })

  it('validates hostile entity records before examining host handles', () => {
    const store = makeStore()
    const provider = acquireProviderLease(store)
    expect(failure(() => acquireEntityLease(store.scope('x'), null as never)).context).toEqual({
      reason: 'not-object',
    })
    expect(
      failure(() =>
        acquireEntityLease(store.scope('x'), { kind: 'dashPanel', extra: true } as never),
      ).context,
    ).toEqual({ reason: 'unknown-key' })
    let invoked = false
    const hostile = Object.defineProperty({}, 'kind', {
      get() {
        invoked = true
        return 'dashPanel'
      },
    })
    expect(failure(() => acquireEntityLease(store.scope('x'), hostile as never)).context).toEqual({
      reason: 'accessor-property',
    })
    expect(invoked).toBe(false)
    expect(
      failure(() => acquireEntityLease(store.scope('x'), { kind: 'dashPanel' } as never)).context,
    ).toEqual({ reason: 'host-required' })
    provider.release()
  })

  it('rejects forged scoped-store lookalikes without trusting root or scope fields', () => {
    const store = makeStore()
    const provider = acquireProviderLease(store)
    const forged = { root: store, scopeId: 'PRIVATE_SENTINEL' } as never
    const error = failure(() => acquireEntityLease(forged, { kind: 'dashList', host: provider }))
    expect(error.code).toBe('invalid-integration-handle')
    expect(error.context).toEqual({ role: 'host', reason: 'wrong-kind' })
    expect(JSON.stringify(error)).not.toContain('PRIVATE_SENTINEL')
    provider.release()
  })

  it('normalizes hostile option proxies without invoking accessors or leaking trap data', () => {
    const store = makeStore()
    const provider = acquireProviderLease(store)
    const sentinel = 'PRIVATE_SENTINEL'
    const throwingProxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error(sentinel)
        },
      },
    )
    const error = failure(() => acquireEntityLease(store.scope('proxy'), throwingProxy as never))
    expect(error.code).toBe('invalid-entity-options')
    expect(error.context).toEqual({ reason: 'not-object' })
    expect(`${error.message}${error.stack}${JSON.stringify(error)}`).not.toContain(sentinel)
    provider.release()
  })

  it('keeps nested Providers and roots as hard host boundaries', () => {
    const first = makeStore()
    const second = makeStore()
    const outer = acquireProviderLease(first)
    const nested = acquireProviderLease(first, { providerId: 'nested' })
    const foreign = acquireProviderLease(second)
    const outerEntity = acquireEntityLease(first.scope('outer'), { kind: 'dashPanel', host: outer })
    const nestedEntity = acquireEntityLease(first.scope('nested'), {
      kind: 'dashList',
      host: nested,
    })
    const foreignEntity = acquireEntityLease(second.scope('foreign'), {
      kind: 'dashList',
      host: foreign,
    })
    expect(failure(() => acquireRelationshipLease(outerEntity, nestedEntity)).context).toEqual({
      reason: 'host-boundary',
    })
    expect(failure(() => acquireRelationshipLease(outerEntity, foreignEntity)).context).toEqual({
      role: 'child',
      reason: 'foreign-root',
    })
    foreignEntity.release()
    foreign.release()
    nestedEntity.release()
    outerEntity.release()
    nested.release()
    outer.release()
  })

  it('supports Strict Mode-style release and reacquisition generations', () => {
    const store = makeStore()
    const first = acquireProviderLease(store)
    first.release()
    const second = acquireProviderLease(store)
    const entity = acquireEntityLease(store.scope('strict'), { kind: 'dashList', host: second })
    entity.release()
    entity.release()
    second.release()
    second.release()
  })

  it('covers provider lexical validation and integration handle taxonomy', () => {
    const store = makeStore()
    for (const [providerId, reason] of [
      [1, 'not-string'],
      ['', 'empty'],
      ['   ', 'empty'],
      [' x', 'surrounding-whitespace'],
      ['x\u0000', 'control-character'],
    ] as const) {
      const error = failure(() => acquireProviderLease(store, { providerId: providerId as never }))
      expect(error.code).toBe('invalid-provider-id')
      expect(error.context).toEqual({ reason })
    }
    const provider = acquireProviderLease(store)
    const standalone = acquireEntityLease(store.scope('standalone'), { kind: 'dashList' })
    expect(
      failure(() =>
        acquireEntityLease(store.scope('standalone'), { kind: 'dashPanel', host: provider }),
      ).context,
    ).toEqual({ scopeId: 'standalone' })
    standalone.release()
    const panel = acquireEntityLease(store.scope('panel'), { kind: 'dashPanel', host: provider })
    const list = acquireEntityLease(store.scope('list'), { kind: 'dashList', host: panel })
    expect(failure(() => provider.release()).context).toEqual({ leaseKind: 'provider' })
    expect(
      failure(() =>
        acquireEntityLease(store.scope('other'), { kind: 'dashList', host: {} as never }),
      ).context,
    ).toEqual({
      role: 'host',
      reason: 'wrong-kind',
    })
    list.release()
    panel.release()
    expect(failure(() => acquireRelationshipLease(panel, list)).context).toEqual({
      role: 'parent',
      reason: 'released',
    })
    provider.release()
  })

  it('reports host and relationship handle roles without leaking rejected values', () => {
    const first = makeStore()
    const second = makeStore()
    const releasedProvider = acquireProviderLease(first, { providerId: 'released' })
    releasedProvider.release()
    expect(
      failure(() =>
        acquireEntityLease(first.scope('released-host'), {
          kind: 'dashList',
          host: releasedProvider,
        }),
      ).context,
    ).toEqual({ role: 'host', reason: 'released' })
    const foreignProvider = acquireProviderLease(second)
    expect(
      failure(() =>
        acquireEntityLease(first.scope('foreign-host'), {
          kind: 'dashList',
          host: foreignProvider,
        }),
      ).context,
    ).toEqual({ role: 'host', reason: 'foreign-root' })
    const provider = acquireProviderLease(first)
    const parent = acquireEntityLease(first.scope('parent-taxonomy'), {
      kind: 'dashPanel',
      host: provider,
    })
    const child = acquireEntityLease(first.scope('child-taxonomy'), {
      kind: 'dashList',
      host: provider,
    })
    expect(failure(() => acquireRelationshipLease(provider as never, child)).context).toEqual({
      role: 'parent',
      reason: 'wrong-kind',
    })
    parent.release()
    expect(failure(() => acquireRelationshipLease(parent, child)).context).toEqual({
      role: 'parent',
      reason: 'released',
    })
    expect(failure(() => acquireRelationshipLease(provider as never, child)).context).toEqual({
      role: 'parent',
      reason: 'wrong-kind',
    })
    expect(failure(() => acquireRelationshipLease(child, provider as never)).context).toEqual({
      role: 'child',
      reason: 'wrong-kind',
    })
    child.release()
    expect(failure(() => acquireRelationshipLease(provider as never, child)).context).toEqual({
      role: 'parent',
      reason: 'wrong-kind',
    })
    const childReleased = acquireEntityLease(first.scope('child-released'), {
      kind: 'dashList',
      host: provider,
    })
    childReleased.release()
    const freshParent = acquireEntityLease(first.scope('fresh-parent'), {
      kind: 'dashPanel',
      host: provider,
    })
    expect(failure(() => acquireRelationshipLease(freshParent, childReleased)).context).toEqual({
      role: 'child',
      reason: 'released',
    })
    freshParent.release()
    provider.release()
    foreignProvider.release()
  })

  it('matches the scope-model oracle for generated metadata and directed destruction', () => {
    const store = makeStore()
    const provider = acquireProviderLease(store)
    const parent = acquireEntityLease(store.scope('a'), { kind: 'dashPanel', host: provider })
    const middle = acquireEntityLease(store.scope('b'), { kind: 'dashList', host: parent })
    const leaf = acquireEntityLease(store.scope('c'), { kind: 'dashList', host: parent })
    const firstEdge = acquireRelationshipLease(parent, middle)
    const secondEdge = acquireRelationshipLease(middle, leaf)
    let model = createStoreScopeModel({ value: 1 })
    for (const scopeId of ['a', 'b', 'c']) {
      store.setDashListRootOrder(scopeId, [scopeId])
      model = model.setMetadata(scopeId)
    }
    let modelState = model.state
    modelState = acquireStoreScopeRelationship(modelState, 'a-b', 'a', 'b').state
    modelState = acquireStoreScopeRelationship(modelState, 'b-c', 'b', 'c').state
    const destroyedModel = destroyStoreScopeState(modelState, 'a', true)
    const expected = [...modelState.durableScopeIds]
      .filter((scopeId) => !destroyedModel.durableScopeIds.has(scopeId))
      .sort()
    const actual = store.destroyScope('a', { includeDescendants: true })
    expect(actual.ok && actual.changedScopeIds).toEqual(expected)
    firstEdge.release()
    secondEdge.release()
    leaf.release()
    middle.release()
    parent.release()
    provider.release()
  })

  it('enforces uniqueness, host affinity, graph parent conflicts, cycles, and teardown', () => {
    const store = makeStore()
    const provider = acquireProviderLease(store)
    const parent = acquireEntityLease(store.scope('parent'), { kind: 'dashPanel', host: provider })
    const child = acquireEntityLease(store.scope('child'), { kind: 'dashList', host: parent })
    expect(
      failure(() =>
        acquireEntityLease(store.scope('parent'), { kind: 'dashPanel', host: provider }),
      ).code,
    ).toBe('duplicate-entity')
    const otherProvider = acquireProviderLease(store, { providerId: 'other' })
    expect(
      failure(() =>
        acquireEntityLease(store.scope('parent'), { kind: 'dashList', host: otherProvider }),
      ).code,
    ).toBe('scope-host-conflict')
    otherProvider.release()
    const edge = acquireRelationshipLease(parent, child)
    const secondEdge = acquireRelationshipLease(parent, child)
    expect(failure(() => parent.release()).context).toEqual({ leaseKind: 'entity' })
    edge.release()
    expect(failure(() => parent.release()).context).toEqual({ leaseKind: 'entity' })
    secondEdge.release()
    child.release()
    parent.release()
    provider.release()
  })

  it('treats entity-hosted children as dependents even without a relationship edge', () => {
    const store = makeStore()
    const provider = acquireProviderLease(store)
    const host = acquireEntityLease(store.scope('host'), { kind: 'dashPanel', host: provider })
    const hosted = acquireEntityLease(store.scope('hosted'), { kind: 'dashList', host })
    expect(failure(() => host.release()).context).toEqual({ leaseKind: 'entity' })
    hosted.release()
    host.release()
    provider.release()
  })

  it('keys graph parentage by scope while retaining generation leases', () => {
    const store = makeStore()
    const provider = acquireProviderLease(store)
    const parentPanel = acquireEntityLease(store.scope('parent'), {
      kind: 'dashPanel',
      host: provider,
    })
    const parentList = acquireEntityLease(store.scope('parent'), {
      kind: 'dashList',
      host: provider,
    })
    const childPanel = acquireEntityLease(store.scope('child'), {
      kind: 'dashPanel',
      host: provider,
    })
    const childList = acquireEntityLease(store.scope('child'), {
      kind: 'dashList',
      host: provider,
    })
    const first = acquireRelationshipLease(parentPanel, childPanel)
    const second = acquireRelationshipLease(parentList, childList)
    const third = acquireRelationshipLease(parentPanel, childList)
    expect(Object.keys(first)).toEqual(['release'])
    expect(Object.isFrozen(first)).toBe(true)
    const otherParent = acquireEntityLease(store.scope('other'), {
      kind: 'dashPanel',
      host: provider,
    })
    expect(failure(() => acquireRelationshipLease(otherParent, childPanel)).context).toEqual({
      childScopeId: 'child',
    })
    const grandchild = acquireEntityLease(store.scope('grandchild'), {
      kind: 'dashList',
      host: provider,
    })
    const down = acquireRelationshipLease(childPanel, grandchild)
    expect(failure(() => acquireRelationshipLease(grandchild, parentPanel)).context).toEqual({
      parentScopeId: 'grandchild',
      childScopeId: 'parent',
    })
    first.release()
    first.release()
    second.release()
    third.release()
    down.release()
    grandchild.release()
    otherParent.release()
    childList.release()
    childPanel.release()
    parentList.release()
    parentPanel.release()
    provider.release()
  })

  it('keeps active descendants available to destroyScope without deleting leases or values', () => {
    const store = makeStore()
    const provider = acquireProviderLease(store)
    const parent = acquireEntityLease(store.scope('parent'), { kind: 'dashPanel', host: provider })
    const child = acquireEntityLease(store.scope('child'), { kind: 'dashList', host: parent })
    const edge = acquireRelationshipLease(parent, child)
    const secondEdge = acquireRelationshipLease(parent, child)
    store.setDashPanelLayout('parent', {
      placement: { mode: 'floating', disposition: { kind: 'free' } },
      preferredPosition: { x: 1, y: 2 },
    })
    store.setDashListRootOrder('child', ['item'])
    const valueRef = store.getState().values
    expect(store.destroyScope('parent', { includeDescendants: true })).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['child', 'parent'],
    })
    expect(store.getState().values).toBe(valueRef)
    expect(store.getState().scopes.size).toBe(0)
    edge.release()
    store.setDashPanelLayout('parent', {
      placement: { mode: 'floating', disposition: { kind: 'free' } },
      preferredPosition: { x: 3, y: 4 },
    })
    store.setDashListRootOrder('child', ['item'])
    expect(store.destroyScope('parent', { includeDescendants: true })).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['child', 'parent'],
    })
    secondEdge.release()
    store.setDashPanelLayout('parent', {
      placement: { mode: 'floating', disposition: { kind: 'free' } },
      preferredPosition: { x: 5, y: 6 },
    })
    expect(store.destroyScope('parent', { includeDescendants: true })).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['parent'],
    })
    child.release()
    parent.release()
    provider.release()
  })

  property.prop([
    fc.array(
      fc.oneof(
        fc.record({ kind: fc.constant('set' as const), scope: fc.constantFrom('a', 'b', 'c') }),
        fc.record({ kind: fc.constant('remove' as const), scope: fc.constantFrom('a', 'b', 'c') }),
        fc.record({
          kind: fc.constant('destroy' as const),
          scope: fc.constantFrom('a', 'b', 'c'),
          descendants: fc.boolean(),
        }),
        fc.record({ kind: fc.constant('acquire' as const), edge: fc.constantFrom(0, 1, 2, 3, 4) }),
        fc.record({ kind: fc.constant('release' as const), edge: fc.constantFrom(0, 1, 2, 3, 4) }),
      ),
      { minLength: 8, maxLength: 24 },
    ),
  ])('replays generated production/model lifecycle commands', (commands) => {
    const edges = [
      ['a', 'b'],
      ['b', 'c'],
      ['a', 'c'],
      ['c', 'a'],
      ['b', 'a'],
    ] as const
    const store = makeStore()
    const provider = acquireProviderLease(store)
    const entities = new Map<string, EntityLease>()
    for (const scopeId of ['a', 'b', 'c'])
      entities.set(
        scopeId,
        acquireEntityLease(store.scope(scopeId), { kind: 'dashList', host: provider }),
      )
    let modelState = createStoreScopeModel({ value: 1 }).state
    const productionLeases = new Map<number, RelationshipLease[]>()
    const modelLeaseIds = new Map<number, string[]>()
    const expectRelationshipProjection = () => {
      const productionCounts = edges.map((_, edge) => productionLeases.get(edge)?.length ?? 0)
      const modelCounts = edges.map(
        ([parentScopeId, childScopeId]) =>
          [...modelState.relationshipLeases.values()].filter(
            (lease) => lease.parentScopeId === parentScopeId && lease.childScopeId === childScopeId,
          ).length,
      )
      expect(productionCounts).toEqual(modelCounts)
      expect([...modelState.relationshipLeases.keys()].sort()).toEqual(
        [...modelLeaseIds.values()].flat().sort(),
      )
    }
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index]!
      if (command.kind === 'set') {
        const had = modelState.durableScopeIds.has(command.scope)
        const result = store.setDashListRootOrder(command.scope, [command.scope])
        expect(result.ok ? result.changedScopeIds : []).toEqual(had ? [] : [command.scope])
        modelState = setStoreScopeMetadata(modelState, command.scope)
      } else if (command.kind === 'remove') {
        store.removeDashListRootOrder(command.scope)
        modelState = clearStoreScopeMetadata(modelState, command.scope)
      } else if (command.kind === 'destroy') {
        const before = new Set(modelState.durableScopeIds)
        const next = destroyStoreScopeState(modelState, command.scope, command.descendants)
        const result = store.destroyScope(command.scope, {
          includeDescendants: command.descendants,
        })
        expect(result.ok && result.changedScopeIds).toEqual(
          [...before].filter((id) => !next.durableScopeIds.has(id)).sort(),
        )
        modelState = next
      } else if (command.kind === 'acquire') {
        const [parentScopeId, childScopeId] = edges[command.edge]!
        const leaseId = `${index}-${command.edge}`
        const transition = acquireStoreScopeRelationship(
          modelState,
          leaseId,
          parentScopeId,
          childScopeId,
        )
        try {
          const lease = acquireRelationshipLease(
            entities.get(parentScopeId)!,
            entities.get(childScopeId)!,
          )
          expect(transition.reason).toBeUndefined()
          productionLeases.set(command.edge, [...(productionLeases.get(command.edge) ?? []), lease])
          modelLeaseIds.set(command.edge, [...(modelLeaseIds.get(command.edge) ?? []), leaseId])
        } catch (error) {
          expect(transition.reason).toBeDefined()
          expect((error as PicodashContractError).code).toBe(
            transition.reason === 'parent-already-set'
              ? 'relationship-parent-conflict'
              : 'relationship-cycle',
          )
        }
        if (!transition.reason) modelState = transition.state
      } else {
        const leases = productionLeases.get(command.edge) ?? []
        const lease = leases.pop()
        if (lease) lease.release()
        const ids = modelLeaseIds.get(command.edge) ?? []
        const releasedId = ids.pop()
        modelLeaseIds.set(command.edge, ids)
        if (releasedId) modelState = releaseStoreScopeRelationship(modelState, releasedId).state
      }
      expect([...store.getState().scopes.keys()].sort()).toEqual(
        [...modelState.durableScopeIds].sort(),
      )
      expectRelationshipProjection()
    }
    for (const leases of productionLeases.values()) for (const lease of leases) lease.release()
    for (const entity of entities.values()) entity.release()
    provider.release()
  })
})
