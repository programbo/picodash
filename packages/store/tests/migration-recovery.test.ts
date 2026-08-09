import { describe, expect, it, vi } from 'vite-plus/test'
import {
  createPicodashStore,
  type PicodashPersistenceDriver,
  type PicodashSchemaMigration,
} from '../src/index.ts'
import { createMemoryPersistence } from './support/memory-persistence.js'
import { runSchemaMigrations, type SchemaMigrationError } from '../src/migration.ts'
import { createMetadataRecovery } from '../src/metadata-recovery.ts'

const envelope = (values: Record<string, unknown>, scopes: unknown[] = [], schemaVersion = 1) =>
  JSON.stringify({
    kind: 'picodash-store-envelope',
    formatVersion: 1,
    storeId: 'migration-test',
    schemaVersion,
    revision: 1,
    writerId: 'writer',
    valueOwner: 'store',
    values,
    scopes,
  })

const config = (
  driver: PicodashPersistenceDriver,
  migrations?: Record<number, PicodashSchemaMigration>,
) => ({
  valueOwner: 'store' as const,
  storeId: 'migration-test',
  schemaVersion: 2,
  fields: { value: { defaultValue: 0 }, added: { defaultValue: 5 } },
  ...(migrations ? { migrations } : {}),
  persistence: {
    storageKey: 'state',
    driver,
    values: { defaultFieldPolicy: 'include' as const },
  },
})

describe('Store beta migration and metadata recovery', () => {
  it('exposes recovery only for identified Store roots and shares it with scopes', () => {
    const ephemeral = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 0 } },
    })
    expect('metadataRecovery' in ephemeral).toBe(false)
    ephemeral.destroy()
    const identified = createPicodashStore({
      valueOwner: 'store',
      storeId: 'identified',
      schemaVersion: 1,
      fields: { value: { defaultValue: 0 } },
    })
    expect(identified.metadataRecovery).toBe(identified.scope('scope').metadataRecovery)
    identified.destroy()
  })

  it.each([
    ['source-newer', { schemaVersion: 3, values: {}, scopes: [] }, 2, undefined],
    ['missing-step', { schemaVersion: 1, values: {}, scopes: [] }, 3, {}],
    [
      'callback-threw',
      { schemaVersion: 1, values: {}, scopes: [] },
      2,
      {
        1: () => {
          throw new Error('private')
        },
      },
    ],
    [
      'async-result',
      { schemaVersion: 1, values: {}, scopes: [] },
      2,
      { 1: () => Promise.resolve({}) },
    ],
    [
      'invalid-result',
      { schemaVersion: 1, values: {}, scopes: [] },
      2,
      { 1: () => ({ nope: true }) },
    ],
    [
      'wrong-version',
      { schemaVersion: 1, values: {}, scopes: [] },
      2,
      { 1: () => ({ schemaVersion: 3, values: {}, scopes: [] }) },
    ],
  ] as const)('keeps migration failures safe: %s', (reason, payload, target, migrations) => {
    expect(() => runSchemaMigrations(payload, target, migrations as never)).toThrowError(
      expect.objectContaining<Partial<SchemaMigrationError>>({ reason }),
    )
  })

  it('rejects accessor, symbol, and out-of-range migration configuration keys', () => {
    const accessor = Object.defineProperty({}, '1', {
      get: () => () => undefined,
      enumerable: true,
    })
    expect(() =>
      createPicodashStore({ ...config(createMemoryPersistence()), migrations: accessor }),
    ).toThrowError(expect.objectContaining({ code: 'invalid-configuration' }))
    const symbol = { 1: () => ({ schemaVersion: 2, values: {}, scopes: [] }) }
    Object.defineProperty(symbol, Symbol('private'), { value: () => undefined, enumerable: true })
    expect(() =>
      createPicodashStore({ ...config(createMemoryPersistence()), migrations: symbol }),
    ).toThrowError(expect.objectContaining({ code: 'invalid-configuration' }))
    expect(() =>
      createPicodashStore({
        ...config(createMemoryPersistence()),
        migrations: { 2: () => ({ schemaVersion: 3, values: {}, scopes: [] }) },
      }),
    ).toThrowError(expect.objectContaining({ code: 'invalid-configuration' }))
  })

  it('runs a frozen detached N to N+1 payload before current projection', () => {
    const persistence = createMemoryPersistence({ state: envelope({ value: 2 }) })
    let frozen = false
    const store = createPicodashStore(
      config(persistence, {
        1: (payload) => {
          frozen = Object.isFrozen(payload) && Object.isFrozen(payload.values)
          return {
            schemaVersion: 2,
            values: { ...payload.values, added: 8 },
            scopes: payload.scopes,
          }
        },
      }),
    )
    expect(frozen).toBe(true)
    expect(store.getState().values).toMatchObject({ value: 2, added: 8 })
    store.destroy({ discardUnpersisted: true })
  })

  it('compares driver and initial sources before invoking migration callbacks', () => {
    const persistence = createMemoryPersistence({ state: envelope({ value: 2 }) })
    let calls = 0
    expect(() =>
      createPicodashStore({
        ...config(persistence, {
          1: (payload) => {
            calls += 1
            return { ...payload, schemaVersion: 2 }
          },
        }),
        initialEnvelope: JSON.parse(envelope({ value: 3 })),
      }),
    ).toThrowError(expect.objectContaining({ code: 'hydration-source-conflict' }))
    expect(calls).toBe(0)
  })

  it('reports final validation failures with the migration-safe reason', () => {
    const persistence = createMemoryPersistence({ state: envelope({ value: 2 }) })
    expect(() =>
      createPicodashStore({
        valueOwner: 'store',
        storeId: 'migration-test',
        schemaVersion: 2,
        fields: {
          value: {
            defaultValue: 0,
            validate: (value) => (value < 0 ? [{ message: 'negative' }] : []),
          },
        },
        migrations: {
          1: (payload) => ({
            schemaVersion: 2,
            values: { ...payload.values, value: -1 },
            scopes: payload.scopes,
          }),
        },
        persistence: {
          storageKey: 'state',
          driver: persistence,
          values: { defaultFieldPolicy: 'include' },
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'schema-migration-failed', reason: 'final-validation' }),
    )
  })

  it('diagnoses ignored persisted fields and recovers after a verified projection write', () => {
    const persistence = createMemoryPersistence({
      state: envelope({ value: 1, retired: true }, [], 2),
    })
    const store = createPicodashStore(config(persistence))
    const diagnostic = [...store.diagnostics.getState().current.values()].find(
      (entry) => entry.code === 'unknown_persisted_fields',
    )
    expect(diagnostic).toMatchObject({ identity: { kind: 'schema' }, unknownFieldCount: 1 })
    store.setValues({ value: 2 })
    expect(
      [...store.diagnostics.getState().current.values()].some(
        (entry) => entry.code === 'unknown_persisted_fields',
      ),
    ).toBe(false)
    store.destroy({ discardUnpersisted: true })
  })

  it('quarantines one invalid scope, blocks ordinary writes, and replaces deliberately', () => {
    const persistence = createMemoryPersistence({
      state: envelope(
        { value: 1 },
        [
          ['bad-scope', { dashPanel: { invalid: true } }],
          [
            'good-scope',
            {
              dashPanel: {
                placement: { mode: 'floating', disposition: { kind: 'free' } },
                preferredPosition: { x: 1, y: 2 },
              },
            },
          ],
        ],
        2,
      ),
    })
    const store = createPicodashStore(config(persistence))
    const recovery = store.metadataRecovery
    const firstRecoverySnapshot = recovery.getState()
    expect(recovery.getState()).toBe(firstRecoverySnapshot)
    let recoveryNotifications = 0
    const unsubscribe = recovery.subscribe(() => {
      recoveryNotifications += 1
    })
    const recoveryState = recovery.getState()
    expect(recoveryState.quarantinedScopes.has('bad-scope')).toBe(true)
    expect(() =>
      (
        recoveryState.quarantinedScopes as unknown as { set: (key: string, value: unknown) => void }
      ).set('forged', {}),
    ).toThrow()
    expect(store.getState().scopes.has('good-scope')).toBe(true)
    expect(
      store.setDashPanelLayout('bad-scope', {
        placement: { mode: 'floating', disposition: { kind: 'free' } },
        preferredPosition: { x: 1, y: 2 },
      }),
    ).toMatchObject({ ok: false, error: { issues: [{ code: 'quarantined_metadata' }] } })
    expect(store.setValues({ value: 2 })).toMatchObject({ ok: true, persistence: 'saved' })
    expect(JSON.parse(persistence.inspect('state') as string).scopes).toEqual([
      ['bad-scope', { dashPanel: { invalid: true } }],
      [
        'good-scope',
        {
          dashPanel: {
            placement: { mode: 'floating', disposition: { kind: 'free' } },
            preferredPosition: { x: 1, y: 2 },
          },
        },
      ],
    ])
    expect(recovery.replaceScope('bad-scope', null)).toMatchObject({
      ok: true,
      persistence: 'saved',
    })
    expect(recovery.getState().quarantinedScopes.has('bad-scope')).toBe(false)
    expect(recovery.getState()).not.toBe(firstRecoverySnapshot)
    expect(recovery.getState()).toBe(recovery.getState())
    expect(recoveryNotifications).toBe(1)
    unsubscribe()
    expect(JSON.parse(persistence.inspect('state') as string).scopes).toHaveLength(1)
    expect(() => recovery.replaceScope('bad-scope', null)).toThrowError(
      expect.objectContaining({
        code: 'invalid-quarantine-replacement',
        context: { reason: 'not-quarantined' },
      }),
    )
    store.destroy({ discardUnpersisted: true })
  })

  it('destroys quarantine-only scope state and publishes recovery', () => {
    const persistence = createMemoryPersistence({
      state: envelope({ value: 1 }, [['quarantine-only', { dashPanel: { invalid: true } }]], 2),
    })
    const store = createPicodashStore(config(persistence))
    const listener = vi.fn()
    store.metadataRecovery.subscribe(listener)
    expect(store.destroyScope('quarantine-only')).toMatchObject({
      ok: true,
      changedScopeIds: ['quarantine-only'],
      persistence: 'saved',
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.metadataRecovery.getState().quarantinedScopes.has('quarantine-only')).toBe(false)
    expect(
      [...store.diagnostics.getState().current.values()].some(
        (entry) => entry.code === 'metadata_quarantined',
      ),
    ).toBe(false)
    expect(JSON.parse(persistence.inspect('state') as string).scopes).toEqual([])
    store.destroy()
  })

  it('recovers metadata recovery subscriber diagnostics after a successful publication', () => {
    const persistence = createMemoryPersistence({
      state: envelope(
        { value: 1 },
        [
          ['first', { dashPanel: { invalid: true } }],
          ['second', { dashPanel: { invalid: true } }],
        ],
        2,
      ),
    })
    const store = createPicodashStore(config(persistence))
    let shouldThrow = true
    store.metadataRecovery.subscribe(() => {
      if (shouldThrow) throw new Error('private')
    })
    expect(store.metadataRecovery.replaceScope('first', null)).toMatchObject({ ok: true })
    expect(
      [...store.diagnostics.getState().current.values()].some(
        (entry) =>
          entry.code === 'subscriber_exception' &&
          JSON.stringify(entry.identity) ===
            JSON.stringify({
              kind: 'subscriber',
              surface: 'capability',
              capability: 'metadataRecovery',
            }),
      ),
    ).toBe(true)
    shouldThrow = false
    expect(store.metadataRecovery.replaceScope('second', null)).toMatchObject({ ok: true })
    expect(
      [...store.diagnostics.getState().current.values()].some(
        (entry) => entry.code === 'subscriber_exception',
      ),
    ).toBe(false)
    store.destroy()
  })

  it('clears metadata recovery listeners during teardown', () => {
    const listener = vi.fn()
    const runtime = createMetadataRecovery({
      assertActive: () => undefined,
      getState: () => ({ quarantinedScopes: new Map() }),
      replaceScope: () => ({
        ok: true as const,
        changedFields: [],
        changedScopeIds: [],
        persistence: 'unchanged' as const,
      }),
      dispatch: (listeners) => {
        for (const callback of listeners) callback()
      },
    })
    runtime.capability.subscribe(listener)
    runtime.teardown()
    runtime.publish()
    expect(listener).not.toHaveBeenCalled()
  })
})
