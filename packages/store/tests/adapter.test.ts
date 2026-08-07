import { describe, expect, it } from 'vite-plus/test'
import {
  createPicodashStore,
  type PicodashInitializationError,
  type PicodashValidationContext,
  type PicodashValueAdapter,
} from '../src/index.ts'
import { acquireProviderLease } from '../src/integration.ts'
import { createExternalAdapter } from './support/external-adapter.js'

const config = (adapter: ReturnType<typeof createExternalAdapter>) => ({
  valueOwner: 'external' as const,
  storeId: 'adapter-test',
  schemaVersion: 1,
  fields: { count: { defaultValue: 1 }, label: { defaultValue: 'one' } },
  adapter: adapter as unknown as PicodashValueAdapter<{ count: number; label: string }>,
})

const initialization = (adapter: ReturnType<typeof createExternalAdapter>) => {
  try {
    createPicodashStore(config(adapter))
    throw new Error('expected initialization failure')
  } catch (error) {
    return error as PicodashInitializationError
  }
}

describe('manual external Store adapter', () => {
  it('initializes from a strict complete snapshot and preserves the write context', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const store = createPicodashStore(config(adapter))
    const notifications: unknown[] = []
    store.subscribe(() => notifications.push(store.getState()))

    const result = store.setValues({ count: 2 })
    expect(result).toEqual({ ok: true, changedFields: ['count'], changedScopeIds: [] })
    expect(adapter.writes[0]?.context).toEqual({
      source: 'programmatic',
      targetScopeIds: [],
      changedFields: ['count'],
    })
    expect(store.getState().values).toEqual({ count: 2, label: 'one' })
    expect(notifications).toHaveLength(1)
    store.destroy()
    expect(adapter.releaseCalls()).toBe(1)
  })

  it('fails closed for malformed initialization and tears down a failed second read', () => {
    for (const [snapshot, reason] of [
      [{ count: 1 }, 'invalid_snapshot'],
      [{ count: 1, label: 'one', extra: true }, 'invalid_snapshot'],
    ] as const) {
      const adapter = createExternalAdapter(snapshot)
      if (reason === undefined) continue
      const error = initialization(adapter)
      expect(error.name).toBe('PicodashInitializationError')
      expect(error.reason).toBe(reason)
      expect(error.issues).toHaveLength(1)
      expect(error.issues[0]).toMatchObject({
        code: 'adapter_initialization_failed',
        path: [],
        reason,
      })
    }

    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    adapter.nextReadAfterSubscribe('throw')
    const error = initialization(adapter)
    expect(error.reason).toBe('read_threw')
    expect(adapter.releaseCalls()).toBe(1)

    for (const mode of ['invalid', 'async'] as const) {
      const later = createExternalAdapter({ count: 1, label: 'one' })
      later.nextReadAfterSubscribe(mode)
      const laterError = initialization(later)
      expect(laterError.reason).toBe(mode === 'invalid' ? 'invalid_snapshot' : 'async_snapshot')
      expect(later.releaseCalls()).toBe(1)
    }
  })

  it('rejects async reads, thrown subscriptions, and invalid teardown values', () => {
    const asyncRead = createExternalAdapter({ count: 1, label: 'one' })
    asyncRead.nextRead('async')
    expect(initialization(asyncRead).reason).toBe('async_snapshot')

    const subscribeThrow = createExternalAdapter({ count: 1, label: 'one' })
    subscribeThrow.nextSubscribe('throw')
    expect(initialization(subscribeThrow).reason).toBe('subscribe_threw')

    const invalidTeardown = createExternalAdapter({ count: 1, label: 'one' })
    invalidTeardown.nextSubscribe('invalid-teardown')
    expect(initialization(invalidTeardown).reason).toBe('invalid_teardown')
  })

  it('coalesces synchronous subscription echoes and applies valid external notifications', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const store = createPicodashStore(config(adapter))
    let notifications = 0
    store.subscribe(() => {
      notifications += 1
    })
    const before = store.getState()
    expect(store.setValue(store.fields.count, 2)).toMatchObject({ ok: true })
    expect(notifications).toBe(1)
    expect(store.getState()).not.toBe(before)

    adapter.replaceSnapshot({ count: 3, label: 'three' })
    expect(notifications).toBe(2)
    expect(store.getState().values).toEqual({ count: 3, label: 'three' })
    adapter.replaceSnapshot({ count: 3, label: 'three' })
    expect(notifications).toBe(2)
  })

  it('attributes scoped writes without inventing target scopes', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const store = createPicodashStore(config(adapter))
    const scoped = store.scope('panel')
    const result = scoped.setValues({ count: 2 })
    expect(result).toEqual({ ok: true, changedFields: ['count'], changedScopeIds: [] })
    expect(adapter.writes[0]?.context).toEqual({
      source: 'programmatic',
      originScopeId: 'panel',
      targetScopeIds: [],
      changedFields: ['count'],
    })
    store.destroy()
  })

  it('records private health diagnostics, exposes no host payload, and recovers', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const store = createPicodashStore(config(adapter))
    const payload = { count: 9, label: 'host-secret' }
    adapter.nextWrite('commit-mismatch', payload)
    const failed = store.setValues({ count: 2 })
    expect(failed.ok).toBe(false)
    if (!failed.ok) expect(failed.error.issues[0]).toMatchObject({ code: 'adapter_write_failed' })
    const diagnostic = [...store.diagnostics.getState().current.values()][0]
    expect(diagnostic).toMatchObject({
      code: 'adapter_unhealthy',
      identity: { kind: 'adapter' },
      reason: 'mismatched_snapshot',
      count: 1,
    })
    expect(JSON.stringify(diagnostic)).not.toContain('host-secret')
    expect(JSON.stringify(diagnostic)).not.toContain('adapter-test')
    expect(Object.isFrozen(diagnostic)).toBe(true)

    adapter.replaceSnapshot({ count: 1, label: 'one' })
    expect(store.diagnostics.getState().current.size).toBe(0)
    expect(store.setValues({ count: 2 }).ok).toBe(true)
  })

  it('recovers diagnostics on changed external values and reports later read failures', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const store = createPicodashStore(config(adapter))
    adapter.nextWrite('commit-mismatch', { count: 9, label: 'wrong' })
    expect(store.setValues({ count: 2 }).ok).toBe(false)
    expect(store.diagnostics.getState().current.size).toBe(1)
    const firstOccurrence = [...store.diagnostics.getState().current.values()][0]!.lastOccurrence

    adapter.replaceSnapshot({ count: 3, label: 'three' })
    expect(store.getState().values).toEqual({ count: 3, label: 'three' })
    expect(store.diagnostics.getState().current.size).toBe(0)

    adapter.nextRead('throw')
    adapter.emit()
    expect([...store.diagnostics.getState().current.values()][0]).toMatchObject({
      code: 'adapter_unhealthy',
      reason: 'read_threw',
    })
    expect([...store.diagnostics.getState().current.values()][0]!.lastOccurrence).toBeGreaterThan(
      firstOccurrence,
    )
    adapter.nextRead('async')
    adapter.emit()
    expect([...store.diagnostics.getState().current.values()][0]).toMatchObject({
      code: 'adapter_unhealthy',
      reason: 'async_snapshot',
    })
    adapter.replaceSnapshot({ count: 4, label: 'four' })
    expect(store.diagnostics.getState().current.size).toBe(0)
    store.destroy()
  })

  it('blocks reentrant writes from adapter validators and Store subscribers', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    let store: ReturnType<typeof createPicodashStore> | undefined
    const configWithValidator = {
      ...config(adapter),
      fields: {
        count: {
          defaultValue: 1,
          validate: (
            _value: number,
            context: PicodashValidationContext<{ count: number; label: string }>,
          ) => {
            if (context.source !== 'adapter' || !store) return []
            expect(() => store?.setValues({ count: 99 })).toThrowError(
              expect.objectContaining({ code: 'reentrant-write' }),
            )
            return []
          },
        },
        label: { defaultValue: 'one' },
      },
    }
    store = createPicodashStore(configWithValidator)
    let subscriberCalls = 0
    store.subscribe(() => {
      subscriberCalls += 1
      expect(() => store?.setValues({ count: 88 })).toThrowError(
        expect.objectContaining({ code: 'reentrant-write' }),
      )
    })
    adapter.replaceSnapshot({ count: 2, label: 'two' })
    expect(store.getState().values).toEqual({ count: 2, label: 'two' })
    expect(subscriberCalls).toBe(1)
    store.destroy()
  })

  it('validates candidates before the unhealthy gate and keeps metadata available', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const store = createPicodashStore(config(adapter))
    adapter.nextWrite('commit-mismatch', { count: 4, label: 'wrong' })
    expect(store.setValues({ count: 2 }).ok).toBe(false)
    const writes = adapter.writes.length
    const invalid = store.setValues({ count: Number.NaN })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.error.issues[0]?.code).toBe('invalid_json')
    expect(adapter.writes).toHaveLength(writes)
    expect(store.setValues({ count: 1 }).ok).toBe(true)
    const blocked = store.setValues({ count: 3 })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.error.issues[0]).toMatchObject({ code: 'adapter_unhealthy' })
    expect(
      store.setDashPanelLayout('scope', {
        placement: { mode: 'floating', disposition: { kind: 'free' } },
        preferredPosition: { x: 0, y: 0 },
      }).ok,
    ).toBe(true)
    store.destroy()
  })

  it('normalizes write failures without mutating Store values', () => {
    for (const [mode, reason] of [
      ['throw-before-mutation', 'write_threw'],
      ['async-write', 'async_write'],
      ['defer-visibility', 'not_visible'],
      ['commit-mismatch', 'mismatched_snapshot'],
    ] as const) {
      const adapter = createExternalAdapter({ count: 1, label: 'one' })
      const store = createPicodashStore(config(adapter))
      adapter.nextWrite(mode)
      const result = store.setValues({ count: 2 })
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.error.issues[0]).toMatchObject({ code: 'adapter_write_failed', reason })
      expect(store.getState().values.count).toBe(1)
      store.destroy()
    }
  })

  it('keeps the last safe values when verification reads fail or snapshots become invalid', () => {
    for (const [mode, reason] of [
      ['throw', 'not_visible'],
      ['async', 'not_visible'],
      ['invalid', 'invalid_snapshot'],
    ] as const) {
      const adapter = createExternalAdapter({ count: 1, label: 'one' })
      const store = createPicodashStore(config(adapter))
      adapter.nextRead(mode)
      const result = store.setValues({ count: 2 })
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.error.issues[0]).toMatchObject({ code: 'adapter_write_failed', reason })
      expect(store.getState().values).toEqual({ count: 1, label: 'one' })
      store.destroy()
    }

    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const store = createPicodashStore(config(adapter))
    let notifications = 0
    store.subscribe(() => {
      notifications += 1
    })
    adapter.replaceSnapshot({ count: 1, label: 'one', extra: 9 })
    expect(store.getState().values).toEqual({ count: 1, label: 'one' })
    expect(notifications).toBe(0)
    expect([...store.diagnostics.getState().current.values()][0]).toMatchObject({
      code: 'adapter_unhealthy',
      reason: 'invalid_snapshot',
    })
    store.destroy()
  })

  it('ignores stale callbacks after root destruction and refuses active leases first', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const store = createPicodashStore(config(adapter))
    const scope = store.scope('scope')
    const provider = acquireProviderLease(store)
    expect(() => store.destroy()).toThrowError(
      expect.objectContaining({ code: 'root-has-active-leases' }),
    )
    provider.release()
    store.destroy({ discardUnpersisted: true })
    adapter.replaceSnapshot({ count: 2, label: 'stale' })
    expect(() => scope.getState()).toThrowError(
      expect.objectContaining({ code: 'use-after-destroy' }),
    )
    expect(adapter.releaseCalls()).toBe(1)
  })

  it('maps malformed adapter surfaces to contract errors without leaking details', () => {
    const malformed = {
      getSnapshot: 3,
      subscribe() {
        return () => undefined
      },
      setValues() {
        return undefined
      },
    }
    expect(() => createPicodashStore(config(malformed as never))).toThrowError(
      expect.objectContaining({ code: 'invalid-configuration' }),
    )
  })

  it('fails closed on hostile promise-like reflection at initialization, notification, and write', () => {
    const hostileThen = Object.create(null)
    // eslint-disable-next-line unicorn/no-thenable
    Object.defineProperty(hostileThen, 'then', {
      get() {
        throw new Error('hostile then getter')
      },
    })
    const initAdapter = {
      getSnapshot: () => hostileThen,
      subscribe: () => () => undefined,
      setValues: () => undefined,
    }
    expect(initialization(initAdapter as never).reason).toBe('async_snapshot')

    let snapshot: unknown = { count: 1, label: 'one' }
    let listener: (() => void) | undefined
    const adapter = {
      getSnapshot: () => snapshot,
      subscribe: (next: () => void) => {
        listener = next
        return () => undefined
      },
      setValues: () => hostileThen,
    }
    const store = createPicodashStore(config(adapter as never))
    snapshot = hostileThen
    listener?.()
    expect([...store.diagnostics.getState().current.values()][0]).toMatchObject({
      code: 'adapter_unhealthy',
      reason: 'async_snapshot',
    })
    snapshot = { count: 1, label: 'one' }
    listener?.()
    expect(store.diagnostics.getState().current.size).toBe(0)
    const write = store.setValues({ count: 2 })
    expect(write.ok).toBe(false)
    if (!write.ok) expect(write.error.issues[0]).toMatchObject({ reason: 'async_write' })
    store.destroy()
  })
})
