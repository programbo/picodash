import { describe, expect, it } from 'vite-plus/test'
import {
  createPicodashStore,
  type PicodashEnvelopeInput,
  type PicodashValueAdapter,
} from '../src/index.ts'
import { createExternalAdapter } from './support/external-adapter.js'
import { createMemoryPersistence } from './support/memory-persistence.js'

const fields = { value: { defaultValue: 1 } } as const

function createExternalPersistentStore(
  adapter = createExternalAdapter({ value: 1 }),
  driver = createMemoryPersistence(),
  initialEnvelope?: PicodashEnvelopeInput<{ value: number }>,
) {
  const store = createPicodashStore({
    valueOwner: 'external',
    storeId: 'external-persistence',
    schemaVersion: 1,
    fields,
    adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
    ...(initialEnvelope === undefined ? {} : { initialEnvelope }),
    persistence: { storageKey: 'state', driver },
  })
  return { store, adapter, driver }
}

function externalEnvelope(
  scopes: PicodashEnvelopeInput['scopes'] = [],
  revision = 1,
): PicodashEnvelopeInput<{ value: number }> {
  return {
    kind: 'picodash-store-envelope',
    formatVersion: 1,
    storeId: 'external-persistence',
    schemaVersion: 1,
    revision,
    writerId: 'external-writer',
    valueOwner: 'external',
    scopes,
  }
}

describe('external-owned metadata persistence', () => {
  it('hydrates driver-free metadata without seeding or validating adapter-owned values', () => {
    const initialEnvelope = externalEnvelope([
      [
        'panel',
        {
          dashList: { rootOrder: ['saved'], groupOrders: [], collapseOverrides: [] },
        },
      ],
    ])
    const adapter = createExternalAdapter({ value: 41 })
    const store = createPicodashStore({
      valueOwner: 'external',
      storeId: 'external-persistence',
      schemaVersion: 1,
      fields,
      adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
      initialEnvelope,
    })

    expect(store.getState().values).toEqual({ value: 41 })
    expect(store.scope('panel').getState().scope?.dashList?.rootOrder).toEqual(['saved'])
    expect(adapter.writes).toHaveLength(0)
    expect('persistence' in store).toBe(false)
    store.destroy()
  })

  it('recovers driver-free quarantined metadata without writing adapter values', () => {
    const adapter = createExternalAdapter({ value: 9 })
    const store = createPicodashStore({
      valueOwner: 'external',
      storeId: 'external-persistence',
      schemaVersion: 1,
      fields,
      adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
      initialEnvelope: externalEnvelope([
        ['panel', { dashList: { rootOrder: 'invalid' } } as never],
      ]),
    })
    expect(store.metadataRecovery.getState().quarantinedScopes.has('panel')).toBe(true)
    expect(store.metadataRecovery.replaceScope('panel', null)).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['panel'],
    })
    expect(store.metadataRecovery.getState().quarantinedScopes.has('panel')).toBe(false)
    expect(store.getState().values).toEqual({ value: 9 })
    expect(adapter.writes).toHaveLength(0)
    store.destroy()
  })

  it('migrates driver-free external metadata through an empty value payload', () => {
    const adapter = createExternalAdapter({ value: 12 })
    let observedValues: unknown
    const store = createPicodashStore({
      valueOwner: 'external',
      storeId: 'external-persistence',
      schemaVersion: 2,
      fields,
      adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
      initialEnvelope: externalEnvelope(),
      migrations: {
        1: (payload) => {
          observedValues = payload.values
          return {
            schemaVersion: 2,
            values: {},
            scopes: [
              [
                'migrated',
                {
                  dashList: { rootOrder: ['from-v1'], groupOrders: [], collapseOverrides: [] },
                },
              ],
            ],
          }
        },
      },
    })
    expect(observedValues).toEqual({})
    expect(store.getState().values).toEqual({ value: 12 })
    expect(store.scope('migrated').getState().scope?.dashList?.rootOrder).toEqual(['from-v1'])
    expect(adapter.writes).toHaveLength(0)
    store.destroy()
  })

  it('returns unchanged durability for value-only commands and notifications with no driver I/O', () => {
    const { store, adapter, driver } = createExternalPersistentStore()
    const baselineCalls = driver.calls.length

    expect(store.setValue(store.fields.value, 2)).toEqual({
      ok: true,
      changedFields: ['value'],
      changedScopeIds: [],
      persistence: 'unchanged',
    })
    expect(store.setValues({ value: 2 })).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
      persistence: 'unchanged',
    })
    adapter.replaceSnapshot({ value: 3 })

    expect(store.getState().values).toEqual({ value: 3 })
    expect(driver.calls).toHaveLength(baselineCalls)
    store.destroy({ discardUnpersisted: true })
  })

  it('persists metadata while the adapter is unhealthy and omits values from the envelope', () => {
    const { store, adapter, driver } = createExternalPersistentStore()
    adapter.nextRead('throw')
    adapter.emit()
    expect([...store.diagnostics.getState().current.values()][0]).toMatchObject({
      code: 'adapter_unhealthy',
    })

    expect(store.setDashListRootOrder('panel', ['one'])).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['panel'],
      persistence: 'saved',
    })
    const persisted = JSON.parse(driver.inspect('state') as string)
    expect(persisted.valueOwner).toBe('external')
    expect(Object.hasOwn(persisted, 'values')).toBe(false)
    expect(persisted.scopes[0][0]).toBe('panel')
    expect(adapter.writes).toHaveLength(0)
    store.destroy()
  })

  it('writes the adapter before persisting a combined document import', () => {
    const events: string[] = []
    let value = 1
    const listeners = new Set<() => void>()
    const adapter: PicodashValueAdapter<{ value: number }> = {
      getSnapshot: () => ({ value }),
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      setValues(next) {
        events.push('adapter')
        value = next.value
        for (const listener of listeners) listener()
      },
    }
    const memory = createMemoryPersistence()
    const driver = {
      ...memory,
      write(key: string, payload: string) {
        events.push('persistence')
        memory.write(key, payload)
      },
    }
    const store = createPicodashStore({
      valueOwner: 'external',
      storeId: 'external-persistence',
      schemaVersion: 1,
      fields,
      adapter,
      persistence: { storageKey: 'state', driver },
    })
    const analyzed = store.documents.analyzeImport(
      {
        formatVersion: 1,
        kind: 'root',
        storeId: 'external-persistence',
        schemaVersion: 1,
        fields: [['value', { status: 'included', value: 5 }]],
        scopes: [
          [
            'panel',
            { dashList: { rootOrder: ['imported'], groupOrders: [], collapseOverrides: [] } },
          ],
        ],
      },
      { createMissingScopes: true },
    )
    expect(analyzed.ok).toBe(true)
    if (!analyzed.ok) throw analyzed.error
    expect(store.documents.executeImport(analyzed.plan)).toMatchObject({
      ok: true,
      changedFields: ['value'],
      changedScopeIds: ['panel'],
      persistence: 'saved',
    })
    expect(events).toEqual(['adapter', 'persistence'])
    expect(JSON.parse(memory.inspect('state') as string)).not.toHaveProperty('values')
    store.destroy()
  })

  it('retains a combined adapter and metadata commit when durability becomes pending', () => {
    const { store, adapter, driver } = createExternalPersistentStore()
    const analyzed = store.documents.analyzeImport(
      {
        formatVersion: 1,
        kind: 'root',
        storeId: 'external-persistence',
        schemaVersion: 1,
        fields: [['value', { status: 'included', value: 6 }]],
        scopes: [
          [
            'panel',
            { dashList: { rootOrder: ['pending'], groupOrders: [], collapseOverrides: [] } },
          ],
        ],
      },
      { createMissingScopes: true },
    )
    expect(analyzed.ok).toBe(true)
    if (!analyzed.ok) throw analyzed.error
    driver.failNext('write')
    expect(store.documents.executeImport(analyzed.plan)).toMatchObject({
      ok: true,
      changedFields: ['value'],
      changedScopeIds: ['panel'],
      persistence: 'pending',
    })
    expect(store.getState().values).toEqual({ value: 6 })
    expect(store.scope('panel').getState().scope?.dashList?.rootOrder).toEqual(['pending'])
    expect(adapter.writes).toHaveLength(1)
    expect(driver.inspect('state')).toBeNull()
    store.destroy({ discardUnpersisted: true })
  })

  it('reloads and erases metadata conflicts without writing adapter values', () => {
    const { store, adapter, driver } = createExternalPersistentStore()
    expect(store.setDashListRootOrder('panel', ['local'])).toMatchObject({ persistence: 'saved' })
    const foreign = JSON.parse(driver.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign'
    foreign.scopes[0][1].dashList.rootOrder = ['durable']
    driver.foreignWrite('state', JSON.stringify(foreign))
    expect(store.persistence.getState().status).toBe('conflict')

    const reload = store.persistence.createConflictResolutionPlan({ mode: 'reload' })
    adapter.replaceSnapshot({ value: 8 })
    expect(store.persistence.executeConflictResolution(reload)).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['panel'],
      persistence: 'unchanged',
    })
    expect(store.scope('panel').getState().scope?.dashList?.rootOrder).toEqual(['durable'])
    expect(store.getState().values).toEqual({ value: 8 })
    expect(adapter.writes).toHaveLength(0)

    const nextForeign = JSON.parse(driver.inspect('state') as string)
    nextForeign.revision += 1
    nextForeign.writerId = 'foreign-reconcile'
    nextForeign.scopes[0][1].dashList.rootOrder = ['durable-reconcile']
    driver.foreignWrite('state', JSON.stringify(nextForeign))
    expect(store.setDashListRootOrder('panel', ['local-reconcile'])).toMatchObject({
      persistence: 'pending',
    })
    const reconcile = store.persistence.createConflictResolutionPlan({
      mode: 'reconcile',
      onOverlap: 'local',
    })
    expect(store.persistence.executeConflictResolution(reconcile)).toMatchObject({
      ok: true,
      changedFields: [],
      persistence: 'saved',
    })
    expect(store.scope('panel').getState().scope?.dashList?.rootOrder).toEqual(['local-reconcile'])
    expect(adapter.writes).toHaveLength(0)

    const erase = store.persistence.createErasePlan()
    expect(store.persistence.executeErase(erase, { confirm: true })).toMatchObject({
      ok: true,
      erased: true,
    })
    expect(adapter.writes).toHaveLength(0)
    expect(store.getState().values).toEqual({ value: 8 })
    expect(store.scope('panel').getState().scope?.dashList?.rootOrder).toEqual(['local-reconcile'])
    store.destroy({ discardUnpersisted: true })
  })

  it('activates the adapter before persistence and tears it down after initialization failure', () => {
    const driver = createMemoryPersistence()
    driver.failNext('read')
    const adapter = createExternalAdapter({ value: 1 })
    expect(() => createExternalPersistentStore(adapter, driver)).toThrowError(
      expect.objectContaining({ code: 'persistence-driver-unavailable', reason: 'read' }),
    )
    expect(adapter.releaseCalls()).toBe(1)

    const driverFreeAdapter = createExternalAdapter({ value: 1 })
    expect(() =>
      createPicodashStore({
        valueOwner: 'external',
        storeId: 'external-persistence',
        schemaVersion: 1,
        fields,
        adapter: driverFreeAdapter as unknown as PicodashValueAdapter<{ value: number }>,
        initialEnvelope: { ...externalEnvelope(), values: { value: 1 } } as never,
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'invalid-persistence-envelope', reason: 'values' }),
    )
    expect(driverFreeAdapter.releaseCalls()).toBe(1)

    const recovered = createExternalPersistentStore(createExternalAdapter({ value: 2 }), driver)
    expect(recovered.store.getState().values).toEqual({ value: 2 })
    recovered.store.destroy({ discardUnpersisted: true })
  })

  it('rejects any external persistence values property without invoking an accessor', () => {
    const adapter = createExternalAdapter({ value: 1 })
    const driver = createMemoryPersistence()
    let reads = 0
    const persistence = {
      storageKey: 'state',
      driver,
      get values() {
        reads += 1
        throw new Error('must not be read')
      },
    }
    expect(() =>
      createPicodashStore({
        valueOwner: 'external',
        storeId: 'external-persistence',
        schemaVersion: 1,
        fields,
        adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
        persistence: { storageKey: 'state', driver, values: undefined } as never,
      }),
    ).toThrowError(expect.objectContaining({ code: 'invalid-configuration' }))
    expect(() =>
      createPicodashStore({
        valueOwner: 'external',
        storeId: 'external-persistence',
        schemaVersion: 1,
        fields,
        adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
        persistence: persistence as never,
      }),
    ).toThrowError(expect.objectContaining({ code: 'invalid-configuration' }))
    expect(reads).toBe(0)
  })
})
