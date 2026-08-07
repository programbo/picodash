import { expect, expectTypeOf, test } from 'vite-plus/test'
import {
  createPicodashStore,
  type PicodashEnvelopeHeader,
  type PicodashPersistence,
  type PicodashPersistenceDiagnostic,
  type PicodashPersistenceDriver,
  type PicodashPersistenceState,
  type PersistentTransactionResult,
} from '../src/index.ts'
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
  expectTypeOf(store.scope('scope').persistence).toEqualTypeOf<PicodashPersistence>()
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
    'read-failed' | 'write-failed' | 'write-verification-failed' | 'invalid-later-envelope'
  >()
  expectTypeOf<PicodashEnvelopeHeader['formatVersion']>().toEqualTypeOf<1>()
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
    // @ts-expect-error External-owned stores do not expose Store-owned persistence.
    void external.persistence
  }
  external.destroy()
})
