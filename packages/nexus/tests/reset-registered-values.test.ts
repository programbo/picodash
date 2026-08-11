import { fc, test as property } from '@fast-check/vitest'
import { describe, expect, it } from 'vite-plus/test'
import {
  createPicodashNexus,
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
  property.prop([fc.uniqueArray(fc.constantFrom('a', 'b', 'c'), { maxLength: 3 })])(
    'reports the same selected and changed fields for every active registration subset',
    (ids) => {
      const nexus = createPicodashNexus({
        valueOwner: 'nexus',
        initialValues: { a: 1, b: 1, c: 1 },
        fields: {
          a: { defaultValue: 0 as number },
          b: { defaultValue: 0 as number },
          c: { defaultValue: 0 as number },
        },
      })
      const scope = nexus.scope('property')
      const fields = { a: scope.fields.a, b: scope.fields.b, c: scope.fields.c }
      const leases = ids.map((id) =>
        acquireBindingLease(scope, { itemId: id, field: fields[id], mode: 'display' }),
      )
      const before = nexus.getState()
      const expected = [...ids].sort()
      expect(scope.inspectRegisteredValueReset()).toEqual({
        registeredFields: expected,
        changedFields: expected,
      })
      expect(nexus.getState()).toBe(before)
      for (const lease of leases) lease.release()
      nexus.destroy()
    },
  )

  it('uses active input and display registrations once, excluding released bindings', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      initialValues: { first: 9, second: 8 },
      fields: { first: { defaultValue: 1 as number }, second: { defaultValue: 2 as number } },
    })
    const scope = nexus.scope('scope')
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
    const beforeInspection = nexus.getState()
    let notifications = 0
    nexus.subscribe(() => notifications++)
    const inspection = scope.inspectRegisteredValueReset()
    expect(inspection).toEqual({
      registeredFields: ['first', 'second'],
      changedFields: ['first', 'second'],
    })
    expect(Object.isFrozen(inspection)).toBe(true)
    expect(Object.isFrozen(inspection.registeredFields)).toBe(true)
    expect(Object.isFrozen(inspection.changedFields)).toBe(true)
    expect(nexus.getState()).toBe(beforeInspection)
    expect(notifications).toBe(0)
    expect(scope.resetRegisteredValues()).toEqual({
      ok: true,
      changedFields: ['first', 'second'],
      changedScopeIds: [],
    })
    expect(nexus.getState().values).toEqual({ first: 1, second: 2 })
    nexus.setValuesOrThrow({ first: 4, second: 5 })
    released.release()
    expect(scope.resetRegisteredValues()).toEqual({
      ok: true,
      changedFields: ['first'],
      changedScopeIds: [],
    })
    expect(nexus.getState().values).toEqual({ first: 1, second: 5 })
    input.release()
    display.release()
  })

  it('snapshots active descendants and reference-counted edge release', () => {
    const adapter = createExternalAdapter({ first: 9, second: 8 })
    const nexus = createPicodashNexus({
      valueOwner: 'external',
      adapter: adapter as unknown as PicodashValueAdapter<{ first: number; second: number }>,
      fields: { first: { defaultValue: 1 }, second: { defaultValue: 2 } },
    })
    const provider = acquireProviderLease(nexus)
    const parent = acquireEntityLease(nexus.scope('parent'), { kind: 'dashPanel', host: provider })
    const child = acquireEntityLease(nexus.scope('child'), { kind: 'dashList', host: provider })
    const edgeA = acquireRelationshipLease(parent, child)
    const edgeB = acquireRelationshipLease(parent, child)
    const parentBinding = acquireBindingLease(nexus.scope('parent'), {
      itemId: 'parent',
      field: nexus.fields.first,
      mode: 'display',
    })
    const childBinding = acquireBindingLease(nexus.scope('child'), {
      itemId: 'child',
      field: nexus.fields.second,
      mode: 'input',
    })
    expect(
      nexus.inspectRegisteredValueReset({ scopeId: 'parent', includeDescendants: true }),
    ).toEqual({
      registeredFields: ['first', 'second'],
      changedFields: ['first', 'second'],
    })
    expect(
      nexus.resetRegisteredValues({ scopeId: 'parent', includeDescendants: true }),
    ).toMatchObject({
      ok: true,
      changedFields: ['first', 'second'],
    })
    expect(adapter.writes.at(-1)?.context).toEqual({
      source: 'reset',
      targetScopeIds: ['child', 'parent'],
      changedFields: ['first', 'second'],
    })
    nexus.setValuesOrThrow({ first: 4, second: 5 })
    edgeA.release()
    expect(
      nexus.resetRegisteredValues({ scopeId: 'parent', includeDescendants: true }),
    ).toMatchObject({
      ok: true,
      changedFields: ['first', 'second'],
    })
    nexus.setValuesOrThrow({ first: 4, second: 5 })
    edgeB.release()
    expect(
      nexus.resetRegisteredValues({ scopeId: 'parent', includeDescendants: true }),
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
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'registered-reset',
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
    const first = nexus.scope('first')
    const second = nexus.scope('second')
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
    expect(first.inspectRegisteredValueReset()).toEqual({
      registeredFields: ['value'],
      changedFields: ['value'],
    })
    expect(driver.calls.length).toBe(before)
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
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      initialValues: { first: 4 as number, second: 2 as number },
      fields: { first: { defaultValue: 1 as number }, second: { defaultValue: 2 as number } },
      validateValues: (values) =>
        values.first < values.second ? [{ message: 'invalid pair' }] : [],
    })
    const binding = acquireBindingLease(nexus.scope('scope'), {
      itemId: 'first',
      field: nexus.fields.first,
      mode: 'display',
    })
    for (const [options, reason] of [
      [null, 'not-object'],
      [{ scopeId: 'scope', extra: true }, 'unknown-key'],
      [Object.defineProperty({}, 'scopeId', { get: () => 'scope' }), 'accessor-property'],
      [{ scopeId: 'scope', includeDescendants: 1 }, 'invalid-include-descendants'],
    ] as const) {
      expect(failure(() => nexus.resetRegisteredValues(options as never)).context).toEqual({
        reason,
      })
      expect(failure(() => nexus.inspectRegisteredValueReset(options as never)).context).toEqual({
        reason,
      })
    }
    let nestedError: unknown
    const rootOptions = new Proxy(
      { scopeId: 'scope' },
      {
        ownKeys(target) {
          try {
            nexus.setValue(nexus.fields.second, 9)
          } catch (error) {
            nestedError = error
          }
          return Reflect.ownKeys(target)
        },
      },
    )
    expect(nexus.resetRegisteredValues(rootOptions)).toMatchObject({ ok: false })
    expect(nestedError).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    expect(nexus.getState().values.second).toBe(2)
    nestedError = undefined
    const scopedOptions = new Proxy(
      {},
      {
        ownKeys(target) {
          try {
            nexus.setValue(nexus.fields.second, 9)
          } catch (error) {
            nestedError = error
          }
          return Reflect.ownKeys(target)
        },
      },
    )
    expect(nexus.scope('scope').resetRegisteredValues(scopedOptions)).toMatchObject({ ok: false })
    expect(nestedError).toEqual(expect.objectContaining({ code: 'reentrant-write' }))
    expect(nexus.getState().values.second).toBe(2)
    expect(
      failure(() =>
        nexus.scope('scope').inspectRegisteredValueReset({ includeDescendants: 1 } as never),
      ),
    ).toMatchObject({ context: { reason: 'invalid-include-descendants' } })
    expect(failure(() => nexus.resetRegisteredValues({} as never)).code).toBe('invalid-scope-id')
    expect(failure(() => nexus.inspectRegisteredValueReset({} as never)).code).toBe(
      'invalid-scope-id',
    )
    const before = nexus.getState()
    expect(nexus.resetRegisteredValues({ scopeId: 'scope' })).toMatchObject({ ok: false })
    expect(nexus.getState().values).toEqual(before.values)
    const symbolOptions = { scopeId: 'scope', [Symbol('private')]: true }
    expect(failure(() => nexus.resetRegisteredValues(symbolOptions as never)).context).toEqual({
      reason: 'unknown-key',
    })
    binding.release()
  })

  it('keeps OrThrow success and transaction failure behavior exact', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      initialValues: { value: 4 },
      fields: { value: { defaultValue: 1 as number } },
    })
    const scope = nexus.scope('scope')
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
    nexus.setValueOrThrow(nexus.fields.value, 4)
    const failing = createPicodashNexus({
      valueOwner: 'nexus',
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
    const nexus = createPicodashNexus({
      valueOwner: 'external',
      adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
      fields: { value: { defaultValue: 1 as number } },
    })
    const parent = nexus.scope('parent')
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
    nexus.setValueOrThrow(nexus.fields.value, 4)
    expect(nexus.resetRegisteredValues({ scopeId: 'parent' })).toMatchObject({
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
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
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
    const scope = nexus.scope('scope')
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
    const before = nexus.getState()
    const result = scope.resetRegisteredValues()
    expect(result.ok).toBe(false)
    expect(parserCalls).toBe(0)
    expect(rootValidationCalls).toBe(2)
    expect(nexus.getState()).toBe(before)
    first.release()
    second.release()
  })

  it('coalesces changed notifications and suppresses empty and already-default no-ops', () => {
    const adapter = createExternalAdapter({ value: 1 })
    const nexus = createPicodashNexus({
      valueOwner: 'external',
      adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
      fields: { value: { defaultValue: 1 as number } },
    })
    const scope = nexus.scope('scope')
    let rootNotifications = 0
    let scopeNotifications = 0
    nexus.subscribe(() => {
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
    nexus.setValueOrThrow(nexus.fields.value, 4)
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
    const nexus = createPicodashNexus({
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
    const scope = nexus.scope('scope')
    const binding = acquireBindingLease(scope, {
      itemId: 'value',
      field: scope.fields.value,
      mode: 'input',
    })
    scope.setInput(binding, 'draft')
    adapter.nextWrite('throw-before-mutation')
    const rejectedWrite = scope.resetRegisteredValues()
    expect(rejectedWrite.ok).toBe(false)
    expect(nexus.getState().values.value).toBe(4)
    expect(
      scope.getState().interaction.bindings.get('item')?.get('value')?.conflict,
    ).toBeUndefined()

    const unhealthy = createExternalAdapter({ value: 4 })
    const unhealthyNexus = createPicodashNexus({
      valueOwner: 'external',
      adapter: unhealthy as unknown as PicodashValueAdapter<{ value: number }>,
      fields: { value: { defaultValue: 1 as number } },
    })
    const unhealthyScope = unhealthyNexus.scope('scope')
    const unhealthyBinding = acquireBindingLease(unhealthyScope, {
      itemId: 'value',
      field: unhealthyScope.fields.value,
      mode: 'display',
    })
    unhealthy.nextRead('invalid')
    unhealthy.emit()
    expect(unhealthyScope.resetRegisteredValues().ok).toBe(false)
    expect(unhealthyNexus.getState().values.value).toBe(4)
    unhealthyBinding.release()
    binding.release()
  })

  it('leaves unregistered values and unrelated drafts unchanged', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
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
    const scope = nexus.scope('scope')
    const unrelated = nexus.scope('unrelated')
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
    expect(nexus.getState().values).toEqual({ registered: 1, unregistered: 5 })
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
