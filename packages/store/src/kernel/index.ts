import type { StandardSchemaV1 } from '@standard-schema/spec'
import { clonePicodashValue, picodashJsonEqual } from '../json.js'
import {
  classifyIdentity,
  registerRuntimeController,
  registerRuntimeScopedView,
  runtimeControllerFor,
  runtimeControllerForHandle,
  RuntimeController,
} from '../runtime-controller.js'
import {
  normalizeDashListMetadataRecord,
  normalizeDashPanelLayoutRecord,
  normalizeDurableScopeMetadata,
  decodeDurableScopeMetadata,
  encodeDurableScopeMetadata,
} from '../metadata.js'
import type { SerializedDurableScopeMetadata } from '../metadata.js'
import { createDiagnosticsRuntime, type PicodashDiagnostics } from '../diagnostics.js'
import {
  createExternalAdapterRuntime,
  PicodashInitializationError,
  type AdapterUnhealthyIssue,
  type AdapterWriteContext,
  type AdapterWriteFailedIssue,
  type AdapterWriteFailureReason,
  type ExternalAdapterRuntime,
  type PicodashValueAdapter,
  type SnapshotValidation,
} from '../adapter.js'
import { createPersistenceController, hydratePersistenceEnvelope } from '../persistence.js'
import {
  createMetadataRecovery,
  type PicodashMetadataRecovery,
  type PicodashMetadataRecoveryState,
  type PicodashQuarantinedScopeMetadata,
} from '../metadata-recovery.js'
import { normalizeSchemaMigrations, type SchemaMigrations } from '../migration.js'
import type {
  PicodashEnvelopeInput,
  PicodashPersistence,
  PicodashPersistenceDiagnostic,
  PicodashPersistenceConflictResolutionPlan,
  PicodashPersistenceErasePlan,
  PersistenceConflictResolutionOptions,
  PersistenceEraseResult,
  PersistenceController,
  PersistenceFailureReason,
  PersistentTransactionResult,
  ExternalOwnedPersistenceConfig,
  StoreOwnedPersistenceConfig,
} from '../persistence.js'
import {
  bindingPlanRecord,
  dashListPrunePlanRecord,
  registerBindingPlan,
  registerDashListPrunePlan,
  registerPersistencePlan,
  persistencePlanRecord,
  registerDocumentPlan,
  documentPlanRecord,
  type BindingPlanRegistryRecord,
} from '../plan-registry.js'
import {
  buildPicodashDocumentOverlay,
  decodePicodashDocument,
  encodePicodashDocument,
  migratePicodashDocument,
  PicodashDocumentError,
  normalizePicodashExportExecutionOptions,
  normalizePicodashExportOptions,
  normalizePicodashExportPlanReview,
  normalizePicodashExportPolicy,
  normalizePicodashImportOptions,
  normalizePicodashImportPlanReview,
  stripRedactedPicodashDocumentFields,
  type PicodashDocument,
  PicodashDocumentOptionsError,
  type PicodashDocumentFieldEntry,
  type PicodashDocumentFieldHandle,
  type PicodashExportConfig,
  type PicodashExportExecutionOptions,
  type PicodashExportPlan,
  type PicodashExportPolicy,
  type PicodashRootExportOptions,
  type PicodashScopedExportOptions,
  type PicodashRootImportOptions,
  type PicodashScopedImportOptions,
  type PicodashImportPlan,
  type PicodashNormalizedImportOptions,
} from '../documents.js'

/** The JSON values accepted at Store trust boundaries. */
export type PicodashJsonPrimitive = boolean | null | number | string
export type PicodashJsonValue =
  | PicodashJsonPrimitive
  | readonly PicodashJsonValue[]
  | { readonly [key: string]: PicodashJsonValue }

export type PicodashIssueCode =
  | 'invalid_json'
  | 'parse_failed'
  | 'schema_failed'
  | 'validation_failed'
  | 'stale_input'
  | 'stale_plan'
  | 'unknown_field'
  | 'invalid_document'
  | 'foreign_store'
  | 'incompatible_field'
  | 'missing_scope'
  | 'schema_migration_failed'
  | 'invalid_metadata'
  | 'quarantined_metadata'
  | 'adapter_initialization_failed'
  | 'adapter_unhealthy'
  | 'adapter_write_failed'
  | 'persistence_driver_unavailable'
  | 'invalid_persistence_envelope'
  | 'hydration_source_conflict'
  | 'persistence_failure'
  | 'persistence_resolution_failed'
  | 'persistence_erase_failed'
  | `app:${string}`

/** Issues supplied by application callbacks. Store-owned codes are not accepted here. */
export type PicodashIssueInput = {
  readonly message: string
  readonly code?: `app:${string}`
  readonly path?: readonly (string | number)[]
}

export type TransactionIssue = {
  readonly code: PicodashIssueCode
  readonly path: readonly (string | number)[]
  readonly message: string
  readonly reason?: string
  readonly fieldKey?: string
  readonly scopeId?: string
  readonly itemId?: string
  readonly alias?: string
}

export type PicodashValidationContext<Values extends object = Record<string, PicodashJsonValue>> = {
  readonly values: Readonly<Values>
  readonly field?: PicodashField<Values, keyof Values & string>
  readonly source:
    | 'default'
    | 'initial'
    | 'persistence'
    | 'adapter'
    | 'programmatic'
    | 'interactive'
    | 'repair'
    | 'reset'
    | 'import'
  readonly originScopeId?: string
}

export type PicodashFieldValidator<Value, Values extends object> = (
  value: Value,
  context: PicodashValidationContext<Values>,
) => readonly PicodashIssueInput[]

export type ValuesValidator<Values extends object> = (
  values: Readonly<Values>,
  context: {
    readonly values: Readonly<Values>
    readonly source:
      | 'default'
      | 'initial'
      | 'persistence'
      | 'adapter'
      | 'programmatic'
      | 'interactive'
      | 'repair'
      | 'reset'
      | 'import'
    readonly originScopeId?: string
  },
) => readonly PicodashIssueInput[]

type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer E)[]
        ? readonly Widen<E>[]
        : T extends object
          ? { readonly [K in keyof T]: Widen<T[K]> }
          : T

type IsJson<T> = [T] extends [PicodashJsonValue] ? T : never

type StandardOutput<S> = S extends StandardSchemaV1<infer _Input, infer Output> ? Output : never

/** A parser is part of the target type surface but is intentionally not executed by Phase 1. */
export type PicodashParseResult<Candidate> =
  | { readonly ok: true; readonly candidate: Candidate }
  | {
      readonly ok: false
      readonly issues: readonly [PicodashIssueInput, ...PicodashIssueInput[]]
      readonly repair?: Candidate
    }

export type PicodashFieldDefinition<
  Value extends PicodashJsonValue = PicodashJsonValue,
  Schema extends StandardSchemaV1 | undefined = undefined,
  Values extends object = Record<string, PicodashJsonValue>,
> = {
  readonly defaultValue: Value
  readonly schema?: Schema
  readonly parse?: (input: unknown) => PicodashParseResult<Value>
  readonly validate?: PicodashFieldValidator<
    Schema extends StandardSchemaV1 ? IsJson<StandardOutput<Schema>> : Value,
    Values
  >
}

export type PicodashFieldDefinitions = Record<
  string,
  PicodashFieldDefinition<
    PicodashJsonValue,
    StandardSchemaV1<unknown, PicodashJsonValue>,
    Record<string, PicodashJsonValue>
  >
>

type FieldLike = {
  readonly defaultValue: PicodashJsonValue
  readonly schema?: StandardSchemaV1<unknown, PicodashJsonValue>
  readonly parse?: (input: unknown) => PicodashParseResult<PicodashJsonValue>
}

type InputFieldBase<Values extends Record<string, PicodashJsonValue>, Key extends keyof Values> = {
  readonly defaultValue: Widen<Values[Key]>
  readonly parse?: (input: unknown) => PicodashParseResult<Values[Key]>
  readonly validate?: PicodashFieldValidator<Values[Key], Values>
}

type InputField<Values extends Record<string, PicodashJsonValue>, Key extends keyof Values> =
  | (InputFieldBase<Values, Key> & { readonly schema?: undefined })
  | (InputFieldBase<Values, Key> & {
      readonly schema: StandardSchemaV1<unknown, Values[Key]>
    })

type InputFields<Values extends Record<string, PicodashJsonValue>> = {
  readonly [Key in keyof Values]: InputField<Values, Key>
}

type InferredStoreConfigBase<Values extends Record<string, PicodashJsonValue>> = {
  readonly valueOwner: 'store'
  readonly adapter?: never
  readonly fields: InputFields<Values>
  readonly initialValues?: Partial<Values>
  readonly validateValues?: ValuesValidator<Values>
}

type InferredStoreConfig<Values extends Record<string, PicodashJsonValue>> =
  | (InferredStoreConfigBase<Values> & {
      readonly storeId?: string
      readonly schemaVersion?: number
      readonly initialEnvelope?: never
      readonly persistence?: never
      readonly migrations?: never
      readonly export?: never
    })
  | (InferredStoreConfigBase<Values> & {
      readonly storeId: string
      readonly schemaVersion: number
      readonly initialEnvelope?: PicodashEnvelopeInput<Values>
      readonly persistence?: StoreOwnedPersistenceConfig<
        Record<string, { readonly defaultValue: PicodashJsonValue }>
      >
      readonly migrations?: SchemaMigrations
      readonly export?: PicodashExportConfig
    })

type InferredExternalConfigBase<Values extends Record<string, PicodashJsonValue>> = {
  readonly valueOwner: 'external'
  readonly fields: InputFields<Values>
  readonly adapter: PicodashValueAdapter<Values>
  readonly initialValues?: never
  readonly validateValues?: ValuesValidator<Values>
}

type InferredExternalConfig<Values extends Record<string, PicodashJsonValue>> =
  | (InferredExternalConfigBase<Values> & {
      readonly storeId?: string
      readonly schemaVersion?: number
      readonly initialEnvelope?: never
      readonly persistence?: never
      readonly migrations?: never
      readonly export?: never
    })
  | (InferredExternalConfigBase<Values> & {
      readonly storeId: string
      readonly schemaVersion: number
      readonly initialEnvelope?: PicodashEnvelopeInput<Values>
      readonly persistence?: ExternalOwnedPersistenceConfig
      readonly migrations?: SchemaMigrations
      readonly export?: PicodashExportConfig
    })

type ExternalOwnedConfigBase<Fields extends Record<string, FieldLike>> = {
  readonly valueOwner: 'external'
  readonly fields: DefinitionsFor<Fields>
  readonly adapter: PicodashValueAdapter<ValuesOf<Fields>>
  readonly initialValues?: never
  readonly validateValues?: ValuesValidator<ValuesOf<Fields>>
}

export type ExternalOwnedConfig<Fields extends Record<string, FieldLike>> =
  | (ExternalOwnedConfigBase<Fields> & {
      readonly storeId?: string
      readonly schemaVersion?: number
      readonly initialEnvelope?: never
      readonly persistence?: never
      readonly migrations?: never
      readonly export?: never
    })
  | (ExternalOwnedConfigBase<Fields> & {
      readonly storeId: string
      readonly schemaVersion: number
      readonly initialEnvelope?: PicodashEnvelopeInput<ValuesOf<Fields>>
      readonly persistence?: ExternalOwnedPersistenceConfig
      readonly migrations?: SchemaMigrations
      readonly export?: PicodashExportConfig
    })

type ExactInputFields<
  Values extends Record<string, PicodashJsonValue>,
  Definitions extends InputFields<Values>,
> = {
  readonly [Key in keyof Definitions]: Exclude<
    keyof Definitions[Key],
    keyof InputFields<Values>[Key & keyof Values]
  > extends never
    ? Definitions[Key]
    : never
}

type FieldValueOne<Definition> = Definition extends { readonly schema: infer Schema }
  ? Schema extends StandardSchemaV1
    ? IsJson<StandardOutput<Schema>>
    : Definition extends { readonly defaultValue: infer Value }
      ? Widen<IsJson<Value>>
      : never
  : Definition extends { readonly defaultValue: infer Value }
    ? Widen<IsJson<Value>>
    : never

type FieldValue<Definition> = Definition extends unknown ? FieldValueOne<Definition> : never

export type ValuesOf<Fields extends Record<string, FieldLike>> = {
  readonly [Key in keyof Fields]: FieldValue<Fields[Key]>
}

declare const fieldBrand: unique symbol

/** A root-owned nominal field handle. The brand is intentionally not exported. */
export type PicodashField<Values extends object, Key extends keyof Values & string> = {
  readonly key: Key
  readonly [fieldBrand]: 'PicodashField'
}

export type PicodashFields<Fields extends Record<string, FieldLike>> = {
  readonly [Key in keyof Fields]: PicodashField<ValuesOf<Fields>, Key & string>
}

type DefinitionsFor<Fields extends Record<string, FieldLike>> = {
  readonly [Key in keyof Fields]: Fields[Key] & {
    readonly validate?: PicodashFieldValidator<FieldValue<Fields[Key]>, ValuesOf<NoInfer<Fields>>>
  }
}

type StoreOwnedConfigBase<Fields extends Record<string, FieldLike>> = {
  readonly valueOwner: 'store'
  readonly adapter?: never
  readonly fields: DefinitionsFor<Fields>
  readonly initialValues?: Partial<ValuesOf<Fields>>
  readonly validateValues?: ValuesValidator<ValuesOf<Fields>>
}

export type StoreOwnedConfig<Fields extends Record<string, FieldLike>> =
  | (StoreOwnedConfigBase<Fields> & {
      readonly storeId?: string
      readonly schemaVersion?: number
      readonly initialEnvelope?: never
      readonly persistence?: never
      readonly migrations?: never
      readonly export?: never
    })
  | (StoreOwnedConfigBase<Fields> & {
      readonly storeId: string
      readonly schemaVersion: number
      readonly initialEnvelope?: PicodashEnvelopeInput<ValuesOf<Fields>>
      readonly persistence?: StoreOwnedPersistenceConfig<Fields>
      readonly migrations?: SchemaMigrations
      readonly export?: PicodashExportConfig
    })

export type DashListMetadataRecord = {
  readonly rootOrder?: readonly string[]
  readonly groupOrders: ReadonlyMap<string, readonly string[]>
  readonly collapseOverrides: ReadonlyMap<string, boolean>
}

export type DashPanelSnapPositionRecord =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'

export type DashPanelDockPositionRecord =
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left'
  | 'full-left'
  | 'center-left'
  | 'full-right'
  | 'center-right'
  | 'full-top'
  | 'center-top'
  | 'full-bottom'
  | 'center-bottom'

export type DashPanelPlacementRecord =
  | {
      readonly mode: 'floating'
      readonly disposition:
        | { readonly kind: 'free' }
        | { readonly kind: 'snapped'; readonly position: DashPanelSnapPositionRecord }
    }
  | {
      readonly mode: 'fixed'
      readonly disposition: {
        readonly kind: 'docked'
        readonly position: DashPanelDockPositionRecord
      }
    }
  | {
      readonly mode: 'hybrid'
      readonly disposition:
        | { readonly kind: 'free' }
        | { readonly kind: 'snapped'; readonly position: 'top' | 'bottom' }
        | { readonly kind: 'docked'; readonly position: DashPanelDockPositionRecord }
    }

export type DashPanelLayoutRecord = {
  readonly placement: DashPanelPlacementRecord
  readonly preferredPosition: { readonly x: number; readonly y: number }
}

export type DurableScopeMetadata = {
  readonly dashList?: DashListMetadataRecord
  readonly dashPanel?: DashPanelLayoutRecord
}

export type DashListPruneEffect =
  | 'root-order-entry'
  | 'group-order-owner'
  | 'group-order-entry'
  | 'collapse-override'

export type DashListPruneCandidate = Readonly<{
  readonly nodeId: string
  readonly effects: readonly DashListPruneEffect[]
}>

export type DashListPruneReview = Readonly<{
  readonly kind: 'dash-list-prune-review'
  readonly scopeId: string
  readonly candidates: readonly DashListPruneCandidate[]
}>

export type DashListPruneSelection =
  | { readonly mode: 'review' }
  | {
      readonly mode: 'explicit'
      readonly removeNodeIds: readonly string[]
      readonly keepNodeIds: readonly string[]
    }
  | { readonly mode: 'inventory'; readonly knownNodeIds: readonly string[] }

export type RootDashListPruneOptions = DashListPruneSelection & { readonly scopeId: string }

export type InvalidPruneOptionsReason =
  | 'not-object'
  | 'unknown-key'
  | 'accessor-property'
  | 'invalid-mode'
  | 'invalid-node-ids'
  | 'duplicate-node-id'
  | 'overlapping-node-id'
  | 'unknown-candidate'
  | 'incomplete-candidate-partition'
  | 'missing-active-node'

declare const dashListPrunePlanBrand: unique symbol
export type PicodashDashListPrunePlan = Readonly<{
  readonly [dashListPrunePlanBrand]: 'PicodashDashListPrunePlan'
  readonly kind: 'dash-list-prune-plan'
  readonly mode: 'explicit' | 'inventory'
  readonly scopeId: string
  readonly candidates: readonly DashListPruneCandidate[]
  readonly removeNodeIds: readonly string[]
  readonly keepNodeIds: readonly string[]
}>

export type RootSnapshot<Values extends object> = {
  readonly values: Readonly<Values>
  readonly scopes: ReadonlyMap<string, DurableScopeMetadata>
}

export type InvalidScopeIdReason =
  | 'not-string'
  | 'empty'
  | 'surrounding-whitespace'
  | 'control-character'

export type InvalidDestroyOptionsReason =
  | 'not-object'
  | 'unknown-key'
  | 'accessor-property'
  | 'invalid-include-descendants'
  | 'invalid-discard-unpersisted'

export type DestroyRootOptions = {
  readonly discardUnpersisted: true
}

export type DestroyScopeOptions = {
  readonly includeDescendants?: boolean
}

export type InvalidResetOptionsReason =
  | 'not-object'
  | 'unknown-key'
  | 'accessor-property'
  | 'invalid-include-descendants'

export type ResetRegisteredValuesOptions = {
  readonly includeDescendants?: boolean
}

export type RootResetRegisteredValuesOptions = ResetRegisteredValuesOptions & {
  readonly scopeId: string
}

export type StaleDraftConflict = {
  readonly kind: 'stale-draft'
  readonly baseRevision: number
  readonly baseValue: PicodashJsonValue
}

export type BindingInteractionState = {
  readonly fieldKey: string
  readonly draft?: PicodashJsonValue
  readonly touched: boolean
  readonly inputIssues: readonly TransactionIssue[]
  readonly conflict?: StaleDraftConflict
}

declare const repairPlanBrand: unique symbol
export type PicodashRepairPlan = { readonly [repairPlanBrand]: 'PicodashRepairPlan' }
declare const staleInputOverwritePlanBrand: unique symbol
export type PicodashStaleInputOverwritePlan = {
  readonly [staleInputOverwritePlanBrand]: 'PicodashStaleInputOverwritePlan'
}

export interface BindingInteractionCommands<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  setInput<Key extends keyof Fields & string>(
    binding: import('../integration-leases.js').BindingHandle<Fields, Key>,
    input: PicodashJsonValue,
  ): Result
  discardInput<Key extends keyof Fields & string>(
    binding: import('../integration-leases.js').BindingHandle<Fields, Key>,
  ): boolean
  createStaleInputOverwritePlan<Key extends keyof Fields & string>(
    binding: import('../integration-leases.js').BindingHandle<Fields, Key>,
  ): PicodashStaleInputOverwritePlan
  executeStaleInputOverwrite(plan: PicodashStaleInputOverwritePlan): Result
  executeRepair(plan: PicodashRepairPlan): Result
}

export type ItemInteractionState = {
  readonly focused: boolean
  readonly hovered: boolean
  readonly active: boolean
}

export type ScopeInteractionState = {
  readonly bindings: ReadonlyMap<string, ReadonlyMap<string, BindingInteractionState>>
  readonly items: ReadonlyMap<string, ItemInteractionState>
}

export type ScopedSnapshot<Values extends object> = {
  readonly values: Readonly<Values>
  readonly scope: DurableScopeMetadata | undefined
  readonly interaction: ScopeInteractionState
}

export type PicodashDocumentExportResult<
  Result extends CoreTransactionResult = CoreTransactionResult,
> =
  | Readonly<{ readonly ok: true; readonly document: PicodashDocument }>
  | Extract<Result, { readonly ok: false }>

export interface DocumentImportCommands<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  analyzeImport(
    document: unknown,
    options?: PicodashRootImportOptions<ValuesOf<Fields>>,
  ):
    | Readonly<{ readonly ok: true; readonly plan: PicodashImportPlan }>
    | Extract<Result, { readonly ok: false }>
  executeImport(plan: PicodashImportPlan): Result
}

export interface DocumentExportCommands<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  createExportPlan(options?: PicodashRootExportOptions<ValuesOf<Fields>>): PicodashExportPlan
  executeExport(
    plan: PicodashExportPlan,
    options?: PicodashExportExecutionOptions,
  ): PicodashDocumentExportResult<Result>
}

export interface ScopedDocumentImportCommands<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  analyzeImport(
    document: unknown,
    options?: PicodashScopedImportOptions<ValuesOf<Fields>>,
  ):
    | Readonly<{ readonly ok: true; readonly plan: PicodashImportPlan }>
    | Extract<Result, { readonly ok: false }>
  executeImport(plan: PicodashImportPlan): Result
}

export interface ScopedDocumentExportCommands<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  createExportPlan(options?: PicodashScopedExportOptions<ValuesOf<Fields>>): PicodashExportPlan
  executeExport(
    plan: PicodashExportPlan,
    options?: PicodashExportExecutionOptions,
  ): PicodashDocumentExportResult<Result>
}

type DocumentNamespace<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult,
  Identified extends boolean,
  ExportEnabled extends boolean,
> = Identified extends true
  ? Readonly<
      DocumentImportCommands<Fields, Result> &
        (ExportEnabled extends true ? DocumentExportCommands<Fields, Result> : object)
    >
  : never

type ScopedDocumentNamespace<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult,
  Identified extends boolean,
  ExportEnabled extends boolean,
> = Identified extends true
  ? Readonly<
      ScopedDocumentImportCommands<Fields, Result> &
        (ExportEnabled extends true ? ScopedDocumentExportCommands<Fields, Result> : object)
    >
  : never

export interface RootMetadataCommands<
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  setDashPanelLayout(scopeId: string, layout: DashPanelLayoutRecord): Result
  resetDashPanelLayout(scopeId: string): Result
  setDashListRootOrder(scopeId: string, order: readonly string[]): Result
  removeDashListRootOrder(scopeId: string): Result
  setDashListGroupOrder(scopeId: string, groupId: string, order: readonly string[]): Result
  removeDashListGroupOrder(scopeId: string, groupId: string): Result
  setDashListCollapseOverride(scopeId: string, nodeId: string, collapsed: boolean): Result
  removeDashListCollapseOverride(scopeId: string, nodeId: string): Result
  resetDashListMetadata(scopeId: string): Result
  createPrunePlan(
    options: RootDashListPruneOptions & { readonly mode: 'review' },
  ): DashListPruneReview
  createPrunePlan(
    options: RootDashListPruneOptions & { readonly mode: 'explicit' | 'inventory' },
  ): PicodashDashListPrunePlan
  executePrunePlan(plan: PicodashDashListPrunePlan): Result
}

export interface ScopedMetadataCommands<
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  setDashPanelLayout(layout: DashPanelLayoutRecord): Result
  resetDashPanelLayout(): Result
  setDashListRootOrder(order: readonly string[]): Result
  removeDashListRootOrder(): Result
  setDashListGroupOrder(groupId: string, order: readonly string[]): Result
  removeDashListGroupOrder(groupId: string): Result
  setDashListCollapseOverride(nodeId: string, collapsed: boolean): Result
  removeDashListCollapseOverride(nodeId: string): Result
  resetDashListMetadata(): Result
  createPrunePlan(options: { readonly mode: 'review' }): DashListPruneReview
  createPrunePlan(
    options: Extract<DashListPruneSelection, { readonly mode: 'explicit' | 'inventory' }>,
  ): PicodashDashListPrunePlan
  executePrunePlan(plan: PicodashDashListPrunePlan): Result
}

interface RootStoreBase<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
  Identified extends boolean = false,
  ExportEnabled extends boolean = false,
>
  extends RootMetadataCommands<Result>, BindingInteractionCommands<Fields, Result> {
  readonly kind: 'root'
  readonly fields: PicodashFields<Fields>
  scope(scopeId: string): ScopedStore<Fields, Result, Identified, ExportEnabled>
  getState(): RootSnapshot<ValuesOf<Fields>>
  subscribe(listener: () => void): () => void
  readonly diagnostics: PicodashDiagnostics
  destroy(options?: DestroyRootOptions): void
  setValue<K extends keyof Fields & string>(
    field: PicodashField<ValuesOf<Fields>, K>,
    value: ValuesOf<Fields>[K],
  ): Result
  setValueOrThrow<K extends keyof Fields & string>(
    field: PicodashField<ValuesOf<Fields>, K>,
    value: ValuesOf<Fields>[K],
  ): Extract<Result, { readonly ok: true }>
  resetValue<K extends keyof Fields & string>(field: PicodashField<ValuesOf<Fields>, K>): Result
  resetValueOrThrow<K extends keyof Fields & string>(
    field: PicodashField<ValuesOf<Fields>, K>,
  ): Extract<Result, { readonly ok: true }>
  resetRegisteredValues(options: RootResetRegisteredValuesOptions): Result
  resetRegisteredValuesOrThrow(
    options: RootResetRegisteredValuesOptions,
  ): Extract<Result, { readonly ok: true }>
  setValues(values: Partial<ValuesOf<Fields>>): Result
  setValuesOrThrow(values: Partial<ValuesOf<Fields>>): Extract<Result, { readonly ok: true }>
  destroyScope(scopeId: string, options?: DestroyScopeOptions): Result
}

interface ScopedStoreBase<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
  Identified extends boolean = false,
  ExportEnabled extends boolean = false,
>
  extends ScopedMetadataCommands<Result>, BindingInteractionCommands<Fields, Result> {
  readonly kind: 'scoped'
  readonly root: RootStore<Fields, Result, Identified, ExportEnabled>
  readonly scopeId: string
  readonly fields: PicodashFields<Fields>
  readonly diagnostics: PicodashDiagnostics
  scope(scopeId: string): ScopedStore<Fields, Result, Identified, ExportEnabled>
  getState(): ScopedSnapshot<ValuesOf<Fields>>
  subscribe(listener: () => void): () => void
  setValue<K extends keyof Fields & string>(
    field: PicodashField<ValuesOf<Fields>, K>,
    value: ValuesOf<Fields>[K],
  ): Result
  setValueOrThrow<K extends keyof Fields & string>(
    field: PicodashField<ValuesOf<Fields>, K>,
    value: ValuesOf<Fields>[K],
  ): Extract<Result, { readonly ok: true }>
  resetValue<K extends keyof Fields & string>(field: PicodashField<ValuesOf<Fields>, K>): Result
  resetValueOrThrow<K extends keyof Fields & string>(
    field: PicodashField<ValuesOf<Fields>, K>,
  ): Extract<Result, { readonly ok: true }>
  resetRegisteredValues(options?: ResetRegisteredValuesOptions): Result
  resetRegisteredValuesOrThrow(
    options?: ResetRegisteredValuesOptions,
  ): Extract<Result, { readonly ok: true }>
  setValues(values: Partial<ValuesOf<Fields>>): Result
  setValuesOrThrow(values: Partial<ValuesOf<Fields>>): Extract<Result, { readonly ok: true }>
  destroyScope(options?: DestroyScopeOptions): Result
}

type PersistenceCapability<Result extends CoreTransactionResult> =
  Result extends PersistentTransactionResult ? { readonly persistence: PicodashPersistence } : {}

type MetadataRecoveryCapability<
  Identified extends boolean,
  Result extends CoreTransactionResult,
> = Identified extends true ? { readonly metadataRecovery: PicodashMetadataRecovery<Result> } : {}

export type RootStore<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
  Identified extends boolean = false,
  ExportEnabled extends boolean = false,
> = RootStoreBase<Fields, Result, Identified, ExportEnabled> &
  PersistenceCapability<Result> &
  MetadataRecoveryCapability<Identified, Result> &
  (Identified extends true
    ? { readonly documents: DocumentNamespace<Fields, Result, Identified, ExportEnabled> }
    : {})

export type ScopedStore<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
  Identified extends boolean = false,
  ExportEnabled extends boolean = false,
> = ScopedStoreBase<Fields, Result, Identified, ExportEnabled> &
  PersistenceCapability<Result> &
  MetadataRecoveryCapability<Identified, Result> &
  (Identified extends true
    ? { readonly documents: ScopedDocumentNamespace<Fields, Result, Identified, ExportEnabled> }
    : {})

type ContractErrorCode =
  | 'invalid-configuration'
  | 'invalid-scope-id'
  | 'foreign-handle'
  | 'async-contract'
  | 'invalid-callback-result'
  | 'reentrant-write'
  | 'invalid-destroy-options'
  | 'invalid-reset-options'
  | 'invalid-provider-id'
  | 'duplicate-provider'
  | 'persistence-identity-in-use'
  | 'invalid-persistence-conflict-options'
  | 'invalid-persistence-erase-options'
  | 'invalid-persistence-conflict-resolution'
  | 'invalid-persistence-plan'
  | 'invalid-entity-options'
  | 'invalid-binding-options'
  | 'invalid-integration-handle'
  | 'invalid-binding-handle'
  | 'invalid-binding-plan'
  | 'invalid-stale-input-overwrite'
  | 'duplicate-entity'
  | 'duplicate-binding'
  | 'scope-host-conflict'
  | 'invalid-relationship'
  | 'relationship-parent-conflict'
  | 'relationship-cycle'
  | 'lease-has-active-dependents'
  | 'missing-store-context'
  | 'invalid-dash-list-node-options'
  | 'duplicate-dash-list-node'
  | 'invalid-prune-options'
  | 'invalid-prune-plan'
  | 'invalid-quarantine-replacement'
  | 'invalid-document-options'
  | 'invalid-document-plan'
  | 'root-has-active-leases'
  | 'root-has-unpersisted-state'
  | 'use-after-destroy'

const BUILTIN_CODES = new Set<PicodashIssueCode>([
  'invalid_json',
  'parse_failed',
  'schema_failed',
  'validation_failed',
  'stale_input',
  'stale_plan',
  'unknown_field',
  'invalid_document',
  'foreign_store',
  'incompatible_field',
  'missing_scope',
  'schema_migration_failed',
  'invalid_metadata',
  'quarantined_metadata',
  'adapter_initialization_failed',
  'adapter_unhealthy',
  'adapter_write_failed',
  'persistence_resolution_failed',
  'persistence_erase_failed',
])

const isAppCode = (value: unknown): value is `app:${string}` =>
  typeof value === 'string' && value.startsWith('app:')

const validIssueCode = (value: unknown): value is PicodashIssueCode =>
  BUILTIN_CODES.has(value as PicodashIssueCode) || isAppCode(value)

const freezePath = (path: readonly (string | number)[]): readonly (string | number)[] =>
  Object.freeze([...path])

function assertRuntimeActive(controller: RuntimeController): void {
  if (controller.lifecycle !== 'active') throw new PicodashContractError('use-after-destroy')
}

function makeLifecycleFacade<T extends object>(target: T, controller: RuntimeController): T {
  const methods = new Map<PropertyKey, (...args: never[]) => unknown>()
  const facadeTarget = {} as T
  const guardedMethod = (property: PropertyKey, value: (...args: never[]) => unknown) => {
    const cached = methods.get(property)
    if (cached) return cached
    const method = (...args: never[]) => {
      assertRuntimeActive(controller)
      return Reflect.apply(value, target, args)
    }
    methods.set(property, method)
    return method
  }
  for (const property of Reflect.ownKeys(target))
    Object.defineProperty(facadeTarget, property, {
      enumerable: true,
      configurable: true,
      get: () => {
        assertRuntimeActive(controller)
        const value = Reflect.get(target, property, target)
        return typeof value === 'function'
          ? guardedMethod(property, value as (...args: never[]) => unknown)
          : value
      },
    })
  Object.freeze(facadeTarget)
  return new Proxy(facadeTarget, {
    get(source, property, receiver) {
      assertRuntimeActive(controller)
      return Reflect.get(source, property, receiver)
    },
    has(source, property) {
      assertRuntimeActive(controller)
      return Reflect.has(source, property)
    },
    ownKeys(source) {
      assertRuntimeActive(controller)
      return Reflect.ownKeys(source)
    },
    getOwnPropertyDescriptor(source, property) {
      assertRuntimeActive(controller)
      return Reflect.getOwnPropertyDescriptor(source, property)
    },
    getPrototypeOf(source) {
      assertRuntimeActive(controller)
      return Reflect.getPrototypeOf(source)
    },
    set(source, property, value, receiver) {
      assertRuntimeActive(controller)
      return Reflect.set(source, property, value, receiver)
    },
    defineProperty(source, property, descriptor) {
      assertRuntimeActive(controller)
      return Reflect.defineProperty(source, property, descriptor)
    },
    deleteProperty(source, property) {
      assertRuntimeActive(controller)
      return Reflect.deleteProperty(source, property)
    },
    setPrototypeOf(source, prototype) {
      assertRuntimeActive(controller)
      return Reflect.setPrototypeOf(source, prototype)
    },
    preventExtensions(source) {
      assertRuntimeActive(controller)
      return Reflect.preventExtensions(source)
    },
    isExtensible(source) {
      assertRuntimeActive(controller)
      return Reflect.isExtensible(source)
    },
  })
}

const normalizeIssue = (input: unknown, fallbackCode: PicodashIssueCode): TransactionIssue => {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const code = validIssueCode(source.code) ? source.code : fallbackCode
  const message = typeof source.message === 'string' ? source.message : 'Store operation failed.'
  const rawPath = Array.isArray(source.path)
    ? source.path.filter(
        (segment): segment is string | number =>
          (typeof segment === 'string' || typeof segment === 'number') &&
          (typeof segment !== 'number' || Number.isFinite(segment)),
      )
    : []
  const path = freezePath(rawPath)
  const extras: Record<string, string> = {}
  if (
    source.reason === 'blocked' ||
    source.reason === 'canonical_changed' ||
    source.reason === 'write_threw' ||
    source.reason === 'async_write' ||
    source.reason === 'not_visible' ||
    source.reason === 'invalid_snapshot' ||
    source.reason === 'mismatched_snapshot'
  )
    extras.reason = source.reason
  for (const key of ['fieldKey', 'scopeId', 'itemId', 'alias'] as const)
    if (typeof source[key] === 'string') extras[key] = source[key]
  return Object.freeze({ code, message, path, ...extras })
}

const normalizeIssues = (
  issues: readonly unknown[] | undefined,
  fallbackCode: PicodashIssueCode,
): readonly TransactionIssue[] => {
  try {
    return Object.freeze(
      (issues?.length ? issues : [{ code: fallbackCode, message: 'Store operation failed.' }]).map(
        (item) => normalizeIssue(item, fallbackCode),
      ),
    )
  } catch {
    return Object.freeze([
      Object.freeze({
        code: fallbackCode,
        path: freezePath([]),
        message: 'Store operation failed.',
      }),
    ])
  }
}

export class PicodashContractError extends Error {
  readonly code: ContractErrorCode
  readonly context: Readonly<Record<string, string>>
  readonly issues?: readonly TransactionIssue[]

  constructor(
    code: ContractErrorCode,
    context: Record<string, string> = {},
    issues?: readonly TransactionIssue[],
  ) {
    super(code)
    this.name = 'PicodashContractError'
    this.code = code
    const safeContext: Record<string, string> = Object.create(null)
    try {
      for (const [key, value] of Object.entries(context ?? {}))
        if (typeof value === 'string') safeContext[key] = value
    } catch {
      // A hostile context object is reduced to the empty safe context.
    }
    this.context = Object.freeze(safeContext)
    if (issues !== undefined) this.issues = normalizeIssues(issues, 'validation_failed')
    Object.freeze(this)
  }
}

export class PicodashTransactionError extends Error {
  readonly issues: readonly TransactionIssue[]

  constructor(issues: readonly TransactionIssue[]) {
    super('Picodash transaction rejected')
    this.name = 'PicodashTransactionError'
    this.issues = normalizeIssues(issues, 'validation_failed')
    Object.freeze(this)
  }
}

export type CoreTransactionResult =
  | {
      readonly ok: true
      readonly changedFields: readonly string[]
      readonly changedScopeIds: readonly string[]
    }
  | {
      readonly ok: false
      readonly error: PicodashTransactionError
      readonly repair?: PicodashRepairPlan
    }

const successfulResult = (
  changedFields: readonly string[] = [],
  changedScopeIds: readonly string[] = [],
): Extract<CoreTransactionResult, { readonly ok: true }> =>
  Object.freeze({
    ok: true as const,
    changedFields: Object.freeze([...changedFields]),
    changedScopeIds: Object.freeze([...changedScopeIds]),
  })

const rejectedResult = (
  issues: readonly TransactionIssue[],
  repair?: PicodashRepairPlan,
): Extract<CoreTransactionResult, { readonly ok: false }> =>
  Object.freeze({
    ok: false as const,
    error: new PicodashTransactionError(issues),
    ...(repair ? { repair } : {}),
  })

const adapterUnhealthyIssue = (scopeId?: string): AdapterUnhealthyIssue =>
  Object.freeze({
    code: 'adapter_unhealthy' as const,
    reason: 'blocked' as const,
    path: Object.freeze([]) as readonly [],
    message: 'External adapter is unhealthy.',
    ...(scopeId === undefined ? {} : { scopeId }),
  })

const adapterWriteFailedIssue = (
  reason: AdapterWriteFailureReason,
  scopeId?: string,
): AdapterWriteFailedIssue =>
  Object.freeze({
    code: 'adapter_write_failed' as const,
    reason,
    path: Object.freeze([]) as readonly [],
    message: 'External adapter write failed.',
    ...(scopeId === undefined ? {} : { scopeId }),
  })

const freeze = <T>(value: T): T => Object.freeze(value)
const hasOwn = (value: object, key: PropertyKey): boolean => Object.hasOwn(value, key)

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  try {
    return (
      !!value &&
      (typeof value === 'object' || typeof value === 'function') &&
      typeof (value as { then?: unknown }).then === 'function'
    )
  } catch {
    return false
  }
}

const isControlCharacterFree = (value: string): boolean => {
  for (const character of value) {
    const code = character.codePointAt(0)!
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return false
  }
  return true
}

const validIdentity = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value === value.trim() &&
  isControlCharacterFree(value)

const isPlainDataRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return false
  const descriptors = Object.getOwnPropertyDescriptors(value)
  return Reflect.ownKeys(descriptors).every((key) => {
    if (typeof key !== 'string') return false
    const descriptor = descriptors[key]!
    return descriptor.enumerable && 'value' in descriptor
  })
}

const validatePersistenceValuesPolicy = (
  values: unknown,
  fieldEntries: readonly string[],
): values is {
  readonly defaultFieldPolicy: 'include' | 'omit'
  readonly fields?: Readonly<Record<string, 'include' | 'omit'>>
} => {
  if (!isPlainDataRecord(values)) return false
  const valueKeys = Object.keys(values)
  if (
    !valueKeys.every((key) => key === 'defaultFieldPolicy' || key === 'fields') ||
    !Object.hasOwn(values, 'defaultFieldPolicy')
  )
    return false
  if (values.defaultFieldPolicy !== 'include' && values.defaultFieldPolicy !== 'omit') return false
  if (!Object.hasOwn(values, 'fields')) return true
  const fields = values.fields
  if (!isPlainDataRecord(fields)) return false
  for (const key of Object.keys(fields)) {
    if (!fieldEntries.includes(key)) return false
    if (fields[key] !== 'include' && fields[key] !== 'omit') return false
  }
  return true
}

const validOrderArray = (value: unknown): value is readonly string[] => {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false
    const descriptors = Object.getOwnPropertyDescriptors(value)
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string') return false
      if (key !== 'length' && (!/^0$|^[1-9]\d*$/.test(key) || Number(key) >= value.length))
        return false
      if (key !== 'length' && !descriptors[key]!.enumerable) return false
    }
    for (let index = 0; index < value.length; index += 1)
      if (!Object.hasOwn(value, String(index)) || typeof value[index] !== 'string') return false
    return true
  } catch {
    return false
  }
}

const validFieldKey = (value: unknown): value is string =>
  validIdentity(value) && value !== '__proto__' && value !== 'prototype' && value !== 'constructor'

const cloneJson = (value: unknown): PicodashJsonValue => clonePicodashValue(value as never)

const makeIssue = (
  input: PicodashIssueInput,
  stage: PicodashIssueCode,
  fieldKey?: string,
): TransactionIssue => {
  if (!input || typeof input !== 'object' || typeof input.message !== 'string')
    throw new PicodashContractError('invalid-callback-result', fieldKey ? { fieldKey } : {})
  if (input.code !== undefined && !isAppCode(input.code))
    throw new PicodashContractError('invalid-callback-result', fieldKey ? { fieldKey } : {})
  if (
    input.path !== undefined &&
    (!Array.isArray(input.path) ||
      input.path.some(
        (part) =>
          (typeof part !== 'string' && typeof part !== 'number') ||
          (typeof part === 'number' && !Number.isFinite(part)),
      ))
  )
    throw new PicodashContractError('invalid-callback-result', fieldKey ? { fieldKey } : {})
  const path = [...(fieldKey ? ['values', fieldKey] : []), ...(input.path ?? [])] as (
    | string
    | number
  )[]
  return Object.freeze({
    code: input.code ?? stage,
    path: freezePath(path),
    message: input.message,
    ...(fieldKey ? { fieldKey } : {}),
  })
}

const callbackIssues = (
  result: unknown,
  stage: PicodashIssueCode,
  fieldKey?: string,
): readonly TransactionIssue[] => {
  if (isPromiseLike(result))
    throw new PicodashContractError('async-contract', { stage, ...(fieldKey ? { fieldKey } : {}) })
  if (!Array.isArray(result))
    throw new PicodashContractError('invalid-callback-result', fieldKey ? { fieldKey } : {})
  try {
    return freeze(result.map((entry) => makeIssue(entry as PicodashIssueInput, stage, fieldKey)))
  } catch (error) {
    if (error instanceof PicodashContractError) throw error
    throw new PicodashContractError('invalid-callback-result', fieldKey ? { fieldKey } : {})
  }
}

type StandardPathSegment = PropertyKey | { readonly key: PropertyKey }

const standardPath = (path: unknown): readonly (string | number)[] => {
  if (path === undefined) return freezePath([])
  if (!Array.isArray(path)) throw new PicodashContractError('invalid-callback-result')
  const normalized: (string | number)[] = []
  for (const part of path as StandardPathSegment[]) {
    const segment = part && typeof part === 'object' && 'key' in part ? part.key : part
    if (typeof segment === 'symbol')
      normalized.push(segment.description ? `Symbol(${segment.description})` : 'Symbol()')
    else if (typeof segment === 'string') normalized.push(segment)
    else if (typeof segment === 'number' && Number.isFinite(segment)) normalized.push(segment)
    else throw new PicodashContractError('invalid-callback-result')
  }
  return freezePath(normalized)
}

const standardIssues = (
  result: unknown,
  fieldKey?: string,
): { readonly value?: PicodashJsonValue; readonly issues: readonly TransactionIssue[] } => {
  if (isPromiseLike(result))
    throw new PicodashContractError('async-contract', { stage: 'schema_failed' })
  if (!result || typeof result !== 'object')
    throw new PicodashContractError('invalid-callback-result')
  const record = result as Record<string, unknown>
  const keys = Object.keys(record)
  if (hasOwn(record, 'value')) {
    if (
      keys.some((key) => key !== 'value' && key !== 'issues') ||
      ('issues' in record && record.issues !== undefined)
    )
      throw new PicodashContractError('invalid-callback-result', fieldKey ? { fieldKey } : {})
    return { value: record.value as PicodashJsonValue, issues: freeze([]) }
  }
  if (
    !hasOwn(record, 'issues') ||
    keys.some((key) => key !== 'issues') ||
    !Array.isArray(record.issues)
  )
    throw new PicodashContractError('invalid-callback-result', fieldKey ? { fieldKey } : {})
  const sourceIssues = record.issues as unknown[]
  const issues = sourceIssues.length
    ? sourceIssues.map((entry) => {
        if (
          !entry ||
          typeof entry !== 'object' ||
          typeof (entry as Record<string, unknown>).message !== 'string'
        )
          throw new PicodashContractError('invalid-callback-result', fieldKey ? { fieldKey } : {})
        const item = entry as Record<string, unknown>
        return Object.freeze({
          code: 'schema_failed' as const,
          path: freezePath([...(fieldKey ? ['values', fieldKey] : []), ...standardPath(item.path)]),
          message: item.message as string,
          ...(fieldKey ? { fieldKey } : {}),
        })
      })
    : [
        Object.freeze({
          code: 'schema_failed' as const,
          path: freezePath(fieldKey ? ['values', fieldKey] : []),
          message: 'Schema validation failed.',
          ...(fieldKey ? { fieldKey } : {}),
        }),
      ]
  return { issues: freeze(issues) }
}

const EmptyScopes = Object.freeze({
  size: 0,
  get: (_key: string) => undefined,
  has: (_key: string) => false,
  entries: () => [][Symbol.iterator](),
  keys: () => [][Symbol.iterator](),
  values: () => [][Symbol.iterator](),
  forEach: (_callback: unknown) => undefined,
  [Symbol.iterator]: () => [][Symbol.iterator](),
}) as unknown as ReadonlyMap<string, DurableScopeMetadata>

const immutableMap = <K, V>(entries: readonly (readonly [K, V])[]): ReadonlyMap<K, V> => {
  const source = new Map<K, V>()
  for (const [key, value] of entries) Map.prototype.set.call(source, key, value)
  const facade: ReadonlyMap<K, V> = {
    get size() {
      return source.size
    },
    get(key) {
      return source.get(key)
    },
    has(key) {
      return source.has(key)
    },
    entries() {
      return source.entries()
    },
    keys() {
      return source.keys()
    },
    values() {
      return source.values()
    },
    forEach(callbackfn, thisArg) {
      source.forEach((value, key) => callbackfn.call(thisArg, value, key, facade))
    },
    [Symbol.iterator]() {
      return source[Symbol.iterator]()
    },
  }
  return Object.freeze(facade)
}

const EmptyInteraction: ScopeInteractionState = Object.freeze({
  bindings: immutableMap<string, ReadonlyMap<string, BindingInteractionState>>([]),
  items: immutableMap<string, ItemInteractionState>([]),
})

export function createPicodashStore<
  Values extends Record<string, PicodashJsonValue>,
  const Definitions extends InputFields<Values>,
>(
  config: InferredStoreConfig<Values> & {
    readonly fields: Definitions & ExactInputFields<Values, Definitions>
    readonly storeId: string
    readonly schemaVersion: number
    readonly export: PicodashExportConfig
    readonly persistence: StoreOwnedPersistenceConfig<Definitions>
  },
): RootStore<Definitions, PersistentTransactionResult, true, true>
export function createPicodashStore<
  Values extends Record<string, PicodashJsonValue>,
  const Definitions extends InputFields<Values>,
>(
  config: InferredStoreConfig<Values> & {
    readonly fields: Definitions & ExactInputFields<Values, Definitions>
    readonly storeId: string
    readonly schemaVersion: number
    readonly export: PicodashExportConfig
    readonly persistence?: never
  },
): RootStore<Definitions, CoreTransactionResult, true, true>
export function createPicodashStore<
  Values extends Record<string, PicodashJsonValue>,
  const Definitions extends InputFields<Values>,
>(
  config: InferredStoreConfig<Values> & {
    readonly fields: Definitions & ExactInputFields<Values, Definitions>
    readonly persistence: StoreOwnedPersistenceConfig<Definitions>
  },
): RootStore<Definitions, PersistentTransactionResult, true, false>
export function createPicodashStore<
  Values extends Record<string, PicodashJsonValue>,
  const Definitions extends InputFields<Values>,
>(
  config: InferredStoreConfig<Values> & {
    readonly fields: Definitions & ExactInputFields<Values, Definitions>
    readonly storeId: string
    readonly schemaVersion: number
    readonly initialEnvelope?: PicodashEnvelopeInput<Values>
    readonly migrations?: SchemaMigrations
    readonly persistence?: never
  },
): RootStore<Definitions, CoreTransactionResult, true, false>
export function createPicodashStore<
  Values extends Record<string, PicodashJsonValue>,
  const Definitions extends InputFields<Values>,
>(
  config: InferredExternalConfig<Values> & {
    readonly fields: Definitions & ExactInputFields<Values, Definitions>
    readonly storeId: string
    readonly schemaVersion: number
    readonly export: PicodashExportConfig
    readonly persistence: ExternalOwnedPersistenceConfig
  },
): RootStore<Definitions, PersistentTransactionResult, true, true>
export function createPicodashStore<
  Values extends Record<string, PicodashJsonValue>,
  const Definitions extends InputFields<Values>,
>(
  config: InferredExternalConfig<Values> & {
    readonly fields: Definitions & ExactInputFields<Values, Definitions>
    readonly storeId: string
    readonly schemaVersion: number
    readonly export?: never
    readonly persistence: ExternalOwnedPersistenceConfig
  },
): RootStore<Definitions, PersistentTransactionResult, true, false>
export function createPicodashStore<
  Values extends Record<string, PicodashJsonValue>,
  const Definitions extends InputFields<Values>,
>(
  config: InferredExternalConfig<Values> & {
    readonly fields: Definitions & ExactInputFields<Values, Definitions>
    readonly storeId: string
    readonly schemaVersion: number
    readonly export: PicodashExportConfig
  },
): RootStore<Definitions, CoreTransactionResult, true, true>
export function createPicodashStore<
  Values extends Record<string, PicodashJsonValue>,
  const Definitions extends InputFields<Values>,
>(
  config: InferredExternalConfig<Values> & {
    readonly fields: Definitions & ExactInputFields<Values, Definitions>
    readonly storeId: string
    readonly schemaVersion: number
    readonly export?: never
  },
): RootStore<Definitions, CoreTransactionResult, true, false>
export function createPicodashStore<
  Values extends Record<string, PicodashJsonValue>,
  const Definitions extends InputFields<Values>,
>(
  config:
    | (InferredStoreConfig<Values> & {
        readonly fields: Definitions & ExactInputFields<Values, Definitions>
      })
    | (InferredExternalConfig<Values> & {
        readonly fields: Definitions & ExactInputFields<Values, Definitions>
      }),
): RootStore<Definitions, CoreTransactionResult>
export function createPicodashStore<
  Values extends Record<string, PicodashJsonValue>,
  const Definitions extends InputFields<Values>,
>(
  config:
    | (InferredStoreConfig<Values> & {
        readonly fields: Definitions & ExactInputFields<Values, Definitions>
      })
    | (InferredExternalConfig<Values> & {
        readonly fields: Definitions & ExactInputFields<Values, Definitions>
      }),
): RootStore<Definitions, CoreTransactionResult, boolean, boolean> {
  type Fields = Definitions
  if (
    !config ||
    typeof config !== 'object' ||
    (config.valueOwner !== 'store' && config.valueOwner !== 'external')
  )
    throw new PicodashContractError('invalid-configuration')
  if (!config.fields || typeof config.fields !== 'object' || Array.isArray(config.fields))
    throw new PicodashContractError('invalid-configuration')
  const configuredFieldKeys = Object.keys(config.fields)
  const configuredStoreId = config.storeId
  const configuredSchemaVersion = config.schemaVersion
  const suppliedMigrations = config.migrations
  let configuredMigrations: SchemaMigrations | undefined
  let configuredExportPolicy: PicodashExportPolicy | undefined
  const configuredExport = (config as { readonly export?: unknown }).export
  if (configuredExport !== undefined) {
    if (
      !validIdentity(configuredStoreId) ||
      !Number.isSafeInteger(configuredSchemaVersion) ||
      configuredSchemaVersion === undefined ||
      configuredSchemaVersion <= 0
    )
      throw new PicodashContractError('invalid-configuration')
    try {
      configuredExportPolicy = normalizePicodashExportPolicy(configuredExport, configuredFieldKeys)
    } catch {
      throw new PicodashContractError('invalid-configuration')
    }
  }
  if (configuredStoreId !== undefined && !validIdentity(configuredStoreId))
    throw new PicodashContractError('invalid-configuration')
  if (
    configuredSchemaVersion !== undefined &&
    (!validIdentity(configuredStoreId) ||
      !Number.isSafeInteger(configuredSchemaVersion) ||
      configuredSchemaVersion <= 0)
  )
    throw new PicodashContractError('invalid-configuration')
  if (suppliedMigrations !== undefined) {
    if (
      !validIdentity(configuredStoreId) ||
      !Number.isSafeInteger(configuredSchemaVersion) ||
      configuredSchemaVersion === undefined ||
      configuredSchemaVersion <= 0
    )
      throw new PicodashContractError('invalid-configuration')
    try {
      configuredMigrations = normalizeSchemaMigrations(suppliedMigrations, configuredSchemaVersion)
    } catch {
      throw new PicodashContractError('invalid-configuration')
    }
  }
  if (
    config.initialValues !== undefined &&
    (!config.initialValues ||
      typeof config.initialValues !== 'object' ||
      Array.isArray(config.initialValues))
  )
    throw new PicodashContractError('invalid-configuration')
  if (config.valueOwner === 'store' && config.adapter !== undefined)
    throw new PicodashContractError('invalid-configuration')
  if (config.valueOwner === 'external' && config.initialValues !== undefined)
    throw new PicodashContractError('invalid-configuration')
  if (
    config.valueOwner === 'external' &&
    (config.initialEnvelope !== undefined ||
      config.persistence !== undefined ||
      suppliedMigrations !== undefined ||
      config.export !== undefined) &&
    (!validIdentity(configuredStoreId) ||
      !Number.isSafeInteger(configuredSchemaVersion) ||
      configuredSchemaVersion === undefined ||
      configuredSchemaVersion <= 0)
  )
    throw new PicodashContractError('invalid-configuration')
  const configuredPersistence = (
    config as {
      readonly persistence?:
        | StoreOwnedPersistenceConfig<Definitions>
        | ExternalOwnedPersistenceConfig
    }
  ).persistence
  const metadataRecoveryEnabled =
    validIdentity(configuredStoreId) &&
    Number.isSafeInteger(configuredSchemaVersion) &&
    configuredSchemaVersion !== undefined &&
    configuredSchemaVersion > 0
  const documentsEnabled =
    validIdentity(configuredStoreId) &&
    Number.isSafeInteger(configuredSchemaVersion) &&
    configuredSchemaVersion !== undefined &&
    configuredSchemaVersion > 0
  if (configuredPersistence !== undefined) {
    if (
      !validIdentity(configuredStoreId) ||
      !Number.isSafeInteger(configuredSchemaVersion) ||
      configuredSchemaVersion === undefined ||
      configuredSchemaVersion <= 0
    )
      throw new PicodashContractError('invalid-configuration')
    const persistence = configuredPersistence as object
    const descriptors = Object.getOwnPropertyDescriptors(persistence)
    const ownKeys = Reflect.ownKeys(descriptors)
    if (
      config.valueOwner === 'external' &&
      (ownKeys.some((key) => typeof key !== 'string') ||
        ownKeys.some((key) => key !== 'storageKey' && key !== 'driver') ||
        !Object.hasOwn(descriptors, 'storageKey') ||
        !Object.hasOwn(descriptors, 'driver') ||
        !('value' in descriptors.storageKey!) ||
        !('value' in descriptors.driver!))
    )
      throw new PicodashContractError('invalid-configuration')
    const persistenceRecord = persistence as Record<string, unknown>
    if (
      !persistence ||
      typeof persistence !== 'object' ||
      !validIdentity(persistenceRecord.storageKey as string)
    )
      throw new PicodashContractError('invalid-configuration')
    const driver = persistenceRecord.driver as Record<string, unknown> | undefined
    const valuesPolicy =
      config.valueOwner === 'store'
        ? (persistenceRecord.values as Record<string, unknown> | undefined)
        : undefined
    if (
      !driver ||
      typeof driver !== 'object' ||
      !driver.identity ||
      typeof driver.read !== 'function' ||
      typeof driver.write !== 'function' ||
      typeof driver.remove !== 'function' ||
      (!driver.subscribe && driver.subscribe !== undefined) ||
      (driver.subscribe !== undefined && typeof driver.subscribe !== 'function') ||
      (config.valueOwner === 'store' &&
        !validatePersistenceValuesPolicy(valuesPolicy, configuredFieldKeys))
    )
      throw new PicodashContractError('invalid-configuration')
  }
  const persistenceIncludedFields =
    configuredPersistence === undefined
      ? undefined
      : config.valueOwner === 'external'
        ? new Set<string>()
        : new Set(
            configuredFieldKeys.filter((key) => {
              const storePersistence =
                configuredPersistence as StoreOwnedPersistenceConfig<Definitions>
              const overrides = storePersistence.values.fields as
                | Record<string, 'include' | 'omit'>
                | undefined
              const selected = overrides?.[key]
              return selected === undefined
                ? storePersistence.values.defaultFieldPolicy === 'include'
                : selected === 'include'
            }),
          )
  const configuredRootValidate = config.validateValues
  if (configuredRootValidate !== undefined && typeof configuredRootValidate !== 'function')
    throw new PicodashContractError('invalid-configuration')

  const fieldOwners = new WeakMap<object, object>()
  const owner = Object.freeze({})
  const definitionMap = new Map<
    string,
    {
      readonly defaultValue: unknown
      readonly schemaValidate?: (value: unknown) => unknown
      readonly parse?: (input: unknown) => PicodashParseResult<unknown>
      readonly validate?: PicodashFieldValidator<unknown, ValuesOf<Fields>>
    }
  >()
  const fieldsRecord = Object.create(null) as Record<string, unknown>
  const fieldEntries = configuredFieldKeys
  for (const key of fieldEntries) {
    if (!validFieldKey(key)) throw new PicodashContractError('invalid-configuration')
    const definition = (config.fields as Record<string, unknown>)[key]
    if (
      !definition ||
      typeof definition !== 'object' ||
      Array.isArray(definition) ||
      !hasOwn(definition, 'defaultValue')
    )
      throw new PicodashContractError('invalid-configuration', { fieldKey: key })
    const source = definition as Record<string, unknown>
    const schema = source.schema
    let schemaValidate: ((value: unknown) => unknown) | undefined
    if (schema !== undefined) {
      if (!schema || typeof schema !== 'object')
        throw new PicodashContractError('invalid-configuration', { fieldKey: key })
      const standard = (schema as Record<string, unknown>)['~standard']
      const standardValidate =
        standard && typeof standard === 'object'
          ? (standard as Record<string, unknown>).validate
          : undefined
      if (
        !standard ||
        typeof standard !== 'object' ||
        (standard as Record<string, unknown>).version !== 1 ||
        typeof (standard as Record<string, unknown>).vendor !== 'string' ||
        typeof standardValidate !== 'function'
      )
        throw new PicodashContractError('invalid-configuration', { fieldKey: key })
      schemaValidate = standardValidate as (value: unknown) => unknown
    }
    const validate = source.validate
    if (validate !== undefined && typeof validate !== 'function')
      throw new PicodashContractError('invalid-configuration', { fieldKey: key })
    const parse = source.parse
    if (parse !== undefined && typeof parse !== 'function')
      throw new PicodashContractError('invalid-configuration', { fieldKey: key })
    const definitionSnapshot = Object.freeze({
      defaultValue: source.defaultValue,
      schemaValidate,
      parse: parse as ((input: unknown) => PicodashParseResult<unknown>) | undefined,
      validate: validate as PicodashFieldValidator<unknown, ValuesOf<Fields>> | undefined,
    })
    definitionMap.set(key, definitionSnapshot)
    const handle = Object.freeze({ key }) as unknown as PicodashField<
      ValuesOf<Fields>,
      keyof Fields & string
    >
    fieldOwners.set(handle, owner)
    Object.defineProperty(fieldsRecord, key, {
      value: handle,
      enumerable: true,
      writable: false,
      configurable: false,
    })
  }
  const fields = Object.freeze(fieldsRecord) as PicodashFields<Fields>

  let rootValidate: ValuesValidator<ValuesOf<Fields>> | undefined = configuredRootValidate

  const canonicalize = (
    key: string,
    raw: unknown,
    source: PicodashValidationContext<ValuesOf<Fields>>['source'],
    fieldKeyForIssue = key,
  ): { readonly value?: PicodashJsonValue; readonly issues: readonly TransactionIssue[] } => {
    const definition = definitionMap.get(key)
    if (!definition)
      return {
        issues: freeze([
          makeIssue({ message: `Unknown field ${key}.`, code: undefined }, 'unknown_field', key),
        ]),
      }
    let value = raw
    if (definition.schemaValidate) {
      let result: unknown
      try {
        result = definition.schemaValidate(raw)
      } catch (error) {
        if (error instanceof PicodashContractError) throw error
        return {
          issues: freeze([
            Object.freeze({
              code: 'schema_failed' as const,
              path: freezePath(['values', fieldKeyForIssue]),
              message: 'Schema validation failed.',
              fieldKey: fieldKeyForIssue,
            }),
          ]),
        }
      }
      let normalized: {
        readonly value?: PicodashJsonValue
        readonly issues: readonly TransactionIssue[]
      }
      try {
        normalized = standardIssues(result, fieldKeyForIssue)
      } catch (error) {
        if (error instanceof PicodashContractError) throw error
        throw new PicodashContractError('invalid-callback-result', { fieldKey: fieldKeyForIssue })
      }
      if (normalized.issues.length) return normalized
      value = normalized.value
    }
    try {
      return { value: cloneJson(value), issues: freeze([]) }
    } catch {
      return {
        issues: freeze([
          Object.freeze({
            code: 'invalid_json' as const,
            path: freezePath(['values', fieldKeyForIssue]),
            message: 'Value is not JSON-compatible.',
            fieldKey: fieldKeyForIssue,
          }),
        ]),
      }
    }
  }

  const runFieldValidators = (
    candidate: Record<string, PicodashJsonValue>,
    source: PicodashValidationContext<ValuesOf<Fields>>['source'],
    originScopeId?: string,
  ): readonly TransactionIssue[] => {
    const frozenCandidate = freeze(candidate) as Readonly<ValuesOf<Fields>>
    const issues: TransactionIssue[] = []
    for (const key of fieldEntries) {
      const definition = definitionMap.get(key)!
      if (!definition.validate) continue
      let result: unknown
      try {
        result = definition.validate(
          candidate[key],
          Object.freeze({
            values: frozenCandidate,
            field: (fields as Record<string, unknown>)[key] as PicodashField<
              ValuesOf<Fields>,
              keyof Fields & string
            >,
            source,
            ...(originScopeId === undefined ? {} : { originScopeId }),
          }),
        )
      } catch (error) {
        if (error instanceof PicodashContractError) throw error
        issues.push(
          Object.freeze({
            code: 'validation_failed' as const,
            path: freezePath(['values', key]),
            message: 'Field validation failed.',
            fieldKey: key,
          }),
        )
        continue
      }
      issues.push(...callbackIssues(result, 'validation_failed', key))
    }
    return freeze(issues)
  }

  const runRootValidator = (
    candidate: Record<string, PicodashJsonValue>,
    source: PicodashValidationContext<ValuesOf<Fields>>['source'],
    originScopeId?: string,
  ): readonly TransactionIssue[] => {
    if (!rootValidate) return freeze([])
    const frozenCandidate = freeze(candidate) as Readonly<ValuesOf<Fields>>
    let result: unknown
    try {
      result = rootValidate(
        frozenCandidate,
        Object.freeze({
          values: frozenCandidate,
          source,
          ...(originScopeId === undefined ? {} : { originScopeId }),
        }),
      )
    } catch (error) {
      if (error instanceof PicodashContractError) throw error
      return freeze([
        Object.freeze({
          code: 'validation_failed' as const,
          path: freezePath([]),
          message: 'Values validation failed.',
        }),
      ])
    }
    return callbackIssues(result, 'validation_failed')
  }

  const buildCandidate = (
    base: Record<string, PicodashJsonValue>,
    supplied: Record<string, unknown>,
    source: PicodashValidationContext<ValuesOf<Fields>>['source'],
    originScopeId?: string,
    validate = true,
  ): {
    readonly candidate: Record<string, PicodashJsonValue>
    readonly issues: readonly TransactionIssue[]
  } => {
    const candidate = Object.create(null) as Record<string, PicodashJsonValue>
    for (const key of fieldEntries) candidate[key] = base[key]!
    const issues: TransactionIssue[] = []
    for (const key of Object.keys(supplied)) {
      if (!definitionMap.has(key)) {
        issues.push(
          Object.freeze({
            code: 'unknown_field' as const,
            path: freezePath(['values', key]),
            message: `Unknown field ${key}.`,
            fieldKey: key,
          }),
        )
        continue
      }
      const normalized = canonicalize(key, supplied[key], source)
      issues.push(...normalized.issues)
      if (!normalized.issues.length) candidate[key] = normalized.value!
    }
    freeze(candidate)
    if (validate) {
      issues.push(...runFieldValidators(candidate, source, originScopeId))
      issues.push(...runRootValidator(candidate, source, originScopeId))
    }
    return { candidate, issues: freeze(issues) }
  }

  const buildCanonicalCandidate = (
    base: Record<string, PicodashJsonValue>,
    supplied: Record<string, unknown>,
    source: PicodashValidationContext<ValuesOf<Fields>>['source'],
    originScopeId?: string,
  ): {
    readonly candidate: Record<string, PicodashJsonValue>
    readonly issues: readonly TransactionIssue[]
  } => {
    const candidate = Object.create(null) as Record<string, PicodashJsonValue>
    for (const key of fieldEntries) candidate[key] = base[key]!
    const issues: TransactionIssue[] = []
    for (const key of Object.keys(supplied)) {
      if (!definitionMap.has(key)) {
        issues.push(
          Object.freeze({
            code: 'unknown_field' as const,
            path: freezePath(['values', key]),
            message: `Unknown field ${key}.`,
            fieldKey: key,
          }),
        )
        continue
      }
      candidate[key] = supplied[key] as PicodashJsonValue
    }
    freeze(candidate)
    issues.push(...runFieldValidators(candidate, source, originScopeId))
    issues.push(...runRootValidator(candidate, source, originScopeId))
    return { candidate, issues: freeze(issues) }
  }

  const defaultRaw = Object.create(null) as Record<string, unknown>
  for (const key of fieldEntries) defaultRaw[key] = definitionMap.get(key)!.defaultValue
  const canonicalDefaults = buildCandidate(
    Object.create(null),
    defaultRaw,
    'default',
    undefined,
    false,
  )
  if (canonicalDefaults.issues.length)
    throw new PicodashContractError('invalid-configuration', {}, canonicalDefaults.issues)
  const baseline = canonicalDefaults.candidate
  const initialRaw = config.initialValues
    ? (config.initialValues as Record<string, unknown>)
    : Object.create(null)
  for (const key of Object.keys(initialRaw))
    if (!definitionMap.has(key))
      throw new PicodashContractError('invalid-configuration', {}, [
        Object.freeze({
          code: 'unknown_field' as const,
          path: freezePath(['values', key]),
          message: `Unknown field ${key}.`,
          fieldKey: key,
        }),
      ])
  const canonicalInitial = buildCandidate(
    baseline,
    initialRaw,
    Object.keys(initialRaw).length ? 'initial' : 'default',
  )
  if (canonicalInitial.issues.length)
    throw new PicodashContractError('invalid-configuration', {}, canonicalInitial.issues)
  let runtimeController!: RuntimeController
  const diagnosticsRuntime = createDiagnosticsRuntime({
    assertActive: () => assertRuntimeActive(runtimeController),
    invalidListener: () => {
      throw new PicodashContractError('invalid-configuration')
    },
  })

  const validateExternalSnapshot = (snapshot: unknown): SnapshotValidation<ValuesOf<Fields>> => {
    try {
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return { ok: false }
      const prototype = Object.getPrototypeOf(snapshot)
      const keys = Reflect.ownKeys(snapshot)
      if (prototype !== Object.prototype && prototype !== null) return { ok: false }
      if (keys.some((key) => typeof key !== 'string') || keys.length !== fieldEntries.length)
        return { ok: false }
      for (const key of fieldEntries) if (!Object.hasOwn(snapshot, key)) return { ok: false }
      const candidate = Object.create(null) as Record<string, PicodashJsonValue>
      const collected: TransactionIssue[] = []
      for (const key of fieldEntries) {
        const normalized = canonicalize(key, (snapshot as Record<string, unknown>)[key], 'adapter')
        collected.push(...normalized.issues)
        if (!normalized.issues.length) candidate[key] = normalized.value!
      }
      if (collected.length) return { ok: false }
      collected.push(...runFieldValidators(candidate, 'adapter'))
      collected.push(...runRootValidator(candidate, 'adapter'))
      if (collected.length) return { ok: false }
      return { ok: true, values: freeze(candidate) as Readonly<ValuesOf<Fields>> }
    } catch {
      return { ok: false }
    }
  }

  let values = freeze(canonicalInitial.candidate) as Readonly<Record<string, PicodashJsonValue>>
  let scopes: ReadonlyMap<string, DurableScopeMetadata> = EmptyScopes
  let quarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata> = immutableMap<
    string,
    PicodashQuarantinedScopeMetadata
  >([])
  let writing = false
  let externalAdapterRuntime: ExternalAdapterRuntime<ValuesOf<Fields>> | undefined
  let adapterEchoValues: Readonly<Record<string, PicodashJsonValue>> | undefined
  if (config.valueOwner === 'external') {
    let runtime: ExternalAdapterRuntime<ValuesOf<Fields>>
    try {
      runtime = createExternalAdapterRuntime<ValuesOf<Fields>>({
        adapter: config.adapter as PicodashValueAdapter<ValuesOf<Fields>>,
        validateSnapshot: validateExternalSnapshot,
        equal: (left, right) => picodashJsonEqual(left as never, right as never),
        onExternalValues: (nextValues) => applyExternalValues(nextValues),
        onHealthFailure: (reason) => {
          diagnosticsRuntime.recordCondition({
            fingerprint: 'adapter',
            code: 'adapter_unhealthy',
            severity: 'error',
            message: 'External adapter is unhealthy.',
            identity: { kind: 'adapter' },
            details: { reason },
          })
          diagnosticsRuntime.publish()
        },
        onHealthRecovery: () => diagnosticsRuntime.recoverCondition('adapter'),
        withNotification: (run) => {
          if (writing) return run()
          writing = true
          try {
            return run()
          } finally {
            writing = false
          }
        },
      })
    } catch (error) {
      if (error instanceof PicodashInitializationError) throw error
      throw new PicodashContractError('invalid-configuration')
    }
    externalAdapterRuntime = runtime
    values = runtime.initialValues as Readonly<Record<string, PicodashJsonValue>>
  }
  let persistenceController: PersistenceController | undefined
  if (configuredPersistence === undefined && config.initialEnvelope !== undefined) {
    const storeId = configuredStoreId
    const schemaVersion = configuredSchemaVersion
    if (
      !validIdentity(storeId) ||
      typeof schemaVersion !== 'number' ||
      !Number.isSafeInteger(schemaVersion) ||
      schemaVersion <= 0
    )
      throw new PicodashContractError('invalid-configuration')
    let hydrated: ReturnType<typeof hydratePersistenceEnvelope>
    try {
      hydrated = hydratePersistenceEnvelope(
        config.initialEnvelope,
        { storeId, schemaVersion, valueOwner: config.valueOwner },
        (input) => {
          if (config.valueOwner === 'external')
            return input &&
              typeof input === 'object' &&
              !Array.isArray(input) &&
              !Object.keys(input).length
              ? Object.freeze({})
              : undefined
          if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined
          const source = input as Record<string, unknown>
          const built = buildCandidate(
            values as Record<string, PicodashJsonValue>,
            Object.fromEntries(
              fieldEntries
                .filter(
                  (key) =>
                    (persistenceIncludedFields === undefined ||
                      persistenceIncludedFields.has(key)) &&
                    Object.hasOwn(source, key),
                )
                .map((key) => [key, source[key]]),
            ),
            'persistence',
          )
          return built.issues.length ? undefined : freeze(built.candidate)
        },
        {
          migrations: configuredMigrations,
          valueOwner: config.valueOwner,
          countUnknownFields: (input) =>
            Object.keys(input).filter((key) => !fieldEntries.includes(key)).length,
          onUnknownFieldCount: (count) => {
            if (!count) return
            diagnosticsRuntime.recordCondition({
              fingerprint: 'schema-unknown-fields',
              code: 'unknown_persisted_fields',
              severity: 'warning',
              message: 'Persisted fields are not present in the current Store schema.',
              identity: { kind: 'schema' },
              details: { unknownFieldCount: count },
            })
            diagnosticsRuntime.publish()
          },
          onQuarantine: (scopeId) => {
            diagnosticsRuntime.recordCondition({
              fingerprint: `metadata-quarantined:${scopeId}`,
              code: 'metadata_quarantined',
              severity: 'warning',
              message: 'Scope metadata was quarantined.',
              identity: { kind: 'scope-metadata', scopeId },
            })
            diagnosticsRuntime.publish()
          },
        },
      )
    } catch (error) {
      externalAdapterRuntime?.destroy()
      throw error
    }
    if (!hydrated.ok) {
      externalAdapterRuntime?.destroy()
      throw new PicodashInitializationError(hydrated.reason, 'invalid-persistence-envelope')
    }
    if (config.valueOwner === 'store') values = hydrated.record.values
    scopes = hydrated.record.scopes
    quarantinedScopes = hydrated.record.quarantinedScopes
  }
  if (configuredPersistence !== undefined) {
    try {
      const persistenceConfig = configuredPersistence
      persistenceController = createPersistenceController({
        storageKey: persistenceConfig.storageKey,
        driver: persistenceConfig.driver,
        storeId: configuredStoreId!,
        schemaVersion: configuredSchemaVersion!,
        baselineValues: config.valueOwner === 'external' ? Object.freeze({}) : values,
        valueOwner: config.valueOwner,
        initialEnvelope: config.initialEnvelope,
        migrations: configuredMigrations,
        normalizeValues: (input) => {
          if (config.valueOwner === 'external')
            return input &&
              typeof input === 'object' &&
              !Array.isArray(input) &&
              !Object.keys(input).length
              ? Object.freeze({})
              : undefined
          if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined
          const source = input as Record<string, unknown>
          const built = buildCandidate(
            values as Record<string, PicodashJsonValue>,
            Object.fromEntries(
              fieldEntries
                .filter(
                  (key) =>
                    (persistenceIncludedFields === undefined ||
                      persistenceIncludedFields.has(key)) &&
                    Object.hasOwn(source, key),
                )
                .map((key) => [key, source[key]]),
            ),
            'persistence',
          )
          return built.issues.length ? undefined : freeze(built.candidate)
        },
        onUnknownFieldCount: (count) => {
          if (!count) return
          diagnosticsRuntime.recordCondition({
            fingerprint: 'schema-unknown-fields',
            code: 'unknown_persisted_fields',
            severity: 'warning',
            message: 'Persisted fields are not present in the current Store schema.',
            identity: { kind: 'schema' },
            details: { unknownFieldCount: count },
          })
          diagnosticsRuntime.publish()
        },
        onQuarantine: (scopeId) => {
          diagnosticsRuntime.recordCondition({
            fingerprint: `metadata-quarantined:${scopeId}`,
            code: 'metadata_quarantined',
            severity: 'warning',
            message: 'Scope metadata was quarantined.',
            identity: { kind: 'scope-metadata', scopeId },
          })
          diagnosticsRuntime.publish()
        },
        onUnknownFieldsRecovered: () => {
          diagnosticsRuntime.recoverCondition('schema-unknown-fields')
          diagnosticsRuntime.publish()
        },
        onExternalValues: () => undefined,
        onApply: (nextValues, nextScopes, nextQuarantinedScopes) =>
          applyPersistenceResolution(nextValues, nextScopes, nextQuarantinedScopes),
        createConflictResolutionPlan: (input) =>
          createPersistenceConflictResolutionPlanPublic(input),
        executeConflictResolution: (plan) => executePersistenceConflictResolutionPublic(plan),
        createErasePlan: () => createPersistenceErasePlanPublic(),
        executeErase: (plan, input) => executePersistenceErasePublic(plan, input),
        onFailure: (reason: PersistenceFailureReason) => {
          if (!runtimeController)
            return Object.freeze({
              code: 'persistence_failure' as const,
              severity: 'error' as const,
              message: 'Store persistence failed.',
              identity: Object.freeze({ kind: 'persistence' as const }),
              count: 1,
              lastOccurrence: 1,
              reason,
            })
          const diagnostic = diagnosticsRuntime.recordCondition({
            fingerprint: 'persistence',
            code: 'persistence_failure',
            severity: 'error',
            message: 'Store persistence failed.',
            identity: { kind: 'persistence' },
            details: { reason },
          })
          diagnosticsRuntime.publish()
          return diagnostic as PicodashPersistenceDiagnostic
        },
        onRecovery: () => {
          if (!runtimeController) return
          diagnosticsRuntime.recoverCondition('persistence')
          diagnosticsRuntime.publish()
        },
        onConflict: () => undefined,
        includeField: (key) => {
          return persistenceIncludedFields!.has(key)
        },
        onUseAfterDestroy: () => {
          throw new PicodashContractError('use-after-destroy')
        },
        dispatchCapability: (capabilityListeners) => {
          if (!runtimeController) return
          diagnosticsRuntime.dispatch([
            { surface: 'capability', capability: 'persistence', listeners: capabilityListeners },
          ])
        },
        withKernelWrite: (run) => {
          if (writing) return run()
          writing = true
          try {
            return run()
          } finally {
            writing = false
          }
        },
      })
      if (config.valueOwner === 'store') values = persistenceController.initialValues
      scopes = persistenceController.initialScopes
      quarantinedScopes = persistenceController.initialQuarantinedScopes
    } catch (error) {
      externalAdapterRuntime?.destroy()
      if (error instanceof PicodashInitializationError) throw error
      if (error instanceof Error && error.message.startsWith('persistence-identity-in-use:'))
        throw new PicodashContractError('persistence-identity-in-use', {
          storageKey: configuredPersistence.storageKey,
        })
      throw new PicodashContractError('invalid-configuration')
    }
  }
  let currentSnapshot!: RootSnapshot<ValuesOf<Fields>>
  const interactionByScope = new Map<string, ScopeInteractionState>()
  const interactionBases = new WeakMap<
    object,
    { readonly baseRevision: number; readonly baseValue: PicodashJsonValue }
  >()
  let suppressInteractionDispatch = false
  const fieldRevisions = new Map<string, number>(fieldEntries.map((key) => [key, 0]))
  type RepairRecord = {
    readonly binding: object
    readonly interaction: BindingInteractionState
    readonly fieldKey: string
    readonly scopeId: string
    readonly itemId: string
    readonly alias: string
    readonly revision: number
    readonly baseValue: PicodashJsonValue
    readonly draft: PicodashJsonValue
    readonly candidate: PicodashJsonValue
    readonly targetValues: Readonly<Record<string, PicodashJsonValue>>
    consumed: boolean
    readonly registry: BindingPlanRegistryRecord
  }
  const repairPlans = new WeakMap<object, RepairRecord>()
  type StaleOverwriteRecord = {
    readonly binding: object
    readonly interaction: BindingInteractionState
    readonly fieldKey: string
    readonly scopeId: string
    readonly itemId: string
    readonly alias: string
    readonly revision: number
    readonly targetValue: PicodashJsonValue
    readonly draft: PicodashJsonValue
    consumed: boolean
    readonly registry: BindingPlanRegistryRecord
  }
  const staleOverwritePlans = new WeakMap<object, StaleOverwriteRecord>()
  const listeners = new Set<() => void>()
  const scopedRefs = new Map<string, WeakRef<object>>()
  type ScopedChannel = {
    readonly scopeId: string
    snapshot: ScopedSnapshot<ValuesOf<Fields>>
    readonly listeners: Set<() => void>
  }
  let scopedInternals = new WeakMap<object, ScopedChannel>()
  const channelsById = new Map<string, ScopedChannel>()
  const activeChannels = new Set<ScopedChannel>()
  currentSnapshot = freeze({ values, scopes }) as RootSnapshot<ValuesOf<Fields>>

  type StoreResult = CoreTransactionResult
  let metadataRecoveryCapability!: PicodashMetadataRecovery<StoreResult>
  let store!: RootStore<Fields, StoreResult, boolean, boolean>
  let metadataRecoverySnapshot: PicodashMetadataRecoveryState = Object.freeze({
    quarantinedScopes,
  })
  const metadataRecoveryRuntime = createMetadataRecovery<StoreResult>({
    assertActive: () => {
      if (runtimeController?.lifecycle !== 'active')
        throw new PicodashContractError('use-after-destroy')
    },
    getState: () => metadataRecoveryState(),
    replaceScope: (scopeId, replacement) => replaceQuarantinedScopeInternal(scopeId, replacement),
    dispatch: (capabilityListeners) =>
      diagnosticsRuntime.dispatch([
        {
          surface: 'capability',
          capability: 'metadataRecovery',
          listeners: capabilityListeners,
        },
      ]),
  })
  metadataRecoveryCapability = metadataRecoveryRuntime.capability
  const publishMetadataRecovery = metadataRecoveryRuntime.publish

  const publishQuarantineTransition = (
    previous: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>,
    next: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>,
  ): void => {
    const changedScopeIds = [...new Set([...previous.keys(), ...next.keys()])].filter((scopeId) => {
      const before = previous.get(scopeId)
      const after = next.get(scopeId)
      return (
        !!before !== !!after || (!!before && !!after && !picodashJsonEqual(before.raw, after.raw))
      )
    })
    if (!changedScopeIds.length) return
    metadataRecoverySnapshot = Object.freeze({ quarantinedScopes: next })
    for (const scopeId of changedScopeIds) {
      if (next.has(scopeId)) {
        if (!previous.has(scopeId))
          diagnosticsRuntime.recordCondition({
            fingerprint: `metadata-quarantined:${scopeId}`,
            code: 'metadata_quarantined',
            severity: 'warning',
            message: 'Scope metadata was quarantined.',
            identity: { kind: 'scope-metadata', scopeId },
          })
      } else diagnosticsRuntime.recoverCondition(`metadata-quarantined:${scopeId}`)
    }
    diagnosticsRuntime.publish()
    publishMetadataRecovery()
  }

  type DocumentExportSnapshot = Readonly<{
    readonly receiverScopeId?: string
    readonly options: ReturnType<typeof normalizePicodashExportOptions>
    readonly document: PicodashDocument
    readonly values: Readonly<Record<string, PicodashJsonValue>>
    readonly scopes: readonly (readonly [string, SerializedDurableScopeMetadata])[]
    readonly activeFieldKeys: readonly string[]
    readonly descendantScopeIds: readonly string[]
  }>
  type DocumentImportSnapshot = Readonly<{
    readonly receiverScopeId?: string
    readonly document: PicodashDocument
    readonly options: PicodashNormalizedImportOptions
    readonly overlay: ReturnType<typeof buildPicodashDocumentOverlay>
    readonly targetFieldRevisions: readonly (readonly [string, number])[]
    readonly targetScopeExistence: readonly (readonly [string, boolean])[]
    readonly targetScopes: readonly (readonly [string, SerializedDurableScopeMetadata | null])[]
    readonly targetQuarantined: readonly (readonly [
      string,
      PicodashQuarantinedScopeMetadata | null,
    ])[]
    readonly storeId: string
    readonly schemaVersion: number
  }>

  const documentOptionError = (error: unknown): never => {
    if (error instanceof PicodashContractError) throw error
    if (error && typeof error === 'object') {
      const operation = (error as { operation?: unknown }).operation
      const reason = (error as { reason?: unknown }).reason
      if (typeof operation === 'string' && typeof reason === 'string')
        throw new PicodashContractError('invalid-document-options', { operation, reason })
    }
    throw new PicodashContractError('invalid-document-options', {
      operation: 'import-analysis',
      reason: 'invalid-mapping',
    })
  }

  const documentPlanError = (
    kind: 'export' | 'import',
    reason: 'wrong-kind' | 'foreign-root' | 'foreign-target' | 'consumed',
  ): never => {
    throw new PicodashContractError('invalid-document-plan', { kind, reason })
  }

  const documentFailure = (
    reason: string,
    message = 'Invalid Store document.',
  ): Extract<CoreTransactionResult, { readonly ok: false }> =>
    (() => {
      const code: PicodashIssueCode =
        reason === 'foreign_store'
          ? 'foreign_store'
          : reason === 'unknown_field'
            ? 'unknown_field'
            : reason === 'incompatible_field'
              ? 'incompatible_field'
              : reason === 'missing_scope'
                ? 'missing_scope'
                : reason === 'schema_migration_failed'
                  ? 'schema_migration_failed'
                  : reason === 'stale_plan'
                    ? 'stale_plan'
                    : 'invalid_document'
      const issue: TransactionIssue = {
        code,
        path: freezePath([]),
        message,
        ...(code === 'invalid_document' ? { reason } : {}),
      }
      return rejectedResult([Object.freeze(issue)])
    })()

  const documentScopes = (): readonly (readonly [string, SerializedDurableScopeMetadata])[] =>
    Object.freeze(
      [...scopes.entries()]
        .filter(([scopeId]) => !quarantinedScopes.has(scopeId))
        .map(([scopeId, metadata]) => {
          const encoded = encodeDurableScopeMetadata(metadata)
          return encoded === undefined ? undefined : ([scopeId, encoded] as const)
        })
        .filter(
          (entry): entry is readonly [string, SerializedDurableScopeMetadata] =>
            entry !== undefined,
        )
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    )

  const documentScopeIds = (): readonly string[] => {
    const controller = runtimeControllerFor(store as object)
    const ids = new Set<string>([...scopes.keys(), ...quarantinedScopes.keys()])
    for (const [scopeId] of controller?.bindings ?? []) ids.add(scopeId)
    for (const [scopeId] of controller?.dashListNodes ?? []) ids.add(scopeId)
    for (const entity of controller?.entities ?? []) if (entity.active) ids.add(entity.scopeId)
    for (const relationship of controller?.relationships ?? []) {
      if (relationship.active) {
        ids.add(relationship.parentScopeId)
        ids.add(relationship.childScopeId)
      }
    }
    return Object.freeze([...ids].sort())
  }

  const assertDocumentFieldHandles = (
    handles: readonly PicodashDocumentFieldHandle[] | undefined,
  ): readonly string[] => {
    if (handles === undefined) return Object.freeze([])
    const keys = handles.map((handle) => {
      assertOwned(handle)
      return handle.key
    })
    return Object.freeze([...new Set(keys)].sort())
  }

  const makeExportSnapshot = (
    receiverScopeId: string | undefined,
    input: unknown,
  ): DocumentExportSnapshot => {
    if (!configuredExportPolicy)
      throw new PicodashContractError('invalid-document-options', {
        operation: 'export',
        reason: 'invalid-target',
      })
    let options: ReturnType<typeof normalizePicodashExportOptions>
    try {
      options = normalizePicodashExportOptions(
        input,
        receiverScopeId === undefined ? 'root' : 'scope',
      )
    } catch (error) {
      return documentOptionError(error)
    }
    const selectedExplicit = assertDocumentFieldHandles(options.fields)
    const promoted = assertDocumentFieldHandles(options.promoteFields)
    const controller = runtimeControllerFor(store as object)
    const targetScopeId = receiverScopeId ?? options.scopeId
    const descendants =
      targetScopeId !== undefined && options.includeDescendants
        ? [...(controller?.descendants(targetScopeId) ?? [])]
        : []
    const selected = new Set<string>()
    if (targetScopeId === undefined) {
      if (options.fields !== undefined) for (const key of selectedExplicit) selected.add(key)
      else for (const key of fieldEntries) selected.add(key)
    } else if (options.fields !== undefined) {
      for (const key of selectedExplicit) selected.add(key)
    } else {
      for (const scopeId of [targetScopeId, ...descendants])
        for (const key of controller?.activeBindingFieldKeys(scopeId) ?? []) selected.add(key)
    }
    if (options.promoteFields !== undefined && options.fields !== undefined)
      for (const key of promoted) selected.add(key)
    for (const key of promoted)
      if (!selected.has(key))
        documentOptionError(new PicodashDocumentOptionsError('export', 'invalid-promotion'))
    const fields: PicodashDocumentFieldEntry[] = []
    for (const key of [...selected].sort()) {
      const policy = configuredExportPolicy.fields[key] ?? {
        default: configuredExportPolicy.documents.defaultFieldPolicy,
      }
      const isPromoted = promoted.includes(key)
      if (
        isPromoted &&
        (policy.default !== 'redact' || policy.allowPromotion !== 'with-confirmation')
      )
        documentOptionError(new PicodashDocumentOptionsError('export', 'invalid-promotion'))
      if (policy.default === 'omit') continue
      fields.push([
        key,
        policy.default === 'redact' && !isPromoted
          ? { status: 'redacted' as const }
          : { status: 'included' as const, value: values[key]! },
      ])
    }
    const serializedScopes = documentScopes()
    const targetScopes =
      targetScopeId === undefined
        ? serializedScopes
        : serializedScopes.filter(([scopeId]) => [targetScopeId, ...descendants].includes(scopeId))
    const document = encodePicodashDocument(
      targetScopeId === undefined
        ? {
            formatVersion: 1,
            kind: 'root',
            storeId: configuredStoreId!,
            schemaVersion: configuredSchemaVersion!,
            fields,
            scopes: targetScopes,
          }
        : {
            formatVersion: 1,
            kind: 'scope',
            storeId: configuredStoreId!,
            schemaVersion: configuredSchemaVersion!,
            scopeId: targetScopeId,
            fields,
            scopes: targetScopes,
          },
    )
    return Object.freeze({
      receiverScopeId,
      options,
      document,
      values: Object.freeze({ ...values }),
      scopes: targetScopes,
      activeFieldKeys: Object.freeze(
        targetScopeId === undefined || options.fields !== undefined
          ? []
          : [
              ...new Set(
                [targetScopeId, ...descendants].flatMap(
                  (scopeId) => controller?.activeBindingFieldKeys(scopeId) ?? [],
                ),
              ),
            ].sort(),
      ),
      descendantScopeIds: Object.freeze(descendants.sort()),
    })
  }

  const createDocumentExportPlan = (
    receiverScopeId: string | undefined,
    input: unknown,
  ): PicodashExportPlan =>
    withWriteLock(() => {
      const snapshot = makeExportSnapshot(receiverScopeId, input)
      const review = normalizePicodashExportPlanReview({
        kind: 'export-plan',
        documentKind: snapshot.document.kind,
        ...(snapshot.document.kind === 'scope' ? { scopeId: snapshot.document.scopeId } : {}),
        fieldKeys: snapshot.document.fields.map(([key]) => key),
        promotedFieldKeys: snapshot.options.promoteFields?.map((field) => field.key) ?? [],
        scopeIds: snapshot.document.scopes.map(([scopeId]) => scopeId),
      })
      const plan = Object.freeze(review) as PicodashExportPlan
      registerDocumentPlan(plan as object, {
        root: store as object,
        kind: 'export',
        snapshot: snapshot as object,
        consumed: false,
      })
      return plan
    })

  const executeDocumentExportPlan = (
    plan: PicodashExportPlan,
    input: unknown,
    expectedReceiverScopeId?: string,
  ): PicodashDocumentExportResult =>
    withWriteLock(() => {
      const record =
        plan && typeof plan === 'object' ? documentPlanRecord(plan as object) : undefined
      if (!record) return documentPlanError('export', 'wrong-kind')
      if (record.kind !== 'export') documentPlanError('export', 'wrong-kind')
      if (record.root !== (store as object)) documentPlanError('export', 'foreign-root')
      const snapshot = record.snapshot as DocumentExportSnapshot
      if (snapshot.receiverScopeId !== expectedReceiverScopeId)
        documentPlanError('export', 'foreign-target')
      try {
        normalizePicodashExportExecutionOptions(
          input,
          (snapshot.options.promoteFields?.length ?? 0) > 0,
        )
      } catch (error) {
        return documentOptionError(error)
      }
      if (record.consumed) documentPlanError('export', 'consumed')
      record.consumed = true
      const current = makeExportSnapshot(snapshot.receiverScopeId, snapshot.options)
      if (
        JSON.stringify(current.document) !== JSON.stringify(snapshot.document) ||
        JSON.stringify(current.activeFieldKeys) !== JSON.stringify(snapshot.activeFieldKeys) ||
        JSON.stringify(current.descendantScopeIds) !== JSON.stringify(snapshot.descendantScopeIds)
      )
        return documentFailure('stale_plan', 'Export plan is stale.')
      return Object.freeze({ ok: true as const, document: current.document })
    })

  const makeImportSnapshot = (
    receiverScopeId: string | undefined,
    documentInput: unknown,
    optionsInput?: unknown,
  ): DocumentImportSnapshot | Extract<CoreTransactionResult, { readonly ok: false }> => {
    let options: PicodashNormalizedImportOptions
    try {
      options = normalizePicodashImportOptions(
        optionsInput,
        receiverScopeId === undefined ? 'root' : 'scope',
      )
      for (const [, target] of options.fieldMap) if (target !== 'ignore') assertOwned(target)
    } catch (error) {
      return documentOptionError(error)
    }
    let document: PicodashDocument
    try {
      document = decodePicodashDocument(documentInput)
    } catch (error) {
      if (error instanceof PicodashDocumentError) return documentFailure(error.reason)
      return documentFailure('shape')
    }
    if (document.storeId !== configuredStoreId && !options.allowForeignStore)
      return documentFailure('foreign_store')
    if (document.kind === 'root' && options.targetScopeId !== undefined)
      return documentOptionError(
        new PicodashDocumentOptionsError('import-analysis', 'invalid-target'),
      )
    if (receiverScopeId !== undefined && document.kind !== 'scope') return documentFailure('kind')
    if (
      receiverScopeId === undefined &&
      document.kind === 'scope' &&
      options.targetScopeId === undefined
    )
      return documentFailure('missing_scope')
    if (document.kind === 'scope' && receiverScopeId !== undefined)
      options = Object.freeze({ ...options, targetScopeId: receiverScopeId })
    if (document.schemaVersion !== configuredSchemaVersion) {
      try {
        document = migratePicodashDocument(document, configuredSchemaVersion!, configuredMigrations)
      } catch {
        return documentFailure('schema_migration_failed')
      }
    }
    const targetScopeIds = documentScopeIds()
    const scopeMappings = new Map(options.scopeMap)
    if (document.kind === 'scope' && options.targetScopeId !== undefined)
      scopeMappings.set(document.scopeId, options.targetScopeId)
    const relevantTargetScopeIds = new Set<string>()
    if (document.kind === 'scope')
      relevantTargetScopeIds.add(scopeMappings.get(document.scopeId) ?? document.scopeId)
    for (const [sourceScopeId] of document.scopes)
      relevantTargetScopeIds.add(scopeMappings.get(sourceScopeId) ?? sourceScopeId)
    const targetScopeIdSet = new Set(targetScopeIds)
    const targetScopeMap = new Map(documentScopes())
    const relevantTargetFieldKeys = new Set<string>()
    const fieldMappings = new Map(options.fieldMap)
    for (const [sourceFieldKey, entry] of document.fields) {
      if (entry.status !== 'included') continue
      const mapped = fieldMappings.get(sourceFieldKey)
      if (mapped !== 'ignore')
        relevantTargetFieldKeys.add(
          typeof mapped === 'object' && mapped !== null ? mapped.key : sourceFieldKey,
        )
    }
    let overlay: ReturnType<typeof buildPicodashDocumentOverlay>
    try {
      overlay = buildPicodashDocumentOverlay({
        document: stripRedactedPicodashDocumentFields(document),
        targetValues: values,
        targetScopes: documentScopes(),
        targetScopeIds,
        targetFieldKeys: fieldEntries,
        compatibleFieldKeys: fieldEntries,
        options,
      })
    } catch (error) {
      if (error instanceof PicodashDocumentOptionsError) return documentOptionError(error)
      if (error instanceof PicodashDocumentError) return documentFailure(error.reason)
      return documentFailure('metadata')
    }
    const importedValues: Record<string, PicodashJsonValue> = Object.create(null)
    for (const key of overlay.changedFields) importedValues[key] = overlay.values[key]!
    const canonical = buildCandidate(
      values as Record<string, PicodashJsonValue>,
      importedValues,
      'import',
      receiverScopeId,
    )
    if (canonical.issues.length) return rejectedResult(canonical.issues)
    overlay = Object.freeze({
      ...overlay,
      values: canonical.candidate,
      changedFields: Object.freeze(
        fieldEntries
          .filter((key) => !picodashJsonEqual(values[key]!, canonical.candidate[key]!))
          .sort(),
      ),
    })
    return Object.freeze({
      receiverScopeId,
      document,
      options,
      overlay,
      targetFieldRevisions: Object.freeze(
        [...relevantTargetFieldKeys]
          .sort()
          .map((fieldKey) => Object.freeze([fieldKey, fieldRevisions.get(fieldKey) ?? 0] as const)),
      ),
      targetScopeExistence: Object.freeze(
        [...relevantTargetScopeIds]
          .sort()
          .map((scopeId) => Object.freeze([scopeId, targetScopeIdSet.has(scopeId)] as const)),
      ),
      targetScopes: Object.freeze(
        [...relevantTargetScopeIds]
          .sort()
          .map((scopeId) => Object.freeze([scopeId, targetScopeMap.get(scopeId) ?? null] as const)),
      ),
      targetQuarantined: Object.freeze(
        overlay.changedScopeIds
          .map((scopeId) => {
            const record = quarantinedScopes.get(scopeId)
            return Object.freeze([
              scopeId,
              record === undefined
                ? null
                : Object.freeze({
                    scopeId,
                    raw: clonePicodashValue(record.raw),
                  }),
            ] as const)
          })
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
      ),
      storeId: configuredStoreId!,
      schemaVersion: configuredSchemaVersion!,
    })
  }

  const createDocumentImportPlanLocked = (
    receiverScopeId: string | undefined,
    documentInput: unknown,
    optionsInput: unknown,
  ):
    | Readonly<{ readonly ok: true; readonly plan: PicodashImportPlan }>
    | Extract<CoreTransactionResult, { readonly ok: false }> => {
    const snapshot = makeImportSnapshot(receiverScopeId, documentInput, optionsInput)
    if (!('overlay' in snapshot)) return snapshot
    const review = normalizePicodashImportPlanReview({
      kind: 'import-plan',
      documentKind: snapshot.document.kind,
      ...(snapshot.options.targetScopeId === undefined
        ? {}
        : { targetScopeId: snapshot.options.targetScopeId }),
      changedFields: snapshot.overlay.changedFields,
      changedScopeIds: snapshot.overlay.changedScopeIds,
      ignoredFields: snapshot.overlay.ignoredFields,
      createdScopes: snapshot.overlay.createdScopes,
      fieldRemaps: snapshot.overlay.fieldRemaps,
      scopeRemaps: snapshot.overlay.scopeRemaps,
      foreignStore: snapshot.document.storeId !== configuredStoreId,
    })
    const plan = Object.freeze(review) as PicodashImportPlan
    registerDocumentPlan(plan as object, {
      root: store as object,
      kind: 'import',
      snapshot: snapshot as object,
      consumed: false,
    })
    return Object.freeze({ ok: true as const, plan })
  }

  const createDocumentImportPlan = (
    receiverScopeId: string | undefined,
    documentInput: unknown,
    optionsInput: unknown,
  ) =>
    withWriteLock(() =>
      createDocumentImportPlanLocked(receiverScopeId, documentInput, optionsInput),
    )

  const executeDocumentImportPlanLocked = (
    plan: PicodashImportPlan,
    expectedReceiverScopeId?: string,
  ): CoreTransactionResult => {
    const record = plan && typeof plan === 'object' ? documentPlanRecord(plan as object) : undefined
    if (!record) return documentPlanError('import', 'wrong-kind')
    if (record.kind !== 'import') documentPlanError('import', 'wrong-kind')
    if (record.root !== (store as object)) documentPlanError('import', 'foreign-root')
    const snapshot = record.snapshot as DocumentImportSnapshot
    if (snapshot.receiverScopeId !== expectedReceiverScopeId)
      documentPlanError('import', 'foreign-target')
    if (record.consumed) documentPlanError('import', 'consumed')
    // A structurally valid single-use plan is consumed before recomputing its
    // overlay. State drift, metadata validation, or adapter/persistence failure
    // therefore cannot make the same plan executable a second time.
    record.consumed = true
    if (
      snapshot.targetFieldRevisions.some(
        ([fieldKey, revision]) => (fieldRevisions.get(fieldKey) ?? 0) !== revision,
      )
    )
      return documentFailure('stale_plan', 'Import plan is stale.')
    const currentScopeIds = new Set(documentScopeIds())
    if (
      snapshot.targetScopeExistence.some(
        ([scopeId, existed]) => currentScopeIds.has(scopeId) !== existed,
      )
    )
      return documentFailure('stale_plan', 'Import plan is stale.')
    const currentScopeMap = new Map(documentScopes())
    if (
      JSON.stringify(snapshot.targetScopes) !==
      JSON.stringify(
        snapshot.targetScopes.map(([scopeId]) => [scopeId, currentScopeMap.get(scopeId) ?? null]),
      )
    )
      return documentFailure('stale_plan', 'Import plan is stale.')
    let currentOverlay: ReturnType<typeof buildPicodashDocumentOverlay>
    try {
      currentOverlay = buildPicodashDocumentOverlay({
        document: snapshot.document,
        targetValues: values,
        targetScopes: documentScopes(),
        targetScopeIds: documentScopeIds(),
        targetFieldKeys: fieldEntries,
        compatibleFieldKeys: fieldEntries,
        options: snapshot.options,
      })
    } catch (error) {
      if (error instanceof PicodashDocumentOptionsError) return documentOptionError(error)
      if (error instanceof PicodashDocumentError) return documentFailure(error.reason)
      return documentFailure('metadata')
    }
    const currentImportedValues: Record<string, PicodashJsonValue> = Object.create(null)
    for (const key of currentOverlay.changedFields)
      currentImportedValues[key] = currentOverlay.values[key]!
    const currentCanonical = buildCandidate(
      values as Record<string, PicodashJsonValue>,
      currentImportedValues,
      'import',
      snapshot.receiverScopeId,
    )
    if (currentCanonical.issues.length) return rejectedResult(currentCanonical.issues)
    currentOverlay = Object.freeze({
      ...currentOverlay,
      values: currentCanonical.candidate,
      changedFields: Object.freeze(
        fieldEntries
          .filter((key) => !picodashJsonEqual(values[key]!, currentCanonical.candidate[key]!))
          .sort(),
      ),
    })
    const trackedQuarantineIds = new Set(snapshot.targetQuarantined.map(([scopeId]) => scopeId))
    const trackedFieldKeys = new Set(snapshot.targetFieldRevisions.map(([fieldKey]) => fieldKey))
    const trackedScopeIds = new Set<string>()
    const scopeMap = new Map(snapshot.options.scopeMap)
    if (snapshot.document.kind === 'scope' && snapshot.options.targetScopeId !== undefined)
      scopeMap.set(snapshot.document.scopeId, snapshot.options.targetScopeId)
    for (const [sourceScopeId] of snapshot.document.scopes)
      trackedScopeIds.add(scopeMap.get(sourceScopeId) ?? sourceScopeId)
    if (snapshot.options.targetScopeId !== undefined)
      trackedScopeIds.add(snapshot.options.targetScopeId)
    const overlayFingerprint = (overlay: ReturnType<typeof buildPicodashDocumentOverlay>) => ({
      values: Object.fromEntries(
        [...trackedFieldKeys].sort().map((key) => [key, overlay.values[key]] as const),
      ),
      scopes: overlay.scopes.filter(([scopeId]) => trackedScopeIds.has(scopeId)),
      changedFields: overlay.changedFields.filter((key) => trackedFieldKeys.has(key)),
      changedScopeIds: overlay.changedScopeIds.filter((scopeId) => trackedScopeIds.has(scopeId)),
      ignoredFields: overlay.ignoredFields,
      createdScopes: overlay.createdScopes.filter((scopeId) => trackedScopeIds.has(scopeId)),
      fieldRemaps: overlay.fieldRemaps,
      scopeRemaps: overlay.scopeRemaps.filter(([, targetId]) => trackedScopeIds.has(targetId)),
    })
    if (
      JSON.stringify(overlayFingerprint(currentOverlay)) !==
        JSON.stringify(overlayFingerprint(snapshot.overlay)) ||
      JSON.stringify(snapshot.targetQuarantined) !==
        JSON.stringify(
          [...trackedQuarantineIds]
            .map((scopeId) => [scopeId, quarantinedScopes.get(scopeId) ?? null] as const)
            .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
        )
    )
      return documentFailure('stale_plan', 'Import plan is stale.')
    const nextScopesEntries: [string, DurableScopeMetadata][] = []
    try {
      for (const [scopeId, metadata] of currentOverlay.scopes) {
        const decoded = decodeDurableScopeMetadata(metadata)
        if (decoded !== undefined) nextScopesEntries.push([scopeId, decoded])
      }
    } catch {
      return documentFailure('metadata')
    }
    const nextScopes = immutableMap(
      nextScopesEntries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    )
    const changedScopeSet = new Set(currentOverlay.changedScopeIds)
    const nextQuarantinedScopes = immutableMap(
      [...quarantinedScopes.entries()].filter(([scopeId]) => !changedScopeSet.has(scopeId)),
    )
    const nextValues: Record<string, unknown> = Object.create(null)
    for (const key of fieldEntries) {
      if (!picodashJsonEqual(values[key]!, currentOverlay.values[key]!))
        nextValues[key] = currentOverlay.values[key]!
    }
    return transactAttributed(nextValues, snapshot.receiverScopeId, 'import', {
      includeRoot: true,
      targetScopeIds: currentOverlay.changedScopeIds,
      nextScopes,
      nextQuarantinedScopes,
      validatedCandidate: currentOverlay.values,
      lockHeld: true,
    })
  }

  const executeDocumentImportPlan = (
    plan: PicodashImportPlan,
    expectedReceiverScopeId?: string,
  ): CoreTransactionResult =>
    withWriteLock(() => executeDocumentImportPlanLocked(plan, expectedReceiverScopeId))
  const storeImplementation: RootStore<Fields, StoreResult, boolean, boolean> = {
    kind: 'root',
    fields,
    diagnostics: diagnosticsRuntime.facade,
    scope: (scopeId) => getScoped(scopeId),
    getState: () => currentSnapshot,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new PicodashContractError('invalid-configuration')
      listeners.add(listener)
      let active = true
      return () => {
        if (!active) return
        active = false
        listeners.delete(listener)
      }
    },
    destroy(options) {
      destroyRootInternal(options)
    },
    setValue(field, value) {
      assertOwned(field)
      return transact({ [field.key]: value })
    },
    setValueOrThrow(field, value) {
      assertOwned(field)
      const result = transact({ [field.key]: value })
      if (!result.ok) throw result.error
      return result
    },
    resetValue(field) {
      assertOwned(field)
      return transactAttributed({ [field.key]: baseline[field.key]! }, undefined, 'reset', {
        canonicalSupplied: true,
      })
    },
    resetValueOrThrow(field) {
      const result = store.resetValue(field)
      if (!result.ok) throw result.error
      return result
    },
    resetRegisteredValues(options) {
      return withWriteLock(() => {
        const parsed = validateResetOptions(options, true)
        validateScopeId(parsed.scopeId)
        return resetRegisteredValuesInternal(parsed.scopeId, parsed.includeDescendants)
      })
    },
    resetRegisteredValuesOrThrow(options) {
      const result = store.resetRegisteredValues(options)
      if (!result.ok) throw result.error
      return result
    },
    setValues(next) {
      return transact(next as Record<string, unknown>)
    },
    setValuesOrThrow(next) {
      const result = transact(next as Record<string, unknown>)
      if (!result.ok) throw result.error
      return result
    },
    setInput: (binding, input) => setInputInternal(binding as object, input),
    discardInput: (binding) => discardInputInternal(binding as object),
    createStaleInputOverwritePlan: (binding) =>
      createStaleInputOverwritePlanInternal(binding as object),
    executeStaleInputOverwrite: (plan) => executeStaleInputOverwriteInternal(plan as object),
    executeRepair: (plan) => executeRepairInternal(plan),
    destroyScope(scopeId, options) {
      return destroyScopeInternal(scopeId, options)
    },
    setDashPanelLayout: (scopeId, layout) =>
      metadataCommand(scopeId, (previous) => ({
        ...previous,
        dashPanel: normalizeDashPanelLayoutRecord(layout),
      })),
    resetDashPanelLayout: (scopeId) =>
      metadataCommand(scopeId, (previous) => {
        if (!previous?.dashPanel) return previous
        return previous.dashList ? { dashList: previous.dashList } : undefined
      }),
    setDashListRootOrder: (scopeId, order) =>
      metadataCommand(scopeId, (previous) => {
        if (!validOrderArray(order)) throw new TypeError('Invalid Store metadata record.')
        const list = previous?.dashList
        const normalized = normalizeDashListMetadataRecord({
          ...(order.length ? { rootOrder: order } : {}),
          groupOrders: list?.groupOrders ?? new Map(),
          collapseOverrides: list?.collapseOverrides ?? new Map(),
        })
        return { ...previous, dashList: normalized }
      }),
    removeDashListRootOrder: (scopeId) =>
      metadataCommand(scopeId, (previous) => {
        const list = previous?.dashList
        if (!list?.rootOrder) return previous
        const normalized = normalizeDashListMetadataRecord({
          groupOrders: list.groupOrders,
          collapseOverrides: list.collapseOverrides,
        })
        return normalized.rootOrder === undefined &&
          !normalized.groupOrders.size &&
          !normalized.collapseOverrides.size
          ? previous?.dashPanel
            ? { dashPanel: previous.dashPanel }
            : undefined
          : { ...previous, dashList: normalized }
      }),
    setDashListGroupOrder: (scopeId, groupId, order) =>
      metadataCommand(scopeId, (previous) => {
        if (!validIdentity(groupId)) throw new TypeError('Invalid Store metadata record.')
        if (!validOrderArray(order)) throw new TypeError('Invalid Store metadata record.')
        const list = previous?.dashList
        const groups = new Map(list?.groupOrders ?? [])
        if (order.length) groups.set(groupId, order)
        else groups.delete(groupId)
        const normalized = normalizeDashListMetadataRecord({
          ...(list?.rootOrder === undefined ? {} : { rootOrder: list.rootOrder }),
          groupOrders: groups,
          collapseOverrides: list?.collapseOverrides ?? new Map(),
        })
        return { ...previous, dashList: normalized }
      }),
    removeDashListGroupOrder: (scopeId, groupId) =>
      metadataCommand(scopeId, (previous) => {
        if (!validIdentity(groupId)) throw new TypeError('Invalid Store metadata record.')
        const list = previous?.dashList
        if (!list?.groupOrders.has(groupId)) return previous
        const groups = new Map(list.groupOrders)
        groups.delete(groupId)
        const normalized = normalizeDashListMetadataRecord({
          ...(list.rootOrder === undefined ? {} : { rootOrder: list.rootOrder }),
          groupOrders: groups,
          collapseOverrides: list.collapseOverrides,
        })
        return { ...previous, dashList: normalized }
      }),
    setDashListCollapseOverride: (scopeId, nodeId, collapsed) =>
      metadataCommand(scopeId, (previous) => {
        if (!validIdentity(nodeId) || typeof collapsed !== 'boolean')
          throw new TypeError('Invalid Store metadata record.')
        const list = previous?.dashList
        const overrides = new Map(list?.collapseOverrides ?? [])
        overrides.set(nodeId, collapsed)
        const normalized = normalizeDashListMetadataRecord({
          ...(list?.rootOrder === undefined ? {} : { rootOrder: list.rootOrder }),
          groupOrders: list?.groupOrders ?? new Map(),
          collapseOverrides: overrides,
        })
        return { ...previous, dashList: normalized }
      }),
    removeDashListCollapseOverride: (scopeId, nodeId) =>
      metadataCommand(scopeId, (previous) => {
        if (!validIdentity(nodeId)) throw new TypeError('Invalid Store metadata record.')
        const list = previous?.dashList
        if (!list?.collapseOverrides.has(nodeId)) return previous
        const overrides = new Map(list.collapseOverrides)
        overrides.delete(nodeId)
        const normalized = normalizeDashListMetadataRecord({
          ...(list.rootOrder === undefined ? {} : { rootOrder: list.rootOrder }),
          groupOrders: list.groupOrders,
          collapseOverrides: overrides,
        })
        return { ...previous, dashList: normalized }
      }),
    resetDashListMetadata: (scopeId) =>
      metadataCommand(scopeId, (previous) =>
        previous?.dashPanel ? { dashPanel: previous.dashPanel } : undefined,
      ),
    createPrunePlan: ((options: RootDashListPruneOptions) =>
      createRootPrunePlanInternal(options)) as RootMetadataCommands<StoreResult>['createPrunePlan'],
    executePrunePlan: (plan) => executePrunePlanInternal(plan as object),
  }
  runtimeController = new RuntimeController(storeImplementation as object)
  const guardedDiagnosticsCapability = makeLifecycleFacade(
    diagnosticsRuntime.facade,
    runtimeController,
  )
  const guardedPersistenceCapability = persistenceController
    ? makeLifecycleFacade(persistenceController.capability, runtimeController)
    : undefined
  const guardedMetadataRecoveryCapability = metadataRecoveryEnabled
    ? makeLifecycleFacade(metadataRecoveryCapability, runtimeController)
    : undefined
  Object.defineProperty(storeImplementation, 'diagnostics', {
    value: guardedDiagnosticsCapability,
    enumerable: true,
    writable: false,
    configurable: false,
  })
  if (documentsEnabled) {
    const documents: Record<string, unknown> = {
      analyzeImport: (document: unknown, options?: unknown) => {
        assertRuntimeActive(runtimeController)
        return createDocumentImportPlan(undefined, document, options)
      },
      executeImport: (plan: PicodashImportPlan) => {
        assertRuntimeActive(runtimeController)
        return executeDocumentImportPlan(plan, undefined)
      },
    }
    if (configuredExportPolicy) {
      documents.createExportPlan = (options?: unknown) => {
        assertRuntimeActive(runtimeController)
        return createDocumentExportPlan(undefined, options)
      }
      documents.executeExport = (plan: PicodashExportPlan, options?: unknown) => {
        assertRuntimeActive(runtimeController)
        return executeDocumentExportPlan(plan, options, undefined)
      }
    }
    Object.defineProperty(storeImplementation, 'documents', {
      value: makeLifecycleFacade(Object.freeze(documents), runtimeController),
      enumerable: true,
      writable: false,
      configurable: false,
    })
  }
  if (persistenceController)
    Object.defineProperty(storeImplementation, 'persistence', {
      value: guardedPersistenceCapability,
      enumerable: true,
      writable: false,
      configurable: false,
    })
  if (metadataRecoveryEnabled)
    Object.defineProperty(storeImplementation, 'metadataRecovery', {
      value: guardedMetadataRecoveryCapability,
      enumerable: true,
      writable: false,
      configurable: false,
    })
  Object.freeze(storeImplementation)
  store = makeLifecycleFacade(storeImplementation, runtimeController)
  runtimeController.finalizeRoot(store as object)
  registerRuntimeController(store as object, runtimeController)
  runtimeController.setBindingInteractionCleanup(clearBindingInteraction)
  runtimeController.setLeaseMutationGuard(() => {
    if (writing) throw new PicodashContractError('reentrant-write')
  })
  runtimeController.setLeaseMutationRunner(withWriteLock)
  if (externalAdapterRuntime)
    runtimeController.registerResource({
      phase: 'capability',
      teardown: () => externalAdapterRuntime?.destroy(),
    })
  if (persistenceController)
    runtimeController.registerResource({
      phase: 'capability',
      hasUnpersistedState: () => persistenceController?.hasUnpersistedState() ?? false,
      teardown: (context) => persistenceController?.destroy(context.discardUnpersisted),
    })
  if (metadataRecoveryEnabled)
    runtimeController.registerResource({
      phase: 'capability',
      teardown: () => metadataRecoveryRuntime.teardown(),
    })
  diagnosticsRuntime.attachResource((resource) => runtimeController.registerResource(resource))
  runtimeController.registerResource({
    phase: 'kernel',
    teardown: () => {
      listeners.clear()
      interactionByScope.clear()
      channelsById.clear()
      activeChannels.clear()
      scopedRefs.clear()
      scopedInternals = new WeakMap<object, ScopedChannel>()
    },
  })

  function assertOwned(
    field: unknown,
  ): asserts field is PicodashField<ValuesOf<Fields>, keyof Fields & string> {
    if (!field || typeof field !== 'object') throw new PicodashContractError('foreign-handle')
    const key = (field as { key?: unknown }).key
    if (
      typeof key !== 'string' ||
      fieldOwners.get(field) !== owner ||
      !definitionMap.has(key) ||
      (fields as Record<string, unknown>)[key] !== field
    )
      throw new PicodashContractError('foreign-handle')
  }

  function transact(next: Record<string, unknown>): CoreTransactionResult {
    return transactAttributed(next)
  }

  type TransactionDispatchOptions = {
    readonly beforeDispatch?: () => void
    readonly canonicalSupplied?: boolean
    readonly includeRoot?: boolean
    readonly targetScopeIds?: readonly string[]
    readonly nextScopes?: ReadonlyMap<string, DurableScopeMetadata>
    readonly nextQuarantinedScopes?: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>
    readonly validatedCandidate?: Readonly<Record<string, PicodashJsonValue>>
    readonly lockHeld?: boolean
  }

  function withWriteLock<T>(operation: () => T): T {
    if (writing) throw new PicodashContractError('reentrant-write')
    writing = true
    try {
      return operation()
    } finally {
      writing = false
    }
  }

  function persistCurrent(): 'unchanged' | 'saved' | 'pending' | undefined {
    return persistenceController?.persist(values, scopes, quarantinedScopes)
  }

  function applyPersistenceResolution(
    nextValues: Readonly<Record<string, PicodashJsonValue>>,
    nextScopes: ReadonlyMap<string, DurableScopeMetadata>,
    nextQuarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>,
  ): Readonly<{
    readonly changedFields: readonly string[]
    readonly changedScopeIds: readonly string[]
  }> {
    const changedFields =
      config.valueOwner === 'external'
        ? []
        : fieldEntries.filter((key) => !picodashJsonEqual(values[key]!, nextValues[key]!)).sort()
    const scopeIds = new Set([
      ...scopes.keys(),
      ...nextScopes.keys(),
      ...quarantinedScopes.keys(),
      ...nextQuarantinedScopes.keys(),
    ])
    const changedScopeIds = [...scopeIds]
      .filter((scopeId) => {
        const before = scopes.get(scopeId)
        const after = nextScopes.get(scopeId)
        const beforeQuarantine = quarantinedScopes.get(scopeId)
        const afterQuarantine = nextQuarantinedScopes.get(scopeId)
        return (
          JSON.stringify(encodeDurableScopeMetadata(before)) !==
            JSON.stringify(encodeDurableScopeMetadata(after)) ||
          JSON.stringify(beforeQuarantine?.raw) !== JSON.stringify(afterQuarantine?.raw)
        )
      })
      .sort()
    if (!changedFields.length && !changedScopeIds.length)
      return Object.freeze({
        changedFields: Object.freeze([]),
        changedScopeIds: Object.freeze([]),
      })
    if (config.valueOwner === 'store')
      values = freeze(nextValues) as Readonly<Record<string, PicodashJsonValue>>
    scopes = nextScopes
    const previousQuarantinedScopes = quarantinedScopes
    quarantinedScopes = nextQuarantinedScopes
    for (const key of changedFields) fieldRevisions.set(key, (fieldRevisions.get(key) ?? 0) + 1)
    markDirtyBindingsStale(changedFields)
    currentSnapshot = freeze({ values, scopes }) as RootSnapshot<ValuesOf<Fields>>
    const affectedChannels = collectScopedChannels()
    refreshScopedChannels(affectedChannels)
    publishQuarantineTransition(previousQuarantinedScopes, quarantinedScopes)
    dispatchStoreSubscribers(affectedChannels)
    return Object.freeze({
      changedFields: Object.freeze(changedFields),
      changedScopeIds: Object.freeze(changedScopeIds),
    })
  }

  const persistenceOptionError = (
    code: 'invalid-persistence-conflict-options' | 'invalid-persistence-erase-options',
    reason: string,
  ): never => {
    throw new PicodashContractError(code, { reason })
  }

  const exactDataRecord = (
    input: unknown,
    allowedKeys: readonly string[],
  ): {
    readonly record?: Record<string, unknown>
    readonly reason?: 'not-object' | 'unknown-key' | 'accessor-property'
  } => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { reason: 'not-object' }
    try {
      const descriptors = Object.getOwnPropertyDescriptors(input)
      const record: Record<string, unknown> = Object.create(null)
      for (const key of Reflect.ownKeys(descriptors)) {
        if (typeof key !== 'string' || !allowedKeys.includes(key)) return { reason: 'unknown-key' }
      }
      for (const key of Reflect.ownKeys(descriptors)) {
        const descriptor = descriptors[key as string]!
        if (!descriptor.enumerable) return { reason: 'unknown-key' }
        if (!('value' in descriptor)) return { reason: 'accessor-property' }
        record[key as string] = descriptor.value
      }
      return { record }
    } catch {
      return { reason: 'not-object' }
    }
  }

  function parsePersistenceConflictOptions(input: unknown): PersistenceConflictResolutionOptions {
    const checked = exactDataRecord(input, ['mode', 'onOverlap'])
    if (!checked.record)
      persistenceOptionError('invalid-persistence-conflict-options', checked.reason!)
    const validRecord = checked.record as Record<string, unknown>
    const keys = Object.keys(validRecord)
    const mode = validRecord.mode
    if (mode !== 'reload' && mode !== 'overwrite' && mode !== 'reconcile')
      persistenceOptionError('invalid-persistence-conflict-options', 'invalid-mode')
    if (mode === 'reconcile') {
      if (keys.some((key) => key !== 'mode' && key !== 'onOverlap'))
        persistenceOptionError('invalid-persistence-conflict-options', 'unknown-key')
      if (
        keys.length !== 2 ||
        (validRecord.onOverlap !== 'local' && validRecord.onOverlap !== 'durable')
      )
        persistenceOptionError('invalid-persistence-conflict-options', 'invalid-overlap')
      return { mode, onOverlap: validRecord.onOverlap as 'local' | 'durable' }
    }
    if (keys.some((key) => key !== 'mode') || keys.length !== 1)
      persistenceOptionError('invalid-persistence-conflict-options', 'unknown-key')
    return { mode: mode as 'reload' | 'overwrite' }
  }

  function parseEraseConfirmation(input: unknown): { readonly confirm: true } {
    const checked = exactDataRecord(input, ['confirm'])
    if (!checked.record)
      persistenceOptionError('invalid-persistence-erase-options', checked.reason!)
    const validRecord = checked.record as Record<string, unknown>
    const keys = Object.keys(validRecord)
    if (keys.some((key) => key !== 'confirm'))
      persistenceOptionError('invalid-persistence-erase-options', 'unknown-key')
    if (keys.length !== 1 || validRecord.confirm !== true)
      persistenceOptionError('invalid-persistence-erase-options', 'confirmation-required')
    return { confirm: true }
  }

  function createPersistenceConflictResolutionPlanPublic(
    input: PersistenceConflictResolutionOptions,
  ): PicodashPersistenceConflictResolutionPlan {
    return withWriteLock(() => {
      const parsed = parsePersistenceConflictOptions(input)
      let snapshot
      try {
        snapshot = persistenceController!.createConflictResolutionSnapshot(parsed)
      } catch {
        throw new PicodashContractError('invalid-persistence-conflict-resolution', {
          reason: 'not-conflicted',
        })
      }
      const plan = Object.freeze({
        kind: 'persistence-conflict-resolution-plan' as const,
        mode: parsed.mode,
      }) as PicodashPersistenceConflictResolutionPlan
      registerPersistencePlan(plan as object, {
        root: store as object,
        kind: 'conflict-resolution',
        snapshot: snapshot as object,
        consumed: false,
      })
      return plan
    })
  }

  function invalidPersistencePlan(reason: 'wrong-kind' | 'foreign-root' | 'consumed'): never {
    throw new PicodashContractError('invalid-persistence-plan', {
      kind: 'conflict-resolution',
      reason,
    })
  }

  function executePersistenceConflictResolutionPublic(
    plan: PicodashPersistenceConflictResolutionPlan,
  ): PersistentTransactionResult {
    if (writing) throw new PicodashContractError('reentrant-write')
    const record =
      plan && typeof plan === 'object' ? persistencePlanRecord(plan as object) : undefined
    if (!record) invalidPersistencePlan('wrong-kind')
    if (record.kind !== 'conflict-resolution') invalidPersistencePlan('wrong-kind')
    if (record.root !== (store as object)) invalidPersistencePlan('foreign-root')
    if (record.consumed) invalidPersistencePlan('consumed')
    record.consumed = true
    const outcome = persistenceController!.executeConflictResolution(record.snapshot as never)
    if (!outcome.ok)
      return rejectedResult([
        Object.freeze({
          code:
            outcome.reason === 'stale'
              ? ('stale_plan' as const)
              : ('persistence_resolution_failed' as const),
          path: freezePath([]),
          message:
            outcome.reason === 'stale'
              ? 'Persistence plan is stale.'
              : 'Persistence conflict resolution failed.',
        }),
      ]) as PersistentTransactionResult
    return Object.freeze({
      ok: true as const,
      changedFields: outcome.changedFields,
      changedScopeIds: outcome.changedScopeIds,
      persistence: outcome.persistence,
    })
  }

  function createPersistenceErasePlanPublic(): PicodashPersistenceErasePlan {
    return withWriteLock(() => {
      const snapshot = persistenceController!.createEraseSnapshot()
      const plan = Object.freeze({
        kind: 'persistence-erase-plan' as const,
        hasDurableEnvelope: snapshot.hasDurableEnvelope,
        discardsPendingEnvelope: snapshot.discardsPendingEnvelope,
      }) as PicodashPersistenceErasePlan
      registerPersistencePlan(plan as object, {
        root: store as object,
        kind: 'erase',
        snapshot: snapshot as object,
        consumed: false,
      })
      return plan
    })
  }

  function executePersistenceErasePublic(
    plan: PicodashPersistenceErasePlan,
    input: { readonly confirm: true },
  ): PersistenceEraseResult {
    return withWriteLock(() => {
      parseEraseConfirmation(input)
      const record =
        plan && typeof plan === 'object' ? persistencePlanRecord(plan as object) : undefined
      if (!record)
        throw new PicodashContractError('invalid-persistence-plan', {
          kind: 'erase',
          reason: 'wrong-kind',
        })
      if (record.kind !== 'erase')
        throw new PicodashContractError('invalid-persistence-plan', {
          kind: 'erase',
          reason: 'wrong-kind',
        })
      if (record.root !== (store as object))
        throw new PicodashContractError('invalid-persistence-plan', {
          kind: 'erase',
          reason: 'foreign-root',
        })
      if (record.consumed)
        throw new PicodashContractError('invalid-persistence-plan', {
          kind: 'erase',
          reason: 'consumed',
        })
      record.consumed = true
      const outcome = persistenceController!.executeErase(record.snapshot as never)
      if (!outcome.ok)
        return {
          ok: false,
          error: new PicodashTransactionError([
            Object.freeze({
              code:
                outcome.reason === 'stale'
                  ? ('stale_plan' as const)
                  : ('persistence_erase_failed' as const),
              path: freezePath([]),
              message:
                outcome.reason === 'stale'
                  ? 'Persistence plan is stale.'
                  : 'Persistence erase failed.',
            }),
          ]),
        }
      return outcome
    })
  }

  function resultWithPersistence(result: CoreTransactionResult): CoreTransactionResult {
    if (!result.ok || !persistenceController) return result
    if (config.valueOwner === 'external' && result.changedScopeIds.length === 0)
      return Object.freeze({ ...result, persistence: 'unchanged' as const })
    return Object.freeze({ ...result, persistence: persistCurrent()! }) as CoreTransactionResult
  }

  function transactAttributed(
    next: Record<string, unknown>,
    originScopeId?: string,
    source: 'programmatic' | 'interactive' | 'repair' | 'reset' | 'import' = 'programmatic',
    options?: TransactionDispatchOptions,
  ): CoreTransactionResult {
    const ownsWriteLock = options?.lockHeld !== true
    if (writing && ownsWriteLock) throw new PicodashContractError('reentrant-write')
    if (!next || typeof next !== 'object' || Array.isArray(next))
      return rejectedResult([
        Object.freeze({
          code: 'invalid_json',
          path: freezePath([]),
          message: 'Values must be a record.',
        }),
      ])
    const keys = Object.keys(next)
    if (!keys.length && options?.nextScopes === undefined)
      return resultWithPersistence(successfulResult())
    if (ownsWriteLock) writing = true
    try {
      const built = options?.validatedCandidate
        ? {
            candidate: options.validatedCandidate,
            issues: freeze([]) as readonly TransactionIssue[],
          }
        : options?.canonicalSupplied
          ? buildCanonicalCandidate(
              values as Record<string, PicodashJsonValue>,
              next,
              source,
              originScopeId,
            )
          : buildCandidate(values as Record<string, PicodashJsonValue>, next, source, originScopeId)
      if (built.issues.length) return rejectedResult(built.issues)
      const changedFields = fieldEntries
        .filter((key) => !picodashJsonEqual(values[key]!, built.candidate[key]!))
        .sort()
      const nextScopes = options?.nextScopes ?? scopes
      const nextQuarantinedScopes = options?.nextQuarantinedScopes ?? quarantinedScopes
      const changedScopeIds = [...new Set([...scopes.keys(), ...nextScopes.keys()])].filter(
        (scopeId) => {
          const before = encodeDurableScopeMetadata(scopes.get(scopeId))
          const after = encodeDurableScopeMetadata(nextScopes.get(scopeId))
          return !picodashJsonEqual(
            (before ?? null) as PicodashJsonValue,
            (after ?? null) as PicodashJsonValue,
          )
        },
      )
      const changedQuarantineIds = [
        ...new Set([...quarantinedScopes.keys(), ...nextQuarantinedScopes.keys()]),
      ].filter((scopeId) => {
        const before = quarantinedScopes.get(scopeId)?.raw
        const after = nextQuarantinedScopes.get(scopeId)?.raw
        return !picodashJsonEqual(
          (before ?? null) as PicodashJsonValue,
          (after ?? null) as PicodashJsonValue,
        )
      })
      for (const scopeId of changedQuarantineIds)
        if (!changedScopeIds.includes(scopeId)) changedScopeIds.push(scopeId)
      changedScopeIds.sort()
      if (!changedFields.length && !changedScopeIds.length) {
        if (options?.beforeDispatch) {
          options.beforeDispatch()
          const affectedChannels =
            originScopeId === undefined
              ? new Set<ScopedChannel>()
              : collectScopedChannels(originScopeId)
          refreshScopedChannels(affectedChannels)
          dispatchStoreSubscribers(affectedChannels, options.includeRoot ?? false)
        }
        return resultWithPersistence(successfulResult())
      }
      if (externalAdapterRuntime?.isUnhealthy() && changedFields.length)
        return rejectedResult([adapterUnhealthyIssue(originScopeId)])
      if (externalAdapterRuntime && changedFields.length) {
        adapterEchoValues = built.candidate
        const context: AdapterWriteContext = Object.freeze({
          source,
          ...(originScopeId === undefined ? {} : { originScopeId }),
          targetScopeIds: Object.freeze(
            options?.targetScopeIds !== undefined
              ? [...options.targetScopeIds]
              : source === 'programmatic' || originScopeId === undefined
                ? []
                : [originScopeId],
          ),
          changedFields: Object.freeze([...changedFields]),
        })
        let failure
        try {
          failure = externalAdapterRuntime.writeValues(
            freeze(built.candidate) as Readonly<ValuesOf<Fields>>,
            context,
          )
        } finally {
          adapterEchoValues = undefined
        }
        if (failure !== undefined)
          return rejectedResult([adapterWriteFailedIssue(failure, originScopeId)])
      }
      values = freeze(built.candidate) as Readonly<Record<string, PicodashJsonValue>>
      scopes = nextScopes
      const previousQuarantinedScopes = quarantinedScopes
      quarantinedScopes = nextQuarantinedScopes
      for (const key of changedFields) fieldRevisions.set(key, (fieldRevisions.get(key) ?? 0) + 1)
      markDirtyBindingsStale(changedFields)
      options?.beforeDispatch?.()
      currentSnapshot = freeze({ values, scopes }) as RootSnapshot<ValuesOf<Fields>>
      const affectedChannels = collectScopedChannels()
      refreshScopedChannels(affectedChannels)
      publishQuarantineTransition(previousQuarantinedScopes, quarantinedScopes)
      const result = resultWithPersistence(successfulResult(changedFields, changedScopeIds))
      dispatchStoreSubscribers(affectedChannels, options?.includeRoot)
      return result
    } finally {
      if (ownsWriteLock) writing = false
    }
  }

  function resetRegisteredValuesInternal(
    scopeId: string,
    includeDescendants: boolean,
    originScopeId?: string,
  ): CoreTransactionResult {
    validateScopeId(scopeId)
    const controller = runtimeControllerFor(store as object)
    const targetScopeIds = new Set<string>([scopeId])
    if (includeDescendants)
      for (const descendant of controller?.descendants(scopeId) ?? [])
        targetScopeIds.add(descendant)
    const sortedTargetScopeIds = [...targetScopeIds].sort()
    const selectedFields = new Set<string>()
    for (const target of sortedTargetScopeIds) {
      const byItem = controller?.bindings.get(target)
      if (!byItem) continue
      for (const byAlias of byItem.values()) {
        for (const binding of byAlias.values()) {
          if (!binding.active) continue
          const fieldKey = (binding.field as { readonly key?: unknown }).key
          if (typeof fieldKey === 'string' && definitionMap.has(fieldKey))
            selectedFields.add(fieldKey)
        }
      }
    }
    const supplied = Object.create(null) as Record<string, unknown>
    for (const fieldKey of [...selectedFields].sort()) supplied[fieldKey] = baseline[fieldKey]!
    return transactAttributed(supplied, originScopeId, 'reset', {
      canonicalSupplied: true,
      targetScopeIds: Object.freeze(sortedTargetScopeIds),
      lockHeld: true,
    })
  }

  function bindingRecordFor(handle: object): import('../runtime-controller.js').BindingRecord {
    const controller = runtimeControllerFor(store as object)
    const owner = runtimeControllerForHandle(handle)
    if (!controller)
      throw new PicodashContractError('invalid-binding-handle', { reason: 'wrong-kind' })
    if (owner && owner !== controller)
      throw new PicodashContractError('invalid-binding-handle', { reason: 'foreign-root' })
    const record = controller.bindingHandles.get(handle)
    if (!record) throw new PicodashContractError('invalid-binding-handle', { reason: 'wrong-kind' })
    if (!record.active) {
      const current = controller.activeBinding(record.scopeId, record.itemId, record.alias)
      throw new PicodashContractError('invalid-binding-handle', {
        reason: current ? 'superseded' : 'released',
      })
    }
    return record
  }

  const interactionIssues = (
    issues: readonly TransactionIssue[],
    record: import('../runtime-controller.js').BindingRecord,
  ): readonly TransactionIssue[] => {
    const bindingFieldKey =
      record.field && typeof record.field === 'object'
        ? (record.field as { key: string }).key
        : undefined
    return Object.freeze(
      issues.map((issue) => {
        const structuralFieldKey =
          issue.fieldKey ??
          (issue.path[0] === 'values' && typeof issue.path[1] === 'string'
            ? issue.path[1]
            : undefined)
        const belongsToBinding =
          issue.alias === record.alias ||
          (issue.alias === undefined && structuralFieldKey === bindingFieldKey)
        return Object.freeze({
          ...issue,
          ...(issue.fieldKey === undefined && structuralFieldKey !== undefined
            ? { fieldKey: structuralFieldKey }
            : {}),
          ...(belongsToBinding
            ? { scopeId: record.scopeId, itemId: record.itemId, alias: record.alias }
            : {}),
        })
      }),
    )
  }

  function setInteraction(
    record: import('../runtime-controller.js').BindingRecord,
    state: BindingInteractionState | undefined,
  ): BindingInteractionState | undefined {
    const previous = interactionByScope.get(record.scopeId)
    const bindings = new Map(previous?.bindings ?? [])
    const items = new Map(previous?.items ?? [])
    const itemBindings = new Map(bindings.get(record.itemId) ?? [])
    let stored: BindingInteractionState | undefined
    if (state) {
      const source = state as BindingInteractionState & {
        baseRevision?: number
        baseValue?: PicodashJsonValue
      }
      const visible: BindingInteractionState = {
        fieldKey: source.fieldKey,
        ...(source.draft === undefined ? {} : { draft: source.draft }),
        touched: source.touched,
        inputIssues: source.inputIssues,
        ...(source.conflict ? { conflict: source.conflict } : {}),
      }
      const frozen = Object.freeze(visible)
      stored = frozen
      if (source.baseRevision !== undefined && source.baseValue !== undefined)
        interactionBases.set(frozen, {
          baseRevision: source.baseRevision,
          baseValue: source.baseValue,
        })
      itemBindings.set(record.alias, frozen)
    } else itemBindings.delete(record.alias)
    if (itemBindings.size) bindings.set(record.itemId, immutableMap([...itemBindings]))
    else {
      bindings.delete(record.itemId)
      items.delete(record.itemId)
    }
    const next =
      bindings.size || items.size
        ? Object.freeze({ bindings: immutableMap([...bindings]), items: immutableMap([...items]) })
        : EmptyInteraction
    if (next === previous) return stored
    if (next === EmptyInteraction) interactionByScope.delete(record.scopeId)
    else interactionByScope.set(record.scopeId, next)
    if (!suppressInteractionDispatch) {
      const affected = collectScopedChannels(record.scopeId)
      refreshScopedChannels(affected)
      dispatchStoreSubscribers(affected, false)
    }
    return stored
  }

  const interactionBase = (state: BindingInteractionState | undefined) =>
    state ? interactionBases.get(state as object) : undefined

  function markDirtyBindingsStale(changedFields: readonly string[]): void {
    const changed = new Set(changedFields)
    for (const [scopeId, interaction] of interactionByScope) {
      let nextInteraction: ScopeInteractionState | undefined
      const bindings = new Map(interaction.bindings)
      for (const [itemId, aliases] of interaction.bindings) {
        const nextAliases = new Map(aliases)
        for (const [alias, state] of aliases) {
          if (state.draft === undefined || !changed.has(state.fieldKey) || state.conflict) continue
          nextAliases.set(
            alias,
            Object.freeze({
              ...state,
              conflict: Object.freeze({
                kind: 'stale-draft' as const,
                baseRevision:
                  interactionBase(state)?.baseRevision ??
                  Math.max(0, (fieldRevisions.get(state.fieldKey) ?? 1) - 1),
                baseValue: interactionBase(state)?.baseValue ?? values[state.fieldKey]!,
              }),
            }),
          )
          nextInteraction = interaction
        }
        if (nextAliases.size) bindings.set(itemId, immutableMap([...nextAliases]))
      }
      if (nextInteraction)
        interactionByScope.set(
          scopeId,
          Object.freeze({ bindings: immutableMap([...bindings]), items: interaction.items }),
        )
    }
  }

  function setInputInternalLocked(handle: object, input: PicodashJsonValue): CoreTransactionResult {
    const binding = bindingRecordFor(handle)
    if (binding.mode !== 'input')
      throw new PicodashContractError('invalid-binding-handle', { reason: 'wrong-kind' })
    let draft: PicodashJsonValue
    try {
      draft = clonePicodashValue(input)
    } catch {
      return rejectedResult([
        Object.freeze({
          code: 'invalid_json',
          path: freezePath(['values', (binding.field as { key: string }).key]),
          message: 'Binding input must be JSON-compatible.',
          fieldKey: (binding.field as { key: string }).key,
          scopeId: binding.scopeId,
          itemId: binding.itemId,
          alias: binding.alias,
        }),
      ])
    }
    const fieldKey = (binding.field as { key: string }).key
    const previous = interactionByScope
      .get(binding.scopeId)
      ?.bindings.get(binding.itemId)
      ?.get(binding.alias)
    const baseRevision = previous
      ? (interactionBase(previous)?.baseRevision ?? fieldRevisions.get(fieldKey)!)
      : fieldRevisions.get(fieldKey)!
    const baseValue = previous
      ? (interactionBase(previous)?.baseValue ?? values[fieldKey]!)
      : values[fieldKey]!
    const stale = !!previous?.conflict
    const definition = definitionMap.get(fieldKey)!
    const pipeline: TransactionIssue[] = []
    let candidateRaw: unknown = draft
    let repairCandidate: PicodashJsonValue | undefined
    let parseFailed = false
    if (definition.parse) {
      let parsed: PicodashParseResult<unknown>
      try {
        parsed = definition.parse(draft) as PicodashParseResult<unknown>
      } catch {
        parsed = { ok: false, issues: [{ message: 'Input parsing failed.' }] }
      }
      if (!parsed.ok) {
        parseFailed = true
        pipeline.push(
          ...parsed.issues.map((issue) =>
            Object.freeze({
              code: 'parse_failed' as const,
              path: freezePath(['values', fieldKey, ...(issue.path ?? [])]),
              message: issue.message,
              fieldKey,
            }),
          ),
        )
        repairCandidate = parsed.repair as PicodashJsonValue | undefined
      } else candidateRaw = parsed.candidate
    }
    const normalized = parseFailed
      ? { value: undefined, issues: freeze([]) as readonly TransactionIssue[] }
      : canonicalize(fieldKey, candidateRaw, 'interactive')
    if (!parseFailed) pipeline.push(...normalized.issues)
    const candidate = Object.create(null) as Record<string, PicodashJsonValue>
    for (const key of fieldEntries) candidate[key] = values[key]!
    if (!parseFailed && !normalized.issues.length) {
      candidate[fieldKey] = normalized.value!
      pipeline.push(
        ...runFieldValidators(candidate, 'interactive', binding.scopeId),
        ...runRootValidator(candidate, 'interactive', binding.scopeId),
      )
    }
    const enriched = interactionIssues(pipeline, binding)
    if (stale) {
      const staleIssue = Object.freeze({
        code: 'stale_input' as const,
        reason: 'canonical_changed' as const,
        message: 'Binding input is stale and requires explicit overwrite confirmation.',
        path: freezePath(['values', fieldKey]),
        fieldKey,
        scopeId: binding.scopeId,
        itemId: binding.itemId,
        alias: binding.alias,
      })
      setInteraction(binding, {
        fieldKey,
        draft,
        touched: true,
        inputIssues: enriched,
        conflict: previous!.conflict,
        baseRevision,
        baseValue,
      } as BindingInteractionState)
      return rejectedResult([...enriched, staleIssue])
    }
    if (pipeline.length) {
      let plan: PicodashRepairPlan | undefined
      let repairRegistration:
        | Readonly<{
            plan: PicodashRepairPlan
            registry: BindingPlanRegistryRecord
            candidate: PicodashJsonValue
          }>
        | undefined
      if (repairCandidate !== undefined && !stale) {
        const repair = canonicalize(fieldKey, repairCandidate, 'repair')
        const repairCandidateRecord = Object.create(null) as Record<string, PicodashJsonValue>
        for (const key of fieldEntries) repairCandidateRecord[key] = values[key]!
        if (!repair.issues.length) {
          repairCandidateRecord[fieldKey] = repair.value!
          const repairIssues = [
            ...runFieldValidators(repairCandidateRecord, 'repair', binding.scopeId),
            ...runRootValidator(repairCandidateRecord, 'repair', binding.scopeId),
          ]
          if (!repairIssues.length) {
            plan = Object.freeze({}) as PicodashRepairPlan
            const registry: BindingPlanRegistryRecord = {
              root: store as object,
              kind: 'repair',
              consumed: false,
            }
            repairRegistration = { plan, registry, candidate: repair.value! }
          }
        }
      }
      const interaction = setInteraction(binding, {
        fieldKey,
        draft,
        touched: true,
        inputIssues: enriched,
        ...(previous?.conflict ? { conflict: previous.conflict } : {}),
        baseRevision,
        baseValue,
      } as BindingInteractionState & { baseRevision: number; baseValue: PicodashJsonValue })
      if (repairRegistration) {
        const { plan: repairPlan, registry, candidate: repairValue } = repairRegistration
        const record: RepairRecord = {
          binding: handle,
          interaction: interaction!,
          fieldKey,
          scopeId: binding.scopeId,
          itemId: binding.itemId,
          alias: binding.alias,
          revision: fieldRevisions.get(fieldKey)!,
          baseValue,
          draft,
          candidate: repairValue,
          targetValues: values as Readonly<Record<string, PicodashJsonValue>>,
          consumed: false,
          registry,
        }
        repairPlans.set(repairPlan, record)
        registerBindingPlan(repairPlan, registry)
      }
      return rejectedResult(enriched, plan)
    }
    if (picodashJsonEqual(values[fieldKey]!, candidate[fieldKey]!)) {
      if (previous) {
        suppressInteractionDispatch = true
        try {
          setInteraction(binding, undefined)
        } finally {
          suppressInteractionDispatch = false
        }
        const affected = collectScopedChannels(binding.scopeId)
        refreshScopedChannels(affected)
        dispatchStoreSubscribers(affected, false)
      }
      return resultWithPersistence(successfulResult())
    }
    const result = transactAttributed(
      { [fieldKey]: candidate[fieldKey] },
      binding.scopeId,
      'interactive',
      {
        beforeDispatch: () => {
          suppressInteractionDispatch = true
          try {
            setInteraction(binding, undefined)
          } finally {
            suppressInteractionDispatch = false
          }
        },
        validatedCandidate: candidate,
        lockHeld: true,
      },
    )
    if (!result.ok)
      setInteraction(binding, {
        fieldKey,
        draft,
        touched: true,
        inputIssues: Object.freeze([]),
        ...(previous?.conflict ? { conflict: previous.conflict } : {}),
        baseRevision,
        baseValue,
      } as BindingInteractionState)
    return result
  }

  function setInputInternal(handle: object, input: PicodashJsonValue): CoreTransactionResult {
    return withWriteLock(() => setInputInternalLocked(handle, input))
  }

  function discardInputInternalLocked(handle: object): boolean {
    const record = bindingRecordFor(handle)
    if (record.mode !== 'input')
      throw new PicodashContractError('invalid-binding-handle', { reason: 'wrong-kind' })
    const existing = interactionByScope
      .get(record.scopeId)
      ?.bindings.get(record.itemId)
      ?.get(record.alias)
    if (!existing) return false
    setInteraction(record, undefined)
    return true
  }

  function discardInputInternal(handle: object): boolean {
    return withWriteLock(() => discardInputInternalLocked(handle))
  }

  function createStaleInputOverwritePlanInternal(handle: object): PicodashStaleInputOverwritePlan {
    const record = bindingRecordFor(handle)
    if (record.mode !== 'input')
      throw new PicodashContractError('invalid-binding-handle', { reason: 'wrong-kind' })
    const state = interactionByScope
      .get(record.scopeId)
      ?.bindings.get(record.itemId)
      ?.get(record.alias)
    if (!state?.conflict)
      throw new PicodashContractError('invalid-stale-input-overwrite', { reason: 'not-stale' })
    if (state.draft === undefined || state.inputIssues.length)
      throw new PicodashContractError('invalid-stale-input-overwrite', { reason: 'invalid-draft' })
    const fieldKey = (record.field as { key: string }).key
    const plan = Object.freeze({}) as PicodashStaleInputOverwritePlan
    const registry: BindingPlanRegistryRecord = {
      root: store as object,
      kind: 'stale-input-overwrite',
      consumed: false,
    }
    const planRecord: StaleOverwriteRecord = {
      binding: handle,
      interaction: state,
      fieldKey,
      scopeId: record.scopeId,
      itemId: record.itemId,
      alias: record.alias,
      revision: fieldRevisions.get(fieldKey)!,
      targetValue: values[fieldKey]!,
      draft: clonePicodashValue(state.draft),
      consumed: false,
      registry,
    }
    staleOverwritePlans.set(plan, planRecord)
    registerBindingPlan(plan, registry)
    return plan
  }

  function executeStaleInputOverwriteInternalLocked(plan: object): CoreTransactionResult {
    const registry = bindingPlanRecord(plan)
    if (!registry)
      throw new PicodashContractError('invalid-binding-plan', {
        kind: 'stale-input-overwrite',
        reason: 'wrong-kind',
      })
    if (registry.root !== (store as object))
      throw new PicodashContractError('invalid-binding-plan', {
        kind: registry.kind,
        reason: 'foreign-root',
      })
    if (registry.kind !== 'stale-input-overwrite')
      throw new PicodashContractError('invalid-binding-plan', {
        kind: 'stale-input-overwrite',
        reason: 'wrong-kind',
      })
    const record = staleOverwritePlans.get(plan)
    if (!record)
      throw new PicodashContractError('invalid-binding-plan', {
        kind: 'stale-input-overwrite',
        reason: 'wrong-kind',
      })
    if (registry.consumed || record.consumed)
      throw new PicodashContractError('invalid-binding-plan', {
        kind: 'stale-input-overwrite',
        reason: 'consumed',
      })
    const controller = runtimeControllerFor(store as object)
    const activeBinding = controller?.activeBinding(record.scopeId, record.itemId, record.alias)
    if (!activeBinding || activeBinding.lease !== record.binding)
      throw new PicodashContractError('invalid-binding-plan', {
        kind: 'stale-input-overwrite',
        reason: 'released',
      })
    registry.consumed = true
    record.consumed = true
    const current = interactionByScope
      .get(record.scopeId)
      ?.bindings.get(record.itemId)
      ?.get(record.alias)
    if (
      !current?.conflict ||
      current !== record.interaction ||
      !picodashJsonEqual(current.draft!, record.draft) ||
      (fieldRevisions.get(record.fieldKey) ?? 0) !== record.revision ||
      !picodashJsonEqual(values[record.fieldKey]!, record.targetValue)
    )
      return rejectedResult([
        Object.freeze({
          code: 'stale_plan',
          path: freezePath([]),
          message: 'Stale overwrite plan is stale.',
        }),
      ])
    const definition = definitionMap.get(record.fieldKey)!
    let candidateRaw: unknown = record.draft
    const pipeline: TransactionIssue[] = []
    if (definition.parse) {
      let parsed: PicodashParseResult<unknown>
      try {
        parsed = definition.parse(record.draft) as PicodashParseResult<unknown>
      } catch {
        parsed = { ok: false, issues: [{ message: 'Input parsing failed.' }] }
      }
      if (!parsed.ok)
        pipeline.push(
          ...parsed.issues.map((issue) =>
            Object.freeze({
              code: 'parse_failed' as const,
              path: freezePath(['values', record.fieldKey, ...(issue.path ?? [])]),
              message: issue.message,
              fieldKey: record.fieldKey,
              scopeId: record.scopeId,
              itemId: record.itemId,
              alias: record.alias,
            }),
          ),
        )
      else candidateRaw = parsed.candidate
    }
    const normalized = pipeline.length
      ? { value: undefined, issues: freeze([]) as readonly TransactionIssue[] }
      : canonicalize(record.fieldKey, candidateRaw, 'interactive')
    if (!pipeline.length) pipeline.push(...normalized.issues)
    const candidate = Object.create(null) as Record<string, PicodashJsonValue>
    for (const key of fieldEntries) candidate[key] = values[key]!
    if (!pipeline.length) {
      candidate[record.fieldKey] = normalized.value!
      pipeline.push(
        ...runFieldValidators(candidate, 'interactive', record.scopeId),
        ...runRootValidator(candidate, 'interactive', record.scopeId),
      )
    }
    if (pipeline.length) {
      setInteraction(activeBinding, {
        fieldKey: record.fieldKey,
        draft: record.draft,
        touched: true,
        inputIssues: interactionIssues(pipeline, activeBinding),
        conflict: current.conflict,
        baseRevision: current.conflict.baseRevision,
        baseValue: current.conflict.baseValue,
      } as BindingInteractionState & { baseRevision: number; baseValue: PicodashJsonValue })
      return rejectedResult(interactionIssues(pipeline, activeBinding))
    }
    return transactAttributed(
      { [record.fieldKey]: candidate[record.fieldKey] },
      record.scopeId,
      'interactive',
      {
        beforeDispatch: () => {
          suppressInteractionDispatch = true
          try {
            setInteraction(activeBinding, undefined)
          } finally {
            suppressInteractionDispatch = false
          }
        },
        validatedCandidate: candidate,
        lockHeld: true,
      },
    )
  }

  function executeStaleInputOverwriteInternal(plan: object): CoreTransactionResult {
    return withWriteLock(() => executeStaleInputOverwriteInternalLocked(plan))
  }

  function executeRepairInternal(plan: object): CoreTransactionResult {
    if (writing) throw new PicodashContractError('reentrant-write')
    const registry = bindingPlanRecord(plan)
    if (!registry)
      throw new PicodashContractError('invalid-binding-plan', {
        kind: 'repair',
        reason: 'wrong-kind',
      })
    if (registry.root !== (store as object))
      throw new PicodashContractError('invalid-binding-plan', {
        kind: registry.kind,
        reason: 'foreign-root',
      })
    if (registry.kind !== 'repair')
      throw new PicodashContractError('invalid-binding-plan', {
        kind: 'repair',
        reason: 'wrong-kind',
      })
    const record = repairPlans.get(plan)
    if (!record)
      throw new PicodashContractError('invalid-binding-plan', {
        kind: 'repair',
        reason: 'wrong-kind',
      })
    if (record.consumed || registry.consumed)
      throw new PicodashContractError('invalid-binding-plan', {
        kind: 'repair',
        reason: 'consumed',
      })
    const controller = runtimeControllerFor(store as object)
    const activeBinding = controller?.activeBinding(record.scopeId, record.itemId, record.alias)
    if (!activeBinding)
      throw new PicodashContractError('invalid-binding-plan', {
        kind: 'repair',
        reason: 'released',
      })
    if (activeBinding.lease !== record.binding)
      throw new PicodashContractError('invalid-binding-plan', {
        kind: 'repair',
        reason: 'released',
      })
    record.consumed = true
    registry.consumed = true
    const current = interactionByScope
      .get(record.scopeId)
      ?.bindings.get(record.itemId)
      ?.get(record.alias)
    if (
      !current ||
      current !== record.interaction ||
      JSON.stringify(values) !== JSON.stringify(record.targetValues) ||
      (fieldRevisions.get(record.fieldKey) ?? 0) !== record.revision ||
      !picodashJsonEqual(current.draft!, record.draft)
    )
      return rejectedResult([
        Object.freeze({
          code: 'stale_plan',
          path: freezePath([]),
          message: 'Repair plan is stale.',
        }),
      ])
    const result = transactAttributed(
      { [record.fieldKey]: record.candidate },
      record.scopeId,
      'repair',
      {
        beforeDispatch: () => {
          suppressInteractionDispatch = true
          try {
            setInteraction(activeBinding, undefined)
          } finally {
            suppressInteractionDispatch = false
          }
        },
        canonicalSupplied: true,
      },
    )
    return result
  }

  function validateScopeId(value: unknown): asserts value is string {
    const reason = classifyIdentity(value)
    if (reason) throw new PicodashContractError('invalid-scope-id', { reason })
  }

  function validateResetOptions(
    options: unknown,
    root: boolean,
  ): { readonly scopeId?: unknown; readonly includeDescendants: boolean } {
    if (!options || typeof options !== 'object' || Array.isArray(options))
      throw new PicodashContractError('invalid-reset-options', { reason: 'not-object' })
    let descriptors: Record<PropertyKey, PropertyDescriptor>
    try {
      descriptors = Object.getOwnPropertyDescriptors(options)
      for (const key of Reflect.ownKeys(descriptors)) {
        if (
          typeof key !== 'string' ||
          (root ? key !== 'scopeId' && key !== 'includeDescendants' : key !== 'includeDescendants')
        )
          throw new PicodashContractError('invalid-reset-options', { reason: 'unknown-key' })
      }
      const knownKeys: readonly string[] = root
        ? ['scopeId', 'includeDescendants']
        : ['includeDescendants']
      for (const key of knownKeys) {
        const descriptor = descriptors[key]
        if (descriptor && !('value' in descriptor))
          throw new PicodashContractError('invalid-reset-options', { reason: 'accessor-property' })
      }
      const includeDescendants = descriptors.includeDescendants?.value
      if (includeDescendants !== undefined && typeof includeDescendants !== 'boolean')
        throw new PicodashContractError('invalid-reset-options', {
          reason: 'invalid-include-descendants',
        })
      return {
        ...(root ? { scopeId: descriptors.scopeId?.value } : {}),
        includeDescendants: includeDescendants === true,
      }
    } catch (error) {
      if (error instanceof PicodashContractError) throw error
      throw new PicodashContractError('invalid-reset-options', { reason: 'not-object' })
    }
  }

  function validateDestroyOptions(options: unknown): boolean {
    if (options === undefined) return false
    if (!options || typeof options !== 'object' || Array.isArray(options))
      throw new PicodashContractError('invalid-destroy-options', { reason: 'not-object' })
    let descriptors: Record<PropertyKey, PropertyDescriptor>
    try {
      descriptors = Object.getOwnPropertyDescriptors(options)
      for (const key of Reflect.ownKeys(descriptors))
        if (key !== 'includeDescendants')
          throw new PicodashContractError('invalid-destroy-options', { reason: 'unknown-key' })
      const descriptor = descriptors.includeDescendants
      if (descriptor && !('value' in descriptor))
        throw new PicodashContractError('invalid-destroy-options', { reason: 'accessor-property' })
      if (descriptor && typeof descriptor.value !== 'boolean')
        throw new PicodashContractError('invalid-destroy-options', {
          reason: 'invalid-include-descendants',
        })
      return descriptor?.value === true
    } catch (error) {
      if (error instanceof PicodashContractError) throw error
      throw new PicodashContractError('invalid-destroy-options', { reason: 'not-object' })
    }
  }

  function validateDestroyRootOptions(options: unknown): boolean {
    if (options === undefined) return false
    if (!options || typeof options !== 'object' || Array.isArray(options))
      throw new PicodashContractError('invalid-destroy-options', { reason: 'not-object' })
    let descriptors: Record<PropertyKey, PropertyDescriptor>
    try {
      descriptors = Object.getOwnPropertyDescriptors(options)
      for (const key of Reflect.ownKeys(descriptors))
        if (key !== 'discardUnpersisted')
          throw new PicodashContractError('invalid-destroy-options', { reason: 'unknown-key' })
      const descriptor = descriptors.discardUnpersisted
      if (descriptor && !('value' in descriptor))
        throw new PicodashContractError('invalid-destroy-options', { reason: 'accessor-property' })
      if (descriptor && descriptor.value !== true)
        throw new PicodashContractError('invalid-destroy-options', {
          reason: 'invalid-discard-unpersisted',
        })
      return descriptor?.value === true
    } catch (error) {
      if (error instanceof PicodashContractError) throw error
      throw new PicodashContractError('invalid-destroy-options', { reason: 'not-object' })
    }
  }

  function destroyRootInternal(options?: DestroyRootOptions): void {
    const controller = runtimeControllerFor(store as object)
    if (!controller || controller.lifecycle !== 'active')
      throw new PicodashContractError('use-after-destroy')
    if (writing) {
      validateDestroyRootOptions(options)
      throw new PicodashContractError('reentrant-write')
    }
    withWriteLock(() => {
      const discardUnpersisted = validateDestroyRootOptions(options)
      if (controller.hasActiveLeases()) throw new PicodashContractError('root-has-active-leases')
      if (!discardUnpersisted && controller.hasUnpersistedState())
        throw new PicodashContractError('root-has-unpersisted-state')
      controller.destroyResources({ discardUnpersisted })
    })
  }

  function destroyScopeInternalLocked(
    scopeId: string,
    options?: DestroyScopeOptions,
  ): CoreTransactionResult {
    validateScopeId(scopeId)
    const includeDescendants = validateDestroyOptions(options)
    const targets = new Set<string>([scopeId])
    if (includeDescendants) {
      const controller = runtimeControllerFor(store as object)
      for (const descendant of controller?.descendants(scopeId) ?? []) targets.add(descendant)
    }
    const changedScopeIds = [...targets]
      .filter((id) => scopes.has(id) || quarantinedScopes.has(id))
      .sort()
    const changedInteractionScopeIds = [...targets]
      .filter((id) => interactionByScope.has(id))
      .sort()
    if (!changedScopeIds.length && !changedInteractionScopeIds.length)
      return resultWithPersistence(successfulResult())
    const nextEntries = [...scopes.entries()].filter(([id]) => !targets.has(id))
    scopes = nextEntries.length ? immutableMap(nextEntries) : EmptyScopes
    const previousQuarantinedScopes = quarantinedScopes
    const nextQuarantinedEntries = [...quarantinedScopes.entries()].filter(
      ([id]) => !targets.has(id),
    )
    quarantinedScopes = nextQuarantinedEntries.length
      ? immutableMap(nextQuarantinedEntries)
      : immutableMap<string, PicodashQuarantinedScopeMetadata>([])
    for (const id of targets) interactionByScope.delete(id)
    currentSnapshot = freeze({ values, scopes }) as RootSnapshot<ValuesOf<Fields>>
    const affectedChannels = new Set<ScopedChannel>()
    for (const id of new Set([...changedScopeIds, ...changedInteractionScopeIds]))
      for (const channel of collectScopedChannels(id)) affectedChannels.add(channel)
    refreshScopedChannels(affectedChannels)
    publishQuarantineTransition(previousQuarantinedScopes, quarantinedScopes)
    const reportedChangedScopeIds = [
      ...new Set([...changedScopeIds, ...changedInteractionScopeIds]),
    ].sort()
    const persistedResult = resultWithPersistence(successfulResult([], changedScopeIds))
    const result = Object.freeze({
      ...persistedResult,
      changedScopeIds: Object.freeze(reportedChangedScopeIds),
    })
    dispatchStoreSubscribers(affectedChannels, changedScopeIds.length > 0)
    return result
  }

  function destroyScopeInternal(
    scopeId: string,
    options?: DestroyScopeOptions,
  ): CoreTransactionResult {
    return withWriteLock(() => destroyScopeInternalLocked(scopeId, options))
  }

  function makeScopedSnapshot(scopeId: string): ScopedSnapshot<ValuesOf<Fields>> {
    return freeze({
      values: currentSnapshot.values,
      scope: scopes.get(scopeId),
      interaction: interactionByScope.get(scopeId) ?? EmptyInteraction,
    })
  }

  function clearBindingInteractionLocked(scopeId: string, itemId: string, alias: string): void {
    const interaction = interactionByScope.get(scopeId)
    const itemBindings = interaction?.bindings.get(itemId)
    if (!interaction || !itemBindings || !itemBindings.has(alias)) return
    const nextBindings = new Map(interaction.bindings)
    const remainingItemBindings = new Map(itemBindings)
    remainingItemBindings.delete(alias)
    const nextItems = new Map(interaction.items)
    if (remainingItemBindings.size)
      nextBindings.set(itemId, immutableMap([...remainingItemBindings]))
    else {
      nextBindings.delete(itemId)
      nextItems.delete(itemId)
    }
    const nextInteraction =
      nextBindings.size || nextItems.size
        ? Object.freeze({
            bindings: immutableMap([...nextBindings]),
            items: immutableMap([...nextItems]),
          })
        : EmptyInteraction
    if (nextInteraction === interaction) return
    if (nextInteraction === EmptyInteraction) interactionByScope.delete(scopeId)
    else interactionByScope.set(scopeId, nextInteraction)
    const affected = collectScopedChannels(scopeId)
    refreshScopedChannels(affected)
    dispatchStoreSubscribers(affected, false)
  }

  function clearBindingInteraction(scopeId: string, itemId: string, alias: string): void {
    if (writing) clearBindingInteractionLocked(scopeId, itemId, alias)
    else withWriteLock(() => clearBindingInteractionLocked(scopeId, itemId, alias))
  }

  function collectScopedChannels(targetScopeId?: string): Set<ScopedChannel> {
    const affected = new Set<ScopedChannel>()
    if (targetScopeId === undefined) for (const channel of activeChannels) affected.add(channel)
    for (const [id, ref] of scopedRefs) {
      const view = ref.deref()
      if (!view) {
        scopedRefs.delete(id)
        continue
      }
      if (targetScopeId === undefined || targetScopeId === id) {
        const channel = scopedInternals.get(view)
        if (channel) affected.add(channel)
      }
    }
    if (targetScopeId !== undefined) {
      const channel = channelsById.get(targetScopeId)
      if (channel) affected.add(channel)
    }
    return affected
  }

  function refreshScopedChannels(affected: Set<ScopedChannel>) {
    for (const channel of affected) channel.snapshot = makeScopedSnapshot(channel.scopeId)
  }

  function dispatchStoreSubscribers(affected: Set<ScopedChannel>, includeRoot = true) {
    diagnosticsRuntime.dispatch([
      ...(includeRoot ? [{ surface: 'root' as const, listeners }] : []),
      ...[...affected]
        .sort((left, right) => left.scopeId.localeCompare(right.scopeId))
        .map((channel) => ({
          surface: 'scope' as const,
          scopeId: channel.scopeId,
          listeners: channel.listeners,
        })),
    ])
  }

  function applyExternalValues(nextValues: Readonly<ValuesOf<Fields>>) {
    const next = freeze(nextValues) as Readonly<Record<string, PicodashJsonValue>>
    if (
      adapterEchoValues &&
      fieldEntries.every((key) => picodashJsonEqual(adapterEchoValues![key]!, next[key]!))
    ) {
      diagnosticsRuntime.publish()
      return
    }
    const changedFields = fieldEntries.filter((key) => !picodashJsonEqual(values[key]!, next[key]!))
    const changed = changedFields.length > 0
    if (!changed) {
      diagnosticsRuntime.publish()
      return
    }
    values = next
    for (const key of changedFields) fieldRevisions.set(key, (fieldRevisions.get(key) ?? 0) + 1)
    markDirtyBindingsStale(changedFields)
    currentSnapshot = freeze({ values, scopes }) as RootSnapshot<ValuesOf<Fields>>
    const affectedChannels = collectScopedChannels()
    refreshScopedChannels(affectedChannels)
    dispatchStoreSubscribers(affectedChannels)
    diagnosticsRuntime.publish()
  }

  function getScoped(scopeId: string): ScopedStore<Fields, StoreResult, boolean> {
    validateScopeId(scopeId)
    const cached = scopedRefs.get(scopeId)?.deref() as
      | ScopedStore<Fields, StoreResult, boolean>
      | undefined
    if (cached) return cached
    const channel =
      channelsById.get(scopeId) ??
      ({
        scopeId,
        snapshot: makeScopedSnapshot(scopeId),
        listeners: new Set<() => void>(),
      } satisfies ScopedChannel)
    const scoped: ScopedStore<Fields, StoreResult, boolean, boolean> = {
      kind: 'scoped',
      root: store,
      scopeId,
      fields,
      diagnostics: guardedDiagnosticsCapability,
      scope: (id) => getScoped(id),
      getState: () => channel.snapshot,
      subscribe(listener) {
        if (typeof listener !== 'function') throw new PicodashContractError('invalid-configuration')
        const wasEmpty = channel.listeners.size === 0
        channel.listeners.add(listener)
        if (wasEmpty) {
          channelsById.set(scopeId, channel)
          activeChannels.add(channel)
        }
        let active = true
        return () => {
          if (active) {
            active = false
            channel.listeners.delete(listener)
            if (channel.listeners.size === 0) {
              activeChannels.delete(channel)
              if (channelsById.get(scopeId) === channel) channelsById.delete(scopeId)
            }
          }
        }
      },
      setValue(field, value) {
        assertOwned(field)
        return transactAttributed({ [field.key]: value }, scopeId)
      },
      setValueOrThrow(field, value) {
        const result = scoped.setValue(field, value)
        if (!result.ok) throw result.error
        return result
      },
      resetValue(field) {
        assertOwned(field)
        return transactAttributed({ [field.key]: baseline[field.key]! }, scopeId, 'reset', {
          canonicalSupplied: true,
        })
      },
      resetValueOrThrow(field) {
        const result = scoped.resetValue(field)
        if (!result.ok) throw result.error
        return result
      },
      resetRegisteredValues(options) {
        return withWriteLock(() => {
          const parsed = validateResetOptions(options === undefined ? {} : options, false)
          return resetRegisteredValuesInternal(scopeId, parsed.includeDescendants, scopeId)
        })
      },
      resetRegisteredValuesOrThrow(options) {
        const result = scoped.resetRegisteredValues(options)
        if (!result.ok) throw result.error
        return result
      },
      setValues(next) {
        return transactAttributed(next as Record<string, unknown>, scopeId)
      },
      setValuesOrThrow(next) {
        const result = scoped.setValues(next)
        if (!result.ok) throw result.error
        return result
      },
      setInput: (binding, input) => setInputInternal(binding as object, input),
      discardInput: (binding) => discardInputInternal(binding as object),
      createStaleInputOverwritePlan: (binding) =>
        createStaleInputOverwritePlanInternal(binding as object),
      executeStaleInputOverwrite: (plan) => executeStaleInputOverwriteInternal(plan as object),
      executeRepair: (plan) => executeRepairInternal(plan),
      destroyScope: (options) => destroyScopeInternal(scopeId, options),
      setDashPanelLayout: (layout) => store.setDashPanelLayout(scopeId, layout),
      resetDashPanelLayout: () => store.resetDashPanelLayout(scopeId),
      setDashListRootOrder: (order) => store.setDashListRootOrder(scopeId, order),
      removeDashListRootOrder: () => store.removeDashListRootOrder(scopeId),
      setDashListGroupOrder: (groupId, order) =>
        store.setDashListGroupOrder(scopeId, groupId, order),
      removeDashListGroupOrder: (groupId) => store.removeDashListGroupOrder(scopeId, groupId),
      setDashListCollapseOverride: (nodeId, collapsed) =>
        store.setDashListCollapseOverride(scopeId, nodeId, collapsed),
      removeDashListCollapseOverride: (nodeId) =>
        store.removeDashListCollapseOverride(scopeId, nodeId),
      resetDashListMetadata: () => store.resetDashListMetadata(scopeId),
      createPrunePlan: ((options: DashListPruneSelection) =>
        createScopedPrunePlanInternal(
          scopeId,
          options,
        )) as ScopedMetadataCommands<StoreResult>['createPrunePlan'],
      executePrunePlan: (plan) => executePrunePlanInternal(plan as object, scopeId),
    }
    if (documentsEnabled) {
      const documents: Record<string, unknown> = {
        analyzeImport: (document: unknown, options?: unknown) => {
          assertRuntimeActive(runtimeController)
          return createDocumentImportPlan(scopeId, document, options)
        },
        executeImport: (plan: PicodashImportPlan) => {
          assertRuntimeActive(runtimeController)
          return executeDocumentImportPlan(plan, scopeId)
        },
      }
      if (configuredExportPolicy) {
        documents.createExportPlan = (options?: unknown) => {
          assertRuntimeActive(runtimeController)
          return createDocumentExportPlan(scopeId, options)
        }
        documents.executeExport = (plan: PicodashExportPlan, options?: unknown) => {
          assertRuntimeActive(runtimeController)
          return executeDocumentExportPlan(plan, options, scopeId)
        }
      }
      Object.defineProperty(scoped, 'documents', {
        value: makeLifecycleFacade(Object.freeze(documents), runtimeController),
        enumerable: true,
        writable: false,
        configurable: false,
      })
    }
    if (persistenceController)
      Object.defineProperty(scoped, 'persistence', {
        value: guardedPersistenceCapability,
        enumerable: true,
        writable: false,
        configurable: false,
      })
    if (metadataRecoveryEnabled)
      Object.defineProperty(scoped, 'metadataRecovery', {
        value: guardedMetadataRecoveryCapability,
        enumerable: true,
        writable: false,
        configurable: false,
      })
    Object.freeze(scoped)
    const controller = runtimeControllerFor(store as object)
    const facade = controller ? makeLifecycleFacade(scoped, controller) : scoped
    if (controller) registerRuntimeScopedView(facade as object, controller, scopeId)
    scopedInternals.set(facade, channel)
    scopedRefs.set(scopeId, new WeakRef(facade))
    return facade
  }

  type ParsedPruneSelection =
    | { readonly mode: 'review' }
    | {
        readonly mode: 'explicit'
        readonly removeNodeIds: readonly string[]
        readonly keepNodeIds: readonly string[]
      }
    | { readonly mode: 'inventory'; readonly knownNodeIds: readonly string[] }

  function invalidPruneOptions(reason: InvalidPruneOptionsReason): never {
    throw new PicodashContractError('invalid-prune-options', { reason })
  }

  function parsePruneNodeIds(value: unknown): readonly string[] {
    try {
      if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
        return invalidPruneOptions('invalid-node-ids')
      const descriptors = Object.getOwnPropertyDescriptors(value)
      for (const key of Reflect.ownKeys(descriptors)) {
        if (typeof key !== 'string') return invalidPruneOptions('invalid-node-ids')
        if (key !== 'length' && (!/^0$|^[1-9]\d*$/.test(key) || Number(key) >= value.length))
          return invalidPruneOptions('invalid-node-ids')
        if (key !== 'length' && (!descriptors[key]!.enumerable || !('value' in descriptors[key]!)))
          return invalidPruneOptions('invalid-node-ids')
      }
      const values: string[] = []
      const seen = new Set<string>()
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)]
        if (!descriptor || !('value' in descriptor)) return invalidPruneOptions('invalid-node-ids')
        const nodeId = descriptor.value
        if (!validIdentity(nodeId)) return invalidPruneOptions('invalid-node-ids')
        if (seen.has(nodeId)) return invalidPruneOptions('duplicate-node-id')
        seen.add(nodeId)
        values.push(nodeId)
      }
      values.sort()
      return Object.freeze(values)
    } catch (error) {
      if (error instanceof PicodashContractError) throw error
      return invalidPruneOptions('invalid-node-ids')
    }
  }

  function parsePruneOptions(
    options: unknown,
    requireScope: boolean,
  ): {
    readonly scopeId?: unknown
    readonly selection: ParsedPruneSelection
  } {
    if (!options || typeof options !== 'object' || Array.isArray(options))
      return invalidPruneOptions('not-object')
    let descriptors: Record<PropertyKey, PropertyDescriptor>
    try {
      descriptors = Object.getOwnPropertyDescriptors(options)
      for (const key of Reflect.ownKeys(descriptors)) {
        const allowed =
          key === 'mode' ||
          (requireScope && key === 'scopeId') ||
          key === 'removeNodeIds' ||
          key === 'keepNodeIds' ||
          key === 'knownNodeIds'
        if (!allowed) return invalidPruneOptions('unknown-key')
      }
      for (const key of Reflect.ownKeys(descriptors)) {
        const descriptor = descriptors[key]!
        if (!('value' in descriptor)) return invalidPruneOptions('accessor-property')
      }
    } catch (error) {
      if (error instanceof PicodashContractError) throw error
      return invalidPruneOptions('not-object')
    }
    const mode = descriptors.mode?.value
    if (mode !== 'review' && mode !== 'explicit' && mode !== 'inventory')
      return invalidPruneOptions('invalid-mode')
    const modeKeys =
      mode === 'review'
        ? new Set<PropertyKey>(['mode', ...(requireScope ? ['scopeId'] : [])])
        : mode === 'explicit'
          ? new Set<PropertyKey>([
              'mode',
              ...(requireScope ? ['scopeId'] : []),
              'removeNodeIds',
              'keepNodeIds',
            ])
          : new Set<PropertyKey>(['mode', ...(requireScope ? ['scopeId'] : []), 'knownNodeIds'])
    for (const key of Reflect.ownKeys(descriptors))
      if (!modeKeys.has(key)) return invalidPruneOptions('unknown-key')
    if (mode === 'review')
      return {
        ...(requireScope ? { scopeId: descriptors.scopeId?.value } : {}),
        selection: { mode },
      }
    if (mode === 'explicit') {
      const removeNodeIds = parsePruneNodeIds(descriptors.removeNodeIds?.value)
      const keepNodeIds = parsePruneNodeIds(descriptors.keepNodeIds?.value)
      return {
        ...(requireScope ? { scopeId: descriptors.scopeId?.value } : {}),
        selection: { mode, removeNodeIds, keepNodeIds },
      }
    }
    const knownNodeIds = parsePruneNodeIds(descriptors.knownNodeIds?.value)
    return {
      ...(requireScope ? { scopeId: descriptors.scopeId?.value } : {}),
      selection: { mode, knownNodeIds },
    }
  }

  function pruneCandidates(scopeId: string): readonly DashListPruneCandidate[] {
    const list = scopes.get(scopeId)?.dashList
    const effects = new Map<string, Set<DashListPruneEffect>>()
    const add = (nodeId: string, effect: DashListPruneEffect) => {
      const current = effects.get(nodeId) ?? new Set<DashListPruneEffect>()
      current.add(effect)
      effects.set(nodeId, current)
    }
    for (const nodeId of list?.rootOrder ?? []) add(nodeId, 'root-order-entry')
    if (list) {
      for (const [owner, order] of list.groupOrders) {
        add(owner, 'group-order-owner')
        for (const nodeId of order) add(nodeId, 'group-order-entry')
      }
      for (const nodeId of list.collapseOverrides.keys()) add(nodeId, 'collapse-override')
    }
    const controller = runtimeControllerFor(store as object)
    const active = new Set(controller?.activeDashListNodeIds(scopeId) ?? [])
    const order: readonly DashListPruneEffect[] = [
      'root-order-entry',
      'group-order-owner',
      'group-order-entry',
      'collapse-override',
    ]
    return Object.freeze(
      [...effects.keys()]
        .filter((nodeId) => !active.has(nodeId))
        .sort()
        .map((nodeId) =>
          Object.freeze({
            nodeId,
            effects: Object.freeze(order.filter((effect) => effects.get(nodeId)!.has(effect))),
          }),
        ),
    )
  }

  function pruneFingerprint(scopeId: string): string {
    const list = scopes.get(scopeId)?.dashList
    const controller = runtimeControllerFor(store as object)
    return JSON.stringify({
      rootOrder: list?.rootOrder ?? null,
      groupOrders: list ? [...list.groupOrders].map(([key, order]) => [key, order]) : [],
      collapseOverrides: list ? [...list.collapseOverrides] : [],
      activeNodeIds: controller?.activeDashListNodeIds(scopeId) ?? [],
    })
  }

  function classifyPruneSelection(
    selection: ParsedPruneSelection,
    candidates: readonly DashListPruneCandidate[],
    scopeId: string,
  ):
    | { readonly mode: 'review' }
    | {
        readonly mode: 'explicit' | 'inventory'
        readonly removeNodeIds: readonly string[]
        readonly keepNodeIds: readonly string[]
      } {
    if (selection.mode === 'review') return selection
    const candidateIds = new Set(candidates.map((candidate) => candidate.nodeId))
    if (selection.mode === 'explicit') {
      const overlap = selection.removeNodeIds.some((nodeId) =>
        selection.keepNodeIds.includes(nodeId),
      )
      if (overlap) return invalidPruneOptions('overlapping-node-id')
      for (const nodeId of [...selection.removeNodeIds, ...selection.keepNodeIds])
        if (!candidateIds.has(nodeId)) return invalidPruneOptions('unknown-candidate')
      const selected = new Set([...selection.removeNodeIds, ...selection.keepNodeIds])
      if (selected.size !== candidateIds.size || [...candidateIds].some((id) => !selected.has(id)))
        return invalidPruneOptions('incomplete-candidate-partition')
      return selection
    }
    const active = runtimeControllerFor(store as object)?.activeDashListNodeIds(scopeId) ?? []
    const known = new Set(selection.knownNodeIds)
    if (active.some((nodeId) => !known.has(nodeId)))
      return invalidPruneOptions('missing-active-node')
    const keepNodeIds = candidates
      .map((candidate) => candidate.nodeId)
      .filter((nodeId) => known.has(nodeId))
    const removeNodeIds = candidates
      .map((candidate) => candidate.nodeId)
      .filter((nodeId) => !known.has(nodeId))
    return {
      mode: 'inventory',
      removeNodeIds: Object.freeze([...removeNodeIds]),
      keepNodeIds: Object.freeze([...keepNodeIds]),
    }
  }

  function createPrunePlan(
    options: unknown,
    requireScope: boolean,
    scopedScopeId?: string,
  ): DashListPruneReview | PicodashDashListPrunePlan {
    return withWriteLock(() => {
      const parsed = parsePruneOptions(options, requireScope)
      const scopeId = requireScope ? parsed.scopeId : scopedScopeId
      if (scopeId === undefined || typeof scopeId !== 'string') validateScopeId(scopeId)
      else validateScopeId(scopeId)
      const candidates = pruneCandidates(scopeId as string)
      const classified = classifyPruneSelection(parsed.selection, candidates, scopeId as string)
      if (classified.mode === 'review')
        return Object.freeze({
          kind: 'dash-list-prune-review' as const,
          scopeId: scopeId as string,
          candidates,
        })
      const plan = Object.freeze({
        kind: 'dash-list-prune-plan' as const,
        mode: classified.mode,
        scopeId: scopeId as string,
        candidates,
        removeNodeIds: Object.freeze([...classified.removeNodeIds]),
        keepNodeIds: Object.freeze([...classified.keepNodeIds]),
      }) as PicodashDashListPrunePlan
      registerDashListPrunePlan(plan as object, {
        root: store as object,
        scopeId: scopeId as string,
        fingerprint: pruneFingerprint(scopeId as string),
        removeNodeIds: plan.removeNodeIds,
        consumed: false,
      })
      return plan
    })
  }

  function createRootPrunePlanInternal(
    options: RootDashListPruneOptions,
  ): DashListPruneReview | PicodashDashListPrunePlan {
    return createPrunePlan(options, true)
  }

  function createScopedPrunePlanInternal(
    scopeId: string,
    options: DashListPruneSelection,
  ): DashListPruneReview | PicodashDashListPrunePlan {
    return createPrunePlan(options, false, scopeId)
  }

  function executePrunePlanInternal(plan: object, expectedScopeId?: string): CoreTransactionResult {
    if (writing) throw new PicodashContractError('reentrant-write')
    let registry: ReturnType<typeof dashListPrunePlanRecord>
    try {
      registry = dashListPrunePlanRecord(plan)
    } catch {
      throw new PicodashContractError('invalid-prune-plan', { reason: 'wrong-kind' })
    }
    if (!registry) throw new PicodashContractError('invalid-prune-plan', { reason: 'wrong-kind' })
    if (
      registry.root !== (store as object) ||
      (expectedScopeId !== undefined && registry.scopeId !== expectedScopeId)
    )
      throw new PicodashContractError('invalid-prune-plan', { reason: 'foreign-root' })
    if (registry.consumed)
      throw new PicodashContractError('invalid-prune-plan', { reason: 'consumed' })
    registry.consumed = true
    if (registry.fingerprint !== pruneFingerprint(registry.scopeId))
      return rejectedResult([
        Object.freeze({
          code: 'stale_plan' as const,
          path: Object.freeze([]) as readonly [],
          message: 'Prune plan is stale.',
        }),
      ])
    const remove = new Set(registry.removeNodeIds)
    if (remove.size === 0) return resultWithPersistence(successfulResult())
    return metadataCommand(registry.scopeId, (previous) => {
      const list = previous?.dashList
      if (!list) return previous
      const rootOrder = list.rootOrder?.filter((nodeId) => !remove.has(nodeId))
      const groupOrders = new Map<string, readonly string[]>()
      for (const [owner, order] of list.groupOrders) {
        if (remove.has(owner)) continue
        const nextOrder = order.filter((nodeId) => !remove.has(nodeId))
        if (nextOrder.length) groupOrders.set(owner, nextOrder)
      }
      const collapseOverrides = new Map<string, boolean>()
      for (const [nodeId, collapsed] of list.collapseOverrides)
        if (!remove.has(nodeId)) collapseOverrides.set(nodeId, collapsed)
      const normalized = normalizeDashListMetadataRecord({
        ...(rootOrder && rootOrder.length ? { rootOrder } : {}),
        groupOrders,
        collapseOverrides,
      })
      return normalized.rootOrder === undefined &&
        normalized.groupOrders.size === 0 &&
        normalized.collapseOverrides.size === 0
        ? previous?.dashPanel
          ? { dashPanel: previous.dashPanel }
          : undefined
        : {
            ...(previous?.dashPanel ? { dashPanel: previous.dashPanel } : {}),
            dashList: normalized,
          }
    })
  }

  function metadataCommand(
    scopeId: string,
    transform: (previous: DurableScopeMetadata | undefined) => DurableScopeMetadata | undefined,
  ): CoreTransactionResult {
    if (writing) throw new PicodashContractError('reentrant-write')
    validateScopeId(scopeId)
    if (quarantinedScopes.has(scopeId))
      return rejectedResult([
        Object.freeze({
          code: 'quarantined_metadata' as const,
          path: freezePath(['scopes', scopeId]),
          message: 'Scope metadata is quarantined.',
          scopeId,
        }),
      ])
    writing = true
    try {
      let candidate: DurableScopeMetadata | undefined
      try {
        const transformed = transform(scopes.get(scopeId))
        candidate = normalizeDurableScopeMetadata({
          dashList: transformed?.dashList,
          dashPanel: transformed?.dashPanel,
        })
      } catch (error) {
        if (error instanceof PicodashContractError) throw error
        return rejectedResult([
          Object.freeze({
            code: 'invalid_metadata',
            path: freezePath(['scopes', scopeId]),
            message: 'Invalid Store metadata.',
          }),
        ])
      }
      const previous = scopes.get(scopeId)
      if (metadataEqual(previous, candidate)) return resultWithPersistence(successfulResult())
      const entries = [...scopes.entries()].filter(([id]) => id !== scopeId)
      if (candidate !== undefined) entries.push([scopeId, candidate])
      entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      scopes = entries.length ? immutableMap(entries) : EmptyScopes
      currentSnapshot = freeze({ values, scopes }) as RootSnapshot<ValuesOf<Fields>>
      const affectedChannels = collectScopedChannels(scopeId)
      refreshScopedChannels(affectedChannels)
      const result = resultWithPersistence(successfulResult([], [scopeId]))
      dispatchStoreSubscribers(affectedChannels)
      return result
    } finally {
      writing = false
    }
  }

  function metadataRecoveryState(): PicodashMetadataRecoveryState {
    return metadataRecoverySnapshot
  }

  function replaceQuarantinedScopeInternalLocked(
    scopeId: string,
    replacement: SerializedDurableScopeMetadata | null,
  ): CoreTransactionResult {
    validateScopeId(scopeId)
    if (!quarantinedScopes.has(scopeId))
      throw new PicodashContractError('invalid-quarantine-replacement', {
        reason: 'not-quarantined',
      })
    let candidate: DurableScopeMetadata | undefined
    if (replacement !== null) {
      try {
        candidate = decodeDurableScopeMetadata(replacement)
      } catch (error) {
        if (error instanceof PicodashContractError) throw error
        return rejectedResult([
          Object.freeze({
            code: 'invalid_metadata' as const,
            path: freezePath(['scopes', scopeId]),
            message: 'Invalid Store metadata.',
            scopeId,
          }),
        ])
      }
    }
    const nextQuarantine = new Map(quarantinedScopes)
    nextQuarantine.delete(scopeId)
    const previousQuarantinedScopes = quarantinedScopes
    quarantinedScopes = nextQuarantine.size
      ? immutableMap([...nextQuarantine.entries()])
      : immutableMap<string, PicodashQuarantinedScopeMetadata>([])
    const nextScopes = [...scopes.entries()].filter(([id]) => id !== scopeId)
    if (candidate !== undefined) nextScopes.push([scopeId, candidate])
    nextScopes.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    scopes = nextScopes.length ? immutableMap(nextScopes) : EmptyScopes
    currentSnapshot = freeze({ values, scopes }) as RootSnapshot<ValuesOf<Fields>>
    const affectedChannels = collectScopedChannels(scopeId)
    refreshScopedChannels(affectedChannels)
    publishQuarantineTransition(previousQuarantinedScopes, quarantinedScopes)
    const result = resultWithPersistence(successfulResult([], [scopeId]))
    dispatchStoreSubscribers(affectedChannels)
    return result
  }

  function replaceQuarantinedScopeInternal(
    scopeId: string,
    replacement: SerializedDurableScopeMetadata | null,
  ): CoreTransactionResult {
    return withWriteLock(() => replaceQuarantinedScopeInternalLocked(scopeId, replacement))
  }

  function metadataEqual(
    left: DurableScopeMetadata | undefined,
    right: DurableScopeMetadata | undefined,
  ): boolean {
    if (left === right) return true
    if (
      !left ||
      !right ||
      !!left.dashPanel !== !!right.dashPanel ||
      !!left.dashList !== !!right.dashList
    )
      return false
    if (
      left.dashPanel &&
      right.dashPanel &&
      !picodashJsonEqual(left.dashPanel as never, right.dashPanel as never)
    )
      return false
    if (left.dashList && right.dashList) {
      if (
        !picodashJsonEqual(
          (left.dashList.rootOrder ?? null) as never,
          (right.dashList.rootOrder ?? null) as never,
        )
      )
        return false
      if (
        left.dashList.groupOrders.size !== right.dashList.groupOrders.size ||
        left.dashList.collapseOverrides.size !== right.dashList.collapseOverrides.size
      )
        return false
      for (const [key, value] of left.dashList.groupOrders)
        if (!picodashJsonEqual(value as never, right.dashList.groupOrders.get(key) as never))
          return false
      for (const [key, value] of left.dashList.collapseOverrides)
        if (right.dashList.collapseOverrides.get(key) !== value) return false
    }
    return true
  }

  return store
}
