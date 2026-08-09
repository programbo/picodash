import { describe, expect, it, vi } from 'vite-plus/test'
import {
  createPicodashStore,
  PicodashContractError,
  type PicodashEnvelopeInput,
  type PicodashPersistenceDriver,
  type StoreOwnedConfig,
} from '../src/index.ts'
import { PicodashInitializationError } from '../src/adapter.ts'
import { acquireBindingLease } from '../src/integration.ts'
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

  it('confirms an already-written pending envelope after verification recovers', () => {
    const backend = createMemoryPersistence()
    let armVerificationFailure = false
    let failVerificationRead = false
    const driver: PicodashPersistenceDriver = {
      identity: backend.identity,
      read: (key) => {
        if (failVerificationRead) {
          failVerificationRead = false
          throw new Error('transient verification failure')
        }
        return backend.read(key)
      },
      write: (key, payload) => {
        backend.write(key, payload)
        if (armVerificationFailure) {
          armVerificationFailure = false
          failVerificationRead = true
        }
      },
      remove: (key) => backend.remove(key),
    }
    const store = createPicodashStore(makeConfig(driver))
    armVerificationFailure = true
    expect(store.setValues({ count: 2 })).toMatchObject({
      ok: true,
      persistence: 'pending',
    })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(2)
    const writesBeforeFlush = backend.calls.filter((call) => call.kind === 'write').length
    expect(store.persistence.flush()).toBe('saved')
    expect(backend.calls.filter((call) => call.kind === 'write')).toHaveLength(writesBeforeFlush)
    expect(store.persistence.getState()).toMatchObject({
      status: 'clean',
      hasPendingEnvelope: false,
    })
    store.destroy()
  })

  it('confirms an exact pending envelope observed by a subscription', () => {
    const backend = createMemoryPersistence()
    let listener: (() => void) | undefined
    let armVerificationFailure = false
    let failVerificationRead = false
    const driver: PicodashPersistenceDriver = {
      identity: backend.identity,
      read: (key) => {
        if (failVerificationRead) {
          failVerificationRead = false
          throw new Error('transient verification failure')
        }
        return backend.read(key)
      },
      write: (key, payload) => {
        backend.write(key, payload)
        if (armVerificationFailure) {
          armVerificationFailure = false
          failVerificationRead = true
        }
      },
      remove: (key) => backend.remove(key),
      subscribe: (_key, nextListener) => {
        listener = nextListener
        return () => {
          listener = undefined
        }
      },
    }
    const store = createPicodashStore(makeConfig(driver))
    armVerificationFailure = true
    expect(store.setValues({ count: 2 })).toMatchObject({ persistence: 'pending' })
    expect(store.persistence.getState()).toMatchObject({
      status: 'error',
      hasPendingEnvelope: true,
    })
    listener?.()
    expect(store.persistence.getState()).toMatchObject({
      status: 'clean',
      hasPendingEnvelope: false,
    })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(2)
    store.destroy()
  })

  it('rewrites confirmed content after an uncertain candidate reached durability', () => {
    const backend = createMemoryPersistence()
    let armVerificationFailure = false
    let failVerificationRead = false
    const driver: PicodashPersistenceDriver = {
      identity: backend.identity,
      read: (key) => {
        if (failVerificationRead) {
          failVerificationRead = false
          throw new Error('transient verification failure')
        }
        return backend.read(key)
      },
      write: (key, payload) => {
        backend.write(key, payload)
        if (armVerificationFailure) {
          armVerificationFailure = false
          failVerificationRead = true
        }
      },
      remove: (key) => backend.remove(key),
    }
    const store = createPicodashStore(makeConfig(driver))
    armVerificationFailure = true
    expect(store.setValues({ count: 2 })).toMatchObject({ persistence: 'pending' })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(2)
    expect(store.setValues({ count: 1 })).toMatchObject({ persistence: 'saved' })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(1)
    expect(store.persistence.getState()).toMatchObject({
      status: 'clean',
      hasPendingEnvelope: false,
    })
    store.destroy()
  })

  it('advances from an uncertain durable candidate to a newer commit', () => {
    const backend = createMemoryPersistence()
    let armVerificationFailure = false
    let failVerificationRead = false
    const driver: PicodashPersistenceDriver = {
      identity: backend.identity,
      read: (key) => {
        if (failVerificationRead) {
          failVerificationRead = false
          throw new Error('transient verification failure')
        }
        return backend.read(key)
      },
      write: (key, payload) => {
        backend.write(key, payload)
        if (armVerificationFailure) {
          armVerificationFailure = false
          failVerificationRead = true
        }
      },
      remove: (key) => backend.remove(key),
    }
    const store = createPicodashStore(makeConfig(driver))
    armVerificationFailure = true
    expect(store.setValues({ count: 2 })).toMatchObject({ persistence: 'pending' })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(2)
    expect(store.setValues({ count: 3 })).toMatchObject({ persistence: 'saved' })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(3)
    expect(store.persistence.getState()).toMatchObject({ status: 'clean' })
    store.destroy()
  })

  it('keeps a conflict revert pending with the latest live revision', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    expect(store.setValues({ count: 2 })).toMatchObject({ persistence: 'saved' })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'conflict-revert'
    foreign.values.count = 9
    persistence.foreignWrite('state', JSON.stringify(foreign))
    expect(store.setValues({ count: 3 })).toMatchObject({ persistence: 'pending' })
    const beforeRevert = store.persistence.getState().liveRevision
    expect(store.setValues({ count: 2 })).toMatchObject({ persistence: 'pending' })
    expect(store.persistence.getState()).toMatchObject({
      status: 'conflict',
      hasPendingEnvelope: true,
      liveRevision: beforeRevert + 1,
    })
    expect(JSON.parse(persistence.inspect('state') as string).values.count).toBe(9)
    store.destroy({ discardUnpersisted: true })
  })

  it('ignores an absent-to-absent subscription notification before first durability', () => {
    const backend = createMemoryPersistence()
    let listener: (() => void) | undefined
    const driver: PicodashPersistenceDriver = {
      identity: backend.identity,
      read: (key) => backend.read(key),
      write: (key, payload) => backend.write(key, payload),
      remove: (key) => backend.remove(key),
      subscribe: (_key, nextListener) => {
        listener = nextListener
        return () => {
          listener = undefined
        }
      },
    }
    const store = createPicodashStore(makeConfig(driver))
    listener?.()
    expect(store.persistence.getState()).toMatchObject({
      status: 'clean',
      durableRevision: null,
      hasPendingEnvelope: false,
    })
    expect(store.setValues({ count: 2 })).toMatchObject({ persistence: 'saved' })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(2)
    store.destroy()
  })

  it('rejects nested public conflict-plan execution before consuming the plan', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore({
      ...makeConfig(persistence),
      fields: {
        count: {
          defaultValue: 1,
          parse: (input: unknown) =>
            typeof input === 'number'
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'number required' }] },
        },
        secret: { defaultValue: 'hidden' },
      },
    })
    store.setValues({ count: 2 })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'nested-conflict'
    foreign.values.count = 9
    persistence.foreignWrite('state', JSON.stringify(foreign))
    expect(store.setValues({ count: 3 })).toMatchObject({ persistence: 'pending' })
    const plan = store.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    const scope = store.scope('nested-conflict')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.count,
      mode: 'input',
    })
    expect(scope.setInput(binding, 'invalid' as never)).toMatchObject({ ok: false })
    let nestedError: unknown
    const unsubscribe = scope.subscribe(() => {
      try {
        store.persistence.executeConflictResolution(plan)
      } catch (error) {
        nestedError = error
      }
    })
    scope.discardInput(binding)
    expect(nestedError).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    unsubscribe()
    expect(store.persistence.executeConflictResolution(plan)).toMatchObject({ ok: true })
    binding.release()
    store.destroy()
  })

  it('rejects nested public erase-plan execution before consuming the plan', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore({
      ...makeConfig(persistence),
      fields: {
        count: {
          defaultValue: 1,
          parse: (input: unknown) =>
            typeof input === 'number'
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'number required' }] },
        },
        secret: { defaultValue: 'hidden' },
      },
    })
    store.setValues({ count: 2 })
    const plan = store.persistence.createErasePlan()
    const scope = store.scope('nested-erase')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.count,
      mode: 'input',
    })
    expect(scope.setInput(binding, 'invalid' as never)).toMatchObject({ ok: false })
    let nestedError: unknown
    const unsubscribe = scope.subscribe(() => {
      try {
        store.persistence.executeErase(plan, { confirm: true })
      } catch (error) {
        nestedError = error
      }
    })
    scope.discardInput(binding)
    expect(nestedError).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    unsubscribe()
    expect(store.persistence.executeErase(plan, { confirm: true })).toMatchObject({ ok: true })
    binding.release()
    store.destroy()
  })

  it('cancels a failed pending envelope when live state returns to durable content', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    expect(store.setValues({ count: 2 })).toMatchObject({ persistence: 'saved' })
    persistence.failNext('write')
    expect(store.setValues({ count: 3 })).toMatchObject({ persistence: 'pending' })
    expect(store.setValues({ count: 2 })).toMatchObject({ persistence: 'unchanged' })
    expect(store.persistence.getState()).toMatchObject({
      status: 'clean',
      hasPendingEnvelope: false,
    })
    expect(store.persistence.flush()).toBe('unchanged')
    expect(JSON.parse(persistence.inspect('state') as string).values.count).toBe(2)
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

  it('fills missing current fields from the baseline during later hydration', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 2 })
    const confirmed = persistence.inspect('state') as string
    const invalid = JSON.parse(confirmed)
    delete invalid.values.secret
    persistence.foreignWrite('state', JSON.stringify(invalid))
    expect(store.persistence.getState()).toMatchObject({ status: 'clean' })
    expect(store.getState().values.secret).toBe('hidden')
    expect(() => createPicodashStore(makeConfig(persistence))).toThrowError(
      expect.objectContaining({ code: 'persistence-identity-in-use' }),
    )
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

  it('projects fields outside the active persistence policy to their baseline', () => {
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
    const store = createPicodashStore({
      ...makeConfig(source),
      persistence: {
        storageKey: 'state',
        driver: source,
        values: { defaultFieldPolicy: 'omit' },
      },
    })
    expect(store.getState().values.secret).toBe('hidden')
    store.destroy({ discardUnpersisted: true })
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
    const store = createPicodashStore(makeConfig(driver))
    expect(store.getState().values.secret).toBe('hidden')
    store.destroy({ discardUnpersisted: true })
    const initialStore = createPicodashStore({
      ...makeConfig(createMemoryPersistence()),
      initialEnvelope: JSON.parse(envelope),
    })
    expect(initialStore.getState().values.secret).toBe('hidden')
    initialStore.destroy({ discardUnpersisted: true })
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
        listener()
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
    expect(store.setValue(store.fields.value, 7)).toMatchObject({
      ok: true,
      persistence: 'saved',
    })
    store.destroy()
  })

  it('uses the baseline when durable state is removed during subscription setup', () => {
    const encoded = encodePersistenceEnvelope({
      storeId: 'persistence-test',
      schemaVersion: 1,
      revision: 4,
      writerId: 'removed-during-subscribe',
      values: { count: 9, secret: 'durable' },
      scopes: new Map(),
      includeField: () => true,
    }).serialized
    const backend = createMemoryPersistence({ state: encoded })
    const driver: PicodashPersistenceDriver = {
      ...backend,
      subscribe(key, listener) {
        backend.foreignWrite(key, null)
        return backend.subscribe(key, listener)
      },
    }
    const store = createPicodashStore(makeConfig(driver))
    expect(store.getState().values).toEqual({ count: 1, secret: 'hidden' })
    expect(store.persistence.getState()).toMatchObject({
      status: 'clean',
      durableRevision: null,
      liveRevision: 0,
    })
    expect(backend.inspect('state')).toBeNull()
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
    invalid.values = []
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

  it('reloads durable fields and scopes while retaining policy-omitted live fields', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore({
      ...makeConfig(persistence),
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'omit', fields: { count: 'include' } },
      },
    })
    store.setValues({ count: 2, secret: 'live-only' })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-reload'
    foreign.values.count = 9
    persistence.foreignWrite('state', JSON.stringify(foreign))
    const plan = store.persistence.createConflictResolutionPlan({ mode: 'reload' })
    expect(store.persistence.executeConflictResolution(plan)).toMatchObject({
      ok: true,
      persistence: 'unchanged',
    })
    expect(store.getState().values).toEqual({ count: 9, secret: 'live-only' })
    expect(store.persistence.getState()).toMatchObject({ status: 'clean' })
    store.destroy()
  })

  it('reconciles local and durable changes with deterministic overlap policy', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 2 })
    persistence.failNext('write')
    store.setValues({ count: 3 })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-reconcile'
    foreign.values.count = 4
    persistence.foreignWrite('state', JSON.stringify(foreign))
    const plan = store.persistence.createConflictResolutionPlan({
      mode: 'reconcile',
      onOverlap: 'local',
    })
    expect(store.persistence.executeConflictResolution(plan)).toMatchObject({
      ok: true,
      persistence: 'saved',
    })
    expect(store.getState().values.count).toBe(3)
    expect(JSON.parse(persistence.inspect('state') as string).values.count).toBe(3)
    store.destroy()
  })

  it('uses the durable side for reconcile overlap when requested', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 2 })
    persistence.failNext('write')
    store.setValues({ count: 3 })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-durable-overlap'
    foreign.values.count = 4
    persistence.foreignWrite('state', JSON.stringify(foreign))
    const plan = store.persistence.createConflictResolutionPlan({
      mode: 'reconcile',
      onOverlap: 'durable',
    })
    expect(store.persistence.executeConflictResolution(plan)).toMatchObject({ ok: true })
    expect(store.getState().values.count).toBe(4)
    expect(JSON.parse(persistence.inspect('state') as string).values.count).toBe(4)
    store.destroy()
  })

  it('publishes quarantines and unknown fields accepted by conflict reload', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 2 })
    const recoveryListener = vi.fn()
    store.metadataRecovery.subscribe(recoveryListener)
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-quarantine-and-field'
    foreign.values.retired = true
    foreign.scopes = [['quarantined', { dashPanel: { invalid: true } }]]
    persistence.foreignWrite('state', JSON.stringify(foreign))
    const plan = store.persistence.createConflictResolutionPlan({ mode: 'reload' })
    expect(store.persistence.executeConflictResolution(plan)).toMatchObject({ ok: true })
    expect(recoveryListener).toHaveBeenCalledTimes(1)
    expect(store.metadataRecovery.getState().quarantinedScopes.has('quarantined')).toBe(true)
    expect([...store.diagnostics.getState().current.values()].map((entry) => entry.code)).toEqual(
      expect.arrayContaining(['metadata_quarantined', 'unknown_persisted_fields']),
    )
    store.destroy({ discardUnpersisted: true })
  })

  it('merges quarantined raw scope records as complete reconciliation units', () => {
    const persistence = createMemoryPersistence()
    const initialEnvelope = {
      kind: 'picodash-store-envelope',
      formatVersion: 1,
      storeId: 'persistence-test',
      schemaVersion: 1,
      revision: 1,
      writerId: 'quarantine-source',
      valueOwner: 'store',
      values: { count: 1, secret: 'hidden' },
      scopes: [['scope', { dashList: { invalid: true } }]],
    } as const
    const store = createPicodashStore({ ...makeConfig(persistence), initialEnvelope } as never)
    persistence.failNext('write')
    expect(store.metadataRecovery.replaceScope('scope', null)).toMatchObject({ ok: true })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-quarantine'
    foreign.scopes[0][1].dashList.invalid = 'foreign'
    persistence.foreignWrite('state', JSON.stringify(foreign))
    const plan = store.persistence.createConflictResolutionPlan({
      mode: 'reconcile',
      onOverlap: 'local',
    })
    expect(store.persistence.executeConflictResolution(plan)).toMatchObject({ ok: true })
    const persisted = JSON.parse(persistence.inspect('state') as string)
    expect(persisted.scopes).toEqual([])
    store.destroy()
  })

  it('consumes stale plans without mutating live state and permits a fresh plan', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 2 })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-stale'
    foreign.values.count = 7
    persistence.foreignWrite('state', JSON.stringify(foreign))
    const stale = store.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    store.setValues({ secret: 'local-change' })
    expect(store.persistence.executeConflictResolution(stale)).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'stale_plan', path: [], message: 'Persistence plan is stale.' }] },
    })
    expect(store.getState().values.secret).toBe('local-change')
    const fresh = store.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    expect(store.persistence.executeConflictResolution(fresh)).toMatchObject({ ok: true })
    store.destroy()
  })

  it('reloads foreign removal from the validated baseline without writing', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 2 })
    persistence.foreignWrite('state', null)
    store.setValues({ count: 3 })
    const callsBefore = persistence.calls.length
    const plan = store.persistence.createConflictResolutionPlan({ mode: 'reload' })
    expect(store.persistence.executeConflictResolution(plan)).toMatchObject({ ok: true })
    expect(store.getState().values.count).toBe(1)
    expect(persistence.calls.slice(callsBefore).some((call) => call.kind === 'write')).toBe(false)
    expect(store.persistence.getState()).toMatchObject({ status: 'clean', durableRevision: null })
    store.destroy()
  })

  it('erases after confirmation and keeps live state intact', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 4 })
    const before = store.getState().values
    const plan = store.persistence.createErasePlan()
    expect(store.persistence.executeErase(plan, { confirm: true })).toEqual({
      ok: true,
      erased: true,
      discardedPendingEnvelope: false,
    })
    expect(persistence.inspect('state')).toBeNull()
    expect(store.getState().values).toEqual(before)
    expect(store.persistence.getState()).toMatchObject({ status: 'clean', durableRevision: null })
    store.destroy()
  })

  it('holds the write lock while parsing erase confirmation', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 4 })
    const plan = store.persistence.createErasePlan()
    let nestedError: unknown
    const confirmation = new Proxy(
      { confirm: true as const },
      {
        ownKeys(target) {
          try {
            store.setValue(store.fields.count, 9)
          } catch (error) {
            nestedError = error
          }
          return Reflect.ownKeys(target)
        },
      },
    )
    expect(store.persistence.executeErase(plan, confirmation)).toMatchObject({ ok: true })
    expect(nestedError).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    expect(store.getState().values.count).toBe(4)
    store.destroy()
  })

  it('holds the write lock while migrating subscription observations', () => {
    const persistence = createMemoryPersistence()
    let nestedWrite: (() => void) | undefined
    let nestedError: unknown
    const store = createPicodashStore({
      ...makeConfig(persistence),
      schemaVersion: 2,
      migrations: {
        1: (payload) => {
          try {
            nestedWrite?.()
          } catch (error) {
            nestedError = error
          }
          return { ...payload, schemaVersion: 2 }
        },
      },
    })
    nestedWrite = () => store.setValue(store.fields.count, 9)
    store.setValues({ count: 2 })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.schemaVersion = 1
    foreign.revision += 1
    foreign.writerId = 'foreign-migrating-writer'
    persistence.foreignWrite('state', JSON.stringify(foreign))
    expect(nestedError).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    expect(store.getState().values.count).toBe(2)
    expect(store.persistence.getState()).toMatchObject({ status: 'conflict' })
    store.destroy({ discardUnpersisted: true })
  })

  it('holds the write lock while persistence plans snapshot migrated durable data', () => {
    const persistence = createMemoryPersistence()
    const writer = createPicodashStore(makeConfig(persistence))
    writer.setValue(writer.fields.count, 2)
    writer.destroy()
    let nestedWrite: (() => void) | undefined
    const nestedErrors: unknown[] = []
    const store = createPicodashStore({
      ...makeConfig(persistence),
      schemaVersion: 2,
      migrations: {
        1: (payload) => {
          try {
            nestedWrite?.()
          } catch (error) {
            nestedErrors.push(error)
          }
          return { ...payload, schemaVersion: 2 }
        },
      },
    })
    nestedWrite = () => store.setValue(store.fields.count, 9)
    store.persistence.createErasePlan()
    expect(nestedErrors.pop()).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    expect(store.getState().values.count).toBe(2)
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-plan-reader'
    persistence.foreignWrite('state', JSON.stringify(foreign))
    nestedErrors.length = 0
    store.persistence.createConflictResolutionPlan({ mode: 'reload' })
    expect(nestedErrors).toEqual([expect.objectContaining({ code: 'reentrant-write' })])
    expect(store.getState().values.count).toBe(2)
    store.destroy({ discardUnpersisted: true })
  })

  it('completes Store teardown when persistence unsubscribe throws', () => {
    const persistence = createMemoryPersistence()
    let throwOnUnsubscribe = true
    const driver: PicodashPersistenceDriver = {
      identity: persistence.identity,
      read: (key) => persistence.read(key),
      write: (key, payload) => persistence.write(key, payload),
      remove: (key) => persistence.remove(key),
      subscribe: (key, listener) => {
        const unsubscribe = persistence.subscribe(key, listener)
        return () => {
          unsubscribe()
          if (throwOnUnsubscribe) throw new Error('unsubscribe failed')
        }
      },
    }
    const first = createPicodashStore(makeConfig(driver))
    expect(() => first.destroy()).toThrow('unsubscribe failed')
    expect(() => first.getState()).toThrowError(
      expect.objectContaining({ code: 'use-after-destroy' }),
    )
    const replacement = createPicodashStore(makeConfig(driver))
    throwOnUnsubscribe = false
    expect(() => replacement.destroy()).not.toThrow()
  })

  it('performs one verified remove even when the captured durable target is absent', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    const plan = store.persistence.createErasePlan()
    expect(plan.hasDurableEnvelope).toBe(false)
    const before = persistence.calls.filter((call) => call.kind === 'remove').length
    expect(store.persistence.executeErase(plan, { confirm: true })).toMatchObject({
      ok: true,
      erased: false,
    })
    expect(persistence.calls.filter((call) => call.kind === 'remove').length).toBe(before + 1)
    store.destroy()
  })

  it('keeps live state and conflict status after a visibly corrupted recovery write', () => {
    const backend = createMemoryPersistence()
    let corruptNextWrite = false
    const driver: PicodashPersistenceDriver = {
      identity: backend.identity,
      read: (key) => backend.read(key),
      subscribe: (key, listener) => backend.subscribe(key, listener),
      remove: (key) => backend.remove(key),
      write: (key, payload) => {
        backend.write(key, payload)
        if (corruptNextWrite) {
          corruptNextWrite = false
          const corrupted = JSON.parse(backend.inspect(key) as string)
          corrupted.revision += 1
          backend.foreignWrite(key, JSON.stringify(corrupted))
        }
      },
    }
    const store = createPicodashStore(makeConfig(driver))
    store.setValues({ count: 2 })
    backend.failNext('write')
    store.setValues({ count: 3 })
    const foreign = JSON.parse(backend.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-corruption'
    foreign.values.count = 4
    backend.foreignWrite('state', JSON.stringify(foreign))
    const plan = store.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    corruptNextWrite = true
    const result = store.persistence.executeConflictResolution(plan)
    expect(result).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'persistence_resolution_failed', path: [] }] },
    })
    expect(store.getState().values.count).toBe(3)
    expect(store.persistence.getState()).toMatchObject({ status: 'conflict' })
    expect(() =>
      store.persistence.createConflictResolutionPlan({ mode: 'overwrite' }),
    ).not.toThrow()
    store.destroy({ discardUnpersisted: true })
  })

  it('refreshes the conflict observation after verification fails without subscriptions', () => {
    const backend = createMemoryPersistence()
    let armVerificationFailure = false
    let failVerificationRead = false
    const driver: PicodashPersistenceDriver = {
      identity: backend.identity,
      read: (key) => {
        if (failVerificationRead) {
          failVerificationRead = false
          throw new Error('transient verification failure')
        }
        return backend.read(key)
      },
      write: (key, payload) => {
        backend.write(key, payload)
        if (armVerificationFailure) {
          armVerificationFailure = false
          failVerificationRead = true
        }
      },
      remove: (key) => backend.remove(key),
    }
    const store = createPicodashStore(makeConfig(driver))
    store.setValues({ count: 2 })
    const foreign = JSON.parse(backend.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-writer'
    foreign.values.count = 9
    backend.foreignWrite('state', JSON.stringify(foreign))
    expect(store.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })
    expect(store.persistence.getState()).toMatchObject({ status: 'conflict' })

    armVerificationFailure = true
    const first = store.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    expect(store.persistence.executeConflictResolution(first)).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'persistence_resolution_failed' }] },
    })
    expect(store.persistence.getState()).toMatchObject({ status: 'conflict' })

    const retry = store.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    expect(store.persistence.executeConflictResolution(retry)).toMatchObject({ ok: true })
    expect(store.persistence.getState()).toMatchObject({ status: 'clean' })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(3)
    store.destroy()
  })

  it('rejects conflict writes when exact durable content gains an unknown field', () => {
    const backend = createMemoryPersistence()
    let injectUnknownField = false
    const driver: PicodashPersistenceDriver = {
      identity: backend.identity,
      read: (key) => backend.read(key),
      subscribe: (key, listener) => backend.subscribe(key, listener),
      write: (key, payload) => {
        backend.write(key, payload)
        if (injectUnknownField) {
          injectUnknownField = false
          const foreign = JSON.parse(payload)
          foreign.values.retired = 'foreign'
          backend.foreignWrite(key, JSON.stringify(foreign))
        }
      },
      remove: (key) => backend.remove(key),
    }
    const store = createPicodashStore(makeConfig(driver))
    store.setValues({ count: 2 })
    const foreign = JSON.parse(backend.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-writer'
    foreign.values.count = 9
    backend.foreignWrite('state', JSON.stringify(foreign))
    expect(store.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })

    injectUnknownField = true
    const plan = store.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    expect(store.persistence.executeConflictResolution(plan)).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'persistence_resolution_failed' }] },
    })
    expect(store.persistence.getState()).toMatchObject({ status: 'conflict' })
    store.destroy({ discardUnpersisted: true })
  })

  it('fences clean stores against same-header unknown durable fields', () => {
    for (const subscribed of [true, false]) {
      const backend = createMemoryPersistence()
      const driver: PicodashPersistenceDriver = {
        identity: backend.identity,
        read: (key) => backend.read(key),
        write: (key, payload) => backend.write(key, payload),
        remove: (key) => backend.remove(key),
        ...(subscribed ? { subscribe: (key, listener) => backend.subscribe(key, listener) } : {}),
      }
      const store = createPicodashStore(makeConfig(driver))
      store.setValues({ count: 2 })
      const foreign = JSON.parse(backend.inspect('state') as string)
      foreign.values.retired = 'foreign'
      backend.foreignWrite('state', JSON.stringify(foreign))
      if (subscribed) expect(store.persistence.getState()).toMatchObject({ status: 'conflict' })
      else {
        expect(store.persistence.getState()).toMatchObject({ status: 'clean' })
        expect(store.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })
        expect(store.persistence.getState()).toMatchObject({ status: 'conflict' })
      }
      expect(JSON.parse(backend.inspect('state') as string).values.retired).toBe('foreign')
      store.destroy({ discardUnpersisted: true })
    }
  })

  it('rejects wrong-kind and consumed plans with safe contexts', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 2 })
    const erase = store.persistence.createErasePlan()
    expect(() => store.persistence.executeConflictResolution(erase as never)).toThrowError(
      expect.objectContaining({ code: 'invalid-persistence-plan' }),
    )
    expect(store.persistence.executeErase(erase, { confirm: true })).toMatchObject({ ok: true })
    expect(() => store.persistence.executeErase(erase, { confirm: true })).toThrowError(
      expect.objectContaining({
        code: 'invalid-persistence-plan',
        context: { kind: 'erase', reason: 'consumed' },
      }),
    )
    store.destroy()
  })

  it('uses exact safe option errors without invoking accessors', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    const conflictOptions = [
      [undefined, 'not-object'],
      [{ mode: 'invalid' }, 'invalid-mode'],
      [{ mode: 'reconcile' }, 'invalid-overlap'],
      [{ mode: 'reload', extra: true }, 'unknown-key'],
    ] as const
    for (const [input, reason] of conflictOptions)
      expect(() => store.persistence.createConflictResolutionPlan(input as never)).toThrowError(
        expect.objectContaining({
          code: 'invalid-persistence-conflict-options',
          context: { reason },
        }),
      )
    let accessed = false
    const hostile = Object.defineProperty({ mode: 'reload' }, 'onOverlap', {
      enumerable: true,
      get() {
        accessed = true
        return 'local'
      },
    })
    expect(() => store.persistence.createConflictResolutionPlan(hostile as never)).toThrowError(
      expect.objectContaining({
        code: 'invalid-persistence-conflict-options',
        context: { reason: 'accessor-property' },
      }),
    )
    expect(accessed).toBe(false)
    const throwingProxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('private reflection failure')
        },
      },
    )
    expect(() =>
      store.persistence.createConflictResolutionPlan(throwingProxy as never),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-persistence-conflict-options',
        context: { reason: 'not-object' },
      }),
    )
    expect(() => store.persistence.executeErase({} as never, undefined as never)).toThrowError(
      expect.objectContaining({
        code: 'invalid-persistence-erase-options',
        context: { reason: 'not-object' },
      }),
    )
    const erasePlan = store.persistence.createErasePlan()
    expect(() => store.persistence.executeErase(erasePlan, throwingProxy as never)).toThrowError(
      expect.objectContaining({
        code: 'invalid-persistence-erase-options',
        context: { reason: 'not-object' },
      }),
    )
    expect(store.persistence.executeErase(erasePlan, { confirm: true })).toMatchObject({ ok: true })
    store.destroy()
  })

  it('keeps erase plans retryable after remove failure and verification failure', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 2 })
    persistence.failNext('remove')
    const failed = store.persistence.createErasePlan()
    expect(store.persistence.executeErase(failed, { confirm: true })).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'persistence_erase_failed', path: [] }] },
    })
    expect(store.persistence.getState()).toMatchObject({ status: 'clean', durableRevision: 1 })
    const retry = store.persistence.createErasePlan()
    expect(store.persistence.executeErase(retry, { confirm: true })).toMatchObject({ ok: true })
    store.destroy()

    const backend = createMemoryPersistence()
    let reinsert = true
    const driver: PicodashPersistenceDriver = {
      identity: backend.identity,
      read: (key) => backend.read(key),
      subscribe: (key, listener) => backend.subscribe(key, listener),
      write: (key, payload) => backend.write(key, payload),
      remove: (key) => {
        const payload = backend.inspect(key)
        backend.remove(key)
        if (reinsert && typeof payload === 'string') backend.foreignWrite(key, payload)
      },
    }
    const reinsertStore = createPicodashStore(makeConfig(driver))
    reinsertStore.setValues({ count: 2 })
    const verificationPlan = reinsertStore.persistence.createErasePlan()
    expect(
      reinsertStore.persistence.executeErase(verificationPlan, { confirm: true }),
    ).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'persistence_erase_failed', path: [] }] },
    })
    expect(reinsertStore.persistence.getState()).toMatchObject({ status: 'clean' })
    reinsert = false
    const verificationRetry = reinsertStore.persistence.createErasePlan()
    expect(
      reinsertStore.persistence.executeErase(verificationRetry, { confirm: true }),
    ).toMatchObject({
      ok: true,
    })
    reinsertStore.destroy()
  })

  it('confirms erasure of a later invalid durable record', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 2 })
    persistence.foreignWrite('state', '{"invalid":true}')
    expect(store.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })
    const plan = store.persistence.createErasePlan()
    expect(plan.hasDurableEnvelope).toBe(true)
    expect(store.persistence.executeErase(plan, { confirm: true })).toMatchObject({
      ok: true,
      erased: true,
      discardedPendingEnvelope: true,
    })
    expect(persistence.inspect('state')).toBeNull()
    expect(store.persistence.getState()).toMatchObject({ status: 'clean' })
    store.destroy()
  })

  it('confirms erasure when a later durable record fails schema migration', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore({
      ...makeConfig(persistence),
      schemaVersion: 2,
      migrations: {
        1: () => {
          throw new Error('migration failed')
        },
      },
    })
    store.setValues({ count: 2 })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.schemaVersion = 1
    foreign.revision += 1
    foreign.writerId = 'foreign-writer'
    persistence.foreignWrite('state', JSON.stringify(foreign))
    expect(store.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })

    const plan = store.persistence.createErasePlan()
    expect(plan.hasDurableEnvelope).toBe(true)
    expect(store.persistence.executeErase(plan, { confirm: true })).toMatchObject({
      ok: true,
      erased: true,
      discardedPendingEnvelope: true,
    })
    expect(persistence.inspect('state')).toBeNull()
    expect(store.persistence.getState()).toMatchObject({ status: 'clean' })
    store.destroy()
  })

  it('rejects a plan from a foreign root without exposing root identity', () => {
    const firstPersistence = createMemoryPersistence()
    const first = createPicodashStore(makeConfig(firstPersistence))
    first.setValues({ count: 2 })
    const foreign = JSON.parse(firstPersistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-root'
    firstPersistence.foreignWrite('state', JSON.stringify(foreign))
    const plan = first.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    const second = createPicodashStore(makeConfig(createMemoryPersistence()))
    expect(() => second.persistence.executeConflictResolution(plan)).toThrowError(
      expect.objectContaining({
        code: 'invalid-persistence-plan',
        context: { kind: 'conflict-resolution', reason: 'foreign-root' },
      }),
    )
    second.destroy()
    first.destroy({ discardUnpersisted: true })
  })

  it('publishes one final root/scope transition on a successful reload', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 2 })
    const scope = store.scope('reload')
    let rootNotifications = 0
    let scopeNotifications = 0
    let capabilityNotifications = 0
    const unsubRoot = store.subscribe(() => {
      rootNotifications += 1
    })
    const unsubScope = scope.subscribe(() => {
      scopeNotifications += 1
    })
    const unsubCapability = store.persistence.subscribe(() => {
      capabilityNotifications += 1
    })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-reload-notify'
    foreign.values.count = 9
    persistence.foreignWrite('state', JSON.stringify(foreign))
    rootNotifications = 0
    scopeNotifications = 0
    capabilityNotifications = 0
    const plan = store.persistence.createConflictResolutionPlan({ mode: 'reload' })
    expect(store.persistence.executeConflictResolution(plan)).toMatchObject({ ok: true })
    expect(rootNotifications).toBe(1)
    expect(scopeNotifications).toBe(1)
    expect(capabilityNotifications).toBe(1)
    unsubRoot()
    unsubScope()
    unsubCapability()
    store.destroy()
  })

  it('keeps Store subscribers silent for a semantic no-op conflict reload', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore(makeConfig(persistence))
    store.setValues({ count: 2 })
    const scope = store.scope('reload-no-op')
    const rootListener = vi.fn()
    const scopeListener = vi.fn()
    const capabilityListener = vi.fn()
    store.subscribe(rootListener)
    scope.subscribe(scopeListener)
    store.persistence.subscribe(capabilityListener)
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-no-op'
    persistence.foreignWrite('state', JSON.stringify(foreign))
    rootListener.mockClear()
    scopeListener.mockClear()
    capabilityListener.mockClear()
    const plan = store.persistence.createConflictResolutionPlan({ mode: 'reload' })
    expect(store.persistence.executeConflictResolution(plan)).toMatchObject({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
    })
    expect(rootListener).not.toHaveBeenCalled()
    expect(scopeListener).not.toHaveBeenCalled()
    expect(capabilityListener).toHaveBeenCalledTimes(1)
    store.destroy()
  })
})
