import { describe, expect, it } from 'vite-plus/test'
import {
  createPicodashNexus,
  PicodashContractError,
  type PicodashParseResult,
  type PicodashValueAdapter,
} from '../src/index.ts'
import { createExternalAdapter } from './support/external-adapter.js'
import { createMemoryPersistence } from './support/memory-persistence.js'
import { acquireBindingLease } from '../src/integration.ts'
import { schemaSuccess, syncStandardSchema } from './support/standard-schema-fixtures.js'

describe('typed single-field reset', () => {
  it('does not rerun a non-idempotent schema for canonical defaults', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      initialValues: { count: 10 },
      fields: {
        count: {
          defaultValue: 0,
          schema: syncStandardSchema((input) => schemaSuccess((input as number) + 1)),
        },
      },
    })
    expect(nexus.getState().values.count).toBe(11)
    expect(nexus.resetValue(nexus.fields.count)).toMatchObject({ ok: true })
    expect(nexus.getState().values.count).toBe(1)
    nexus.destroy()
  })

  it('resets to the configured canonical default from root and scope', () => {
    const sources: string[] = []
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
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
    const scoped = nexus.scope('settings')
    expect(nexus.resetValue(nexus.fields.count)).toEqual({
      ok: true,
      changedFields: ['count'],
      changedScopeIds: [],
    })
    expect(nexus.getState().values.count).toBe(1)
    expect(sources.at(-1)).toBe('reset:1')
    nexus.setValueOrThrow(nexus.fields.count, 4)
    expect(scoped.resetValueOrThrow(scoped.fields.count)).toMatchObject({ ok: true })
    expect(scoped.getState().values.count).toEqual(1)
  })

  it('rejects a foreign handle and preserves state atomically', () => {
    const first = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { count: { defaultValue: 1 } },
    })
    const second = createPicodashNexus({
      valueOwner: 'nexus',
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
    const nexus = createPicodashNexus({
      valueOwner: 'external',
      adapter: adapter as unknown as PicodashValueAdapter<{ readonly count: number }>,
      fields: { count: { defaultValue: 1 } },
    })
    let notifications = 0
    nexus.subscribe(() => notifications++)
    expect(nexus.scope('scope').setValue(nexus.fields.count, 3).ok).toBe(true)
    const changed = adapter.writes.at(-1)
    expect(changed?.context).toEqual({
      source: 'programmatic',
      originScopeId: 'scope',
      targetScopeIds: [],
      changedFields: ['count'],
    })
    expect(nexus.scope('scope').resetValue(nexus.fields.count)).toMatchObject({
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
    expect(nexus.resetValue(nexus.fields.count)).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
    })
    expect(adapter.writes.length).toBe(writes)
    expect(notifications).toBe(2)
  })

  it('returns persistence status for changed and unchanged resets', () => {
    const driver = createMemoryPersistence()
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'reset-persistence',
      schemaVersion: 1,
      fields: { count: { defaultValue: 1 } },
      persistence: {
        storageKey: 'state',
        driver,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    nexus.setValueOrThrow(nexus.fields.count, 2)
    expect(nexus.resetValueOrThrow(nexus.fields.count).persistence).toBe('saved')
    const calls = driver.calls.length
    expect(nexus.resetValue(nexus.fields.count)).toMatchObject({
      ok: true,
      persistence: 'unchanged',
    })
    expect(driver.calls.length).toBe(calls)
  })

  it('rejects cross-field reset validation atomically and marks dirty bindings stale only on change', () => {
    const driver = createMemoryPersistence()
    let notifications = 0
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'reset-validation',
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
    const first = nexus.scope('first')
    const second = nexus.scope('second')
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
    nexus.setValuesOrThrow({ count: 2, limit: 4 })
    const beforeCalls = driver.calls.length
    const beforeNotifications = notifications
    expect(nexus.resetValue(nexus.fields.limit)).toMatchObject({
      ok: true,
      changedFields: ['limit'],
    })
    expect(first.getState().interaction.bindings.get('item')?.get('limit')?.conflict).toBeDefined()
    expect(second.getState().interaction.bindings.get('item')?.get('limit')?.conflict).toBeDefined()
    expect(notifications).toBeGreaterThan(beforeNotifications)
    expect(driver.calls.length).toBeGreaterThan(beforeCalls)
    const invalid = createPicodashNexus({
      valueOwner: 'nexus',
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
