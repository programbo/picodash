import { describe, expect, it, vi } from 'vite-plus/test'
import {
  createPicodashNexus,
  PicodashContractError,
  type PicodashEnvelopeInput,
  type PicodashPersistenceDriver,
  type NexusOwnedConfig,
} from '../src/index.ts'
import { PicodashInitializationError } from '../src/adapter.ts'
import { acquireBindingLease } from '../src/integration.ts'
import { decodePersistenceEnvelope, encodePersistenceEnvelope } from '../src/persistence.ts'
import { createMemoryPersistence } from './support/memory-persistence.js'

const makeConfig = (driver: PicodashPersistenceDriver) => ({
  valueOwner: 'nexus' as const,
  nexusId: 'persistence-test',
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

describe('Nexus-owned alpha persistence', () => {
  it('saves a canonical envelope and hydrates a second root', () => {
    const persistence = createMemoryPersistence()
    const first = createPicodashNexus(makeConfig(persistence))
    expect(first.persistence?.getState()).toMatchObject({ status: 'clean', liveRevision: 0 })
    const result = first.setValues({ count: 2 })
    expect(result).toMatchObject({ ok: true, persistence: 'saved' })
    const payload = persistence.inspect('state')
    expect(payload).toContain('"valueOwner":"nexus"')
    expect(payload).toContain('hidden')
    first.destroy()

    const second = createPicodashNexus(makeConfig(persistence))
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
    const nexus = createPicodashNexus({
      ...makeConfig(persistence),
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'omit', fields: { count: 'include' } },
      },
    })
    nexus.setDashListRootOrder('scope', ['item'])
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
    nexus.destroy({ discardUnpersisted: true })
  })

  it('does not write or retry for omitted-only changes', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus({
      ...makeConfig(persistence),
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'include', fields: { secret: 'omit' } },
      },
    })
    const before = persistence.calls.length
    expect(nexus.setValues({ secret: 'omitted' })).toMatchObject({
      ok: true,
      persistence: 'unchanged',
    })
    expect(persistence.calls.length).toBe(before)
    persistence.failNext('write')
    expect(nexus.setValues({ count: 2 })).toMatchObject({ ok: true, persistence: 'pending' })
    const pendingBefore = persistence.calls.length
    expect(nexus.setValues({ secret: 'still omitted' })).toMatchObject({
      ok: true,
      persistence: 'unchanged',
    })
    expect(persistence.calls.length).toBe(pendingBefore)
    nexus.destroy({ discardUnpersisted: true })
  })

  it('snapshots the disclosure policy instead of rereading caller objects', () => {
    const persistence = createMemoryPersistence()
    const policy = {
      defaultFieldPolicy: 'omit' as const,
      fields: { count: 'include' as const },
    }
    const nexus = createPicodashNexus({
      ...makeConfig(persistence),
      persistence: { storageKey: 'state', driver: persistence, values: policy },
    })
    ;(policy.fields as Record<string, string>).count = 'omit'
    ;(policy.fields as Record<string, string>).secret = 'include'
    ;(policy as { defaultFieldPolicy: string }).defaultFieldPolicy = 'include'
    expect(nexus.setValues({ count: 2 })).toMatchObject({ persistence: 'saved' })
    expect(JSON.parse(persistence.inspect('state') as string).values).toEqual({ count: 2 })
    expect(nexus.setValues({ secret: 'changed' })).toMatchObject({ persistence: 'unchanged' })
    nexus.destroy()
  })

  it('keeps live values and exposes pending/error state after driver failure', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    persistence.failNext('write')
    const result = nexus.setValues({ count: 3 })
    expect(result).toMatchObject({ ok: true, persistence: 'pending' })
    expect(nexus.getState().values.count).toBe(3)
    expect(nexus.persistence?.getState()).toMatchObject({
      status: 'error',
      hasPendingEnvelope: true,
    })
    expect(nexus.persistence?.flush()).toBe('saved')
    expect(nexus.persistence?.getState()).toMatchObject({ status: 'clean' })
    nexus.destroy()
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
    const nexus = createPicodashNexus(makeConfig(driver))
    armVerificationFailure = true
    expect(nexus.setValues({ count: 2 })).toMatchObject({
      ok: true,
      persistence: 'pending',
    })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(2)
    const writesBeforeFlush = backend.calls.filter((call) => call.kind === 'write').length
    expect(nexus.persistence.flush()).toBe('saved')
    expect(backend.calls.filter((call) => call.kind === 'write')).toHaveLength(writesBeforeFlush)
    expect(nexus.persistence.getState()).toMatchObject({
      status: 'clean',
      hasPendingEnvelope: false,
    })
    nexus.destroy()
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
    const nexus = createPicodashNexus(makeConfig(driver))
    armVerificationFailure = true
    expect(nexus.setValues({ count: 2 })).toMatchObject({ persistence: 'pending' })
    expect(nexus.persistence.getState()).toMatchObject({
      status: 'error',
      hasPendingEnvelope: true,
    })
    listener?.()
    expect(nexus.persistence.getState()).toMatchObject({
      status: 'clean',
      hasPendingEnvelope: false,
    })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(2)
    nexus.destroy()
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
    const nexus = createPicodashNexus(makeConfig(driver))
    armVerificationFailure = true
    expect(nexus.setValues({ count: 2 })).toMatchObject({ persistence: 'pending' })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(2)
    expect(nexus.setValues({ count: 1 })).toMatchObject({ persistence: 'saved' })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(1)
    expect(nexus.persistence.getState()).toMatchObject({
      status: 'clean',
      hasPendingEnvelope: false,
    })
    nexus.destroy()
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
    const nexus = createPicodashNexus(makeConfig(driver))
    armVerificationFailure = true
    expect(nexus.setValues({ count: 2 })).toMatchObject({ persistence: 'pending' })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(2)
    expect(nexus.setValues({ count: 3 })).toMatchObject({ persistence: 'saved' })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(3)
    expect(nexus.persistence.getState()).toMatchObject({ status: 'clean' })
    nexus.destroy()
  })

  it('keeps a conflict revert pending with the latest live revision', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    expect(nexus.setValues({ count: 2 })).toMatchObject({ persistence: 'saved' })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'conflict-revert'
    foreign.values.count = 9
    persistence.foreignWrite('state', JSON.stringify(foreign))
    expect(nexus.setValues({ count: 3 })).toMatchObject({ persistence: 'pending' })
    const beforeRevert = nexus.persistence.getState().liveRevision
    expect(nexus.setValues({ count: 2 })).toMatchObject({ persistence: 'pending' })
    expect(nexus.persistence.getState()).toMatchObject({
      status: 'conflict',
      hasPendingEnvelope: true,
      liveRevision: beforeRevert + 1,
    })
    expect(JSON.parse(persistence.inspect('state') as string).values.count).toBe(9)
    nexus.destroy({ discardUnpersisted: true })
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
    const nexus = createPicodashNexus(makeConfig(driver))
    listener?.()
    expect(nexus.persistence.getState()).toMatchObject({
      status: 'clean',
      durableRevision: null,
      hasPendingEnvelope: false,
    })
    expect(nexus.setValues({ count: 2 })).toMatchObject({ persistence: 'saved' })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(2)
    nexus.destroy()
  })

  it('rejects nested public conflict-plan execution before consuming the plan', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus({
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
    nexus.setValues({ count: 2 })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'nested-conflict'
    foreign.values.count = 9
    persistence.foreignWrite('state', JSON.stringify(foreign))
    expect(nexus.setValues({ count: 3 })).toMatchObject({ persistence: 'pending' })
    const plan = nexus.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    const scope = nexus.scope('nested-conflict')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.count,
      mode: 'input',
    })
    expect(scope.setInput(binding, 'invalid' as never)).toMatchObject({ ok: false })
    let nestedError: unknown
    const unsubscribe = scope.subscribe(() => {
      try {
        nexus.persistence.executeConflictResolution(plan)
      } catch (error) {
        nestedError = error
      }
    })
    scope.discardInput(binding)
    expect(nestedError).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    unsubscribe()
    expect(nexus.persistence.executeConflictResolution(plan)).toMatchObject({ ok: true })
    binding.release()
    nexus.destroy()
  })

  it('rejects nested public erase-plan execution before consuming the plan', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus({
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
    nexus.setValues({ count: 2 })
    const plan = nexus.persistence.createErasePlan()
    const scope = nexus.scope('nested-erase')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.count,
      mode: 'input',
    })
    expect(scope.setInput(binding, 'invalid' as never)).toMatchObject({ ok: false })
    let nestedError: unknown
    const unsubscribe = scope.subscribe(() => {
      try {
        nexus.persistence.executeErase(plan, { confirm: true })
      } catch (error) {
        nestedError = error
      }
    })
    scope.discardInput(binding)
    expect(nestedError).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    unsubscribe()
    expect(nexus.persistence.executeErase(plan, { confirm: true })).toMatchObject({ ok: true })
    binding.release()
    nexus.destroy()
  })

  it('cancels a failed pending envelope when live state returns to durable content', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    expect(nexus.setValues({ count: 2 })).toMatchObject({ persistence: 'saved' })
    persistence.failNext('write')
    expect(nexus.setValues({ count: 3 })).toMatchObject({ persistence: 'pending' })
    expect(nexus.setValues({ count: 2 })).toMatchObject({ persistence: 'unchanged' })
    expect(nexus.persistence.getState()).toMatchObject({
      status: 'clean',
      hasPendingEnvelope: false,
    })
    expect(nexus.persistence.flush()).toBe('unchanged')
    expect(JSON.parse(persistence.inspect('state') as string).values.count).toBe(2)
    nexus.destroy()
  })

  it('replaces an older pending envelope with the newest complete commit', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    persistence.failNext('write')
    persistence.failNext('write')
    expect(nexus.setValues({ count: 2 })).toMatchObject({ ok: true, persistence: 'pending' })
    expect(nexus.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })
    expect(nexus.persistence?.getState()).toMatchObject({
      status: 'error',
      hasPendingEnvelope: true,
    })
    expect(nexus.persistence?.flush()).toBe('saved')
    expect(JSON.parse(persistence.inspect('state') as string).values.count).toBe(3)
    expect(nexus.persistence?.getState()).toMatchObject({ status: 'clean', liveRevision: 2 })
    nexus.destroy()
  })

  it('detects foreign envelopes and never overwrites them', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 2 })
    const persisted = persistence.inspect('state')
    expect(typeof persisted).toBe('string')
    const foreign = JSON.parse(persisted as string)
    foreign.revision += 1
    foreign.writerId = 'foreign'
    foreign.values.count = 9
    persistence.foreignWrite('state', JSON.stringify(foreign))
    expect(nexus.persistence?.getState()).toMatchObject({ status: 'conflict' })
    const before = persistence.inspect('state')
    expect(nexus.setValues({ count: 4 })).toMatchObject({ ok: true, persistence: 'pending' })
    expect(persistence.inspect('state')).toBe(before)
    expect(nexus.persistence?.flush()).toBe('pending')
    nexus.destroy({ discardUnpersisted: true })
  })

  it('fills missing current fields from the baseline during later hydration', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 2 })
    const confirmed = persistence.inspect('state') as string
    const invalid = JSON.parse(confirmed)
    delete invalid.values.secret
    persistence.foreignWrite('state', JSON.stringify(invalid))
    expect(nexus.persistence.getState()).toMatchObject({ status: 'clean' })
    expect(nexus.getState().values.secret).toBe('hidden')
    expect(() => createPicodashNexus(makeConfig(persistence))).toThrowError(
      expect.objectContaining({ code: 'persistence-identity-in-use' }),
    )
    nexus.destroy()
  })

  it('detects foreign removal before a write even without subscriptions', () => {
    const persistence = createMemoryPersistence()
    const noSubscriptionDriver = {
      ...persistence,
      subscribe: undefined,
    } as PicodashPersistenceDriver
    const nexus = createPicodashNexus(makeConfig(noSubscriptionDriver))
    expect(nexus.setValues({ count: 2 })).toMatchObject({ ok: true, persistence: 'saved' })
    persistence.foreignWrite('state', null)
    const before = persistence.calls.length
    expect(nexus.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })
    expect(nexus.persistence.getState()).toMatchObject({
      status: 'conflict',
      conflict: { reason: 'foreign-removal' },
    })
    expect(persistence.calls.slice(before).some((call) => call.kind === 'write')).toBe(false)
    nexus.destroy({ discardUnpersisted: true })
  })

  it('treats foreign removal as a conflict and ignores synchronous write echoes', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    expect(nexus.setValues({ count: 2 })).toMatchObject({ ok: true, persistence: 'saved' })
    expect(nexus.persistence?.getState()).toMatchObject({ status: 'clean' })
    persistence.foreignWrite('state', null)
    expect(nexus.persistence?.getState()).toMatchObject({
      status: 'conflict',
      conflict: { reason: 'foreign-removal' },
    })
    const callsBefore = persistence.calls.length
    expect(nexus.persistence?.flush()).toBe('pending')
    expect(persistence.calls.slice(callsBefore).some((call) => call.kind === 'write')).toBe(false)
    expect(persistence.calls.some((call) => call.kind === 'remove')).toBe(false)
    nexus.destroy({ discardUnpersisted: true })
  })

  it('shares one capability across root and scoped views and hardens lifecycle', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    const scoped = nexus.scope('scope')
    expect(nexus.persistence).toBe(scoped.persistence)
    const captured = nexus.persistence!
    nexus.destroy()
    expect(() => captured.getState()).toThrowError(PicodashContractError)
  })

  it('releases the identity claim and refuses destruction with pending state', () => {
    const persistence = createMemoryPersistence()
    const first = createPicodashNexus(makeConfig(persistence))
    persistence.failNext('write')
    first.setValues({ count: 2 })
    expect(() => first.destroy()).toThrowError(
      expect.objectContaining({ code: 'root-has-unpersisted-state' }),
    )
    const captured = first.persistence!
    first.destroy({ discardUnpersisted: true })
    expect(() => captured.flush()).toThrowError(PicodashContractError)
    const second = createPicodashNexus(makeConfig(persistence))
    expect(second.persistence).toBeDefined()
    expect(persistence.calls.some((call) => call.kind === 'remove')).toBe(false)
    second.destroy()
  })

  it('reports driver initialization reasons without retaining causes or storage data', () => {
    const persistence = createMemoryPersistence()
    persistence.failNext('read', new Error('secret driver cause'))
    expect(() => createPicodashNexus(makeConfig(persistence))).toThrowError(
      expect.objectContaining({ code: 'persistence-driver-unavailable', reason: 'read' }),
    )
    const malformed = createMemoryPersistence({ state: '{"writerId":"secret"}' })
    try {
      createPicodashNexus(makeConfig(malformed))
      throw new Error('expected malformed envelope')
    } catch (error) {
      expect(error).toMatchObject({ code: 'invalid-persistence-envelope' })
      expect(String(error)).not.toContain('secret')
    }
  })

  it('projects fields outside the active persistence policy to their baseline', () => {
    const source = createMemoryPersistence()
    const envelope = encodePersistenceEnvelope({
      nexusId: 'persistence-test',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer',
      values: { count: 2, secret: 'disclosed' },
      scopes: new Map(),
      includeField: () => true,
    }).serialized
    source.foreignWrite('state', envelope)
    const nexus = createPicodashNexus({
      ...makeConfig(source),
      persistence: {
        storageKey: 'state',
        driver: source,
        values: { defaultFieldPolicy: 'omit' },
      },
    })
    expect(nexus.getState().values.secret).toBe('hidden')
    nexus.destroy({ discardUnpersisted: true })
  })

  it('rejects envelopes that omit a field disclosed by the active policy', () => {
    const envelope = encodePersistenceEnvelope({
      nexusId: 'persistence-test',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer',
      values: { count: 2 },
      scopes: new Map(),
      includeField: (key) => key === 'count',
    }).serialized
    const driver = createMemoryPersistence({ state: envelope })
    const nexus = createPicodashNexus(makeConfig(driver))
    expect(nexus.getState().values.secret).toBe('hidden')
    nexus.destroy({ discardUnpersisted: true })
    const initialNexus = createPicodashNexus({
      ...makeConfig(createMemoryPersistence()),
      initialEnvelope: JSON.parse(envelope),
    })
    expect(initialNexus.getState().values.secret).toBe('hidden')
    initialNexus.destroy({ discardUnpersisted: true })
  })

  it('baseline-fills fields omitted by policy', () => {
    const serialized = encodePersistenceEnvelope({
      nexusId: 'persistence-test',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer',
      values: { count: 2 },
      scopes: new Map(),
      includeField: (key) => key === 'count',
    }).serialized
    const driver = createMemoryPersistence({ state: serialized })
    const nexus = createPicodashNexus({
      ...makeConfig(driver),
      persistence: {
        storageKey: 'state',
        driver,
        values: { defaultFieldPolicy: 'omit', fields: { count: 'include' } },
      },
    })
    expect(nexus.getState().values).toEqual({ count: 2, secret: 'hidden' })
    nexus.destroy()

    const initialDriver = createMemoryPersistence()
    const initialNexus = createPicodashNexus({
      ...makeConfig(initialDriver),
      initialEnvelope: JSON.parse(serialized),
      persistence: {
        storageKey: 'state',
        driver: initialDriver,
        values: { defaultFieldPolicy: 'omit', fields: { count: 'include' } },
      },
    })
    expect(initialNexus.getState().values).toEqual({ count: 2, secret: 'hidden' })
    initialNexus.destroy()
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
      createPicodashNexus({
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
      createPicodashNexus({
        ...makeConfig(persistence),
        persistence: { storageKey: 'state', driver: persistence, values: unknown },
      } as never),
    ).toThrowError(expect.objectContaining({ code: 'invalid-configuration' }))
    const symbolValues = { defaultFieldPolicy: 'include' as const } as Record<PropertyKey, unknown>
    Object.defineProperty(symbolValues, Symbol('private'), { enumerable: true, value: 'x' })
    expect(() =>
      createPicodashNexus({
        ...makeConfig(persistence),
        persistence: { storageKey: 'state', driver: persistence, values: symbolValues },
      } as never),
    ).toThrowError(expect.objectContaining({ code: 'invalid-configuration' }))
  })

  it('rejects disagreement between driver and initial hydration sources', () => {
    const persistence = createMemoryPersistence()
    const seeded = encodePersistenceEnvelope({
      nexusId: 'persistence-test',
      schemaVersion: 1,
      revision: 2,
      writerId: 'driver-writer',
      values: { count: 2, secret: 'driver' },
      scopes: new Map(),
      includeField: () => true,
    }).serialized
    persistence.foreignWrite('state', seeded)
    const initial = encodePersistenceEnvelope({
      nexusId: 'persistence-test',
      schemaVersion: 1,
      revision: 3,
      writerId: 'initial-writer',
      values: { count: 2, secret: 'driver' },
      scopes: new Map(),
      includeField: () => true,
    }).envelope
    expect(() =>
      createPicodashNexus({ ...makeConfig(persistence), initialEnvelope: initial }),
    ).toThrowError(
      expect.objectContaining({ code: 'hydration-source-conflict', reason: 'revision' }),
    )
  })

  it('establishes subscriptions before seeding and leaves empty storage untouched on failure', () => {
    const failing = createMemoryPersistence()
    failing.failNext('subscribe')
    const initial = encodePersistenceEnvelope({
      nexusId: 'seed-failure',
      schemaVersion: 1,
      revision: 1,
      writerId: 'initial',
      values: { value: 2 },
      scopes: new Map(),
      includeField: () => true,
    }).envelope
    expect(() =>
      createPicodashNexus({
        valueOwner: 'nexus',
        nexusId: 'seed-failure',
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
      nexusId: 'seed-race',
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
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'seed-race',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      initialEnvelope: encodePersistenceEnvelope({
        nexusId: 'seed-race',
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
    expect(nexus.persistence.getState()).toMatchObject({ durableRevision: 7 })
    expect(JSON.parse(backend.inspect('state') as string).writerId).toBe('racing-writer')
    expect(backend.calls.filter((call) => call.kind === 'write')).toHaveLength(0)
    expect(nexus.setValue(nexus.fields.value, 7)).toMatchObject({
      ok: true,
      persistence: 'saved',
    })
    nexus.destroy()
  })

  it('uses the baseline when durable state is removed during subscription setup', () => {
    const encoded = encodePersistenceEnvelope({
      nexusId: 'persistence-test',
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
    const nexus = createPicodashNexus(makeConfig(driver))
    expect(nexus.getState().values).toEqual({ count: 1, secret: 'hidden' })
    expect(nexus.persistence.getState()).toMatchObject({
      status: 'clean',
      durableRevision: null,
      liveRevision: 0,
    })
    expect(backend.inspect('state')).toBeNull()
    expect(backend.calls.filter((call) => call.kind === 'write')).toHaveLength(0)
    nexus.destroy()
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
      createPicodashNexus({
        ...makeConfig(driver),
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'persistence-driver-unavailable', reason: 'read' }),
    )
    const nexus = createPicodashNexus(makeConfig(backend))
    nexus.destroy()

    const invalidBackend = createMemoryPersistence()
    const valid = encodePersistenceEnvelope({
      nexusId: 'persistence-test',
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
    expect(() => createPicodashNexus(makeConfig(invalidDriver))).toThrowError(
      expect.objectContaining({ code: 'invalid-persistence-envelope', reason: 'values' }),
    )
    invalidBackend.foreignWrite('state', valid)
    const recovered = createPicodashNexus(makeConfig(invalidBackend))
    recovered.destroy()
  })

  it('uses the root diagnostic object and occurrence sequence for persistence failures', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    const throwing = nexus.subscribe(() => {
      throw new Error('PRIVATE_ROOT')
    })
    nexus.setValues({ count: 2 })
    throwing()
    persistence.failNext('write')
    nexus.setValues({ count: 3 })
    const persistenceDiagnostic = [...nexus.diagnostics.getState().current.values()].find(
      (entry) => entry.code === 'persistence_failure',
    )!
    const state = nexus.persistence.getState()
    expect(state.status).toBe('error')
    if (state.status === 'error') {
      expect(state.lastError).toBe(persistenceDiagnostic)
      expect(state.lastError.lastOccurrence).toBeGreaterThan(1)
      expect(Object.isFrozen(state.lastError)).toBe(true)
      expect(Object.isFrozen(state.lastError.identity)).toBe(true)
    }
    nexus.persistence.flush()
    nexus.destroy()
  })

  it('dispatches capability subscribers through the diagnostics boundary', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    let capabilityNotifications = 0
    const unsubscribe = nexus.persistence!.subscribe(() => {
      capabilityNotifications += 1
    })
    persistence.failNext('write')
    nexus.setValues({ count: 2 })
    expect(capabilityNotifications).toBeGreaterThan(0)
    expect(
      [...nexus.diagnostics.getState().current.values()].find(
        (item) => item.code === 'persistence_failure',
      ),
    ).toMatchObject({
      code: 'persistence_failure',
      reason: 'write-failed',
    })
    unsubscribe()
    nexus.persistence!.flush()
    expect(nexus.diagnostics.getState().current.has('persistence')).toBe(false)
    nexus.destroy()
  })

  it('keeps persistence callbacks under the Nexus write reentrancy guard', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    const errors: PicodashContractError[] = []
    nexus.persistence.subscribe(() => {
      try {
        nexus.setValues({ count: 9 })
      } catch (error) {
        errors.push(error as PicodashContractError)
      }
    })
    persistence.failNext('write')
    nexus.setValues({ count: 2 })
    expect(errors.some((error) => error.code === 'reentrant-write')).toBe(true)
    expect(nexus.getState().values.count).toBe(2)
    nexus.persistence.flush()
    nexus.destroy()
  })

  it('keeps hydrated scope maps and nested metadata maps deeply immutable', () => {
    const persistence = createMemoryPersistence()
    const source = createPicodashNexus(makeConfig(persistence))
    source.setDashListRootOrder('scope', ['item'])
    const raw = persistence.inspect('state') as string
    source.destroy()
    const hydrated = createPicodashNexus({
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
      nexusId: 'deterministic',
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
      nexusId: 'deterministic',
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
      nexusId: 'persistence-test',
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
      nexusId: 'persistence-test',
      schemaVersion: 1,
    })
    expect(decoded.ok).toBe(true)
    if (decoded.ok) expect(decoded.envelope.scopes.map(([scopeId]) => scopeId)).toEqual(['a', 'z'])
    expect(
      decodePersistenceEnvelope(
        { ...valid, kind: 'picodash-store-envelope' },
        { nexusId: 'persistence-test', schemaVersion: 1 },
      ),
    ).toMatchObject({ ok: false, reason: 'format' })
    const legacyIdentity = { ...valid } as Record<string, unknown>
    delete legacyIdentity.nexusId
    legacyIdentity.storeId = 'persistence-test'
    expect(
      decodePersistenceEnvelope(legacyIdentity, { nexusId: 'persistence-test', schemaVersion: 1 }),
    ).toMatchObject({ ok: false, reason: 'shape' })
    const unsorted = { ...valid, scopes: [...(valid.scopes as unknown[])].reverse() }
    expect(
      decodePersistenceEnvelope(unsorted, { nexusId: 'persistence-test', schemaVersion: 1 }),
    ).toMatchObject({ ok: false, reason: 'metadata' })
    for (const schemaVersion of [0, -1, 1.5, '1'])
      expect(
        decodePersistenceEnvelope(
          { ...valid, schemaVersion },
          { nexusId: 'persistence-test', schemaVersion: 1 },
          { allowSchemaMismatch: true },
        ),
      ).toMatchObject({ ok: false, reason: 'schema' })

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
      decodePersistenceEnvelope(hostile, { nexusId: 'persistence-test', schemaVersion: 1 }),
    ).toMatchObject({ ok: false, reason: 'metadata' })
    expect(getterCalls).toBe(0)

    const external = {
      kind: 'picodash-nexus-envelope',
      formatVersion: 1,
      nexusId: 'persistence-test',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer',
      valueOwner: 'external',
      scopes: [],
    }
    expect(
      decodePersistenceEnvelope(external, { nexusId: 'persistence-test', schemaVersion: 1 }),
    ).toMatchObject({ ok: false, reason: 'authority' })
  })

  it('hydrates a driver-free initial envelope without exposing a capability', () => {
    const envelope = encodePersistenceEnvelope({
      nexusId: 'initial-envelope-test',
      schemaVersion: 1,
      revision: 4,
      writerId: 'fixture-writer',
      values: { count: 8, secret: 'from-envelope' },
      scopes: new Map(),
      includeField: () => true,
    }).envelope as PicodashEnvelopeInput<{ count: number; secret: string }>
    const config: NexusOwnedConfig<{
      readonly count: { readonly defaultValue: number }
      readonly secret: { readonly defaultValue: string }
    }> = {
      valueOwner: 'nexus',
      nexusId: 'initial-envelope-test',
      schemaVersion: 1,
      fields: {
        count: { defaultValue: 1 },
        secret: { defaultValue: 'default' },
      },
      initialEnvelope: envelope,
    }
    const nexus = createPicodashNexus(config)
    expect(nexus.getState().values).toEqual({ count: 8, secret: 'from-envelope' })
    expect(Reflect.has(nexus, 'persistence')).toBe(false)
    nexus.destroy()
  })

  it('seeds an empty driver from an initial envelope before activation', () => {
    const persistence = createMemoryPersistence()
    const initialEnvelope = encodePersistenceEnvelope({
      nexusId: 'seed-test',
      schemaVersion: 1,
      revision: 4,
      writerId: 'initial-writer',
      values: { value: 9 },
      scopes: new Map(),
      includeField: () => true,
    }).envelope
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'seed-test',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      initialEnvelope,
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    expect(nexus.getState().values.value).toBe(9)
    expect(nexus.persistence.getState()).toMatchObject({
      status: 'clean',
      durableRevision: 5,
      liveRevision: 5,
    })
    expect(JSON.parse(persistence.inspect('state') as string).revision).toBe(5)
    nexus.destroy()
  })

  it('rejects malformed persisted envelopes before creating a root', () => {
    expect(() =>
      createPicodashNexus({
        ...makeConfig(createMemoryPersistence()),
        initialEnvelope: '{"kind":"not-picodash"}' as never,
      }),
    ).toThrowError(PicodashInitializationError)
    const valid = encodePersistenceEnvelope({
      nexusId: 'persistence-test',
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
      createPicodashNexus({
        ...makeConfig(createMemoryPersistence()),
        initialEnvelope: hostile,
      } as never),
    ).toThrowError(
      expect.objectContaining({ code: 'invalid-persistence-envelope', reason: 'shape' }),
    )
  })

  it('reloads durable fields and scopes while retaining policy-omitted live fields', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus({
      ...makeConfig(persistence),
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'omit', fields: { count: 'include' } },
      },
    })
    nexus.setValues({ count: 2, secret: 'live-only' })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-reload'
    foreign.values.count = 9
    persistence.foreignWrite('state', JSON.stringify(foreign))
    const plan = nexus.persistence.createConflictResolutionPlan({ mode: 'reload' })
    expect(nexus.persistence.executeConflictResolution(plan)).toMatchObject({
      ok: true,
      persistence: 'unchanged',
    })
    expect(nexus.getState().values).toEqual({ count: 9, secret: 'live-only' })
    expect(nexus.persistence.getState()).toMatchObject({ status: 'clean' })
    nexus.destroy()
  })

  it('reconciles local and durable changes with deterministic overlap policy', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 2 })
    persistence.failNext('write')
    nexus.setValues({ count: 3 })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-reconcile'
    foreign.values.count = 4
    persistence.foreignWrite('state', JSON.stringify(foreign))
    const plan = nexus.persistence.createConflictResolutionPlan({
      mode: 'reconcile',
      onOverlap: 'local',
    })
    expect(nexus.persistence.executeConflictResolution(plan)).toMatchObject({
      ok: true,
      persistence: 'saved',
    })
    expect(nexus.getState().values.count).toBe(3)
    expect(JSON.parse(persistence.inspect('state') as string).values.count).toBe(3)
    nexus.destroy()
  })

  it('uses the durable side for reconcile overlap when requested', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 2 })
    persistence.failNext('write')
    nexus.setValues({ count: 3 })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-durable-overlap'
    foreign.values.count = 4
    persistence.foreignWrite('state', JSON.stringify(foreign))
    const plan = nexus.persistence.createConflictResolutionPlan({
      mode: 'reconcile',
      onOverlap: 'durable',
    })
    expect(nexus.persistence.executeConflictResolution(plan)).toMatchObject({ ok: true })
    expect(nexus.getState().values.count).toBe(4)
    expect(JSON.parse(persistence.inspect('state') as string).values.count).toBe(4)
    nexus.destroy()
  })

  it('publishes quarantines and unknown fields accepted by conflict reload', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 2 })
    const recoveryListener = vi.fn()
    nexus.metadataRecovery.subscribe(recoveryListener)
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-quarantine-and-field'
    foreign.values.retired = true
    foreign.scopes = [['quarantined', { dashPanel: { invalid: true } }]]
    persistence.foreignWrite('state', JSON.stringify(foreign))
    const plan = nexus.persistence.createConflictResolutionPlan({ mode: 'reload' })
    expect(nexus.persistence.executeConflictResolution(plan)).toMatchObject({ ok: true })
    expect(recoveryListener).toHaveBeenCalledTimes(1)
    expect(nexus.metadataRecovery.getState().quarantinedScopes.has('quarantined')).toBe(true)
    expect([...nexus.diagnostics.getState().current.values()].map((entry) => entry.code)).toEqual(
      expect.arrayContaining(['metadata_quarantined', 'unknown_persisted_fields']),
    )
    nexus.destroy({ discardUnpersisted: true })
  })

  it('merges quarantined raw scope records as complete reconciliation units', () => {
    const persistence = createMemoryPersistence()
    const initialEnvelope = {
      kind: 'picodash-nexus-envelope',
      formatVersion: 1,
      nexusId: 'persistence-test',
      schemaVersion: 1,
      revision: 1,
      writerId: 'quarantine-source',
      valueOwner: 'nexus',
      values: { count: 1, secret: 'hidden' },
      scopes: [['scope', { dashList: { invalid: true } }]],
    } as const
    const nexus = createPicodashNexus({ ...makeConfig(persistence), initialEnvelope } as never)
    persistence.failNext('write')
    expect(nexus.metadataRecovery.replaceScope('scope', null)).toMatchObject({ ok: true })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-quarantine'
    foreign.scopes[0][1].dashList.invalid = 'foreign'
    persistence.foreignWrite('state', JSON.stringify(foreign))
    const plan = nexus.persistence.createConflictResolutionPlan({
      mode: 'reconcile',
      onOverlap: 'local',
    })
    expect(nexus.persistence.executeConflictResolution(plan)).toMatchObject({ ok: true })
    const persisted = JSON.parse(persistence.inspect('state') as string)
    expect(persisted.scopes).toEqual([])
    nexus.destroy()
  })

  it('consumes stale plans without mutating live state and permits a fresh plan', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 2 })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-stale'
    foreign.values.count = 7
    persistence.foreignWrite('state', JSON.stringify(foreign))
    const stale = nexus.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    nexus.setValues({ secret: 'local-change' })
    expect(nexus.persistence.executeConflictResolution(stale)).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'stale_plan', path: [], message: 'Persistence plan is stale.' }] },
    })
    expect(nexus.getState().values.secret).toBe('local-change')
    const fresh = nexus.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    expect(nexus.persistence.executeConflictResolution(fresh)).toMatchObject({ ok: true })
    nexus.destroy()
  })

  it('reloads foreign removal from the validated baseline without writing', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 2 })
    persistence.foreignWrite('state', null)
    nexus.setValues({ count: 3 })
    const callsBefore = persistence.calls.length
    const plan = nexus.persistence.createConflictResolutionPlan({ mode: 'reload' })
    expect(nexus.persistence.executeConflictResolution(plan)).toMatchObject({ ok: true })
    expect(nexus.getState().values.count).toBe(1)
    expect(persistence.calls.slice(callsBefore).some((call) => call.kind === 'write')).toBe(false)
    expect(nexus.persistence.getState()).toMatchObject({ status: 'clean', durableRevision: null })
    nexus.destroy()
  })

  it('erases after confirmation and keeps live state intact', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 4 })
    const before = nexus.getState().values
    const plan = nexus.persistence.createErasePlan()
    expect(nexus.persistence.executeErase(plan, { confirm: true })).toEqual({
      ok: true,
      erased: true,
      discardedPendingEnvelope: false,
    })
    expect(persistence.inspect('state')).toBeNull()
    expect(nexus.getState().values).toEqual(before)
    expect(nexus.persistence.getState()).toMatchObject({ status: 'clean', durableRevision: null })
    nexus.destroy()
  })

  it('holds the write lock while parsing erase confirmation', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 4 })
    const plan = nexus.persistence.createErasePlan()
    let nestedError: unknown
    const confirmation = new Proxy(
      { confirm: true as const },
      {
        ownKeys(target) {
          try {
            nexus.setValue(nexus.fields.count, 9)
          } catch (error) {
            nestedError = error
          }
          return Reflect.ownKeys(target)
        },
      },
    )
    expect(nexus.persistence.executeErase(plan, confirmation)).toMatchObject({ ok: true })
    expect(nestedError).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    expect(nexus.getState().values.count).toBe(4)
    nexus.destroy()
  })

  it('holds the write lock while migrating subscription observations', () => {
    const persistence = createMemoryPersistence()
    let nestedWrite: (() => void) | undefined
    let nestedError: unknown
    const nexus = createPicodashNexus({
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
    nestedWrite = () => nexus.setValue(nexus.fields.count, 9)
    nexus.setValues({ count: 2 })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.schemaVersion = 1
    foreign.revision += 1
    foreign.writerId = 'foreign-migrating-writer'
    persistence.foreignWrite('state', JSON.stringify(foreign))
    expect(nestedError).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    expect(nexus.getState().values.count).toBe(2)
    expect(nexus.persistence.getState()).toMatchObject({ status: 'conflict' })
    nexus.destroy({ discardUnpersisted: true })
  })

  it('holds the write lock while persistence plans snapshot migrated durable data', () => {
    const persistence = createMemoryPersistence()
    const writer = createPicodashNexus(makeConfig(persistence))
    writer.setValue(writer.fields.count, 2)
    writer.destroy()
    let nestedWrite: (() => void) | undefined
    const nestedErrors: unknown[] = []
    const nexus = createPicodashNexus({
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
    nestedWrite = () => nexus.setValue(nexus.fields.count, 9)
    nexus.persistence.createErasePlan()
    expect(nestedErrors.pop()).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    expect(nexus.getState().values.count).toBe(2)
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-plan-reader'
    persistence.foreignWrite('state', JSON.stringify(foreign))
    nestedErrors.length = 0
    nexus.persistence.createConflictResolutionPlan({ mode: 'reload' })
    expect(nestedErrors).toEqual([expect.objectContaining({ code: 'reentrant-write' })])
    expect(nexus.getState().values.count).toBe(2)
    nexus.destroy({ discardUnpersisted: true })
  })

  it('completes Nexus teardown when persistence unsubscribe throws', () => {
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
    const first = createPicodashNexus(makeConfig(driver))
    expect(() => first.destroy()).toThrow('unsubscribe failed')
    expect(() => first.getState()).toThrowError(
      expect.objectContaining({ code: 'use-after-destroy' }),
    )
    const replacement = createPicodashNexus(makeConfig(driver))
    throwOnUnsubscribe = false
    expect(() => replacement.destroy()).not.toThrow()
  })

  it('performs one verified remove even when the captured durable target is absent', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    const plan = nexus.persistence.createErasePlan()
    expect(plan.hasDurableEnvelope).toBe(false)
    const before = persistence.calls.filter((call) => call.kind === 'remove').length
    expect(nexus.persistence.executeErase(plan, { confirm: true })).toMatchObject({
      ok: true,
      erased: false,
    })
    expect(persistence.calls.filter((call) => call.kind === 'remove').length).toBe(before + 1)
    nexus.destroy()
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
    const nexus = createPicodashNexus(makeConfig(driver))
    nexus.setValues({ count: 2 })
    backend.failNext('write')
    nexus.setValues({ count: 3 })
    const foreign = JSON.parse(backend.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-corruption'
    foreign.values.count = 4
    backend.foreignWrite('state', JSON.stringify(foreign))
    const plan = nexus.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    corruptNextWrite = true
    const result = nexus.persistence.executeConflictResolution(plan)
    expect(result).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'persistence_resolution_failed', path: [] }] },
    })
    expect(nexus.getState().values.count).toBe(3)
    expect(nexus.persistence.getState()).toMatchObject({ status: 'conflict' })
    expect(() =>
      nexus.persistence.createConflictResolutionPlan({ mode: 'overwrite' }),
    ).not.toThrow()
    nexus.destroy({ discardUnpersisted: true })
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
    const nexus = createPicodashNexus(makeConfig(driver))
    nexus.setValues({ count: 2 })
    const foreign = JSON.parse(backend.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-writer'
    foreign.values.count = 9
    backend.foreignWrite('state', JSON.stringify(foreign))
    expect(nexus.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })
    expect(nexus.persistence.getState()).toMatchObject({ status: 'conflict' })

    armVerificationFailure = true
    const first = nexus.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    expect(nexus.persistence.executeConflictResolution(first)).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'persistence_resolution_failed' }] },
    })
    expect(nexus.persistence.getState()).toMatchObject({ status: 'conflict' })

    const retry = nexus.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    expect(nexus.persistence.executeConflictResolution(retry)).toMatchObject({ ok: true })
    expect(nexus.persistence.getState()).toMatchObject({ status: 'clean' })
    expect(JSON.parse(backend.inspect('state') as string).values.count).toBe(3)
    nexus.destroy()
  })

  it('clears uncertain writes after reload establishes a new durable baseline', () => {
    const backend = createMemoryPersistence()
    let failVerificationRead = false
    let uncertainPayload = ''
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
        uncertainPayload = payload
        backend.write(key, payload)
        failVerificationRead = true
      },
      remove: (key) => backend.remove(key),
      subscribe: (key, listener) => backend.subscribe(key, listener),
    }
    const nexus = createPicodashNexus(makeConfig(driver))
    expect(nexus.setValue(nexus.fields.count, 2)).toMatchObject({
      ok: true,
      persistence: 'pending',
    })
    const foreign = JSON.parse(uncertainPayload)
    foreign.revision += 1
    foreign.writerId = 'foreign-reload-baseline'
    foreign.values.count = 7
    backend.foreignWrite('state', JSON.stringify(foreign))
    expect(nexus.persistence.getState()).toMatchObject({ status: 'conflict' })
    const reload = nexus.persistence.createConflictResolutionPlan({ mode: 'reload' })
    expect(nexus.persistence.executeConflictResolution(reload)).toMatchObject({ ok: true })
    expect(nexus.getState().values.count).toBe(7)
    backend.foreignWrite('state', uncertainPayload)
    expect(nexus.persistence.getState()).toMatchObject({ status: 'conflict' })
    expect(nexus.getState().values.count).toBe(7)
    nexus.destroy({ discardUnpersisted: true })
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
    const nexus = createPicodashNexus(makeConfig(driver))
    nexus.setValues({ count: 2 })
    const foreign = JSON.parse(backend.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-writer'
    foreign.values.count = 9
    backend.foreignWrite('state', JSON.stringify(foreign))
    expect(nexus.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })

    injectUnknownField = true
    const plan = nexus.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    expect(nexus.persistence.executeConflictResolution(plan)).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'persistence_resolution_failed' }] },
    })
    expect(nexus.persistence.getState()).toMatchObject({ status: 'conflict' })
    nexus.destroy({ discardUnpersisted: true })
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
      const nexus = createPicodashNexus(makeConfig(driver))
      nexus.setValues({ count: 2 })
      const foreign = JSON.parse(backend.inspect('state') as string)
      foreign.values.retired = 'foreign'
      backend.foreignWrite('state', JSON.stringify(foreign))
      if (subscribed) expect(nexus.persistence.getState()).toMatchObject({ status: 'conflict' })
      else {
        expect(nexus.persistence.getState()).toMatchObject({ status: 'clean' })
        expect(nexus.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })
        expect(nexus.persistence.getState()).toMatchObject({ status: 'conflict' })
      }
      expect(JSON.parse(backend.inspect('state') as string).values.retired).toBe('foreign')
      nexus.destroy({ discardUnpersisted: true })
    }
  })

  it('rejects wrong-kind and consumed plans with safe contexts', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 2 })
    const erase = nexus.persistence.createErasePlan()
    expect(() => nexus.persistence.executeConflictResolution(erase as never)).toThrowError(
      expect.objectContaining({ code: 'invalid-persistence-plan' }),
    )
    expect(nexus.persistence.executeErase(erase, { confirm: true })).toMatchObject({ ok: true })
    expect(() => nexus.persistence.executeErase(erase, { confirm: true })).toThrowError(
      expect.objectContaining({
        code: 'invalid-persistence-plan',
        context: { kind: 'erase', reason: 'consumed' },
      }),
    )
    nexus.destroy()
  })

  it('uses exact safe option errors without invoking accessors', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    const conflictOptions = [
      [undefined, 'not-object'],
      [{ mode: 'invalid' }, 'invalid-mode'],
      [{ mode: 'reconcile' }, 'invalid-overlap'],
      [{ mode: 'reload', extra: true }, 'unknown-key'],
    ] as const
    for (const [input, reason] of conflictOptions)
      expect(() => nexus.persistence.createConflictResolutionPlan(input as never)).toThrowError(
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
    expect(() => nexus.persistence.createConflictResolutionPlan(hostile as never)).toThrowError(
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
      nexus.persistence.createConflictResolutionPlan(throwingProxy as never),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-persistence-conflict-options',
        context: { reason: 'not-object' },
      }),
    )
    expect(() => nexus.persistence.executeErase({} as never, undefined as never)).toThrowError(
      expect.objectContaining({
        code: 'invalid-persistence-erase-options',
        context: { reason: 'not-object' },
      }),
    )
    const erasePlan = nexus.persistence.createErasePlan()
    expect(() => nexus.persistence.executeErase(erasePlan, throwingProxy as never)).toThrowError(
      expect.objectContaining({
        code: 'invalid-persistence-erase-options',
        context: { reason: 'not-object' },
      }),
    )
    expect(nexus.persistence.executeErase(erasePlan, { confirm: true })).toMatchObject({ ok: true })
    nexus.destroy()
  })

  it('keeps erase plans retryable after remove failure and verification failure', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 2 })
    persistence.failNext('remove')
    const failed = nexus.persistence.createErasePlan()
    expect(nexus.persistence.executeErase(failed, { confirm: true })).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'persistence_erase_failed', path: [] }] },
    })
    expect(nexus.persistence.getState()).toMatchObject({ status: 'clean', durableRevision: 1 })
    const retry = nexus.persistence.createErasePlan()
    expect(nexus.persistence.executeErase(retry, { confirm: true })).toMatchObject({ ok: true })
    nexus.destroy()

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
    const reinsertNexus = createPicodashNexus(makeConfig(driver))
    reinsertNexus.setValues({ count: 2 })
    const verificationPlan = reinsertNexus.persistence.createErasePlan()
    expect(
      reinsertNexus.persistence.executeErase(verificationPlan, { confirm: true }),
    ).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'persistence_erase_failed', path: [] }] },
    })
    expect(reinsertNexus.persistence.getState()).toMatchObject({ status: 'clean' })
    reinsert = false
    const verificationRetry = reinsertNexus.persistence.createErasePlan()
    expect(
      reinsertNexus.persistence.executeErase(verificationRetry, { confirm: true }),
    ).toMatchObject({
      ok: true,
    })
    reinsertNexus.destroy()
  })

  it('confirms erasure of a later invalid durable record', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 2 })
    persistence.foreignWrite('state', '{"invalid":true}')
    expect(nexus.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })
    const plan = nexus.persistence.createErasePlan()
    expect(plan.hasDurableEnvelope).toBe(true)
    expect(nexus.persistence.executeErase(plan, { confirm: true })).toMatchObject({
      ok: true,
      erased: true,
      discardedPendingEnvelope: true,
    })
    expect(persistence.inspect('state')).toBeNull()
    expect(nexus.persistence.getState()).toMatchObject({ status: 'clean' })
    nexus.destroy()
  })

  it('confirms erasure when a later durable record fails schema migration', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus({
      ...makeConfig(persistence),
      schemaVersion: 2,
      migrations: {
        1: () => {
          throw new Error('migration failed')
        },
      },
    })
    nexus.setValues({ count: 2 })
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.schemaVersion = 1
    foreign.revision += 1
    foreign.writerId = 'foreign-writer'
    persistence.foreignWrite('state', JSON.stringify(foreign))
    expect(nexus.setValues({ count: 3 })).toMatchObject({ ok: true, persistence: 'pending' })

    const plan = nexus.persistence.createErasePlan()
    expect(plan.hasDurableEnvelope).toBe(true)
    expect(nexus.persistence.executeErase(plan, { confirm: true })).toMatchObject({
      ok: true,
      erased: true,
      discardedPendingEnvelope: true,
    })
    expect(persistence.inspect('state')).toBeNull()
    expect(nexus.persistence.getState()).toMatchObject({ status: 'clean' })
    nexus.destroy()
  })

  it('rejects a plan from a foreign root without exposing root identity', () => {
    const firstPersistence = createMemoryPersistence()
    const first = createPicodashNexus(makeConfig(firstPersistence))
    first.setValues({ count: 2 })
    const foreign = JSON.parse(firstPersistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-root'
    firstPersistence.foreignWrite('state', JSON.stringify(foreign))
    const plan = first.persistence.createConflictResolutionPlan({ mode: 'overwrite' })
    const second = createPicodashNexus(makeConfig(createMemoryPersistence()))
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
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 2 })
    const scope = nexus.scope('reload')
    let rootNotifications = 0
    let scopeNotifications = 0
    let capabilityNotifications = 0
    const unsubRoot = nexus.subscribe(() => {
      rootNotifications += 1
    })
    const unsubScope = scope.subscribe(() => {
      scopeNotifications += 1
    })
    const unsubCapability = nexus.persistence.subscribe(() => {
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
    const plan = nexus.persistence.createConflictResolutionPlan({ mode: 'reload' })
    expect(nexus.persistence.executeConflictResolution(plan)).toMatchObject({ ok: true })
    expect(rootNotifications).toBe(1)
    expect(scopeNotifications).toBe(1)
    expect(capabilityNotifications).toBe(1)
    unsubRoot()
    unsubScope()
    unsubCapability()
    nexus.destroy()
  })

  it('keeps Nexus subscribers silent for a semantic no-op conflict reload', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus(makeConfig(persistence))
    nexus.setValues({ count: 2 })
    const scope = nexus.scope('reload-no-op')
    const rootListener = vi.fn()
    const scopeListener = vi.fn()
    const capabilityListener = vi.fn()
    nexus.subscribe(rootListener)
    scope.subscribe(scopeListener)
    nexus.persistence.subscribe(capabilityListener)
    const foreign = JSON.parse(persistence.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign-no-op'
    persistence.foreignWrite('state', JSON.stringify(foreign))
    rootListener.mockClear()
    scopeListener.mockClear()
    capabilityListener.mockClear()
    const plan = nexus.persistence.createConflictResolutionPlan({ mode: 'reload' })
    expect(nexus.persistence.executeConflictResolution(plan)).toMatchObject({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
    })
    expect(rootListener).not.toHaveBeenCalled()
    expect(scopeListener).not.toHaveBeenCalled()
    expect(capabilityListener).toHaveBeenCalledTimes(1)
    nexus.destroy()
  })
})
