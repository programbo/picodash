import { describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashStore, type PicodashValueAdapter } from '../src/index.ts'
import { acquireEntityLease } from '../src/integration.ts'
import { createExternalAdapter } from './support/external-adapter.js'
import { createMemoryPersistence } from './support/memory-persistence.js'
import {
  schemaFailure,
  schemaSuccess,
  syncStandardSchema,
} from './support/standard-schema-fixtures.js'

const createStore = (storeId: string) =>
  createPicodashStore({
    valueOwner: 'store',
    storeId,
    schemaVersion: 1,
    fields: {
      value: { defaultValue: 1 },
      secret: { defaultValue: 'token' },
    },
    export: {
      documents: { defaultFieldPolicy: 'include' },
      fields: { secret: { default: 'redact', allowPromotion: 'with-confirmation' } },
    },
  })

describe('Store document namespace integration', () => {
  it('exports root and scoped projections with policy and one-use plans', () => {
    const store = createStore('documents-integration')
    const rootPlan = store.documents.createExportPlan()
    const rootResult = store.documents.executeExport(rootPlan)
    expect(rootResult.ok).toBe(true)
    if (!rootResult.ok) return
    expect(rootResult.document.kind).toBe('root')
    expect(rootResult.document.fields).toEqual([
      ['secret', { status: 'redacted' }],
      ['value', { status: 'included', value: 1 }],
    ])

    const scopedPlan = store.scope('settings').documents.createExportPlan({
      includeDescendants: false,
      fields: [store.fields.value],
    })
    const scopedResult = store.scope('settings').documents.executeExport(scopedPlan)
    expect(scopedResult.ok).toBe(true)
    if (scopedResult.ok) expect(scopedResult.document.kind).toBe('scope')
    store.destroy()
  })

  it('guards cached root and scoped document capabilities after destruction', () => {
    const store = createStore('documents-destroyed-capability')
    const rootDocuments = store.documents
    const scopedDocuments = store.scope('scope').documents
    store.destroy()
    for (const action of [
      () => rootDocuments.analyzeImport({}),
      () => rootDocuments.createExportPlan(),
      () => scopedDocuments.analyzeImport({}),
      () => scopedDocuments.createExportPlan({ includeDescendants: false }),
    ])
      expect(action).toThrowError(expect.objectContaining({ code: 'use-after-destroy' }))
  })

  it('requires explicit promotion confirmation and does not consume on malformed execution options', () => {
    const store = createStore('documents-promotion')
    const plan = store.documents.createExportPlan({
      includeDescendants: false,
      fields: [store.fields.secret],
      promoteFields: [store.fields.secret],
    })
    expect(() => store.documents.executeExport(plan, undefined)).toThrowError(
      expect.objectContaining({ code: 'invalid-document-options' }),
    )
    const result = store.documents.executeExport(plan, { confirmRedactedPromotion: true })
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.document.fields).toEqual([['secret', { status: 'included', value: 'token' }]])
    store.destroy()
  })

  it('imports atomically, fences stale plans, and rejects foreign identity without permission', () => {
    const source = createStore('documents-source')
    const sourceResult = source.documents.executeExport(source.documents.createExportPlan())
    expect(sourceResult.ok).toBe(true)
    if (!sourceResult.ok) return
    const target = createStore('documents-target')
    const foreign = target.documents.analyzeImport(sourceResult.document)
    expect(foreign.ok).toBe(false)
    if (!foreign.ok) {
      expect(foreign.error.issues[0]).toEqual({
        code: 'foreign_store',
        path: [],
        message: 'Invalid Store document.',
      })
    }

    target.setValue(target.fields.value, 10)
    const analysis = target.documents.analyzeImport(sourceResult.document, {
      allowForeignStore: true,
    })
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    target.setValue(target.fields.secret, 'changed-after-analysis')
    const stale = target.documents.executeImport(analysis.plan)
    expect(stale.ok).toBe(false)
    if (!stale.ok) expect(stale.error.issues[0]?.message).toBe('Import plan is stale.')
    expect(() => target.documents.executeImport(analysis.plan)).toThrowError(
      expect.objectContaining({ code: 'invalid-document-plan' }),
    )

    const fresh = target.documents.analyzeImport(sourceResult.document, { allowForeignStore: true })
    expect(fresh.ok).toBe(true)
    if (fresh.ok) {
      const committed = target.documents.executeImport(fresh.plan)
      expect(committed.ok).toBe(true)
      expect(target.getState().values.value).toBe(1)
    }
    source.destroy()
    target.destroy()
  })

  it('rejects root-document retargeting and stales plans when an active-only target disappears', () => {
    const store = createStore('documents-scope-existence')
    const exported = store.documents.executeExport(store.documents.createExportPlan())
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    expect(() =>
      store.documents.analyzeImport(exported.document, { targetScopeId: 'transient' }),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-document-options',
        context: { operation: 'import-analysis', reason: 'invalid-target' },
      }),
    )

    const scopeDocument = {
      ...exported.document,
      kind: 'scope' as const,
      scopeId: 'transient',
      scopes: [],
    }
    const transient = store.scope('transient')
    const lease = acquireEntityLease(transient, { kind: 'dashList' })
    const analysis = store.documents.analyzeImport(scopeDocument, {
      targetScopeId: 'transient',
    })
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    lease.release()
    expect(store.documents.executeImport(analysis.plan)).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'stale_plan', message: 'Import plan is stale.' }] },
    })
    store.destroy()
  })

  it('validates and canonicalizes imported values during analysis', () => {
    const source = createPicodashStore({
      valueOwner: 'store',
      storeId: 'documents-analysis-pipeline',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1.4 } },
      export: { documents: { defaultFieldPolicy: 'include' } },
    })
    const exported = source.documents.executeExport(source.documents.createExportPlan())
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    const target = createPicodashStore({
      valueOwner: 'store',
      storeId: 'documents-analysis-pipeline',
      schemaVersion: 1,
      fields: {
        value: {
          defaultValue: 1,
          schema: syncStandardSchema((input) =>
            typeof input === 'number'
              ? schemaSuccess(Math.round(input))
              : schemaFailure([{ message: 'number required' }]),
          ),
        },
      },
    })
    const canonical = target.documents.analyzeImport(exported.document)
    expect(canonical).toMatchObject({ ok: true, plan: { changedFields: [] } })
    if (!canonical.ok) return
    expect(target.documents.executeImport(canonical.plan)).toMatchObject({
      ok: true,
      changedFields: [],
    })

    source.setValue(source.fields.value, -1)
    const rejectedDocument = source.documents.executeExport(source.documents.createExportPlan())
    expect(rejectedDocument.ok).toBe(true)
    if (!rejectedDocument.ok) return
    const rejectingTarget = createPicodashStore({
      valueOwner: 'store',
      storeId: 'documents-analysis-pipeline',
      schemaVersion: 1,
      fields: {
        value: {
          defaultValue: 1,
          validate: (value) => (value < 0 ? [{ message: 'must be non-negative' }] : []),
        },
      },
    })
    expect(rejectingTarget.documents.analyzeImport(rejectedDocument.document)).toMatchObject({
      ok: false,
      error: { issues: [{ code: 'validation_failed' }] },
    })
    source.destroy()
    target.destroy()
    rejectingTarget.destroy()
  })

  it('commits a non-idempotent schema canonicalizer exactly once', () => {
    const source = createPicodashStore({
      valueOwner: 'store',
      storeId: 'documents-single-canonicalization',
      schemaVersion: 1,
      fields: { value: { defaultValue: 10 } },
      export: { documents: { defaultFieldPolicy: 'include' } },
    })
    const exported = source.documents.executeExport(source.documents.createExportPlan())
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    const target = createPicodashStore({
      valueOwner: 'store',
      storeId: 'documents-single-canonicalization',
      schemaVersion: 1,
      fields: {
        value: {
          defaultValue: 0,
          schema: syncStandardSchema((input) =>
            typeof input === 'number'
              ? schemaSuccess(input + 1)
              : schemaFailure([{ message: 'number required' }]),
          ),
        },
      },
    })
    const analysis = target.documents.analyzeImport(exported.document)
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    expect(target.documents.executeImport(analysis.plan)).toMatchObject({
      ok: true,
      changedFields: ['value'],
    })
    expect(target.getState().values.value).toBe(11)
    source.destroy()
    target.destroy()
  })

  it('fences scoped plans to their receiver target', () => {
    const store = createStore('documents-target-fence')
    const plan = store.scope('one').documents.createExportPlan({ includeDescendants: false })
    try {
      store.scope('two').documents.executeExport(plan)
      throw new Error('expected foreign target')
    } catch (error) {
      expect(error).toMatchObject({ code: 'invalid-document-plan' })
      expect((error as { context: { reason?: string } }).context.reason).toBe('foreign-target')
    }
    store.destroy()
  })

  it('imports through Store-owned persistence and preserves the saved result', () => {
    const source = createStore('documents-persistence-import')
    const exported = source.documents.executeExport(source.documents.createExportPlan())
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    const persistence = createMemoryPersistence()
    const target = createPicodashStore({
      valueOwner: 'store',
      storeId: 'documents-persistence-import',
      schemaVersion: 1,
      fields: { value: { defaultValue: 10 }, secret: { defaultValue: 'target' } },
      persistence: {
        storageKey: 'documents-import-state',
        driver: persistence,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    const analysis = target.documents.analyzeImport(exported.document)
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    const result = target.documents.executeImport(analysis.plan)
    expect(result).toMatchObject({ ok: true, persistence: 'saved' })
    expect(target.getState().values).toEqual({ value: 1, secret: 'target' })
    expect(persistence.calls.filter(({ kind }) => kind === 'write')).toHaveLength(1)
    expect(persistence.inspect('documents-import-state')).toContain('"value":1')
    source.destroy()
    target.destroy({ discardUnpersisted: true })
  })

  it('imports as one atomic external-adapter batch and leaves state unchanged on failure', () => {
    const source = createStore('documents-adapter-import')
    const adapter = createExternalAdapter({ value: 10, secret: 'target' })
    const target = createPicodashStore({
      valueOwner: 'external',
      storeId: 'documents-adapter-import',
      schemaVersion: 1,
      fields: { value: { defaultValue: 0 }, secret: { defaultValue: 'target' } },
      adapter: adapter as unknown as PicodashValueAdapter<{
        readonly value: number
        readonly secret: string
      }>,
    })
    const exported = source.documents.executeExport(source.documents.createExportPlan())
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    const first = target.documents.analyzeImport(exported.document)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(target.documents.executeImport(first.plan)).toMatchObject({ ok: true })
    expect(adapter.writes).toHaveLength(1)
    expect(adapter.writes[0]?.context).toMatchObject({ source: 'import' })
    expect(target.getState().values.value).toBe(1)

    source.setValue(source.fields.value, 2)
    const nextExport = source.documents.executeExport(source.documents.createExportPlan())
    expect(nextExport.ok).toBe(true)
    if (!nextExport.ok) return
    const second = target.documents.analyzeImport(nextExport.document)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    const before = target.getState()
    adapter.nextWrite('throw-before-mutation')
    expect(target.documents.executeImport(second.plan)).toMatchObject({ ok: false })
    expect(adapter.writes).toHaveLength(2)
    expect(target.getState()).toBe(before)
    expect(target.getState().values.value).toBe(1)
    source.destroy()
    target.destroy()
  })

  it('runs document schema migration before import overlay', () => {
    const source = createStore('documents-migration-import')
    const exported = source.documents.executeExport(source.documents.createExportPlan())
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    const target = createPicodashStore({
      valueOwner: 'store',
      storeId: 'documents-migration-import',
      schemaVersion: 2,
      fields: { value: { defaultValue: 0 }, secret: { defaultValue: 'target' } },
      migrations: {
        1: (payload) => ({
          ...payload,
          schemaVersion: 2,
          values: { ...payload.values, value: Number(payload.values.value) + 1 },
        }),
      },
    })
    const analysis = target.documents.analyzeImport(exported.document)
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    expect(target.documents.executeImport(analysis.plan)).toMatchObject({ ok: true })
    expect(target.getState().values.value).toBe(2)
    source.destroy()
    target.destroy()
  })

  it('tracks mapped quarantine freshness, clears imported quarantine, and ignores unrelated quarantine changes', () => {
    const source = createStore('documents-quarantine-import')
    const panel = {
      placement: { mode: 'floating', disposition: { kind: 'free' } },
      preferredPosition: { x: 1, y: 2 },
    } as const
    expect(source.setDashPanelLayout('mapped', panel)).toMatchObject({ ok: true })
    const exported = source
      .scope('mapped')
      .documents.executeExport(
        source.scope('mapped').documents.createExportPlan({ includeDescendants: false }),
      )
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    const quarantineEnvelope = JSON.stringify({
      kind: 'picodash-store-envelope',
      formatVersion: 1,
      storeId: 'documents-quarantine-import',
      schemaVersion: 1,
      revision: 1,
      writerId: 'quarantine-writer',
      valueOwner: 'store',
      values: { value: 10, secret: 'target' },
      scopes: [
        ['mapped', { dashPanel: { invalid: true } }],
        ['unrelated', { dashPanel: { invalid: true } }],
      ],
    })
    const targetPersistence = createMemoryPersistence({
      'documents-quarantine-state': quarantineEnvelope,
    })
    const target = createPicodashStore({
      valueOwner: 'store',
      storeId: 'documents-quarantine-import',
      schemaVersion: 1,
      fields: { value: { defaultValue: 0 }, secret: { defaultValue: 'target' } },
      persistence: {
        storageKey: 'documents-quarantine-state',
        driver: targetPersistence,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    expect(target.metadataRecovery.getState().quarantinedScopes.has('mapped')).toBe(true)
    const analysis = target.documents.analyzeImport(exported.document, {
      targetScopeId: 'mapped',
    })
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    expect(target.metadataRecovery.replaceScope('unrelated', { dashPanel: panel })).toMatchObject({
      ok: true,
    })
    const recoveryListener = vi.fn()
    target.metadataRecovery.subscribe(recoveryListener)
    expect(target.documents.executeImport(analysis.plan)).toMatchObject({ ok: true })
    expect(recoveryListener).toHaveBeenCalledTimes(1)
    expect(target.metadataRecovery.getState().quarantinedScopes.has('mapped')).toBe(false)
    expect(
      [...target.diagnostics.getState().current.values()].some(
        (entry) => entry.code === 'metadata_quarantined',
      ),
    ).toBe(false)
    expect(target.getState().scopes.has('mapped')).toBe(true)

    const stalePersistence = createMemoryPersistence({
      'documents-quarantine-stale-state': quarantineEnvelope,
    })
    const staleTarget = createPicodashStore({
      valueOwner: 'store',
      storeId: 'documents-quarantine-import',
      schemaVersion: 1,
      fields: { value: { defaultValue: 0 }, secret: { defaultValue: 'target' } },
      persistence: {
        storageKey: 'documents-quarantine-stale-state',
        driver: stalePersistence,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    const staleAnalysis = staleTarget.documents.analyzeImport(exported.document, {
      targetScopeId: 'mapped',
    })
    expect(staleAnalysis.ok).toBe(true)
    if (!staleAnalysis.ok) return
    expect(staleTarget.metadataRecovery.replaceScope('mapped', { dashPanel: panel })).toMatchObject(
      {
        ok: true,
      },
    )
    const stale = staleTarget.documents.executeImport(staleAnalysis.plan)
    expect(stale).toMatchObject({ ok: false })
    if (!stale.ok) expect(stale.error.issues[0]).toMatchObject({ code: 'stale_plan' })

    const addedQuarantinePersistence = createMemoryPersistence()
    const addedQuarantineTarget = createPicodashStore({
      valueOwner: 'store',
      storeId: 'documents-quarantine-import',
      schemaVersion: 1,
      fields: { value: { defaultValue: 0 }, secret: { defaultValue: 'target' } },
      persistence: {
        storageKey: 'documents-added-quarantine-state',
        driver: addedQuarantinePersistence,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    expect(
      addedQuarantineTarget.setDashPanelLayout('mapped', {
        ...panel,
        preferredPosition: { x: 9, y: 9 },
      }),
    ).toMatchObject({ ok: true })
    const absentAnalysis = addedQuarantineTarget.documents.analyzeImport(exported.document, {
      targetScopeId: 'mapped',
    })
    expect(absentAnalysis.ok).toBe(true)
    if (!absentAnalysis.ok) return
    const foreign = JSON.parse(
      addedQuarantinePersistence.inspect('documents-added-quarantine-state') as string,
    )
    foreign.revision += 1
    foreign.writerId = 'quarantine-after-analysis'
    foreign.scopes = [['mapped', { dashPanel: { invalid: true } }]]
    addedQuarantinePersistence.foreignWrite(
      'documents-added-quarantine-state',
      JSON.stringify(foreign),
    )
    const reload = addedQuarantineTarget.persistence.createConflictResolutionPlan({
      mode: 'reload',
    })
    expect(addedQuarantineTarget.persistence.executeConflictResolution(reload)).toMatchObject({
      ok: true,
    })
    expect(addedQuarantineTarget.metadataRecovery.getState().quarantinedScopes.has('mapped')).toBe(
      true,
    )
    const newlyStale = addedQuarantineTarget.documents.executeImport(absentAnalysis.plan)
    expect(newlyStale).toMatchObject({ ok: false })
    if (!newlyStale.ok) expect(newlyStale.error.issues[0]).toMatchObject({ code: 'stale_plan' })
    addedQuarantineTarget.destroy({ discardUnpersisted: true })
    staleTarget.destroy({ discardUnpersisted: true })
    source.destroy()
    target.destroy({ discardUnpersisted: true })
  })
})
