import { describe, expect, it } from 'vite-plus/test'
import {
  createPicodashStore,
  PicodashContractError,
  PicodashTransactionError,
  type PicodashValueAdapter,
} from '../src/index.ts'
import {
  acquireBindingLease,
  acquireEntityLease,
  acquireProviderLease,
  acquireRelationshipLease,
} from '../src/integration.ts'
import { createExternalAdapter } from './support/external-adapter.js'
import { createMemoryPersistence } from './support/memory-persistence.js'

const failure = (run: () => unknown) => {
  try {
    run()
    throw new Error('expected failure')
  } catch (error) {
    expect(error).toBeInstanceOf(PicodashContractError)
    return error as PicodashContractError
  }
}

describe('registered value reset', () => {
  it('uses active input and display registrations once, excluding released bindings', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      initialValues: { first: 9, second: 8 },
      fields: { first: { defaultValue: 1 as number }, second: { defaultValue: 2 as number } },
    })
    const scope = store.scope('scope')
    const input = acquireBindingLease(scope, {
      itemId: 'input',
      field: scope.fields.first,
      mode: 'input',
    })
    const display = acquireBindingLease(scope, {
      itemId: 'display',
      field: scope.fields.first,
      mode: 'display',
    })
    const released = acquireBindingLease(scope, {
      itemId: 'released',
      field: scope.fields.second,
      mode: 'display',
    })
    expect(scope.resetRegisteredValues()).toEqual({
      ok: true,
      changedFields: ['first', 'second'],
      changedScopeIds: [],
    })
    expect(store.getState().values).toEqual({ first: 1, second: 2 })
    store.setValuesOrThrow({ first: 4, second: 5 })
    released.release()
    expect(scope.resetRegisteredValues()).toEqual({
      ok: true,
      changedFields: ['first'],
      changedScopeIds: [],
    })
    expect(store.getState().values).toEqual({ first: 1, second: 5 })
    input.release()
    display.release()
  })

  it('snapshots active descendants and reference-counted edge release', () => {
    const adapter = createExternalAdapter({ first: 9, second: 8 })
    const store = createPicodashStore({
      valueOwner: 'external',
      adapter: adapter as unknown as PicodashValueAdapter<{ first: number; second: number }>,
      fields: { first: { defaultValue: 1 }, second: { defaultValue: 2 } },
    })
    const provider = acquireProviderLease(store)
    const parent = acquireEntityLease(store.scope('parent'), { kind: 'dashPanel', host: provider })
    const child = acquireEntityLease(store.scope('child'), { kind: 'dashList', host: provider })
    const edgeA = acquireRelationshipLease(parent, child)
    const edgeB = acquireRelationshipLease(parent, child)
    const parentBinding = acquireBindingLease(store.scope('parent'), {
      itemId: 'parent',
      field: store.fields.first,
      mode: 'display',
    })
    const childBinding = acquireBindingLease(store.scope('child'), {
      itemId: 'child',
      field: store.fields.second,
      mode: 'input',
    })
    expect(
      store.resetRegisteredValues({ scopeId: 'parent', includeDescendants: true }),
    ).toMatchObject({
      ok: true,
      changedFields: ['first', 'second'],
    })
    expect(adapter.writes.at(-1)?.context).toEqual({
      source: 'reset',
      targetScopeIds: ['child', 'parent'],
      changedFields: ['first', 'second'],
    })
    store.setValuesOrThrow({ first: 4, second: 5 })
    edgeA.release()
    expect(
      store.resetRegisteredValues({ scopeId: 'parent', includeDescendants: true }),
    ).toMatchObject({
      ok: true,
      changedFields: ['first', 'second'],
    })
    store.setValuesOrThrow({ first: 4, second: 5 })
    edgeB.release()
    expect(
      store.resetRegisteredValues({ scopeId: 'parent', includeDescendants: true }),
    ).toMatchObject({
      ok: true,
      changedFields: ['first'],
    })
    childBinding.release()
    parentBinding.release()
    child.release()
    parent.release()
    provider.release()
  })

  it('preserves no-op behavior, persistence results, and dirty drafts', () => {
    const driver = createMemoryPersistence()
    const store = createPicodashStore({
      valueOwner: 'store',
      storeId: 'registered-reset',
      schemaVersion: 1,
      initialValues: { value: 4 },
      fields: {
        value: {
          defaultValue: 1,
          parse: (input) =>
            input === 'reject'
              ? { ok: false, issues: [{ message: 'reject' }] }
              : { ok: true, candidate: input as number },
        },
      },
      persistence: {
        storageKey: 'state',
        driver,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    const first = store.scope('first')
    const second = store.scope('second')
    const firstBinding = acquireBindingLease(first, {
      itemId: 'item',
      field: first.fields.value,
      mode: 'input',
    })
    const secondBinding = acquireBindingLease(second, {
      itemId: 'item',
      field: second.fields.value,
      mode: 'input',
    })
    first.setInput(firstBinding, 'reject')
    second.setInput(secondBinding, 'reject')
    const before = driver.calls.length
    expect(first.resetRegisteredValues()).toMatchObject({
      ok: true,
      changedFields: ['value'],
      persistence: 'saved',
    })
    expect(first.getState().interaction.bindings.get('item')?.get('value')?.draft).toBe('reject')
    expect(first.getState().interaction.bindings.get('item')?.get('value')?.conflict).toBeDefined()
    expect(second.getState().interaction.bindings.get('item')?.get('value')?.conflict).toBeDefined()
    const writes = driver.calls.length
    expect(first.resetRegisteredValues()).toMatchObject({
      ok: true,
      changedFields: [],
      persistence: 'unchanged',
    })
    expect(driver.calls.length).toBe(writes)
    expect(driver.calls.length).toBeGreaterThan(before)
    firstBinding.release()
    secondBinding.release()
  })

  it('validates exact option records before reading and keeps reset atomic', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      initialValues: { first: 4 as number, second: 2 as number },
      fields: { first: { defaultValue: 1 as number }, second: { defaultValue: 2 as number } },
      validateValues: (values) =>
        values.first < values.second ? [{ message: 'invalid pair' }] : [],
    })
    const binding = acquireBindingLease(store.scope('scope'), {
      itemId: 'first',
      field: store.fields.first,
      mode: 'display',
    })
    for (const [options, reason] of [
      [null, 'not-object'],
      [{ scopeId: 'scope', extra: true }, 'unknown-key'],
      [Object.defineProperty({}, 'scopeId', { get: () => 'scope' }), 'accessor-property'],
      [{ scopeId: 'scope', includeDescendants: 1 }, 'invalid-include-descendants'],
    ] as const) {
      expect(failure(() => store.resetRegisteredValues(options as never)).context).toEqual({
        reason,
      })
    }
    expect(failure(() => store.resetRegisteredValues({} as never)).code).toBe('invalid-scope-id')
    const before = store.getState()
    expect(store.resetRegisteredValues({ scopeId: 'scope' })).toMatchObject({ ok: false })
    expect(store.getState().values).toEqual(before.values)
    const symbolOptions = { scopeId: 'scope', [Symbol('private')]: true }
    expect(failure(() => store.resetRegisteredValues(symbolOptions as never)).context).toEqual({
      reason: 'unknown-key',
    })
    binding.release()
  })

  it('keeps OrThrow success and transaction failure behavior exact', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      initialValues: { value: 4 },
      fields: { value: { defaultValue: 1 as number } },
    })
    const scope = store.scope('scope')
    const binding = acquireBindingLease(scope, {
      itemId: 'value',
      field: scope.fields.value,
      mode: 'display',
    })
    expect(scope.resetRegisteredValuesOrThrow()).toEqual({
      ok: true,
      changedFields: ['value'],
      changedScopeIds: [],
    })
    store.setValueOrThrow(store.fields.value, 4)
    const failing = createPicodashStore({
      valueOwner: 'store',
      initialValues: { value: 4 },
      fields: { value: { defaultValue: 1 as number } },
      validateValues: (values) => (values.value < 2 ? [{ message: 'too small' }] : []),
    })
    const failingScope = failing.scope('scope')
    const failingBinding = acquireBindingLease(failingScope, {
      itemId: 'value',
      field: failingScope.fields.value,
      mode: 'display',
    })
    expect(() => failing.resetRegisteredValuesOrThrow({ scopeId: 'scope' })).toThrowError(
      PicodashTransactionError,
    )
    expect(failing.getState().values.value).toBe(4)
    failingBinding.release()
    binding.release()
  })

  it('attributes scoped adapter resets while root resets omit origin scope', () => {
    const adapter = createExternalAdapter({ value: 4 })
    const store = createPicodashStore({
      valueOwner: 'external',
      adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
      fields: { value: { defaultValue: 1 as number } },
    })
    const parent = store.scope('parent')
    const scopeBinding = acquireBindingLease(parent, {
      itemId: 'value',
      field: parent.fields.value,
      mode: 'display',
    })
    expect(parent.resetRegisteredValues()).toMatchObject({ ok: true, changedFields: ['value'] })
    expect(adapter.writes.at(-1)?.context).toEqual({
      source: 'reset',
      originScopeId: 'parent',
      targetScopeIds: ['parent'],
      changedFields: ['value'],
    })
    store.setValueOrThrow(store.fields.value, 4)
    expect(store.resetRegisteredValues({ scopeId: 'parent' })).toMatchObject({
      ok: true,
      changedFields: ['value'],
    })
    expect(adapter.writes.at(-1)?.context).toEqual({
      source: 'reset',
      targetScopeIds: ['parent'],
      changedFields: ['value'],
    })
    scopeBinding.release()
  })

  it('runs one reset validation aggregate without invoking parsers and preserves state on rejection', () => {
    let parserCalls = 0
    let rootValidationCalls = 0
    const store = createPicodashStore({
      valueOwner: 'store',
      initialValues: { first: 4 as number, second: 2 as number },
      fields: {
        first: {
          defaultValue: 1 as number,
          parse: () => {
            parserCalls += 1
            return { ok: true, candidate: 1 }
          },
        },
        second: { defaultValue: 2 as number },
      },
      validateValues: (values) => {
        rootValidationCalls += 1
        return values.first < values.second ? [{ message: 'invalid pair' }] : []
      },
    })
    const scope = store.scope('scope')
    const first = acquireBindingLease(scope, {
      itemId: 'first',
      field: scope.fields.first,
      mode: 'display',
    })
    const second = acquireBindingLease(scope, {
      itemId: 'second',
      field: scope.fields.second,
      mode: 'display',
    })
    const before = store.getState()
    const result = scope.resetRegisteredValues()
    expect(result.ok).toBe(false)
    expect(parserCalls).toBe(0)
    expect(rootValidationCalls).toBe(2)
    expect(store.getState()).toBe(before)
    first.release()
    second.release()
  })

  it('coalesces changed notifications and suppresses empty and already-default no-ops', () => {
    const adapter = createExternalAdapter({ value: 1 })
    const store = createPicodashStore({
      valueOwner: 'external',
      adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
      fields: { value: { defaultValue: 1 as number } },
    })
    const scope = store.scope('scope')
    let rootNotifications = 0
    let scopeNotifications = 0
    store.subscribe(() => {
      rootNotifications += 1
    })
    scope.subscribe(() => {
      scopeNotifications += 1
    })
    const writes = adapter.writes.length
    expect(scope.resetRegisteredValues()).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
    })
    expect([rootNotifications, scopeNotifications]).toEqual([0, 0])
    expect(adapter.writes.length).toBe(writes)
    const binding = acquireBindingLease(scope, {
      itemId: 'value',
      field: scope.fields.value,
      mode: 'display',
    })
    expect(scope.resetRegisteredValues()).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
    })
    expect([rootNotifications, scopeNotifications]).toEqual([0, 0])
    expect(adapter.writes.length).toBe(writes)
    store.setValueOrThrow(store.fields.value, 4)
    const changedNotifications = [rootNotifications, scopeNotifications]
    expect(scope.resetRegisteredValues()).toMatchObject({ ok: true, changedFields: ['value'] })
    expect([
      rootNotifications - changedNotifications[0],
      scopeNotifications - changedNotifications[1],
    ]).toEqual([1, 1])
    binding.release()
  })

  it('keeps values and drafts atomic across adapter unhealthy and write rejection', () => {
    const adapter = createExternalAdapter({ value: 4 })
    const store = createPicodashStore({
      valueOwner: 'external',
      adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
      fields: {
        value: {
          defaultValue: 1 as number,
          parse: (input) =>
            input === 'draft'
              ? { ok: false, issues: [{ message: 'draft' }] }
              : { ok: true, candidate: input as number },
        },
      },
    })
    const scope = store.scope('scope')
    const binding = acquireBindingLease(scope, {
      itemId: 'value',
      field: scope.fields.value,
      mode: 'input',
    })
    scope.setInput(binding, 'draft')
    adapter.nextWrite('throw-before-mutation')
    const rejectedWrite = scope.resetRegisteredValues()
    expect(rejectedWrite.ok).toBe(false)
    expect(store.getState().values.value).toBe(4)
    expect(
      scope.getState().interaction.bindings.get('item')?.get('value')?.conflict,
    ).toBeUndefined()

    const unhealthy = createExternalAdapter({ value: 4 })
    const unhealthyStore = createPicodashStore({
      valueOwner: 'external',
      adapter: unhealthy as unknown as PicodashValueAdapter<{ value: number }>,
      fields: { value: { defaultValue: 1 as number } },
    })
    const unhealthyScope = unhealthyStore.scope('scope')
    const unhealthyBinding = acquireBindingLease(unhealthyScope, {
      itemId: 'value',
      field: unhealthyScope.fields.value,
      mode: 'display',
    })
    unhealthy.nextRead('invalid')
    unhealthy.emit()
    expect(unhealthyScope.resetRegisteredValues().ok).toBe(false)
    expect(unhealthyStore.getState().values.value).toBe(4)
    unhealthyBinding.release()
    binding.release()
  })

  it('leaves unregistered values and unrelated drafts unchanged', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      initialValues: { registered: 4, unregistered: 5 },
      fields: {
        registered: { defaultValue: 1 as number },
        unregistered: {
          defaultValue: 2 as number,
          parse: (input) =>
            input === 'draft'
              ? { ok: false, issues: [{ message: 'draft' }] }
              : { ok: true, candidate: input as number },
        },
      },
    })
    const scope = store.scope('scope')
    const unrelated = store.scope('unrelated')
    const registered = acquireBindingLease(scope, {
      itemId: 'registered',
      field: scope.fields.registered,
      mode: 'display',
    })
    const unrelatedBinding = acquireBindingLease(unrelated, {
      itemId: 'unregistered',
      field: unrelated.fields.unregistered,
      mode: 'input',
    })
    unrelated.setInput(unrelatedBinding, 'draft')
    expect(scope.resetRegisteredValues()).toMatchObject({ ok: true, changedFields: ['registered'] })
    expect(store.getState().values).toEqual({ registered: 1, unregistered: 5 })
    expect(
      unrelated.getState().interaction.bindings.get('unregistered')?.get('unregistered')?.draft,
    ).toBe('draft')
    expect(
      unrelated.getState().interaction.bindings.get('unregistered')?.get('unregistered')?.conflict,
    ).toBeUndefined()
    registered.release()
    unrelatedBinding.release()
  })
})
