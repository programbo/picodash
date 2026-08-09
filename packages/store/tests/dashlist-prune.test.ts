import { describe, expect, it, vi } from 'vite-plus/test'
import { acquireDashListNodeLease, type DashListNodeLease } from '../src/integration.ts'
import { createPicodashStore, PicodashContractError } from '../src/index.ts'

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

describe('DashList node leases and prune plans', () => {
  it('keeps node presence private, generation-safe, and root-destroying', () => {
    const store = makeStore()
    const scoped = store.scope('scope')
    scoped.setDashListRootOrder(['node'])
    let rootNotifications = 0
    let scopeNotifications = 0
    store.subscribe(() => rootNotifications++)
    scoped.subscribe(() => scopeNotifications++)
    const lease = acquireDashListNodeLease(scoped, { nodeId: 'node' })
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['node'])
    expect(rootNotifications).toBe(0)
    expect(scopeNotifications).toBe(0)
    expect(failure(() => acquireDashListNodeLease(scoped, { nodeId: 'node' })).context).toEqual({
      scopeId: 'scope',
      nodeId: 'node',
    })
    expect(failure(() => store.destroy({ discardUnpersisted: true })).code).toBe(
      'root-has-active-leases',
    )
    lease.release()
    lease.release()
    expect(rootNotifications).toBe(0)
    expect(scopeNotifications).toBe(0)
    const next = acquireDashListNodeLease(scoped, { nodeId: 'node' })
    next.release()
    store.destroy({ discardUnpersisted: true })
  })

  it('validates node options without invoking accessors', () => {
    const scoped = makeStore().scope('scope')
    for (const [options, reason] of [
      [null, 'not-object'],
      [[], 'not-object'],
      [{ extra: true }, 'unknown-key'],
      [{ nodeId: ' ' }, 'invalid-node-id'],
      [{ nodeId: 1 }, 'invalid-node-id'],
    ] as const) {
      expect(failure(() => acquireDashListNodeLease(scoped, options as never))).toMatchObject({
        code: 'invalid-dash-list-node-options',
        context: { reason },
      })
    }
    let invoked = false
    const options = Object.defineProperty({}, 'nodeId', {
      get() {
        invoked = true
        return 'node'
      },
    })
    expect(failure(() => acquireDashListNodeLease(scoped, options as never)).context).toEqual({
      reason: 'accessor-property',
    })
    expect(invoked).toBe(false)
  })

  it('reviews metadata candidates with fixed effects and excludes active IDs', () => {
    const store = makeStore()
    const scoped = store.scope('scope')
    scoped.setDashListRootOrder(['root', 'active'])
    scoped.setDashListGroupOrder('group', ['child', 'root'])
    scoped.setDashListCollapseOverride('collapsed', true)
    const active = acquireDashListNodeLease(scoped, { nodeId: 'active' })
    const review = scoped.createPrunePlan({ mode: 'review' })
    expect(review).toEqual({
      kind: 'dash-list-prune-review',
      scopeId: 'scope',
      candidates: [
        { nodeId: 'child', effects: ['group-order-entry'] },
        { nodeId: 'collapsed', effects: ['collapse-override'] },
        { nodeId: 'group', effects: ['group-order-owner'] },
        { nodeId: 'root', effects: ['root-order-entry', 'group-order-entry'] },
      ],
    })
    expect(Object.isFrozen(review)).toBe(true)
    expect(Object.isFrozen(review.candidates)).toBe(true)
    expect(Object.isFrozen(review.candidates[0]!.effects)).toBe(true)
    active.release()
  })

  it('requires exact explicit partitions and authoritative active inventory', () => {
    const store = makeStore()
    const scoped = store.scope('scope')
    scoped.setDashListRootOrder(['a', 'b'])
    const expected = ['a', 'b']
    for (const [options, reason] of [
      [{ mode: 'review', removeNodeIds: [] }, 'unknown-key'],
      [{ mode: 'explicit', removeNodeIds: ['a'], keepNodeIds: ['a', 'b'] }, 'overlapping-node-id'],
      [
        { mode: 'explicit', removeNodeIds: ['a'], keepNodeIds: [] },
        'incomplete-candidate-partition',
      ],
      [
        { mode: 'explicit', removeNodeIds: ['a', 'unknown'], keepNodeIds: ['b'] },
        'unknown-candidate',
      ],
    ] as const) {
      expect(failure(() => scoped.createPrunePlan(options as never)).context).toEqual({ reason })
    }
    const active = acquireDashListNodeLease(scoped, { nodeId: 'a' })
    expect(
      failure(() => scoped.createPrunePlan({ mode: 'inventory', knownNodeIds: [] })).context,
    ).toEqual({
      reason: 'missing-active-node',
    })
    const plan = scoped.createPrunePlan({ mode: 'inventory', knownNodeIds: expected })
    expect(plan.mode).toBe('inventory')
    expect(plan.removeNodeIds).toEqual([])
    expect(plan.keepNodeIds).toEqual(['b'])
    active.release()
  })

  it('fences plans by target metadata and active membership, then prunes only metadata', () => {
    const store = makeStore()
    const scoped = store.scope('scope')
    scoped.setDashListRootOrder(['a', 'b'])
    scoped.setDashListGroupOrder('group', ['a', 'b'])
    scoped.setDashListCollapseOverride('a', true)
    const unchangedByValue = scoped.createPrunePlan({
      mode: 'explicit',
      removeNodeIds: ['a', 'b', 'group'],
      keepNodeIds: [],
    })
    scoped.setValue(store.fields.value, 2)
    expect(scoped.executePrunePlan(unchangedByValue)).toMatchObject({
      ok: true,
      changedFields: [],
      changedScopeIds: ['scope'],
    })
    expect(scoped.getState().values.value).toBe(2)
    expect(scoped.getState().scope).toBeUndefined()

    scoped.setDashListRootOrder(['a'])
    const staleByMetadata = scoped.createPrunePlan({
      mode: 'inventory',
      knownNodeIds: [],
    })
    scoped.setDashListRootOrder(['a', 'c'])
    const staleResult = scoped.executePrunePlan(staleByMetadata)
    expect(staleResult.ok).toBe(false)
    if (!staleResult.ok)
      expect(staleResult.error.issues).toEqual([
        { code: 'stale_plan', path: [], message: 'Prune plan is stale.' },
      ])
    expect(failure(() => scoped.executePrunePlan(staleByMetadata)).context).toEqual({
      reason: 'consumed',
    })

    const staleByPresence = scoped.createPrunePlan({ mode: 'inventory', knownNodeIds: [] })
    const presence = acquireDashListNodeLease(scoped, { nodeId: 'a' })
    const presenceResult = scoped.executePrunePlan(staleByPresence)
    expect(presenceResult.ok).toBe(false)
    presence.release()

    const plan = scoped.createPrunePlan({ mode: 'inventory', knownNodeIds: [] })
    expect(scoped.executePrunePlan(plan)).toMatchObject({ ok: true, changedScopeIds: ['scope'] })
    expect(scoped.getState().scope).toBeUndefined()
  })

  it('rejects nested prune execution before consuming the plan', () => {
    const store = makeStore()
    const scoped = store.scope('scope')
    scoped.setDashListRootOrder(['stale'])
    const plan = scoped.createPrunePlan({ mode: 'inventory', knownNodeIds: [] })
    let nestedError: unknown
    const listener = vi.fn(() => {
      try {
        scoped.executePrunePlan(plan)
      } catch (error) {
        nestedError = error
      }
    })
    const unsubscribe = store.subscribe(listener)
    store.setDashListRootOrder('unrelated', ['node'])
    expect(listener).toHaveBeenCalledTimes(1)
    expect(nestedError).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    unsubscribe()
    expect(scoped.executePrunePlan(plan)).toMatchObject({
      ok: true,
      changedScopeIds: ['scope'],
    })
    store.destroy()
  })

  it('rejects forged, review, and foreign plans without exposing runtime state', () => {
    const store = makeStore()
    const scoped = store.scope('scope')
    scoped.setDashListRootOrder(['a'])
    const review = scoped.createPrunePlan({ mode: 'review' })
    expect(failure(() => scoped.executePrunePlan(review as never)).context).toEqual({
      reason: 'wrong-kind',
    })
    expect(
      failure(() => scoped.executePrunePlan({ kind: 'dash-list-prune-plan' } as never)).context,
    ).toEqual({
      reason: 'wrong-kind',
    })
    const foreignStore = makeStore()
    const foreignScope = foreignStore.scope('scope')
    foreignScope.setDashListRootOrder(['a'])
    const foreign = foreignScope.createPrunePlan({
      mode: 'explicit',
      removeNodeIds: ['a'],
      keepNodeIds: [],
    })
    expect(failure(() => scoped.executePrunePlan(foreign)).context).toEqual({
      reason: 'foreign-root',
    })
    const lease: DashListNodeLease = acquireDashListNodeLease(scoped, { nodeId: 'a' })
    expect(scoped.createPrunePlan({ mode: 'review' }).candidates).toEqual([])
    lease.release()
  })

  it('executes an empty prune plan as a no-op for quarantined metadata', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      storeId: 'quarantined-prune',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      initialEnvelope: {
        kind: 'picodash-store-envelope',
        formatVersion: 1,
        storeId: 'quarantined-prune',
        schemaVersion: 1,
        revision: 1,
        writerId: 'fixture',
        valueOwner: 'store',
        values: { value: 1 },
        scopes: [['scope', { dashList: { invalid: true } }]],
      },
    } as never)
    expect(store.metadataRecovery.getState().quarantinedScopes.has('scope')).toBe(true)
    const scoped = store.scope('scope')
    const plan = scoped.createPrunePlan({
      mode: 'explicit',
      removeNodeIds: [],
      keepNodeIds: [],
    })
    expect(scoped.executePrunePlan(plan)).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
    })
    store.destroy()
  })
})
