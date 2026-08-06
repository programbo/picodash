import { describe, expect, it } from 'vite-plus/test'
import {
  createPicodashStore,
  PicodashContractError,
  type PicodashEnvelopeInput,
  type PicodashPersistenceDriver,
  type StoreOwnedConfig,
} from '../src/index.ts'
import { PicodashInitializationError } from '../src/adapter.ts'
import { decodePersistenceEnvelope, encodePersistenceEnvelope } from '../src/persistence.ts'
import { createMemoryPersistence } from './support/memory-persistence.js'

const makeConfig = (driver: PicodashPersistenceDriver) => ({
  valueOwner: 'store' as const,
  storeId: 'persistence-test',
  schemaVersion: 1,
  fields: {
    count: { defaultValue: 1 },
    secret: { defaultValue: 'hidden' },
  },
  persistence: {
    storageKey: 'state',
    driver,
    values: { defaultFieldPolicy: 'include' as const },
  },
})

describe('Store-owned alpha persistence', () => {
  it('saves a canonical envelope and hydrates a second root', () => {
    const persistence = createMemoryPersistence()
    const first = createPicodashStore(makeConfig(persistence))
    expect(first.persistence?.getState()).toMatchObject({ status: 'clean', liveRevision: 0 })
    const result = first.setValues({ count: 2 })
    expect(result).toMatchObject({ ok: true, persistence: 'saved' })
    const payload = persistence.inspect('state')
    expect(payload).toContain('"valueOwner":"store"')
    expect(payload).toContain('hidden')
    first.destroy()

    const second = createPicodashStore(makeConfig(persistence))
    expect(second.getState().values.count).toBe(2)
    expect(second.persistence?.getState()).toMatchObject({
      status: 'clean',
      durableRevision: 1,
      liveRevision: 1,
    })
    second.destroy()
  })

  it('applies field omission while retaining durable metadata', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore({
      ...makeConfig(persistence),
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'omit', fields: { count: 'include' } },
      },
    })
    store.setDashListRootOrder('scope', ['item'])
    const raw = persistence.inspect('state')!
    expect(raw).toContain('count')
    expect(raw).not.toContain('secret')
    expect(raw).toContain('scope')
    const envelope = JSON.parse(raw as string)
    expect(envelope.scopes).toEqual([
      [
        'scope',
        {
          dashList: {
            rootOrder: ['item'],
            groupOrders: [],
            collapseOverrides: [],
          },
        },
      ],
    ])
    store.destroy({ discardUnpersisted: true })
  })

  it('does not write or retry for omitted-only changes', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore({
      ...makeConfig(persistence),
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'include', fields: { secret: 'omit' } },
      },
    })
    const before = persistence.calls.length
    expect(store.setValues({ secret: 'omitted' })).toMatchObject({
      ok: true,
      persistence: 'unchanged',
    })
    expect(persistence.calls.length).toBe(before)
    persistence.failNext('write')
    expect(store.setValues({ count: 2 })).toMatchObject({ ok: true, persistence: 'pending' })
    const pendingBefore = persistence.calls.length
    expect(store.setValues({ secret: 'still omitted' })).toMatchObject({
      ok: true,
      persistence: 'unchanged',
    })
    expect(persistence.calls.length).toBe(pendingBefore)
    store.destroy({ discardUnpersisted: true })
  })

  it('snapshots the disclosure policy instead of rereading caller objects', () => {
    const persistence = createMemoryPersistence()
    const policy = {
      defaultFieldPolicy: 'omit' as const,
      fields: { count: 'include' as const },
    }
    const store = createPicodashStore({
      ...makeConfig(persistence),
      persistence: { storageKey: 'state', driver: persistence, values: policy },
    })
    ;(policy.fields as Record<string, string>).count = 'omit'
    ;(policy.fields as Record<string, string>).secret = 'include'
    ;(policy as { defaultFieldPolicy: string }).defaultFieldPolicy = 'include'
    expect(store.setValues({ count: 2 })).toMatchObject({ persistence: 'saved' })
    expect(JSON.parse(persistence.inspect('state') as string).values).toEqual({ count: 2 })
    expect(store.setValues({ secret: 'changed' })).toMatchObject({ persistence: 'unchanged' })
    store.destroy()
  })

  it('keeps live values and exposes pending/error state after driver failure', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    persistence.failNext('write')
    const result = store.setValues({ count: 3 })
    expect(result).toMatchObject({ ok: true, persistence: 'pending' })
    expect(store.getState().values.count).toBe(3)
    expect(store.persistence?.getState()).toMatchObject({
      status: 'error',
      hasPendingEnvelope: true,
    })
    expect(store.persistence?.flush()).toBe('saved')
    expect(store.persistence?.getState()).toMatchObject({ status: 'clean' })
    store.destroy()
  })

  it('replaces an older pending envelope with the newest complete commit', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    persistence.failNext('write')
    persistence.failNext('write')
    expect(store.setValues({ count: 2 })).toMatchObject({ ok: true, persistence: 'pending' })
    expect(store.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })
    expect(store.persistence?.getState()).toMatchObject({
      status: 'error',
      hasPendingEnvelope: true,
    })
    expect(store.persistence?.flush()).toBe('saved')
    expect(JSON.parse(persistence.inspect('state') as string).values.count).toBe(3)
    expect(store.persistence?.getState()).toMatchObject({ status: 'clean', liveRevision: 2 })
    store.destroy()
  })

  it('detects foreign envelopes and never overwrites them', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 2 })
    const persisted = persistence.inspect('state')
    expect(typeof persisted).toBe('string')
    const foreign = JSON.parse(persisted as string)
    foreign.revision += 1
    foreign.writerId = 'foreign'
    foreign.values.count = 9
    persistence.foreignWrite('state', JSON.stringify(foreign))
    expect(store.persistence?.getState()).toMatchObject({ status: 'conflict' })
    const before = persistence.inspect('state')
    expect(store.setValues({ count: 4 })).toMatchObject({ ok: true, persistence: 'pending' })
    expect(persistence.inspect('state')).toBe(before)
    expect(store.persistence?.flush()).toBe('pending')
    store.destroy({ discardUnpersisted: true })
  })

  it('keeps the live root and ownership when a later envelope is semantically invalid', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 2 })
    const confirmed = persistence.inspect('state') as string
    const invalid = JSON.parse(confirmed)
    delete invalid.values.secret
    persistence.foreignWrite('state', JSON.stringify(invalid))
    expect(store.persistence.getState()).toMatchObject({
      status: 'error',
      lastError: { reason: 'invalid-later-envelope' },
    })
    expect(() => createPicodashStore(makeConfig(persistence))).toThrowError(
      expect.objectContaining({ code: 'persistence-identity-in-use' }),
    )
    expect(() => store.destroy()).toThrowError(
      expect.objectContaining({ code: 'root-has-unpersisted-state' }),
    )
    persistence.foreignWrite('state', confirmed)
    expect(store.persistence.getState()).toMatchObject({
      status: 'pending',
      hasPendingEnvelope: true,
    })
    expect(store.persistence.flush()).toBe('saved')
    expect(store.persistence.getState()).toMatchObject({
      status: 'clean',
      hasPendingEnvelope: false,
    })
    store.destroy()
  })

  it('detects foreign removal before a write even without subscriptions', () => {
    const persistence = createMemoryPersistence()
    const noSubscriptionDriver = {
      ...persistence,
      subscribe: undefined,
    } as PicodashPersistenceDriver
    const store = createPicodashStore(makeConfig(noSubscriptionDriver))
    expect(store.setValues({ count: 2 })).toMatchObject({ ok: true, persistence: 'saved' })
    persistence.foreignWrite('state', null)
    const before = persistence.calls.length
    expect(store.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })
    expect(store.persistence.getState()).toMatchObject({
      status: 'conflict',
      conflict: { reason: 'foreign-removal' },
    })
    expect(persistence.calls.slice(before).some((call) => call.kind === 'write')).toBe(false)
    store.destroy({ discardUnpersisted: true })
  })

  it('treats foreign removal as a conflict and ignores synchronous write echoes', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    expect(store.setValues({ count: 2 })).toMatchObject({ ok: true, persistence: 'saved' })
    expect(store.persistence?.getState()).toMatchObject({ status: 'clean' })
    persistence.foreignWrite('state', null)
    expect(store.persistence?.getState()).toMatchObject({
      status: 'conflict',
      conflict: { reason: 'foreign-removal' },
    })
    const callsBefore = persistence.calls.length
    expect(store.persistence?.flush()).toBe('pending')
    expect(persistence.calls.slice(callsBefore).some((call) => call.kind === 'write')).toBe(false)
    expect(persistence.calls.some((call) => call.kind === 'remove')).toBe(false)
    store.destroy({ discardUnpersisted: true })
  })

  it('shares one capability across root and scoped views and hardens lifecycle', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    const scoped = store.scope('scope')
    expect(store.persistence).toBe(scoped.persistence)
    const captured = store.persistence!
    store.destroy()
    expect(() => captured.getState()).toThrowError(PicodashContractError)
  })

  it('releases the identity claim and refuses destruction with pending state', () => {
    const persistence = createMemoryPersistence()
    const first = createPicodashStore(makeConfig(persistence))
    persistence.failNext('write')
    first.setValues({ count: 2 })
    expect(() => first.destroy()).toThrowError(
      expect.objectContaining({ code: 'root-has-unpersisted-state' }),
    )
    const captured = first.persistence!
    first.destroy({ discardUnpersisted: true })
    expect(() => captured.flush()).toThrowError(PicodashContractError)
    const second = createPicodashStore(makeConfig(persistence))
    expect(second.persistence).toBeDefined()
    expect(persistence.calls.some((call) => call.kind === 'remove')).toBe(false)
    second.destroy()
  })

  it('reports driver initialization reasons without retaining causes or storage data', () => {
    const persistence = createMemoryPersistence()
    persistence.failNext('read', new Error('secret driver cause'))
    expect(() => createPicodashStore(makeConfig(persistence))).toThrowError(
      expect.objectContaining({ code: 'persistence-driver-unavailable', reason: 'read' }),
    )
    const malformed = createMemoryPersistence({ state: '{"writerId":"secret"}' })
    try {
      createPicodashStore(makeConfig(malformed))
      throw new Error('expected malformed envelope')
    } catch (error) {
      expect(error).toMatchObject({ code: 'invalid-persistence-envelope' })
      expect(String(error)).not.toContain('secret')
    }
  })

  it('rejects disclosed fields outside the active persistence policy', () => {
    const source = createMemoryPersistence()
    const envelope = encodePersistenceEnvelope({
      storeId: 'persistence-test',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer',
      values: { count: 2, secret: 'disclosed' },
      scopes: new Map(),
      includeField: () => true,
    }).serialized
    source.foreignWrite('state', envelope)
    expect(() =>
      createPicodashStore({
        ...makeConfig(source),
        persistence: {
          storageKey: 'state',
          driver: source,
          values: { defaultFieldPolicy: 'omit' },
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'invalid-persistence-envelope', reason: 'values' }),
    )
  })

  it('rejects envelopes that omit a field disclosed by the active policy', () => {
    const envelope = encodePersistenceEnvelope({
      storeId: 'persistence-test',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer',
      values: { count: 2 },
      scopes: new Map(),
      includeField: (key) => key === 'count',
    }).serialized
    const driver = createMemoryPersistence({ state: envelope })
    expect(() => createPicodashStore(makeConfig(driver))).toThrowError(
      expect.objectContaining({ code: 'invalid-persistence-envelope', reason: 'values' }),
    )
    expect(() =>
      createPicodashStore({
        ...makeConfig(createMemoryPersistence()),
        initialEnvelope: JSON.parse(envelope),
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'invalid-persistence-envelope', reason: 'values' }),
    )
  })

  it('baseline-fills fields omitted by policy', () => {
    const serialized = encodePersistenceEnvelope({
      storeId: 'persistence-test',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer',
      values: { count: 2 },
      scopes: new Map(),
      includeField: (key) => key === 'count',
    }).serialized
    const driver = createMemoryPersistence({ state: serialized })
    const store = createPicodashStore({
      ...makeConfig(driver),
      persistence: {
        storageKey: 'state',
        driver,
        values: { defaultFieldPolicy: 'omit', fields: { count: 'include' } },
      },
    })
    expect(store.getState().values).toEqual({ count: 2, secret: 'hidden' })
    store.destroy()

    const initialDriver = createMemoryPersistence()
    const initialStore = createPicodashStore({
      ...makeConfig(initialDriver),
      initialEnvelope: JSON.parse(serialized),
      persistence: {
        storageKey: 'state',
        driver: initialDriver,
        values: { defaultFieldPolicy: 'omit', fields: { count: 'include' } },
      },
    })
    expect(initialStore.getState().values).toEqual({ count: 2, secret: 'hidden' })
    initialStore.destroy()
  })

  it('rejects hostile persistence policy records without invoking accessors', () => {
    const persistence = createMemoryPersistence()
    const hostileValues = Object.defineProperty({ defaultFieldPolicy: 'include' }, 'fields', {
      enumerable: true,
      get: () => {
        throw new Error('PRIVATE_GETTER')
      },
    })
    expect(() =>
      createPicodashStore({
        ...makeConfig(persistence),
        persistence: {
          storageKey: 'state',
          driver: persistence,
          values: hostileValues,
        },
      } as never),
    ).toThrowError(expect.objectContaining({ code: 'invalid-configuration' }))
    const unknown = {
      defaultFieldPolicy: 'include',
      extra: 'unknown',
    }
    expect(() =>
      createPicodashStore({
        ...makeConfig(persistence),
        persistence: { storageKey: 'state', driver: persistence, values: unknown },
      } as never),
    ).toThrowError(expect.objectContaining({ code: 'invalid-configuration' }))
    const symbolValues = { defaultFieldPolicy: 'include' as const } as Record<PropertyKey, unknown>
    Object.defineProperty(symbolValues, Symbol('private'), { enumerable: true, value: 'x' })
    expect(() =>
      createPicodashStore({
        ...makeConfig(persistence),
        persistence: { storageKey: 'state', driver: persistence, values: symbolValues },
      } as never),
    ).toThrowError(expect.objectContaining({ code: 'invalid-configuration' }))
  })

  it('rejects disagreement between driver and initial hydration sources', () => {
    const persistence = createMemoryPersistence()
    const seeded = encodePersistenceEnvelope({
      storeId: 'persistence-test',
      schemaVersion: 1,
      revision: 2,
      writerId: 'driver-writer',
      values: { count: 2, secret: 'driver' },
      scopes: new Map(),
      includeField: () => true,
    }).serialized
    persistence.foreignWrite('state', seeded)
    const initial = encodePersistenceEnvelope({
      storeId: 'persistence-test',
      schemaVersion: 1,
      revision: 3,
      writerId: 'initial-writer',
      values: { count: 2, secret: 'driver' },
      scopes: new Map(),
      includeField: () => true,
    }).envelope
    expect(() =>
      createPicodashStore({ ...makeConfig(persistence), initialEnvelope: initial }),
    ).toThrowError(
      expect.objectContaining({ code: 'hydration-source-conflict', reason: 'revision' }),
    )
  })

  it('establishes subscriptions before seeding and leaves empty storage untouched on failure', () => {
    const failing = createMemoryPersistence()
    failing.failNext('subscribe')
    const initial = encodePersistenceEnvelope({
      storeId: 'seed-failure',
      schemaVersion: 1,
      revision: 1,
      writerId: 'initial',
      values: { value: 2 },
      scopes: new Map(),
      includeField: () => true,
    }).envelope
    expect(() =>
      createPicodashStore({
        valueOwner: 'store',
        storeId: 'seed-failure',
        schemaVersion: 1,
        fields: { value: { defaultValue: 1 } },
        initialEnvelope: initial,
        persistence: {
          storageKey: 'state',
          driver: failing,
          values: { defaultFieldPolicy: 'include' },
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'persistence-driver-unavailable', reason: 'subscribe' }),
    )
    expect(failing.inspect('state')).toBeNull()
    expect(failing.calls.some((call) => call.kind === 'write')).toBe(false)
  })

  it('closes the subscribe/read race before deciding to seed', () => {
    const backend = createMemoryPersistence()
    const raced = encodePersistenceEnvelope({
      storeId: 'seed-race',
      schemaVersion: 1,
      revision: 7,
      writerId: 'racing-writer',
      values: { value: 6 },
      scopes: new Map(),
      includeField: () => true,
    }).serialized
    const driver: PicodashPersistenceDriver = {
      ...backend,
      subscribe(key, listener) {
        backend.foreignWrite(key, raced)
        return backend.subscribe!(key, listener)
      },
    }
    const store = createPicodashStore({
      valueOwner: 'store',
      storeId: 'seed-race',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      initialEnvelope: encodePersistenceEnvelope({
        storeId: 'seed-race',
        schemaVersion: 1,
        revision: 7,
        writerId: 'initial-writer',
        values: { value: 6 },
        scopes: new Map(),
        includeField: () => true,
      }).envelope,
      persistence: {
        storageKey: 'state',
        driver,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    expect(store.persistence.getState()).toMatchObject({ durableRevision: 7 })
    expect(JSON.parse(backend.inspect('state') as string).writerId).toBe('racing-writer')
    expect(backend.calls.filter((call) => call.kind === 'write')).toHaveLength(0)
    store.destroy()
  })

  it('reports a second-read driver failure separately from an invalid envelope', () => {
    const backend = createMemoryPersistence()
    let reads = 0
    const driver: PicodashPersistenceDriver = {
      ...backend,
      read(key) {
        reads += 1
        if (reads === 2) throw new Error('second read failed')
        return backend.read(key)
      },
    }
    expect(() =>
      createPicodashStore({
        ...makeConfig(driver),
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'persistence-driver-unavailable', reason: 'read' }),
    )
    const store = createPicodashStore(makeConfig(backend))
    store.destroy()

    const invalidBackend = createMemoryPersistence()
    const valid = encodePersistenceEnvelope({
      storeId: 'persistence-test',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer',
      values: { count: 1, secret: 'hidden' },
      scopes: new Map(),
      includeField: () => true,
    }).serialized
    const invalid = JSON.parse(valid)
    delete invalid.values.secret
    const invalidDriver: PicodashPersistenceDriver = {
      ...invalidBackend,
      subscribe(key, listener) {
        invalidBackend.foreignWrite(key, JSON.stringify(invalid))
        return invalidBackend.subscribe(key, listener)
      },
    }
    expect(() => createPicodashStore(makeConfig(invalidDriver))).toThrowError(
      expect.objectContaining({ code: 'invalid-persistence-envelope', reason: 'values' }),
    )
    invalidBackend.foreignWrite('state', valid)
    const recovered = createPicodashStore(makeConfig(invalidBackend))
    recovered.destroy()
  })

  it('uses the root diagnostic object and occurrence sequence for persistence failures', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    const throwing = store.subscribe(() => {
      throw new Error('PRIVATE_ROOT')
    })
    store.setValues({ count: 2 })
    throwing()
    persistence.failNext('write')
    store.setValues({ count: 3 })
    const persistenceDiagnostic = [...store.diagnostics.getState().current.values()].find(
      (entry) => entry.code === 'persistence_failure',
    )!
    const state = store.persistence.getState()
    expect(state.status).toBe('error')
    if (state.status === 'error') {
      expect(state.lastError).toBe(persistenceDiagnostic)
      expect(state.lastError.lastOccurrence).toBeGreaterThan(1)
      expect(Object.isFrozen(state.lastError)).toBe(true)
      expect(Object.isFrozen(state.lastError.identity)).toBe(true)
    }
    store.persistence.flush()
    store.destroy()
  })

  it('dispatches capability subscribers through the diagnostics boundary', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    let capabilityNotifications = 0
    const unsubscribe = store.persistence!.subscribe(() => {
      capabilityNotifications += 1
    })
    persistence.failNext('write')
    store.setValues({ count: 2 })
    expect(capabilityNotifications).toBeGreaterThan(0)
    expect(
      [...store.diagnostics.getState().current.values()].find(
        (item) => item.code === 'persistence_failure',
      ),
    ).toMatchObject({
      code: 'persistence_failure',
      reason: 'write-failed',
    })
    unsubscribe()
    store.persistence!.flush()
    expect(store.diagnostics.getState().current.has('persistence')).toBe(false)
    store.destroy()
  })

  it('keeps persistence callbacks under the Store write reentrancy guard', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    const errors: PicodashContractError[] = []
    store.persistence.subscribe(() => {
      try {
        store.setValues({ count: 9 })
      } catch (error) {
        errors.push(error as PicodashContractError)
      }
    })
    persistence.failNext('write')
    store.setValues({ count: 2 })
    expect(errors.some((error) => error.code === 'reentrant-write')).toBe(true)
    expect(store.getState().values.count).toBe(2)
    store.persistence.flush()
    store.destroy()
  })

  it('keeps hydrated scope maps and nested metadata maps deeply immutable', () => {
    const persistence = createMemoryPersistence()
    const source = createPicodashStore(makeConfig(persistence))
    source.setDashListRootOrder('scope', ['item'])
    const raw = persistence.inspect('state') as string
    source.destroy()
    const hydrated = createPicodashStore({
      ...makeConfig(persistence),
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    const scopes = hydrated.getState().scopes as unknown as Map<string, unknown>
    expect(() => Map.prototype.set.call(scopes, 'other', {})).toThrow()
    const metadata = hydrated.getState().scopes.get('scope')!
    const groupOrders = (metadata as any).dashList.groupOrders as Map<string, unknown>
    expect(() => Map.prototype.clear.call(groupOrders)).toThrow()
    expect(hydrated.getState().scopes.get('scope')).toBe(metadata)
    hydrated.destroy()
    expect(raw).toContain('scope')
  })

  it('encodes equivalent records deterministically', () => {
    const left = encodePersistenceEnvelope({
      storeId: 'deterministic',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer',
      values: { b: 2, a: 1 },
      scopes: new Map([
        [
          'z',
          { dashList: { rootOrder: ['z'], groupOrders: new Map(), collapseOverrides: new Map() } },
        ],
        [
          'a',
          { dashList: { rootOrder: ['a'], groupOrders: new Map(), collapseOverrides: new Map() } },
        ],
      ]),
      includeField: () => true,
    })
    const right = encodePersistenceEnvelope({
      storeId: 'deterministic',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer',
      values: { a: 1, b: 2 },
      scopes: new Map([
        [
          'a',
          { dashList: { rootOrder: ['a'], groupOrders: new Map(), collapseOverrides: new Map() } },
        ],
        [
          'z',
          { dashList: { rootOrder: ['z'], groupOrders: new Map(), collapseOverrides: new Map() } },
        ],
      ]),
      includeField: () => true,
    })
    expect(left.serialized).toBe(right.serialized)
    expect(left.content).toBe(right.content)
  })

  it('requires canonical, data-only scope tuples and authority-specific envelopes', () => {
    const encoded = encodePersistenceEnvelope({
      storeId: 'persistence-test',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer',
      values: { count: 1, secret: 'hidden' },
      scopes: new Map(),
      includeField: () => true,
    }).envelope as Record<string, unknown>
    const valid = {
      ...encoded,
      scopes: [
        ['a', {}],
        ['z', {}],
      ],
    }
    const decoded = decodePersistenceEnvelope(valid, {
      storeId: 'persistence-test',
      schemaVersion: 1,
    })
    expect(decoded.ok).toBe(true)
    if (decoded.ok) expect(decoded.envelope.scopes.map(([scopeId]) => scopeId)).toEqual(['a', 'z'])
    const unsorted = { ...valid, scopes: [...(valid.scopes as unknown[])].reverse() }
    expect(
      decodePersistenceEnvelope(unsorted, { storeId: 'persistence-test', schemaVersion: 1 }),
    ).toMatchObject({ ok: false, reason: 'metadata' })

    let getterCalls = 0
    const tuple = ['scope', {}] as unknown as Record<string, unknown>
    Object.defineProperty(tuple, '0', {
      enumerable: true,
      get: () => {
        getterCalls += 1
        return 'scope'
      },
    })
    const hostile = { ...valid, scopes: [tuple] }
    expect(
      decodePersistenceEnvelope(hostile, { storeId: 'persistence-test', schemaVersion: 1 }),
    ).toMatchObject({ ok: false, reason: 'metadata' })
    expect(getterCalls).toBe(0)

    const external = {
      kind: 'picodash-store-envelope',
      formatVersion: 1,
      storeId: 'persistence-test',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer',
      valueOwner: 'external',
      scopes: [],
    }
    expect(
      decodePersistenceEnvelope(external, { storeId: 'persistence-test', schemaVersion: 1 }),
    ).toMatchObject({ ok: false, reason: 'authority' })
  })

  it('hydrates a driver-free initial envelope without exposing a capability', () => {
    const envelope = encodePersistenceEnvelope({
      storeId: 'initial-envelope-test',
      schemaVersion: 1,
      revision: 4,
      writerId: 'fixture-writer',
      values: { count: 8, secret: 'from-envelope' },
      scopes: new Map(),
      includeField: () => true,
    }).envelope as PicodashEnvelopeInput<{ count: number; secret: string }>
    const config: StoreOwnedConfig<{
      readonly count: { readonly defaultValue: number }
      readonly secret: { readonly defaultValue: string }
    }> = {
      valueOwner: 'store',
      storeId: 'initial-envelope-test',
      schemaVersion: 1,
      fields: {
        count: { defaultValue: 1 },
        secret: { defaultValue: 'default' },
      },
      initialEnvelope: envelope,
    }
    const store = createPicodashStore(config)
    expect(store.getState().values).toEqual({ count: 8, secret: 'from-envelope' })
    expect(Reflect.has(store, 'persistence')).toBe(false)
    store.destroy()
  })

  it('seeds an empty driver from an initial envelope before activation', () => {
    const persistence = createMemoryPersistence()
    const initialEnvelope = encodePersistenceEnvelope({
      storeId: 'seed-test',
      schemaVersion: 1,
      revision: 4,
      writerId: 'initial-writer',
      values: { value: 9 },
      scopes: new Map(),
      includeField: () => true,
    }).envelope
    const store = createPicodashStore({
      valueOwner: 'store',
      storeId: 'seed-test',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      initialEnvelope,
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    expect(store.getState().values.value).toBe(9)
    expect(store.persistence.getState()).toMatchObject({
      status: 'clean',
      durableRevision: 5,
      liveRevision: 5,
    })
    expect(JSON.parse(persistence.inspect('state') as string).revision).toBe(5)
    store.destroy()
  })

  it('rejects malformed persisted envelopes before creating a root', () => {
    expect(() =>
      createPicodashStore({
        ...makeConfig(createMemoryPersistence()),
        initialEnvelope: '{"kind":"not-picodash"}' as never,
      }),
    ).toThrowError(PicodashInitializationError)
    const valid = encodePersistenceEnvelope({
      storeId: 'persistence-test',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer',
      values: { count: 1, secret: 'secret' },
      scopes: new Map(),
      includeField: () => true,
    }).envelope
    const hostile = { ...valid }
    Object.defineProperty(hostile, 'extra', { enumerable: false, value: 'PRIVATE_EXTRA' })
    expect(() =>
      createPicodashStore({
        ...makeConfig(createMemoryPersistence()),
        initialEnvelope: hostile,
      } as never),
    ).toThrowError(
      expect.objectContaining({ code: 'invalid-persistence-envelope', reason: 'shape' }),
    )
  })
})
