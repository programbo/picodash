import { describe, expect, it } from 'vite-plus/test'
import {
  createPicodashNexus,
  type PicodashInitializationError,
  type PicodashValidationContext,
  type PicodashValueAdapter,
} from '../src/index.ts'
import { acquireProviderLease } from '../src/integration.ts'
import { createExternalAdapter } from './support/external-adapter.js'

const config = (adapter: ReturnType<typeof createExternalAdapter>) => ({
  valueOwner: 'external' as const,
  nexusId: 'adapter-test',
  schemaVersion: 1,
  fields: { count: { defaultValue: 1 }, label: { defaultValue: 'one' } },
  adapter: adapter as unknown as PicodashValueAdapter<{ count: number; label: string }>,
})

const initialization = (adapter: ReturnType<typeof createExternalAdapter>) => {
  try {
    createPicodashNexus(config(adapter))
    throw new Error('expected initialization failure')
  } catch (error) {
    return error as PicodashInitializationError
  }
}

describe('manual external Nexus adapter', () => {
  it('initializes from a strict complete snapshot and preserves the write context', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const nexus = createPicodashNexus(config(adapter))
    const notifications: unknown[] = []
    nexus.subscribe(() => notifications.push(nexus.getState()))

    const result = nexus.setValues({ count: 2 })
    expect(result).toEqual({ ok: true, changedFields: ['count'], changedScopeIds: [] })
    expect(adapter.writes[0]?.context).toEqual({
      source: 'programmatic',
      targetScopeIds: [],
      changedFields: ['count'],
    })
    expect(nexus.getState().values).toEqual({ count: 2, label: 'one' })
    expect(notifications).toHaveLength(1)
    nexus.destroy()
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
    const nexus = createPicodashNexus(config(adapter))
    let notifications = 0
    nexus.subscribe(() => {
      notifications += 1
    })
    const before = nexus.getState()
    expect(nexus.setValue(nexus.fields.count, 2)).toMatchObject({ ok: true })
    expect(notifications).toBe(1)
    expect(nexus.getState()).not.toBe(before)

    adapter.replaceSnapshot({ count: 3, label: 'three' })
    expect(notifications).toBe(2)
    expect(nexus.getState().values).toEqual({ count: 3, label: 'three' })
    adapter.replaceSnapshot({ count: 3, label: 'three' })
    expect(notifications).toBe(2)
  })

  it('attributes scoped writes without inventing target scopes', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const nexus = createPicodashNexus(config(adapter))
    const scoped = nexus.scope('panel')
    const result = scoped.setValues({ count: 2 })
    expect(result).toEqual({ ok: true, changedFields: ['count'], changedScopeIds: [] })
    expect(adapter.writes[0]?.context).toEqual({
      source: 'programmatic',
      originScopeId: 'panel',
      targetScopeIds: [],
      changedFields: ['count'],
    })
    nexus.destroy()
  })

  it('records private health diagnostics, exposes no host payload, and recovers', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const nexus = createPicodashNexus(config(adapter))
    const payload = { count: 9, label: 'host-secret' }
    adapter.nextWrite('commit-mismatch', payload)
    const failed = nexus.setValues({ count: 2 })
    expect(failed.ok).toBe(false)
    if (!failed.ok) expect(failed.error.issues[0]).toMatchObject({ code: 'adapter_write_failed' })
    const diagnostic = [...nexus.diagnostics.getState().current.values()][0]
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
    expect(nexus.diagnostics.getState().current.size).toBe(0)
    expect(nexus.setValues({ count: 2 }).ok).toBe(true)
  })

  it('recovers diagnostics on changed external values and reports later read failures', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const nexus = createPicodashNexus(config(adapter))
    adapter.nextWrite('commit-mismatch', { count: 9, label: 'wrong' })
    expect(nexus.setValues({ count: 2 }).ok).toBe(false)
    expect(nexus.diagnostics.getState().current.size).toBe(1)
    const firstOccurrence = [...nexus.diagnostics.getState().current.values()][0]!.lastOccurrence

    adapter.replaceSnapshot({ count: 3, label: 'three' })
    expect(nexus.getState().values).toEqual({ count: 3, label: 'three' })
    expect(nexus.diagnostics.getState().current.size).toBe(0)

    adapter.nextRead('throw')
    adapter.emit()
    expect([...nexus.diagnostics.getState().current.values()][0]).toMatchObject({
      code: 'adapter_unhealthy',
      reason: 'read_threw',
    })
    expect([...nexus.diagnostics.getState().current.values()][0]!.lastOccurrence).toBeGreaterThan(
      firstOccurrence,
    )
    adapter.nextRead('async')
    adapter.emit()
    expect([...nexus.diagnostics.getState().current.values()][0]).toMatchObject({
      code: 'adapter_unhealthy',
      reason: 'async_snapshot',
    })
    adapter.replaceSnapshot({ count: 4, label: 'four' })
    expect(nexus.diagnostics.getState().current.size).toBe(0)
    nexus.destroy()
  })

  it('blocks reentrant writes from adapter validators and Nexus subscribers', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    let nexus: ReturnType<typeof createPicodashNexus> | undefined
    const configWithValidator = {
      ...config(adapter),
      fields: {
        count: {
          defaultValue: 1,
          validate: (
            _value: number,
            context: PicodashValidationContext<{ count: number; label: string }>,
          ) => {
            if (context.source !== 'adapter' || !nexus) return []
            expect(() => nexus?.setValues({ count: 99 })).toThrowError(
              expect.objectContaining({ code: 'reentrant-write' }),
            )
            return []
          },
        },
        label: { defaultValue: 'one' },
      },
    }
    nexus = createPicodashNexus(configWithValidator)
    let subscriberCalls = 0
    nexus.subscribe(() => {
      subscriberCalls += 1
      expect(() => nexus?.setValues({ count: 88 })).toThrowError(
        expect.objectContaining({ code: 'reentrant-write' }),
      )
    })
    adapter.replaceSnapshot({ count: 2, label: 'two' })
    expect(nexus.getState().values).toEqual({ count: 2, label: 'two' })
    expect(subscriberCalls).toBe(1)
    nexus.destroy()
  })

  it('validates candidates before the unhealthy gate and keeps metadata available', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const nexus = createPicodashNexus(config(adapter))
    adapter.nextWrite('commit-mismatch', { count: 4, label: 'wrong' })
    expect(nexus.setValues({ count: 2 }).ok).toBe(false)
    const writes = adapter.writes.length
    const invalid = nexus.setValues({ count: Number.NaN })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.error.issues[0]?.code).toBe('invalid_json')
    expect(adapter.writes).toHaveLength(writes)
    expect(nexus.setValues({ count: 1 }).ok).toBe(true)
    const blocked = nexus.setValues({ count: 3 })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.error.issues[0]).toMatchObject({ code: 'adapter_unhealthy' })
    expect(
      nexus.setDashPanelLayout('scope', {
        placement: { mode: 'floating', disposition: { kind: 'free' } },
        preferredPosition: { x: 0, y: 0 },
      }).ok,
    ).toBe(true)
    nexus.destroy()
  })

  it('normalizes write failures without mutating Nexus values', () => {
    for (const [mode, reason] of [
      ['throw-before-mutation', 'write_threw'],
      ['async-write', 'async_write'],
      ['defer-visibility', 'not_visible'],
      ['commit-mismatch', 'mismatched_snapshot'],
    ] as const) {
      const adapter = createExternalAdapter({ count: 1, label: 'one' })
      const nexus = createPicodashNexus(config(adapter))
      adapter.nextWrite(mode)
      const result = nexus.setValues({ count: 2 })
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.error.issues[0]).toMatchObject({ code: 'adapter_write_failed', reason })
      expect(nexus.getState().values.count).toBe(1)
      nexus.destroy()
    }
  })

  it('keeps the last safe values when verification reads fail or snapshots become invalid', () => {
    for (const [mode, reason] of [
      ['throw', 'not_visible'],
      ['async', 'not_visible'],
      ['invalid', 'invalid_snapshot'],
    ] as const) {
      const adapter = createExternalAdapter({ count: 1, label: 'one' })
      const nexus = createPicodashNexus(config(adapter))
      adapter.nextRead(mode)
      const result = nexus.setValues({ count: 2 })
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.error.issues[0]).toMatchObject({ code: 'adapter_write_failed', reason })
      expect(nexus.getState().values).toEqual({ count: 1, label: 'one' })
      nexus.destroy()
    }

    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const nexus = createPicodashNexus(config(adapter))
    let notifications = 0
    nexus.subscribe(() => {
      notifications += 1
    })
    adapter.replaceSnapshot({ count: 1, label: 'one', extra: 9 })
    expect(nexus.getState().values).toEqual({ count: 1, label: 'one' })
    expect(notifications).toBe(0)
    expect([...nexus.diagnostics.getState().current.values()][0]).toMatchObject({
      code: 'adapter_unhealthy',
      reason: 'invalid_snapshot',
    })
    nexus.destroy()
  })

  it('ignores stale callbacks after root destruction and refuses active leases first', () => {
    const adapter = createExternalAdapter({ count: 1, label: 'one' })
    const nexus = createPicodashNexus(config(adapter))
    const scope = nexus.scope('scope')
    const provider = acquireProviderLease(nexus)
    expect(() => nexus.destroy()).toThrowError(
      expect.objectContaining({ code: 'root-has-active-leases' }),
    )
    provider.release()
    nexus.destroy({ discardUnpersisted: true })
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
    expect(() => createPicodashNexus(config(malformed as never))).toThrowError(
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
    const nexus = createPicodashNexus(config(adapter as never))
    snapshot = hostileThen
    listener?.()
    expect([...nexus.diagnostics.getState().current.values()][0]).toMatchObject({
      code: 'adapter_unhealthy',
      reason: 'async_snapshot',
    })
    snapshot = { count: 1, label: 'one' }
    listener?.()
    expect(nexus.diagnostics.getState().current.size).toBe(0)
    const write = nexus.setValues({ count: 2 })
    expect(write.ok).toBe(false)
    if (!write.ok) expect(write.error.issues[0]).toMatchObject({ reason: 'async_write' })
    nexus.destroy()
  })
})
