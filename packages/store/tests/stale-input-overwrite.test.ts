import { describe, expect, it } from 'vite-plus/test'
import { acquireBindingLease } from '../src/integration.ts'
import { createPicodashStore, PicodashContractError } from '../src/index.ts'
import { createExternalAdapter } from './support/external-adapter.js'
import { createMemoryPersistence } from './support/memory-persistence.js'
import { schemaSuccess, syncStandardSchema } from './support/standard-schema-fixtures.js'

describe('stale input overwrite plans', () => {
  it('commits a canonical stale draft without rerunning its schema', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 0,
          parse: (input) =>
            typeof input === 'number'
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'number required' }] },
          schema: syncStandardSchema((input) => schemaSuccess((input as number) + 1)),
        },
      },
    })
    const scope = store.scope('settings')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    scope.setInput(binding, 'bad')
    store.setValue(store.fields.value, 5)
    expect(scope.setInput(binding, 10)).toMatchObject({ ok: false })
    const plan = scope.createStaleInputOverwritePlan(binding)
    expect(scope.executeStaleInputOverwrite(plan)).toMatchObject({ ok: true })
    expect(store.getState().values.value).toBe(11)
    binding.release()
    store.destroy()
  })

  it('captures stale drafts and executes through the interactive pipeline', () => {
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
    const scoped = store.scope('settings')
    const binding = acquireBindingLease(scoped, {
      itemId: 'item',
      field: scoped.fields.value,
      mode: 'input',
    })
    scoped.setInput(binding, -1)
    store.setValue(store.fields.value, 2)
    const stale = scoped.setInput(binding, 3)
    expect(stale.ok).toBe(false)
    const plan = scoped.createStaleInputOverwritePlan(binding)
    expect(scoped.executeStaleInputOverwrite(plan).ok).toBe(true)
    expect(store.getState().values.value).toBe(3)
    expect(() => scoped.executeStaleInputOverwrite(plan)).toThrowError(PicodashContractError)
    binding.release()
    store.destroy()
  })

  it('rejects clean bindings with the exact stale-input reason', () => {
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
    const scoped = store.scope('settings')
    const binding = acquireBindingLease(scoped, {
      itemId: 'item',
      field: scoped.fields.value,
      mode: 'input',
    })
    expect(() => scoped.createStaleInputOverwritePlan(binding)).toThrowError(
      expect.objectContaining({
        code: 'invalid-stale-input-overwrite',
        context: { reason: 'not-stale' },
      }),
    )
    binding.release()
    store.destroy()
  })

  it('reports released before first attempt and consumed after any first attempt', () => {
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
    const scope = store.scope('settings')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    scope.setInput(binding, 0)
    store.setValue(store.fields.value, 2)
    const stale = scope.setInput(binding, 3)
    expect(stale.ok).toBe(false)
    const plan = scope.createStaleInputOverwritePlan(binding)
    binding.release()
    expect(() => scope.executeStaleInputOverwrite(plan)).toThrowError(
      expect.objectContaining({
        code: 'invalid-binding-plan',
        context: { kind: 'stale-input-overwrite', reason: 'released' },
      }),
    )
    store.destroy()
  })

  it('consumes stale plans on stale-plan and validation failures', () => {
    let reject = false
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          parse: (input) =>
            typeof input === 'number' && input > 0
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'bad' }] },
          validate: () => (reject ? [{ message: 'rejected' }] : []),
        },
      },
    })
    const scope = store.scope('settings')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    scope.setInput(binding, 0)
    store.setValue(store.fields.value, 2)
    expect(scope.setInput(binding, 3).ok).toBe(false)
    const stalePlan = scope.createStaleInputOverwritePlan(binding)
    scope.setInput(binding, 4)
    scope.setInput(binding, 3)
    expect(scope.executeStaleInputOverwrite(stalePlan)).toMatchObject({ ok: false })
    expect(() => scope.executeStaleInputOverwrite(stalePlan)).toThrowError(
      expect.objectContaining({ context: { kind: 'stale-input-overwrite', reason: 'consumed' } }),
    )

    scope.discardInput(binding)
    scope.setInput(binding, 0)
    store.setValue(store.fields.value, 4)
    expect(scope.setInput(binding, 4).ok).toBe(false)
    const validationPlan = scope.createStaleInputOverwritePlan(binding)
    reject = true
    expect(scope.executeStaleInputOverwrite(validationPlan)).toMatchObject({ ok: false })
    expect(() => scope.executeStaleInputOverwrite(validationPlan)).toThrowError(
      expect.objectContaining({ context: { kind: 'stale-input-overwrite', reason: 'consumed' } }),
    )
    binding.release()
    store.destroy()
  })

  it('enforces ownership, kind, and exact binding-generation taxonomy', () => {
    const make = () =>
      createPicodashStore({
        valueOwner: 'store' as const,
        fields: {
          value: {
            defaultValue: 1,
            parse: (input: unknown) =>
              typeof input === 'number' && input > 0
                ? { ok: true as const, candidate: input }
                : { ok: false as const, issues: [{ message: 'bad' }] },
          },
        },
      })
    const first = make()
    const second = make()
    const scope = first.scope('settings')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    scope.setInput(binding, 0)
    first.setValue(first.fields.value, 2)
    scope.setInput(binding, 3)
    const overwrite = scope.createStaleInputOverwritePlan(binding)
    expect(() => second.executeStaleInputOverwrite(overwrite)).toThrowError(
      expect.objectContaining({
        context: { kind: 'stale-input-overwrite', reason: 'foreign-root' },
      }),
    )
    expect(() => scope.executeRepair(overwrite as never)).toThrowError(
      expect.objectContaining({ context: { kind: 'repair', reason: 'wrong-kind' } }),
    )
    expect(() => scope.executeStaleInputOverwrite({} as never)).toThrowError(
      expect.objectContaining({ context: { kind: 'stale-input-overwrite', reason: 'wrong-kind' } }),
    )
    binding.release()
    expect(() => scope.executeStaleInputOverwrite(overwrite)).toThrowError(
      expect.objectContaining({ context: { kind: 'stale-input-overwrite', reason: 'released' } }),
    )
    first.destroy()
    second.destroy()
  })

  it('allows root and alternate scoped receivers and fences captured freshness', () => {
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
        other: { defaultValue: 1 },
      },
    })
    const scope = store.scope('settings')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    scope.setInput(binding, 0)
    store.setValue(store.fields.value, 2)
    scope.setInput(binding, 3)
    const unrelated = scope.createStaleInputOverwritePlan(binding)
    store.setValue(store.fields.other, 2)
    expect(store.executeStaleInputOverwrite(unrelated).ok).toBe(true)

    scope.setInput(binding, 0)
    store.setValue(store.fields.value, 4)
    scope.setInput(binding, 5)
    const target = scope.createStaleInputOverwritePlan(binding)
    store.setValue(store.fields.value, 5)
    expect(scope.executeStaleInputOverwrite(target)).toMatchObject({ ok: false })
    expect(() => scope.executeStaleInputOverwrite(target)).toThrowError(
      expect.objectContaining({
        context: { kind: 'stale-input-overwrite', reason: 'consumed' },
      }),
    )

    scope.discardInput(binding)
    scope.setInput(binding, 0)
    store.setValue(store.fields.value, 6)
    scope.setInput(binding, 7)
    const discarded = scope.createStaleInputOverwritePlan(binding)
    scope.discardInput(binding)
    expect(scope.executeStaleInputOverwrite(discarded)).toMatchObject({ ok: false })
    binding.release()
    store.destroy()
  })

  it('retains stale interaction and consumes plans on adapter authority failure', () => {
    const adapter = createExternalAdapter({ value: 1 })
    const store = createPicodashStore({
      valueOwner: 'external',
      storeId: 'overwrite-adapter',
      schemaVersion: 1,
      fields: {
        value: {
          defaultValue: 1,
          parse: (input) =>
            typeof input === 'number' && input > 0
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'bad' }] },
        },
      },
      adapter: adapter as never,
    })
    const scope = store.scope('settings')
    const binding = acquireBindingLease(scope, {
      itemId: 'item',
      field: scope.fields.value,
      mode: 'input',
    })
    scope.setInput(binding, 0)
    adapter.replaceSnapshot({ value: 2 })
    scope.setInput(binding, 3)
    const plan = scope.createStaleInputOverwritePlan(binding)
    adapter.nextWrite('throw-before-mutation')
    const result = scope.executeStaleInputOverwrite(plan)
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.error.issues[0]).toMatchObject({ code: 'adapter_write_failed' })
    expect(adapter.writes.at(-1)?.context).toMatchObject({
      source: 'interactive',
      originScopeId: 'settings',
      targetScopeIds: ['settings'],
    })
    expect(scope.getState().interaction.bindings.get('item')?.get('value')?.conflict).toBeDefined()
    expect(() => scope.executeStaleInputOverwrite(plan)).toThrowError(
      expect.objectContaining({ context: { kind: 'stale-input-overwrite', reason: 'consumed' } }),
    )
    binding.release()
    store.destroy()
  })

  it('publishes changed overwrite once with cleanup visible and other bindings stale', () => {
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
    const scope = store.scope('settings')
    const first = acquireBindingLease(scope, {
      itemId: 'first',
      field: scope.fields.value,
      mode: 'input',
    })
    const second = acquireBindingLease(scope, {
      itemId: 'second',
      field: scope.fields.value,
      mode: 'input',
    })
    scope.setInput(first, 0)
    scope.setInput(second, 0)
    store.setValue(store.fields.value, 2)
    scope.setInput(first, 3)
    scope.setInput(second, 4)
    const plan = scope.createStaleInputOverwritePlan(first)
    let rootCalls = 0
    let scopeCalls = 0
    let observedClear = false
    store.subscribe(() => {
      rootCalls += 1
      observedClear = !scope.getState().interaction.bindings.get('first')
    })
    scope.subscribe(() => {
      scopeCalls += 1
      observedClear = !scope.getState().interaction.bindings.get('first')
    })
    expect(scope.executeStaleInputOverwrite(plan)).toMatchObject({
      ok: true,
      changedFields: ['value'],
    })
    expect(rootCalls).toBe(1)
    expect(scopeCalls).toBe(1)
    expect(observedClear).toBe(true)
    expect(
      scope.getState().interaction.bindings.get('second')?.get('value')?.conflict,
    ).toBeDefined()
    first.release()
    second.release()
    store.destroy()
  })

  it('reports saved changed persistence and unchanged semantic-no-op publication', () => {
    const make = (driver: ReturnType<typeof createMemoryPersistence>) =>
      createPicodashStore({
        valueOwner: 'store' as const,
        storeId: 'overwrite-persistence',
        schemaVersion: 1,
        fields: {
          value: {
            defaultValue: 1,
            parse: (input: unknown) =>
              typeof input === 'number' && input > 0
                ? { ok: true as const, candidate: input }
                : { ok: false as const, issues: [{ message: 'bad' }] },
          },
        },
        persistence: { storageKey: 'state', driver, values: { defaultFieldPolicy: 'include' } },
      })
    const changedDriver = createMemoryPersistence()
    const changed = make(changedDriver)
    const changedScope = changed.scope('settings')
    const changedBinding = acquireBindingLease(changedScope, {
      itemId: 'item',
      field: changedScope.fields.value,
      mode: 'input',
    })
    changedScope.setInput(changedBinding, 0)
    changed.setValue(changed.fields.value, 2)
    changedScope.setInput(changedBinding, 3)
    const changedPlan = changedScope.createStaleInputOverwritePlan(changedBinding)
    expect(changedScope.executeStaleInputOverwrite(changedPlan)).toMatchObject({
      ok: true,
      persistence: 'saved',
    })
    changedBinding.release()
    changed.destroy()

    const noopDriver = createMemoryPersistence()
    const noop = make(noopDriver)
    const noopScope = noop.scope('settings')
    const noopBinding = acquireBindingLease(noopScope, {
      itemId: 'item',
      field: noopScope.fields.value,
      mode: 'input',
    })
    noopScope.setInput(noopBinding, 0)
    noop.setValue(noop.fields.value, 2)
    noop.setValue(noop.fields.value, 1)
    noopScope.setInput(noopBinding, 1)
    const noopPlan = noopScope.createStaleInputOverwritePlan(noopBinding)
    let rootCalls = 0
    let scopeCalls = 0
    let cleanupVisible = false
    noop.subscribe(() => {
      rootCalls += 1
    })
    noopScope.subscribe(() => {
      scopeCalls += 1
      cleanupVisible = !noopScope.getState().interaction.bindings.get('item')
    })
    const before = noopDriver.calls.length
    expect(noopScope.executeStaleInputOverwrite(noopPlan)).toMatchObject({
      ok: true,
      persistence: 'unchanged',
    })
    expect(rootCalls).toBe(0)
    expect(scopeCalls).toBe(1)
    expect(cleanupVisible).toBe(true)
    expect(noopDriver.calls.length).toBe(before)
    noopBinding.release()
    noop.destroy()
  })

  it('keeps plans opaque and rejects forged, display, foreign, superseded, and destroyed handles', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const scope = store.scope('settings')
    const display = acquireBindingLease(scope, {
      itemId: 'display',
      field: scope.fields.value,
      mode: 'display',
    })
    expect(() => scope.createStaleInputOverwritePlan(display as never)).toThrowError(
      expect.objectContaining({
        code: 'invalid-binding-handle',
        context: { reason: 'wrong-kind' },
      }),
    )
    const foreign = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const foreignBinding = acquireBindingLease(foreign.scope('settings'), {
      itemId: 'item',
      field: foreign.fields.value,
      mode: 'input',
    })
    expect(() => scope.createStaleInputOverwritePlan(foreignBinding as never)).toThrowError(
      expect.objectContaining({
        code: 'invalid-binding-handle',
        context: { reason: 'foreign-root' },
      }),
    )
    display.release()
    foreignBinding.release()
    foreign.destroy()
    store.destroy()
    expect(() => scope.executeStaleInputOverwrite({} as never)).toThrowError(PicodashContractError)
  })
})
