import { describe, expect, it } from 'vite-plus/test'
import { acquireBindingLease } from '../src/integration.ts'
import {
  createPicodashStore,
  PicodashContractError,
  type PicodashValueAdapter,
} from '../src/index.ts'
import { createExternalAdapter } from './support/external-adapter.js'

describe('binding interaction commands', () => {
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
    scope.destroyScope()
    expect(rootCalls).toBe(0)
    expect(scopeCalls).toBe(1)
    expect(scope.getState().interaction.bindings.size).toBe(0)
    binding.release()
    store.destroy()
  })
})
