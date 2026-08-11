import { describe, expect, it } from 'vite-plus/test'
import {
  createPicodashNexus,
  type PicodashEnvelopeInput,
  type PicodashValueAdapter,
} from '../src/index.ts'
import { createExternalAdapter } from './support/external-adapter.js'
import { createMemoryPersistence } from './support/memory-persistence.js'

const fields = { value: { defaultValue: 1 } } as const

function createExternalPersistentNexus(
  adapter = createExternalAdapter({ value: 1 }),
  driver = createMemoryPersistence(),
  initialEnvelope?: PicodashEnvelopeInput<{ value: number }>,
) {
  const nexus = createPicodashNexus({
    valueOwner: 'external',
    nexusId: 'external-persistence',
    schemaVersion: 1,
    fields,
    adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
    ...(initialEnvelope === undefined ? {} : { initialEnvelope }),
    persistence: { storageKey: 'state', driver },
  })
  return { nexus, adapter, driver }
}

function externalEnvelope(
  scopes: PicodashEnvelopeInput['scopes'] = [],
  revision = 1,
): PicodashEnvelopeInput<{ value: number }> {
  return {
    kind: 'picodash-nexus-envelope',
    formatVersion: 1,
    nexusId: 'external-persistence',
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
    const nexus = createPicodashNexus({
      valueOwner: 'external',
      nexusId: 'external-persistence',
      schemaVersion: 1,
      fields,
      adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
      initialEnvelope,
    })

    expect(nexus.getState().values).toEqual({ value: 41 })
    expect(nexus.scope('panel').getState().scope?.dashList?.rootOrder).toEqual(['saved'])
    expect(adapter.writes).toHaveLength(0)
    expect('persistence' in nexus).toBe(false)
    nexus.destroy()
  })

  it('recovers driver-free quarantined metadata without writing adapter values', () => {
    const adapter = createExternalAdapter({ value: 9 })
    const nexus = createPicodashNexus({
      valueOwner: 'external',
      nexusId: 'external-persistence',
      schemaVersion: 1,
      fields,
      adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
      initialEnvelope: externalEnvelope([
        ['panel', { dashList: { rootOrder: 'invalid' } } as never],
      ]),
    })
    expect(nexus.metadataRecovery.getState().quarantinedScopes.has('panel')).toBe(true)
    expect(nexus.metadataRecovery.replaceScope('panel', null)).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['panel'],
    })
    expect(nexus.metadataRecovery.getState().quarantinedScopes.has('panel')).toBe(false)
    expect(nexus.getState().values).toEqual({ value: 9 })
    expect(adapter.writes).toHaveLength(0)
    nexus.destroy()
  })

  it('migrates driver-free external metadata through an empty value payload', () => {
    const adapter = createExternalAdapter({ value: 12 })
    let observedValues: unknown
    const nexus = createPicodashNexus({
      valueOwner: 'external',
      nexusId: 'external-persistence',
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
    expect(nexus.getState().values).toEqual({ value: 12 })
    expect(nexus.scope('migrated').getState().scope?.dashList?.rootOrder).toEqual(['from-v1'])
    expect(adapter.writes).toHaveLength(0)
    nexus.destroy()
  })

  it('returns unchanged durability for value-only commands and notifications with no driver I/O', () => {
    const { nexus, adapter, driver } = createExternalPersistentNexus()
    const baselineCalls = driver.calls.length

    expect(nexus.setValue(nexus.fields.value, 2)).toEqual({
      ok: true,
      changedFields: ['value'],
      changedScopeIds: [],
      persistence: 'unchanged',
    })
    expect(nexus.setValues({ value: 2 })).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: [],
      persistence: 'unchanged',
    })
    adapter.replaceSnapshot({ value: 3 })

    expect(nexus.getState().values).toEqual({ value: 3 })
    expect(driver.calls).toHaveLength(baselineCalls)
    nexus.destroy({ discardUnpersisted: true })
  })

  it('persists metadata while the adapter is unhealthy and omits values from the envelope', () => {
    const { nexus, adapter, driver } = createExternalPersistentNexus()
    adapter.nextRead('throw')
    adapter.emit()
    expect([...nexus.diagnostics.getState().current.values()][0]).toMatchObject({
      code: 'adapter_unhealthy',
    })

    expect(nexus.setDashListRootOrder('panel', ['one'])).toEqual({
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
    nexus.destroy()
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
    const nexus = createPicodashNexus({
      valueOwner: 'external',
      nexusId: 'external-persistence',
      schemaVersion: 1,
      fields,
      adapter,
      persistence: { storageKey: 'state', driver },
    })
    const analyzed = nexus.documents.analyzeImport(
      {
        formatVersion: 1,
        kind: 'root',
        nexusId: 'external-persistence',
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
    expect(nexus.documents.executeImport(analyzed.plan)).toMatchObject({
      ok: true,
      changedFields: ['value'],
      changedScopeIds: ['panel'],
      persistence: 'saved',
    })
    expect(events).toEqual(['adapter', 'persistence'])
    expect(JSON.parse(memory.inspect('state') as string)).not.toHaveProperty('values')
    nexus.destroy()
  })

  it('retains a combined adapter and metadata commit when durability becomes pending', () => {
    const { nexus, adapter, driver } = createExternalPersistentNexus()
    const analyzed = nexus.documents.analyzeImport(
      {
        formatVersion: 1,
        kind: 'root',
        nexusId: 'external-persistence',
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
    expect(nexus.documents.executeImport(analyzed.plan)).toMatchObject({
      ok: true,
      changedFields: ['value'],
      changedScopeIds: ['panel'],
      persistence: 'pending',
    })
    expect(nexus.getState().values).toEqual({ value: 6 })
    expect(nexus.scope('panel').getState().scope?.dashList?.rootOrder).toEqual(['pending'])
    expect(adapter.writes).toHaveLength(1)
    expect(driver.inspect('state')).toBeNull()
    nexus.destroy({ discardUnpersisted: true })
  })

  it('reloads and erases metadata conflicts without writing adapter values', () => {
    const { nexus, adapter, driver } = createExternalPersistentNexus()
    expect(nexus.setDashListRootOrder('panel', ['local'])).toMatchObject({ persistence: 'saved' })
    const foreign = JSON.parse(driver.inspect('state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign'
    foreign.scopes[0][1].dashList.rootOrder = ['durable']
    driver.foreignWrite('state', JSON.stringify(foreign))
    expect(nexus.persistence.getState().status).toBe('conflict')

    const reload = nexus.persistence.createConflictResolutionPlan({ mode: 'reload' })
    adapter.replaceSnapshot({ value: 8 })
    expect(nexus.persistence.executeConflictResolution(reload)).toEqual({
      ok: true,
      changedFields: [],
      changedScopeIds: ['panel'],
      persistence: 'unchanged',
    })
    expect(nexus.scope('panel').getState().scope?.dashList?.rootOrder).toEqual(['durable'])
    expect(nexus.getState().values).toEqual({ value: 8 })
    expect(adapter.writes).toHaveLength(0)

    const nextForeign = JSON.parse(driver.inspect('state') as string)
    nextForeign.revision += 1
    nextForeign.writerId = 'foreign-reconcile'
    nextForeign.scopes[0][1].dashList.rootOrder = ['durable-reconcile']
    driver.foreignWrite('state', JSON.stringify(nextForeign))
    expect(nexus.setDashListRootOrder('panel', ['local-reconcile'])).toMatchObject({
      persistence: 'pending',
    })
    const reconcile = nexus.persistence.createConflictResolutionPlan({
      mode: 'reconcile',
      onOverlap: 'local',
    })
    expect(nexus.persistence.executeConflictResolution(reconcile)).toMatchObject({
      ok: true,
      changedFields: [],
      persistence: 'saved',
    })
    expect(nexus.scope('panel').getState().scope?.dashList?.rootOrder).toEqual(['local-reconcile'])
    expect(adapter.writes).toHaveLength(0)

    const erase = nexus.persistence.createErasePlan()
    expect(nexus.persistence.executeErase(erase, { confirm: true })).toMatchObject({
      ok: true,
      erased: true,
    })
    expect(adapter.writes).toHaveLength(0)
    expect(nexus.getState().values).toEqual({ value: 8 })
    expect(nexus.scope('panel').getState().scope?.dashList?.rootOrder).toEqual(['local-reconcile'])
    nexus.destroy({ discardUnpersisted: true })
  })

  it('activates the adapter before persistence and tears it down after initialization failure', () => {
    const driver = createMemoryPersistence()
    driver.failNext('read')
    const adapter = createExternalAdapter({ value: 1 })
    expect(() => createExternalPersistentNexus(adapter, driver)).toThrowError(
      expect.objectContaining({ code: 'persistence-driver-unavailable', reason: 'read' }),
    )
    expect(adapter.releaseCalls()).toBe(1)

    const driverFreeAdapter = createExternalAdapter({ value: 1 })
    expect(() =>
      createPicodashNexus({
        valueOwner: 'external',
        nexusId: 'external-persistence',
        schemaVersion: 1,
        fields,
        adapter: driverFreeAdapter as unknown as PicodashValueAdapter<{ value: number }>,
        initialEnvelope: { ...externalEnvelope(), values: { value: 1 } } as never,
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'invalid-persistence-envelope', reason: 'values' }),
    )
    expect(driverFreeAdapter.releaseCalls()).toBe(1)

    const recovered = createExternalPersistentNexus(createExternalAdapter({ value: 2 }), driver)
    expect(recovered.nexus.getState().values).toEqual({ value: 2 })
    recovered.nexus.destroy({ discardUnpersisted: true })
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
      createPicodashNexus({
        valueOwner: 'external',
        nexusId: 'external-persistence',
        schemaVersion: 1,
        fields,
        adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
        persistence: { storageKey: 'state', driver, values: undefined } as never,
      }),
    ).toThrowError(expect.objectContaining({ code: 'invalid-configuration' }))
    expect(() =>
      createPicodashNexus({
        valueOwner: 'external',
        nexusId: 'external-persistence',
        schemaVersion: 1,
        fields,
        adapter: adapter as unknown as PicodashValueAdapter<{ value: number }>,
        persistence: persistence as never,
      }),
    ).toThrowError(expect.objectContaining({ code: 'invalid-configuration' }))
    expect(reads).toBe(0)
  })
})
