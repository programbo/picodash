import { describe, expect, it } from 'vite-plus/test'
import {
  createPicodashStore,
  PicodashContractError,
  type PicodashParseResult,
  type PicodashValueAdapter,
} from '../src/index.ts'
import { createExternalAdapter } from './support/external-adapter.js'
import { createMemoryPersistence } from './support/memory-persistence.js'
import { acquireBindingLease } from '../src/integration.ts'

describe('typed single-field reset', () => {
  it('resets to the configured canonical default from root and scope', () => {
    const sources: string[] = []
    const store = createPicodashStore({
      valueOwner: 'store',
      initialValues: { count: 9 },
      fields: {
        count: {
          defaultValue: 1,
          parse: () => {
            throw new Error('parser must not run')
          },
          validate: (value, context) => {
            sources.push(`${context.source}:${value}`)
            return []
          },
        },
      },
    })
    const scoped = store.scope('settings')
    expect(store.resetValue(store.fields.count)).toEqual({
      ok: true,
      changedFields: ['count'],
      changedScopeIds: [],
    })
    expect(store.getState().values.count).toBe(1)
    expect(sources.at(-1)).toBe('reset:1')
    store.setValueOrThrow(store.fields.count, 4)
    expect(scoped.resetValueOrThrow(scoped.fields.count)).toMatchObject({ ok: true })
    expect(scoped.getState().values.count).toEqual(1)
  })

  it('rejects a foreign handle and preserves state atomically', () => {
    const first = createPicodashStore({
      valueOwner: 'store',
      fields: { count: { defaultValue: 1 } },
    })
    const second = createPicodashStore({
      valueOwner: 'store',
      fields: { count: { defaultValue: 2 } },
    })
    first.setValueOrThrow(first.fields.count, 7)
    expect(() => first.resetValue(second.fields.count)).toThrowError(
      new PicodashContractError('foreign-handle'),
    )
    expect(first.getState().values.count).toBe(7)
  })

  it('attributes external reset writes and suppresses semantic no-op writes', () => {
    const adapter = createExternalAdapter({ count: 1 })
    const store = createPicodashStore({
      valueOwner: 'external',
      adapter: adapter as unknown as PicodashValueAdapter<{ readonly count: number }>,
      fields: { count: { defaultValue: 1 } },
    })
    let notifications = 0
    store.subscribe(() => notifications++)
    expect(store.scope('scope').setValue(store.fields.count, 3).ok).toBe(true)
    const changed = adapter.writes.at(-1)
    expect(changed?.context).toEqual({
      source: 'programmatic',
      originScopeId: 'scope',
      targetScopeIds: [],
      changedFields: ['count'],
    })
    expect(store.scope('scope').resetValue(store.fields.count)).toMatchObject({
      ok: true,
      changedFields: ['count'],
    })
    expect(adapter.writes.at(-1)?.context).toEqual({
      source: 'reset',
      originScopeId: 'scope',
      targetScopeIds: ['scope'],
      changedFields: ['count'],
    })
    const writes = adapter.writes.length
    expect(store.resetValue(store.fields.count)).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
    })
    expect(adapter.writes.length).toBe(writes)
    expect(notifications).toBe(2)
  })

  it('returns persistence status for changed and unchanged resets', () => {
    const driver = createMemoryPersistence()
    const store = createPicodashStore({
      valueOwner: 'store',
      storeId: 'reset-persistence',
      schemaVersion: 1,
      fields: { count: { defaultValue: 1 } },
      persistence: {
        storageKey: 'state',
        driver,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    store.setValueOrThrow(store.fields.count, 2)
    expect(store.resetValueOrThrow(store.fields.count).persistence).toBe('saved')
    const calls = driver.calls.length
    expect(store.resetValue(store.fields.count)).toMatchObject({
      ok: true,
      persistence: 'unchanged',
    })
    expect(driver.calls.length).toBe(calls)
  })

  it('rejects cross-field reset validation atomically and marks dirty bindings stale only on change', () => {
    const driver = createMemoryPersistence()
    let notifications = 0
    const store = createPicodashStore({
      valueOwner: 'store',
      storeId: 'reset-validation',
      schemaVersion: 1,
      fields: {
        count: { defaultValue: 1 },
        limit: {
          defaultValue: 2 as number,
          parse: (input): PicodashParseResult<number> =>
            input === 3
              ? { ok: false, issues: [{ message: 'draft' }] }
              : { ok: true, candidate: Number(input) },
        },
      },
      validateValues: (values: { readonly count: number; readonly limit: number }) =>
        values.count > values.limit ? [{ message: 'invalid' }] : [],
      persistence: {
        storageKey: 'state',
        driver,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    const first = store.scope('first')
    const second = store.scope('second')
    first.subscribe(() => notifications++)
    second.subscribe(() => notifications++)
    const firstBinding = acquireBindingLease(first, {
      itemId: 'item',
      field: first.fields.limit,
      mode: 'input',
    })
    const secondBinding = acquireBindingLease(second, {
      itemId: 'item',
      field: second.fields.limit,
      mode: 'input',
    })
    first.setInput(firstBinding, 3)
    second.setInput(secondBinding, 3)
    store.setValuesOrThrow({ count: 2, limit: 4 })
    const beforeCalls = driver.calls.length
    const beforeNotifications = notifications
    expect(store.resetValue(store.fields.limit)).toMatchObject({
      ok: true,
      changedFields: ['limit'],
    })
    expect(first.getState().interaction.bindings.get('item')?.get('limit')?.conflict).toBeDefined()
    expect(second.getState().interaction.bindings.get('item')?.get('limit')?.conflict).toBeDefined()
    expect(notifications).toBeGreaterThan(beforeNotifications)
    expect(driver.calls.length).toBeGreaterThan(beforeCalls)
    const invalid = createPicodashStore({
      valueOwner: 'store',
      initialValues: { count: 3, limit: 5 },
      fields: { count: { defaultValue: 3 as number }, limit: { defaultValue: 2 as number } },
      validateValues: (values: { readonly count: number; readonly limit: number }) =>
        values.count > values.limit ? [{ message: 'invalid' }] : [],
    })
    const invalidBefore = invalid.getState()
    expect(invalid.resetValue(invalid.fields.limit).ok).toBe(false)
    expect(invalid.getState()).toBe(invalidBefore)
    firstBinding.release()
    secondBinding.release()
  })
})
