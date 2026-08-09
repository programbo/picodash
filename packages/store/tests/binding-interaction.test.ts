import { describe, expect, it, vi } from 'vite-plus/test'
import { acquireBindingLease } from '../src/integration.ts'
import {
  createPicodashStore,
  PicodashContractError,
  type PicodashValueAdapter,
} from '../src/index.ts'
import { createExternalAdapter } from './support/external-adapter.js'
import { schemaSuccess, syncStandardSchema } from './support/standard-schema-fixtures.js'

describe('binding interaction commands', () => {
  it('holds the write lock while binding validators run', () => {
    let nestedWrite: (() => unknown) | undefined
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          validate: () => {
            nestedWrite?.()
            return []
          },
        },
        other: { defaultValue: 0 },
      },
    })
    const scope = store.scope('reentrant-input')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    nestedWrite = () => store.setValue(store.fields.other, 9)
    expect(() => scope.setInput(binding, 2)).toThrowError(
      expect.objectContaining({ code: 'reentrant-write' }),
    )
    expect(store.getState().values).toEqual({ value: 1, other: 0 })
    binding.release()
    store.destroy()
  })

  it('commits canonical input and repair candidates without rerunning schemas', () => {
    const inputStore = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 0,
          schema: syncStandardSchema((input) => schemaSuccess((input as number) + 1)),
        },
      },
    })
    const inputScope = inputStore.scope('input')
    const inputBinding = acquireBindingLease(inputScope, {
      itemId: 'item',
      field: inputScope.fields.value,
      mode: 'input',
    })
    expect(inputScope.setInput(inputBinding, 10)).toMatchObject({ ok: true })
    expect(inputStore.getState().values.value).toBe(11)
    inputBinding.release()
    inputStore.destroy()

    const repairStore = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 0,
          parse: () => ({ ok: false as const, issues: [{ message: 'bad' }], repair: 10 }),
          schema: syncStandardSchema((input) => schemaSuccess((input as number) + 1)),
        },
      },
    })
    const repairScope = repairStore.scope('repair')
    const repairBinding = acquireBindingLease(repairScope, {
      itemId: 'item',
      field: repairScope.fields.value,
      mode: 'input',
    })
    const failed = repairScope.setInput(repairBinding, 'bad')
    expect(failed.ok).toBe(false)
    if (!failed.ok) expect(repairScope.executeRepair(failed.repair!)).toMatchObject({ ok: true })
    expect(repairStore.getState().values.value).toBe(11)
    repairBinding.release()
    repairStore.destroy()
  })

  it('revalidates canonical repair candidates at execution time', () => {
    let rejectRepair = false
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: () => ({ ok: false as const, issues: [{ message: 'bad' }], repair: 2 }),
          validate: (_value, context) =>
            rejectRepair && context.source === 'repair'
              ? [{ message: 'repair no longer accepted' }]
              : [],
        },
      },
    })
    const scope = store.scope('repair-revalidation')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    const failed = scope.setInput(binding, 'bad')
    expect(failed.ok).toBe(false)
    if (!failed.ok) {
      rejectRepair = true
      expect(scope.executeRepair(failed.repair!)).toMatchObject({
        ok: false,
        error: { issues: [{ code: 'validation_failed' }] },
      })
    }
    expect(store.getState().values.value).toBe(1)
    binding.release()
    store.destroy()
  })

  it('records frozen drafts, enriches issues, and accepts root/scoped receivers', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: (input) =>
            typeof input === 'number' && input >= 0
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'bad input' }] },
        },
      },
    })
    const scoped = store.scope('settings')
    const binding = acquireBindingLease(scoped, {
      itemId: 'item',
      field: scoped.fields.value,
      mode: 'input',
    })
    const result = store.setInput(binding, -1)
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error.issues[0]).toMatchObject({
        code: 'parse_failed',
        fieldKey: 'value',
        scopeId: 'settings',
        itemId: 'item',
        alias: 'value',
      })
    const state = scoped.getState().interaction.bindings.get('item')!.get('value')!
    expect(Object.keys(state)).toEqual(['fieldKey', 'draft', 'touched', 'inputIssues'])
    expect(Object.getOwnPropertyNames(state)).toEqual([
      'fieldKey',
      'draft',
      'touched',
      'inputIssues',
    ])
    expect(Object.isFrozen(state.draft)).toBe(true)
    expect(scoped.discardInput(binding)).toBe(true)
    expect(scoped.discardInput(binding)).toBe(false)
    binding.release()
    store.destroy()
  })

  it('rejects display handles without effects', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const scoped = store.scope('settings')
    const binding = acquireBindingLease(scoped, {
      itemId: 'item',
      field: scoped.fields.value,
      mode: 'display',
    })
    expect(() => store.setInput(binding, 2)).toThrowError(PicodashContractError)
    expect(scoped.getState().interaction.bindings.size).toBe(0)
    binding.release()
    store.destroy()
  })

  it('preserves the original base and returns exact stale issue order', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: (input) =>
            typeof input === 'number' && input > 0
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'bad' }] },
        },
      },
    })
    const scoped = store.scope('scope')
    const binding = acquireBindingLease(scoped, {
      itemId: 'item',
      field: scoped.fields.value,
      mode: 'input',
    })
    scoped.setInput(binding, -1)
    store.setValue(store.fields.value, 2)
    const stale = scoped.setInput(binding, -2)
    expect(stale.ok).toBe(false)
    if (!stale.ok)
      expect(stale.error.issues.map((issue) => issue.code)).toEqual(['parse_failed', 'stale_input'])
    const state = scoped.getState().interaction.bindings.get('item')!.get('value')!
    expect(state.inputIssues.map((issue) => issue.code)).toEqual(['parse_failed'])
    const validStale = scoped.setInput(binding, 3)
    if (!validStale.ok) expect(validStale.error.issues).toHaveLength(1)
    binding.release()
    store.destroy()
  })

  it('returns and consumes a validated parser repair plan', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: () => ({ ok: false as const, issues: [{ message: 'bad' }], repair: 2 }),
        },
      },
    })
    const scoped = store.scope('scope')
    const binding = acquireBindingLease(scoped, {
      itemId: 'item',
      field: scoped.fields.value,
      mode: 'input',
    })
    const failed = scoped.setInput(binding, 0)
    expect(failed.ok).toBe(false)
    if (!failed.ok) {
      expect(failed.repair).toBeDefined()
      expect(scoped.executeRepair(failed.repair!)).toMatchObject({
        ok: true,
        changedFields: ['value'],
      })
      expect(store.getState().values.value).toBe(2)
      expect(() => scoped.executeRepair(failed.repair!)).toThrow(PicodashContractError)
    }
    binding.release()
    store.destroy()
  })

  it('stales repair plans when another value observed by root validation changes', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: () => ({ ok: false as const, issues: [{ message: 'bad' }], repair: 2 }),
        },
        limit: { defaultValue: 2 },
      },
      validateValues: (values: { readonly value: number; readonly limit: number }) =>
        values.value <= values.limit ? [] : [{ message: 'Value exceeds the limit.' }],
    })
    const scoped = store.scope('scope')
    const binding = acquireBindingLease(scoped, {
      itemId: 'item',
      field: scoped.fields.value,
      mode: 'input',
    })
    const failed = scoped.setInput(binding, 0)
    expect(failed.ok).toBe(false)
    if (!failed.ok) {
      expect(failed.repair).toBeDefined()
      expect(store.setValue(store.fields.limit, 1)).toMatchObject({ ok: true })
      expect(scoped.executeRepair(failed.repair!)).toMatchObject({
        ok: false,
        error: { issues: [{ code: 'stale_plan' }] },
      })
    }
    binding.release()
    store.destroy()
  })

  it('stales repair plans when the same rejected draft is discarded and recreated', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: () => ({ ok: false as const, issues: [{ message: 'bad' }], repair: 2 }),
        },
      },
    })
    const scope = store.scope('scope')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    const first = scope.setInput(binding, 0)
    expect(first.ok).toBe(false)
    if (!first.ok) {
      expect(scope.discardInput(binding)).toBe(true)
      expect(scope.setInput(binding, 0).ok).toBe(false)
      expect(scope.executeRepair(first.repair!)).toMatchObject({
        ok: false,
        error: { issues: [{ code: 'stale_plan' }] },
      })
    }
    binding.release()
    store.destroy()
  })

  it('preserves cross-field and root issue ownership for binding input', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { first: { defaultValue: 1 }, second: { defaultValue: 1 } },
      validateValues: (values: { readonly first: number; readonly second: number }) =>
        values.first === 2
          ? [
              { message: 'Second is incompatible.', path: ['values', 'second'] },
              { message: 'The combination is invalid.' },
            ]
          : [],
    })
    const scope = store.scope('scope')
    const binding = acquireBindingLease(scope, {
      itemId: 'compound',
      alias: 'first-control',
      field: scope.fields.first,
      mode: 'input',
    })
    const result = scope.setInput(binding, 2)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.issues[0]).toMatchObject({
        path: ['values', 'second'],
        fieldKey: 'second',
      })
      expect(result.error.issues[0]).not.toHaveProperty('alias')
      expect(result.error.issues[1]).toEqual({
        code: 'validation_failed',
        path: [],
        message: 'The combination is invalid.',
      })
    }
    binding.release()
    store.destroy()
  })

  it('short-circuits schema and validators after parse failure', () => {
    let schemaCalls = 0
    let fieldCalls = 0
    let rootCalls = 0
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: (input) =>
            input === 1
              ? { ok: true as const, candidate: 1 }
              : { ok: false as const, issues: [{ message: 'bad' }] },
          schema: {
            '~standard': {
              version: 1,
              vendor: 'test',
              validate() {
                schemaCalls += 1
                return { value: 2 }
              },
            },
          },
          validate: () => {
            fieldCalls += 1
            return []
          },
        },
      },
      validateValues: () => {
        rootCalls += 1
        return []
      },
    })
    schemaCalls = 0
    fieldCalls = 0
    rootCalls = 0
    const binding = acquireBindingLease(store.scope('scope'), {
      itemId: 'item',
      field: store.fields.value,
      mode: 'input',
    })
    expect(store.setInput(binding, 0).ok).toBe(false)
    expect(schemaCalls).toBe(0)
    expect(fieldCalls).toBe(0)
    expect(rootCalls).toBe(0)
    binding.release()
    store.destroy()
  })

  it('marks falsey drafts stale after an external canonical change', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: false,
          parse: () => ({ ok: false as const, issues: [{ message: 'bad' }] }),
        },
      },
    })
    const scope = store.scope('scope')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    expect(scope.setInput(binding, false).ok).toBe(false)
    expect(store.setValue(store.fields.value, true).ok).toBe(true)
    expect(scope.getState().interaction.bindings.get('item')!.get('value')!.conflict).toBeDefined()
    binding.release()
    store.destroy()
  })

  it('marks a falsey draft stale after a true external notification', () => {
    const adapter = createExternalAdapter({ value: false })
    const store = createPicodashStore({
      valueOwner: 'external',
      storeId: 'falsey-adapter',
      schemaVersion: 1,
      fields: {
        value: {
          defaultValue: false,
          parse: () => ({ ok: false as const, issues: [{ message: 'bad' }] }),
        },
      },
      adapter: adapter as never,
    })
    const scope = store.scope('scope')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    expect(scope.setInput(binding, false).ok).toBe(false)
    adapter.replaceSnapshot({ value: true })
    expect(scope.getState().interaction.bindings.get('item')!.get('value')!.conflict).toBeDefined()
    binding.release()
    store.destroy()
  })

  it('coalesces interactive cleanup into the canonical dispatch', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const scope = store.scope('scope')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    scope.setInput(binding, 0)
    let rootCalls = 0
    let scopeCalls = 0
    let observedInteraction: unknown
    store.subscribe(() => {
      rootCalls += 1
      observedInteraction = scope.getState().interaction.bindings
    })
    scope.subscribe(() => {
      scopeCalls += 1
      observedInteraction = scope.getState().interaction.bindings
    })
    expect(scope.setInput(binding, 2)).toMatchObject({ ok: true, changedFields: ['value'] })
    expect(rootCalls).toBe(1)
    expect(scopeCalls).toBe(1)
    expect((observedInteraction as Map<unknown, unknown>).size).toBe(0)
    binding.release()
    store.destroy()
  })

  it('clears semantic-no-op input with one scoped notification and no root notification', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: (input) =>
            input === 1
              ? { ok: true as const, candidate: 1 }
              : { ok: false as const, issues: [{ message: 'bad' }] },
        },
      },
    })
    const scope = store.scope('scope')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    scope.setInput(binding, 0)
    let rootCalls = 0
    let scopeCalls = 0
    let observedSize = -1
    store.subscribe(() => {
      rootCalls += 1
    })
    scope.subscribe(() => {
      scopeCalls += 1
      observedSize = scope.getState().interaction.bindings.size
    })
    expect(scope.setInput(binding, 1)).toMatchObject({ ok: true, changedFields: [] })
    expect(rootCalls).toBe(0)
    expect(scopeCalls).toBe(1)
    expect(observedSize).toBe(0)
    binding.release()
    store.destroy()
  })

  it('clears semantic-no-op repairs with one scoped notification and no root notification', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: () => ({ ok: false as const, issues: [{ message: 'bad' }], repair: 1 }),
        },
      },
    })
    const scope = store.scope('scope')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    const failed = scope.setInput(binding, 0)
    expect(failed.ok).toBe(false)
    if (!failed.ok) {
      let rootCalls = 0
      let scopeCalls = 0
      let observedSize = -1
      store.subscribe(() => {
        rootCalls += 1
      })
      scope.subscribe(() => {
        scopeCalls += 1
        observedSize = scope.getState().interaction.bindings.size
      })
      expect(scope.executeRepair(failed.repair!)).toMatchObject({ ok: true, changedFields: [] })
      expect(rootCalls).toBe(0)
      expect(scopeCalls).toBe(1)
      expect(observedSize).toBe(0)
    }
    binding.release()
    store.destroy()
  })

  it('does not return a repair plan when the proposal fails field validation', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: () => ({ ok: false as const, issues: [{ message: 'bad' }], repair: 2 }),
          validate: (value) => (value === 2 ? [{ message: 'repair rejected' }] : []),
        },
      },
    })
    const binding = acquireBindingLease(store.scope('scope'), {
      itemId: 'item',
      field: store.fields.value,
      mode: 'input',
    })
    const result = store.setInput(binding, 0)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.repair).toBeUndefined()
    binding.release()
    store.destroy()
  })

  it('retains a clean draft on external authority rejection', () => {
    const adapter = createExternalAdapter({ value: 1 })
    const store = createPicodashStore({
      valueOwner: 'external',
      storeId: 'binding-adapter',
      schemaVersion: 1,
      fields: {
        value: {
          defaultValue: 1,
          parse: (input: unknown) =>
            typeof input === 'number'
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'number required' }] },
        },
      },
      adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
    })
    const scope = store.scope('scope')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    expect(scope.setInput(binding, 'invalid' as never)).toMatchObject({ ok: false })
    expect(
      scope.getState().interaction.bindings.get('item')!.get('value')!.inputIssues,
    ).toHaveLength(1)
    adapter.nextWrite('throw-before-mutation')
    let calls = 0
    scope.subscribe(() => {
      calls += 1
    })
    const result = scope.setInput(binding, 2)
    expect(result.ok).toBe(false)
    expect(calls).toBe(1)
    expect(
      scope.getState().interaction.bindings.get('item')!.get('value')!.inputIssues,
    ).toHaveLength(0)
    binding.release()
    store.destroy()
  })

  it('destroyScope clears interaction without notifying root subscribers', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: () => ({ ok: false as const, issues: [{ message: 'bad' }] }),
        },
      },
    })
    const scope = store.scope('scope')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    scope.setInput(binding, 0)
    let rootCalls = 0
    let scopeCalls = 0
    store.subscribe(() => {
      rootCalls += 1
    })
    scope.subscribe(() => {
      scopeCalls += 1
    })
    expect(scope.destroyScope()).toMatchObject({ changedScopeIds: ['scope'] })
    expect(rootCalls).toBe(0)
    expect(scopeCalls).toBe(1)
    expect(scope.getState().interaction.bindings.size).toBe(0)
    binding.release()
    store.destroy()
  })

  it('holds the write lock while discard notifications run', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: () => ({ ok: false as const, issues: [{ message: 'invalid' }] }),
        },
        other: { defaultValue: 0 },
      },
    })
    const scope = store.scope('discard-lock')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    expect(scope.setInput(binding, 2)).toMatchObject({ ok: false })
    let nestedError: unknown
    const listener = vi.fn(() => {
      try {
        store.setValue(store.fields.other, 9)
      } catch (error) {
        nestedError = error
      }
    })
    const unsubscribe = scope.subscribe(listener)
    expect(scope.discardInput(binding)).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(nestedError).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    expect(store.getState().values).toEqual({ value: 1, other: 0 })
    expect(scope.getState().interaction.bindings.size).toBe(0)
    unsubscribe()
    binding.release()
    store.destroy()
  })

  it('holds the write lock while binding release notifications run', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: () => ({ ok: false as const, issues: [{ message: 'invalid' }] }),
        },
        other: { defaultValue: 0 },
      },
    })
    const scope = store.scope('release-lock')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    expect(scope.setInput(binding, 2)).toMatchObject({ ok: false })
    let nestedError: unknown
    const listener = vi.fn(() => {
      try {
        store.setValue(store.fields.other, 9)
      } catch (error) {
        nestedError = error
      }
    })
    const unsubscribe = scope.subscribe(listener)
    binding.release()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(nestedError).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    expect(store.getState().values).toEqual({ value: 1, other: 0 })
    expect(scope.getState().interaction.bindings.size).toBe(0)
    unsubscribe()
    store.destroy()
  })
})
