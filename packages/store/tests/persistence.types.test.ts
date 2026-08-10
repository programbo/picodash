import { expect, expectTypeOf, test } from 'vite-plus/test'
import {
  createPicodashStore,
  type PicodashEnvelopeHeader,
  type PicodashPersistence,
  type PicodashPersistenceDiagnostic,
  type PicodashPersistenceDriver,
  type PicodashPersistenceState,
  type PicodashPersistenceConflictResolutionPlan,
  type PicodashPersistenceErasePlan,
  type PersistenceEraseResult,
  type SerializedDurableScopeMetadata,
  type PersistentTransactionResult,
  type ExternalOwnedPersistenceConfig,
  type PicodashRepairPlan,
} from '../src/index.ts'
import { acquireBindingLease } from '../src/integration.ts'
import { createMemoryPersistence } from './support/memory-persistence.js'

test('persistent Store results and capability share one public contract', () => {
  const driver: PicodashPersistenceDriver = createMemoryPersistence()
  const store = createPicodashStore({
    valueOwner: 'store',
    storeId: 'persistence-types',
    schemaVersion: 1,
    fields: { value: { defaultValue: 1 } },
    persistence: {
      storageKey: 'state',
      driver,
      values: { defaultFieldPolicy: 'include' },
    },
  })
  expectTypeOf(store.persistence).toEqualTypeOf<PicodashPersistence>()
  expectTypeOf(store.setValues({ value: 2 })).toEqualTypeOf<PersistentTransactionResult>()
  expectTypeOf(
    store.resetRegisteredValues({ scopeId: 'scope' }),
  ).toEqualTypeOf<PersistentTransactionResult>()
  expectTypeOf(store.resetRegisteredValuesOrThrow({ scopeId: 'scope' })).toEqualTypeOf<
    Extract<PersistentTransactionResult, { readonly ok: true }>
  >()
  const binding = acquireBindingLease(store.scope('scope'), {
    itemId: 'item',
    field: store.fields.value,
    mode: 'input',
  })
  expectTypeOf(store.setInput(binding, 2)).toEqualTypeOf<PersistentTransactionResult>()
  expectTypeOf<typeof store.executeRepair>().parameters.toEqualTypeOf<[PicodashRepairPlan]>()
  binding.release()
  expectTypeOf(store.scope('scope').persistence).toEqualTypeOf<PicodashPersistence>()
  expectTypeOf(
    store.scope('scope').resetRegisteredValues(),
  ).toEqualTypeOf<PersistentTransactionResult>()
  store.destroy({ discardUnpersisted: true })
})

test('external metadata persistence preserves persistent result and capability types', () => {
  const driver: PicodashPersistenceDriver = createMemoryPersistence()
  const persistence: ExternalOwnedPersistenceConfig = { storageKey: 'external', driver }
  const store = createPicodashStore({
    valueOwner: 'external',
    storeId: 'external-persistence-types',
    schemaVersion: 1,
    fields: { value: { defaultValue: 1 } },
    adapter: {
      getSnapshot: () => ({ value: 1 }),
      subscribe: () => () => undefined,
      setValues: () => undefined,
    },
    persistence,
  })
  expectTypeOf(store.persistence).toEqualTypeOf<PicodashPersistence>()
  expectTypeOf(store.setValue(store.fields.value, 2)).toEqualTypeOf<PersistentTransactionResult>()
  expectTypeOf(
    store.scope('scope').setDashListRootOrder(['item']),
  ).toEqualTypeOf<PersistentTransactionResult>()
  expectTypeOf(store.metadataRecovery).toMatchTypeOf<{
    replaceScope: (...args: never[]) => unknown
  }>()
  expectTypeOf(store.documents).toMatchTypeOf<{ analyzeImport: (...args: never[]) => unknown }>()
  store.destroy({ discardUnpersisted: true })
})

test('persistence state and diagnostics keep failure reasons structured', () => {
  expectTypeOf<PicodashPersistenceState>().toMatchTypeOf<
    | { readonly status: 'clean' }
    | { readonly status: 'pending' }
    | { readonly status: 'error'; readonly lastError: PicodashPersistenceDiagnostic }
    | { readonly status: 'conflict' }
  >()
  expectTypeOf<PicodashPersistenceDiagnostic['reason']>().toEqualTypeOf<
    | 'read-failed'
    | 'write-failed'
    | 'write-verification-failed'
    | 'invalid-later-envelope'
    | 'remove-failed'
    | 'remove-verification-failed'
  >()
  expectTypeOf<PicodashEnvelopeHeader['formatVersion']>().toEqualTypeOf<1>()
})

test('persistence recovery and serialized metadata contracts are public', () => {
  expectTypeOf<
    PicodashPersistenceConflictResolutionPlan['kind']
  >().toEqualTypeOf<'persistence-conflict-resolution-plan'>()
  expectTypeOf<PicodashPersistenceErasePlan['kind']>().toEqualTypeOf<'persistence-erase-plan'>()
  expectTypeOf<PersistenceEraseResult>().toMatchTypeOf<
    { readonly ok: true; readonly erased: boolean } | { readonly ok: false }
  >()
  expectTypeOf<SerializedDurableScopeMetadata>().toMatchTypeOf<{
    readonly dashList?: object
    readonly dashPanel?: object
  }>()
})

test('persistent configuration requires a stable identity and schema version', () => {
  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    const driver: PicodashPersistenceDriver = createMemoryPersistence()
    expect(() => {
      // @ts-expect-error Persistence cannot be configured without store identity metadata.
      createPicodashStore({
        valueOwner: 'store',
        fields: { value: { defaultValue: 1 } },
        persistence: {
          storageKey: 'state',
          driver,
          values: { defaultFieldPolicy: 'include' },
        },
      })
    }).toThrow()
    expect(() => {
      // @ts-expect-error External persistence also requires Store identity metadata.
      createPicodashStore({
        valueOwner: 'external',
        fields: { value: { defaultValue: 1 } },
        adapter: {
          getSnapshot: () => ({ value: 1 }),
          subscribe: () => () => undefined,
          setValues: () => undefined,
        },
        persistence: { storageKey: 'state', driver },
      })
    }).toThrow()
  }
})

test('ephemeral and external-owned stores omit persistence from their public shape', () => {
  const ephemeral = createPicodashStore({
    valueOwner: 'store',
    fields: { value: { defaultValue: 1 } },
  })
  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    // @ts-expect-error Ephemeral stores do not expose optional persistence capabilities.
    void ephemeral.persistence
  }
  ephemeral.destroy()
  const external = createPicodashStore({
    valueOwner: 'external',
    fields: { value: { defaultValue: 1 } },
    adapter: {
      getSnapshot: () => ({ value: 1 }),
      subscribe: () => () => undefined,
      setValues: () => undefined,
    },
  })
  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    // @ts-expect-error External-owned stores without persistence omit the capability.
    void external.persistence
  }
  external.destroy()
})
