import { describe, expect, it } from 'vite-plus/test'
import { z } from 'zod'
import { clonePicodashValue } from '../../src/json.js'
import {
  createInvalidJsonBoundaryCases,
  ownDataRecord,
  strictJsonValueArbitrary,
} from './json-fixtures.js'
import { createExternalAdapter } from './external-adapter.js'
import { createMemoryPersistence, createMemoryPersistenceDriver } from './memory-persistence.js'
import {
  asyncStandardSchema,
  runStandardSchemaSynchronously,
  schemaFailure,
  schemaSuccess,
  syncStandardSchema,
} from './standard-schema-fixtures.js'
import {
  acquireStoreScopeRelationship,
  clearStoreScopeMetadata,
  createStoreScopeModel,
  destroyStoreScopeState,
  releaseStoreScopeRelationship,
  setStoreScopeMetadata,
} from './store-scope-model.js'

describe('test-only fixture foundation', () => {
  it('generates strict JSON and fresh hostile boundary values', () => {
    expect(strictJsonValueArbitrary).toBeDefined()
    const first = createInvalidJsonBoundaryCases()
    const second = createInvalidJsonBoundaryCases()
    expect(first).not.toBe(second)
    expect(first.map((entry) => entry.value)).not.toEqual(second.map((entry) => entry.value))
    for (const boundary of first)
      expect(() => clonePicodashValue(boundary.value as never)).toThrow()
    const hostile = ownDataRecord([['__proto__', { safe: true }]])
    expect(Object.prototype.hasOwnProperty.call(hostile, '__proto__')).toBe(true)
    expect((Object.prototype as Record<string, unknown>).safe).toBeUndefined()
  })

  it('keeps Standard Schema fixtures synchronous and exposes raw protocol results', () => {
    const success = syncStandardSchema<number>(() => schemaSuccess(3))
    expect(runStandardSchemaSynchronously(success, 'input')).toEqual({
      value: 3,
      issues: undefined,
    })
    const failure = syncStandardSchema<number>(() =>
      schemaFailure([{ message: 'bad', path: ['value'] }]),
    )
    expect(runStandardSchemaSynchronously(failure, 1)).toEqual({
      issues: [{ message: 'bad', path: ['value'] }],
    })
    const asyncSchema = asyncStandardSchema<number>(() => Promise.resolve(schemaSuccess(1)))
    expect(() => runStandardSchemaSynchronously(asyncSchema, 1)).toThrow(/asynchronous/i)
  })

  it('runs Zod Standard Schema success, transform, failure, and issue paths', () => {
    const transformed = runStandardSchemaSynchronously(
      z.coerce.number().transform((value) => value * 2),
      '4',
    )
    expect(transformed).toEqual({ value: 8 })
    const schema = z.object({ nested: z.object({ count: z.number() }) })
    const result = runStandardSchemaSynchronously(schema, { nested: { count: 'nope' } } as never)
    expect('issues' in result).toBe(true)
    if ('issues' in result && result.issues !== undefined)
      expect(result.issues[0]?.path).toEqual(['nested', 'count'])
  })

  it('models root values and scope metadata with immutable semantic no-ops', () => {
    const values = { count: 1 }
    const model = createStoreScopeModel(values)
    expect(model.resolveScope('a').state).toBe(model.state)
    expect(model.replaceValues(values).state).toBe(model.state)
    const insertionOrderModel = createStoreScopeModel({ a: 1, b: 2 })
    expect(insertionOrderModel.replaceValues({ b: 2, a: 1 }).state).toBe(insertionOrderModel.state)
    values.count = 9
    expect(model.state.values).toEqual({ count: 1 })
    const withMetadata = setStoreScopeMetadata(model.state, 'a')
    expect(withMetadata.values).not.toBe(values)
    expect(withMetadata.durableScopeIds.has('a')).toBe(true)
    const cleared = clearStoreScopeMetadata(withMetadata, 'a')
    expect(cleared.durableScopeIds.has('a')).toBe(false)
    expect(() => (withMetadata.durableScopeIds as Set<string>).add('external')).toThrow()
    expect(() => Set.prototype.add.call(withMetadata.durableScopeIds, 'external')).toThrow()
    expect(() =>
      Map.prototype.set.call(withMetadata.relationshipLeases as Map<string, unknown>, 'x', 1),
    ).toThrow()
  })

  it('enforces one parent, acyclicity, named release, and descendant state destruction', () => {
    const resolved = createStoreScopeModel({ count: 1 }).resolveScope('root').state
    const leaseWithoutMetadata = acquireStoreScopeRelationship(
      resolved,
      'ephemeral',
      'root',
      'ephemeral-child',
    )
    expect(leaseWithoutMetadata.state.durableScopeIds.size).toBe(0)
    let state = setStoreScopeMetadata(createStoreScopeModel({ count: 1 }).state, 'root')
    state = setStoreScopeMetadata(state, 'child')
    state = setStoreScopeMetadata(state, 'grandchild')
    const rootLease = acquireStoreScopeRelationship(state, 'root-child', 'root', 'child')
    expect(rootLease.reason).toBeUndefined()
    state = rootLease.state
    const sameEdgeLease = acquireStoreScopeRelationship(state, 'root-child-2', 'root', 'child')
    expect(sameEdgeLease.reason).toBeUndefined()
    state = sameEdgeLease.state
    const childLease = acquireStoreScopeRelationship(
      state,
      'child-grandchild',
      'child',
      'grandchild',
    )
    expect(childLease.reason).toBeUndefined()
    state = childLease.state
    expect(acquireStoreScopeRelationship(state, 'other-parent', 'other', 'child').reason).toBe(
      'parent-already-set',
    )
    expect(acquireStoreScopeRelationship(state, 'cycle', 'grandchild', 'root').reason).toBe('cycle')
    expect(state.relationshipLeases.size).toBe(3)
    const exposedEntry = [...state.relationshipLeases.entries()][0]
    if (exposedEntry !== undefined) exposedEntry[0] = 'tampered'
    expect(state.relationshipLeases.has('root-child')).toBe(true)
    expect(releaseStoreScopeRelationship(state, 'missing').state).toBe(state)
    const releasedOne = releaseStoreScopeRelationship(state, 'root-child')
    expect(releasedOne.reason).toBeUndefined()
    expect(destroyStoreScopeState(releasedOne.state, 'root', true).durableScopeIds.size).toBe(0)
    const releasedFinal = releaseStoreScopeRelationship(releasedOne.state, 'root-child-2')
    expect(releasedFinal.reason).toBeUndefined()
    const noDescendants = destroyStoreScopeState(releasedFinal.state, 'root', true)
    expect(noDescendants.durableScopeIds.has('root')).toBe(false)
    expect(noDescendants.durableScopeIds.has('child')).toBe(true)
    const destroyed = destroyStoreScopeState(state, 'root', true)
    expect(destroyed.durableScopeIds.size).toBe(0)
    expect(destroyed.relationshipLeases).toBe(state.relationshipLeases)
    expect(destroyed.values).toBe(state.values)
    expect(destroyStoreScopeState(state, 'root', false).durableScopeIds.has('child')).toBe(true)
    expect(acquireStoreScopeRelationship(state, 'other-parent', 'other', 'child').state).toBe(state)
  })

  it('provides shared-identity synchronous persistence drivers with atomic failures', () => {
    const persistence = createMemoryPersistence({ shared: 'one' })
    const second = createMemoryPersistenceDriver(persistence.backend)
    expect(second).not.toBe(persistence)
    expect(second.identity).toBe(persistence.identity)
    expect(Object.isFrozen(persistence.identity)).toBe(true)
    const events: string[] = []
    const unsubscribe = second.subscribe('shared', () => events.push('changed'))
    expect(persistence.read('shared')).toBe('one')
    persistence.write('shared', 'two')
    expect(second.read('shared')).toBe('two')
    persistence.write('isolated', 'value')
    expect(second.read('shared')).toBe('two')
    expect(events).toEqual(['changed'])
    persistence.failNext('write')
    expect(() => persistence.write('shared', 'three')).toThrow()
    expect(second.read('shared')).toBe('two')
    persistence.foreignWrite('shared', 'foreign')
    expect(second.read('shared')).toBe('foreign')
    persistence.remove('shared')
    expect(second.read('shared')).toBeNull()
    persistence.foreignWrite('shared', null)
    expect(events).toHaveLength(4)
    persistence.failNext('read')
    expect(() => persistence.read('shared')).toThrow()
    persistence.failNext('remove')
    expect(() => persistence.remove('isolated')).toThrow()
    expect(persistence.read('isolated')).toBe('value')
    unsubscribe()
    unsubscribe()
    expect(Object.isFrozen(persistence.calls)).toBe(true)
    expect(persistence.calls.every((call) => Object.isFrozen(call))).toBe(true)
  })

  it('exercises all external adapter failure modes and payload-free notifications', () => {
    const first = { count: 1 }
    const second = { count: 2 }
    const adapter = createExternalAdapter(first)
    first.count = 7
    const notifications: unknown[][] = []
    const unsubscribe = adapter.subscribe((...args: unknown[]) => notifications.push(args))
    const initialVisible = adapter.getSnapshot()
    expect(initialVisible).not.toBe(first)
    expect(adapter.getSnapshot()).toBe(initialVisible)
    adapter.nextWrite('commit')
    const writePayload = { count: 2 }
    const writeContext = { source: 'test' }
    adapter.setValues(writePayload, writeContext)
    writePayload.count = 8
    writeContext.source = 'mutated'
    const committedVisible = adapter.getSnapshot()
    expect(committedVisible).toEqual(second)
    expect(adapter.getSnapshot()).toBe(committedVisible)
    expect(adapter.writes[0]?.context).toEqual({ source: 'test' })
    adapter.nextWrite('throw-before-mutation')
    expect(() => adapter.setValues(first)).toThrow()
    expect(adapter.getSnapshot()).toBe(committedVisible)
    adapter.nextWrite('defer-visibility')
    adapter.setValues(first)
    expect(adapter.getSnapshot()).toBe(committedVisible)
    adapter.revealDeferredWrite()
    expect(adapter.getSnapshot()).toEqual(first)
    adapter.nextWrite('commit-mismatch', { count: 99 })
    adapter.setValues(second)
    expect(adapter.getSnapshot()).toEqual({ count: 99 })
    adapter.nextWrite('commit-mismatch', null)
    adapter.setValues(second)
    expect(adapter.getSnapshot()).toBeNull()
    adapter.failReads(1)
    expect(() => adapter.getSnapshot()).toThrow()
    adapter.replaceSnapshot(second)
    expect(notifications.every((args) => args.length === 0)).toBe(true)
    unsubscribe()
    unsubscribe()
    expect(adapter.writes).toHaveLength(5)
  })
})
