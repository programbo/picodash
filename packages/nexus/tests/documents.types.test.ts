import type {
  PicodashDocumentFieldHandle,
  PicodashExportOptions,
  PicodashImportOptions,
  PicodashScopedExportOptions,
  PicodashScopedImportOptions,
  PicodashRootDocument,
  PicodashScopeDocument,
} from '../src/documents.ts'
import { expectTypeOf, test } from 'vite-plus/test'
import {
  createPicodashNexus,
  type CoreTransactionResult,
  type PersistentTransactionResult,
} from '../src/index.ts'
import { createMemoryPersistence } from './support/memory-persistence.js'

declare const field: PicodashDocumentFieldHandle

type PositiveExportOptions = PicodashExportOptions & {
  readonly fields: readonly [typeof field]
  readonly promoteFields: readonly [typeof field]
}
type PositiveImportOptions = PicodashImportOptions & {
  readonly fieldMap: { readonly source: typeof field; readonly ignored: 'ignore' }
}
const positiveExportOptions = null as unknown as PositiveExportOptions
const positiveImportOptions = null as unknown as PositiveImportOptions
void positiveExportOptions
void positiveImportOptions

test('document options retain nominal fields and exact document unions', () => {
  const forgedExportOptions: PicodashExportOptions = {
    includeDescendants: false,
    // @ts-expect-error document field selections cannot be forged from a string key object.
    fields: [{ key: 'field' }],
  }

  // @ts-expect-error import mappings require a nominal field handle or the explicit ignore sentinel.
  const forgedImportOptions: PicodashImportOptions = { fieldMap: { source: { key: 'field' } } }

  const root: PicodashRootDocument = {
    formatVersion: 1,
    kind: 'root',
    nexusId: 'nexus',
    schemaVersion: 1,
    fields: [],
    scopes: [],
  }
  const scope: PicodashScopeDocument = {
    formatVersion: 1,
    kind: 'scope',
    nexusId: 'nexus',
    schemaVersion: 1,
    scopeId: 'scope',
    fields: [],
    scopes: [],
  }

  expectTypeOf(root.kind).toEqualTypeOf<'root'>()
  expectTypeOf(scope.kind).toEqualTypeOf<'scope'>()
  const scopedExport: PicodashScopedExportOptions = { includeDescendants: false }
  const scopedImport: PicodashScopedImportOptions = { createMissingScopes: true }
  const badScopedExport: PicodashScopedExportOptions = {
    includeDescendants: false,
    // @ts-expect-error scoped exports cannot retarget another scope.
    scopeId: 'other',
  }
  const badScopedImport: PicodashScopedImportOptions = {
    // @ts-expect-error scoped imports always target the receiver scope.
    targetScopeId: 'other',
  }
  void scopedExport
  void scopedImport
  void badScopedExport
  void badScopedImport
  void forgedExportOptions
  void forgedImportOptions
})

test('public Nexus document namespaces are conditional and preserve result types', () => {
  const ephemeral = createPicodashNexus({
    valueOwner: 'nexus',
    fields: { value: { defaultValue: 1 } },
  })
  // @ts-expect-error Ephemeral roots have no document namespace until identity is configured.
  void ephemeral.documents
  ephemeral.destroy()

  const identifiedImportOnly = createPicodashNexus({
    valueOwner: 'nexus',
    nexusId: 'documents-types-import-only',
    schemaVersion: 1,
    fields: { value: { defaultValue: 1 } },
  })
  expectTypeOf(identifiedImportOnly.documents.analyzeImport).toBeFunction()
  expectTypeOf(
    identifiedImportOnly.documents.executeImport,
  ).returns.toEqualTypeOf<CoreTransactionResult>()
  // @ts-expect-error Export methods require an explicit export policy.
  void identifiedImportOnly.documents.createExportPlan
  const identifiedImportScope = identifiedImportOnly.scope('scope')
  expectTypeOf(identifiedImportScope.documents.analyzeImport).toBeFunction()
  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    // @ts-expect-error Scoped import options cannot retarget another scope.
    identifiedImportScope.documents.analyzeImport({}, { targetScopeId: 'other' })
  }
  identifiedImportOnly.destroy()

  const exportEnabled = createPicodashNexus({
    valueOwner: 'nexus',
    nexusId: 'documents-types-export',
    schemaVersion: 1,
    fields: { value: { defaultValue: 1 } },
    export: { documents: { defaultFieldPolicy: 'include' } },
  })
  expectTypeOf(exportEnabled.documents.createExportPlan).toBeFunction()
  expectTypeOf(exportEnabled.documents.executeExport).returns.toMatchTypeOf<
    { readonly ok: true } | { readonly ok: false }
  >()
  expectTypeOf(exportEnabled.scope('scope').documents.createExportPlan).toBeFunction()
  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    // @ts-expect-error Scoped export options cannot retarget another scope.
    exportEnabled.scope('scope').documents.createExportPlan({ scopeId: 'other' })
  }
  exportEnabled.destroy()

  const persistentExport = createPicodashNexus({
    valueOwner: 'nexus',
    nexusId: 'documents-types-persistent',
    schemaVersion: 1,
    fields: { value: { defaultValue: 1 } },
    export: { documents: { defaultFieldPolicy: 'include' } },
    persistence: {
      storageKey: 'documents-types',
      driver: createMemoryPersistence(),
      values: { defaultFieldPolicy: 'include' },
    },
  })
  expectTypeOf(
    persistentExport.documents.executeImport,
  ).returns.toEqualTypeOf<PersistentTransactionResult>()
  expectTypeOf(persistentExport.documents.executeExport).returns.toMatchTypeOf<
    { readonly ok: true } | PersistentTransactionResult
  >()
  persistentExport.destroy({ discardUnpersisted: true })
})
