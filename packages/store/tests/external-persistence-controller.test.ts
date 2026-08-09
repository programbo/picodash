import { describe, expect, it } from 'vite-plus/test'
import {
  createPersistenceController,
  decodePersistenceEnvelope,
  encodePersistenceEnvelope,
} from '../src/persistence.ts'
import type {
  PicodashPersistenceDiagnostic,
  PicodashPersistenceDriver,
  PersistenceFailureReason,
} from '../src/persistence.ts'
import type { DurableScopeMetadata } from '../src/kernel/index.ts'
import { createMemoryPersistence } from './support/memory-persistence.js'

const baselineValues = Object.freeze({ value: 7 })
const metadata: DurableScopeMetadata = {
  dashList: { rootOrder: ['one'], groupOrders: new Map(), collapseOverrides: new Map() },
}

const diagnostic = (reason: string): PicodashPersistenceDiagnostic =>
  Object.freeze({
    code: 'persistence_failure',
    severity: 'error',
    message: 'Store persistence failed.',
    identity: Object.freeze({ kind: 'persistence' as const }),
    count: 1,
    lastOccurrence: 1,
    reason: reason as PicodashPersistenceDiagnostic['reason'],
  })

function makeController(
  driver: PicodashPersistenceDriver,
  initialEnvelope?: unknown,
  migrations?: Record<number, (payload: any) => any>,
) {
  return createPersistenceController({
    storageKey: 'external-state',
    driver,
    storeId: 'external-controller',
    schemaVersion: migrations ? 2 : 1,
    valueOwner: 'external',
    baselineValues,
    initialEnvelope,
    migrations,
    normalizeValues: () => baselineValues,
    onUnknownFieldCount: () => undefined,
    onUnknownFieldsRecovered: () => undefined,
    onQuarantine: () => undefined,
    onExternalValues: () => undefined,
    onApply: () => ({ changedFields: [], changedScopeIds: [] }),
    createConflictResolutionPlan: () => {
      throw new Error('kernel seam')
    },
    executeConflictResolution: () => {
      throw new Error('kernel seam')
    },
    createErasePlan: () => {
      throw new Error('kernel seam')
    },
    executeErase: () => {
      throw new Error('kernel seam')
    },
    onFailure: (reason: PersistenceFailureReason) => diagnostic(reason),
    onRecovery: () => undefined,
    onConflict: () => undefined,
    includeField: () => true,
    onUseAfterDestroy: () => {
      throw new Error('use-after-destroy')
    },
    dispatchCapability: () => undefined,
    withKernelWrite: <T>(run: () => T): T => run(),
  } as never)
}

describe('external-owned persistence controller', () => {
  it('decodes the authority-discriminated external envelope without values', () => {
    const encoded = encodePersistenceEnvelope({
      storeId: 'external-controller',
      schemaVersion: 1,
      revision: 3,
      writerId: 'writer-a',
      valueOwner: 'external',
      scopes: new Map([['scope', metadata]]),
      includeField: () => true,
    })
    expect(encoded.envelope).not.toHaveProperty('values')
    expect(encoded.content).toBe(
      encodePersistenceEnvelope({
        storeId: 'external-controller',
        schemaVersion: 1,
        revision: 99,
        writerId: 'writer-b',
        valueOwner: 'external',
        scopes: new Map([['scope', metadata]]),
        includeField: () => false,
      }).content,
    )
    expect(
      decodePersistenceEnvelope(encoded.serialized, {
        storeId: 'external-controller',
        schemaVersion: 1,
        valueOwner: 'external',
      }),
    ).toMatchObject({ ok: true })
    const withValues = JSON.parse(encoded.serialized)
    withValues.values = { value: 1 }
    expect(
      decodePersistenceEnvelope(withValues, {
        storeId: 'external-controller',
        schemaVersion: 1,
        valueOwner: 'external',
      }),
    ).toMatchObject({ ok: false, reason: 'values' })
    expect(
      decodePersistenceEnvelope(encoded.serialized, {
        storeId: 'external-controller',
        schemaVersion: 1,
        valueOwner: 'store',
      }),
    ).toMatchObject({ ok: false, reason: 'authority' })
  })

  it('hydrates and writes metadata only while retaining adapter-owned values', () => {
    const driver = createMemoryPersistence()
    const controller = makeController(driver)
    expect(controller.initialValues).toEqual(baselineValues)
    expect(controller.persist({ value: 42 }, new Map([['scope', metadata]]))).toBe('saved')
    const persisted = JSON.parse(driver.inspect('external-state') as string)
    expect(persisted.valueOwner).toBe('external')
    expect(Object.hasOwn(persisted, 'values')).toBe(false)
    expect(persisted.scopes).toHaveLength(1)
    controller.destroy(false)

    const hydrated = makeController(driver)
    expect(hydrated.initialValues).toEqual(baselineValues)
    expect(hydrated.initialScopes.has('scope')).toBe(true)
    hydrated.destroy(false)
  })

  it('rejects migration callbacks that reintroduce external-owned values', () => {
    const envelope = encodePersistenceEnvelope({
      storeId: 'external-controller',
      schemaVersion: 1,
      revision: 1,
      writerId: 'writer-a',
      valueOwner: 'external',
      scopes: new Map(),
      includeField: () => true,
    }).envelope
    expect(() =>
      makeController(createMemoryPersistence(), envelope, {
        1: (payload) => ({ ...payload, schemaVersion: 2, values: { value: 1 } }),
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'schema-migration-failed', reason: 'invalid-result' }),
    )
  })

  it('conflicts, recovers, and erases using metadata-only revisions', () => {
    const driver = createMemoryPersistence()
    const controller = makeController(driver)
    expect(controller.persist(baselineValues, new Map([['scope', metadata]]))).toBe('saved')
    const foreign = JSON.parse(driver.inspect('external-state') as string)
    foreign.revision += 1
    foreign.writerId = 'foreign'
    foreign.scopes[0][1].dashList.rootOrder = ['two']
    driver.foreignWrite('external-state', JSON.stringify(foreign))
    expect(controller.capability.getState()).toMatchObject({ status: 'conflict' })
    const snapshot = controller.createConflictResolutionSnapshot({ mode: 'overwrite' })
    expect(controller.executeConflictResolution(snapshot)).toMatchObject({
      ok: true,
      persistence: 'saved',
    })
    const recovered = JSON.parse(driver.inspect('external-state') as string)
    expect(Object.hasOwn(recovered, 'values')).toBe(false)
    expect(recovered.revision).toBeGreaterThan(foreign.revision)
    const erase = controller.createEraseSnapshot()
    expect(controller.executeErase(erase)).toMatchObject({ ok: true, erased: true })
    expect(driver.inspect('external-state')).toBeNull()
    controller.destroy(false)
  })
})
