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
} from '../metadata.js'
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
import type {
  PicodashEnvelopeInput,
  PicodashPersistence,
  PicodashPersistenceDiagnostic,
  PersistenceController,
  PersistenceFailureReason,
  PersistentTransactionResult,
  StoreOwnedPersistenceConfig,
} from '../persistence.js'
import {
  bindingPlanRecord,
  registerBindingPlan,
  type BindingPlanRegistryRecord,
} from '../plan-registry.js'

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
  | 'invalid_metadata'
  | 'adapter_initialization_failed'
  | 'adapter_unhealthy'
  | 'adapter_write_failed'
  | 'persistence_driver_unavailable'
  | 'invalid_persistence_envelope'
  | 'hydration_source_conflict'
  | 'persistence_failure'
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
    })
  | (InferredStoreConfigBase<Values> & {
      readonly storeId: string
      readonly schemaVersion: number
      readonly initialEnvelope?: PicodashEnvelopeInput<Values>
      readonly persistence?: StoreOwnedPersistenceConfig<
        Record<string, { readonly defaultValue: PicodashJsonValue }>
      >
    })

type InferredExternalConfig<Values extends Record<string, PicodashJsonValue>> = {
  readonly storeId?: string
  readonly schemaVersion?: number
  readonly valueOwner: 'external'
  readonly fields: InputFields<Values>
  readonly adapter: PicodashValueAdapter<Values>
  readonly initialValues?: never
  readonly initialEnvelope?: never
  readonly validateValues?: ValuesValidator<Values>
}

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
    })
  | (StoreOwnedConfigBase<Fields> & {
      readonly storeId: string
      readonly schemaVersion: number
      readonly initialEnvelope?: PicodashEnvelopeInput<ValuesOf<Fields>>
      readonly persistence?: StoreOwnedPersistenceConfig<Fields>
    })

export type ExternalOwnedConfig<Fields extends Record<string, FieldLike>> = {
  readonly storeId?: string
  readonly schemaVersion?: number
  readonly valueOwner: 'external'
  readonly fields: DefinitionsFor<Fields>
  readonly adapter: PicodashValueAdapter<ValuesOf<Fields>>
  readonly initialValues?: never
  readonly initialEnvelope?: never
  readonly validateValues?: ValuesValidator<ValuesOf<Fields>>
}

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
}

interface RootStoreBase<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
>
  extends RootMetadataCommands<Result>, BindingInteractionCommands<Fields, Result> {
  readonly kind: 'root'
  readonly fields: PicodashFields<Fields>
  scope(scopeId: string): ScopedStore<Fields, Result>
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
  setValues(values: Partial<ValuesOf<Fields>>): Result
  setValuesOrThrow(values: Partial<ValuesOf<Fields>>): Extract<Result, { readonly ok: true }>
  destroyScope(scopeId: string, options?: DestroyScopeOptions): Result
}

interface ScopedStoreBase<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
>
  extends ScopedMetadataCommands<Result>, BindingInteractionCommands<Fields, Result> {
  readonly kind: 'scoped'
  readonly root: RootStore<Fields, Result>
  readonly scopeId: string
  readonly fields: PicodashFields<Fields>
  readonly diagnostics: PicodashDiagnostics
  scope(scopeId: string): ScopedStore<Fields, Result>
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
  setValues(values: Partial<ValuesOf<Fields>>): Result
  setValuesOrThrow(values: Partial<ValuesOf<Fields>>): Extract<Result, { readonly ok: true }>
  destroyScope(options?: DestroyScopeOptions): Result
}

type PersistenceCapability<Result extends CoreTransactionResult> =
  Result extends PersistentTransactionResult ? { readonly persistence: PicodashPersistence } : {}

export type RootStore<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> = RootStoreBase<Fields, Result> & PersistenceCapability<Result>

export type ScopedStore<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> = ScopedStoreBase<Fields, Result> & PersistenceCapability<Result>

type ContractErrorCode =
  | 'invalid-configuration'
  | 'invalid-scope-id'
  | 'foreign-handle'
  | 'async-contract'
  | 'invalid-callback-result'
  | 'reentrant-write'
  | 'invalid-destroy-options'
  | 'invalid-provider-id'
  | 'duplicate-provider'
  | 'persistence-identity-in-use'
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
  | 'root-has-active-leases'
  | 'root-has-unpersisted-state'
  | 'use-after-destroy'

const BUILTIN_CODES = new Set<PicodashIssueCode>([
  'invalid_json',
  'parse_failed',
  'schema_failed',
  'validation_failed',
  'stale_input',
  'unknown_field',
  'invalid_metadata',
  'adapter_initialization_failed',
  'adapter_unhealthy',
  'adapter_write_failed',
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
    readonly persistence: StoreOwnedPersistenceConfig<Definitions>
  },
): RootStore<Definitions, PersistentTransactionResult>
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
): RootStore<Definitions, CoreTransactionResult> {
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
  if (config.storeId !== undefined && !validIdentity(config.storeId))
    throw new PicodashContractError('invalid-configuration')
  if (
    config.schemaVersion !== undefined &&
    (!validIdentity(config.storeId) ||
      !Number.isSafeInteger(config.schemaVersion) ||
      config.schemaVersion <= 0)
  )
    throw new PicodashContractError('invalid-configuration')
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
    (config as { readonly initialEnvelope?: unknown }).initialEnvelope !== undefined &&
    config.valueOwner === 'external'
  )
    throw new PicodashContractError('invalid-configuration')
  const configuredPersistence = (
    config as { readonly persistence?: StoreOwnedPersistenceConfig<Definitions> }
  ).persistence
  if (configuredPersistence !== undefined) {
    if (
      config.valueOwner !== 'store' ||
      !validIdentity(config.storeId) ||
      !Number.isSafeInteger(config.schemaVersion) ||
      config.schemaVersion === undefined ||
      config.schemaVersion <= 0
    )
      throw new PicodashContractError('invalid-configuration')
    const persistence = configuredPersistence as Record<string, unknown>
    if (
      !persistence ||
      typeof persistence !== 'object' ||
      !validIdentity(persistence.storageKey as string)
    )
      throw new PicodashContractError('invalid-configuration')
    const driver = persistence.driver as Record<string, unknown> | undefined
    const valuesPolicy = persistence.values as Record<string, unknown> | undefined
    if (
      !driver ||
      typeof driver !== 'object' ||
      !driver.identity ||
      typeof driver.read !== 'function' ||
      typeof driver.write !== 'function' ||
      typeof driver.remove !== 'function' ||
      (!driver.subscribe && driver.subscribe !== undefined) ||
      (driver.subscribe !== undefined && typeof driver.subscribe !== 'function') ||
      !validatePersistenceValuesPolicy(valuesPolicy, configuredFieldKeys)
    )
      throw new PicodashContractError('invalid-configuration')
  }
  const persistenceIncludedFields =
    configuredPersistence === undefined
      ? undefined
      : new Set(
          configuredFieldKeys.filter((key) => {
            const overrides = configuredPersistence.values.fields as
              | Record<string, 'include' | 'omit'>
              | undefined
            const selected = overrides?.[key]
            return selected === undefined
              ? configuredPersistence.values.defaultFieldPolicy === 'include'
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
  let writing = false
  let persistenceController: PersistenceController | undefined
  if (
    config.valueOwner === 'store' &&
    configuredPersistence === undefined &&
    config.initialEnvelope !== undefined
  ) {
    const storeId = config.storeId
    const schemaVersion = config.schemaVersion
    if (
      !validIdentity(storeId) ||
      typeof schemaVersion !== 'number' ||
      !Number.isSafeInteger(schemaVersion) ||
      schemaVersion <= 0
    )
      throw new PicodashContractError('invalid-configuration')
    const hydrated = hydratePersistenceEnvelope(
      config.initialEnvelope,
      { storeId, schemaVersion },
      (input) => {
        if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined
        for (const key of fieldEntries) if (!Object.hasOwn(input, key)) return undefined
        const built = buildCandidate(
          values as Record<string, PicodashJsonValue>,
          input as Record<string, unknown>,
          'persistence',
        )
        return built.issues.length ? undefined : freeze(built.candidate)
      },
    )
    if (!hydrated.ok)
      throw new PicodashInitializationError(hydrated.reason, 'invalid-persistence-envelope')
    values = hydrated.record.values
    scopes = hydrated.record.scopes
  }
  if (config.valueOwner === 'store' && configuredPersistence !== undefined) {
    try {
      const persistenceConfig = configuredPersistence
      persistenceController = createPersistenceController({
        storageKey: persistenceConfig.storageKey,
        driver: persistenceConfig.driver,
        storeId: config.storeId!,
        schemaVersion: config.schemaVersion!,
        baselineValues: values,
        initialEnvelope: config.initialEnvelope,
        normalizeValues: (input) => {
          if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined
          const built = buildCandidate(
            values as Record<string, PicodashJsonValue>,
            input as Record<string, unknown>,
            'persistence',
          )
          return built.issues.length ? undefined : freeze(built.candidate)
        },
        onExternalValues: () => undefined,
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
      values = persistenceController.initialValues
      scopes = persistenceController.initialScopes
    } catch (error) {
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
    readonly fieldKey: string
    readonly scopeId: string
    readonly itemId: string
    readonly alias: string
    readonly revision: number
    readonly baseValue: PicodashJsonValue
    readonly draft: PicodashJsonValue
    readonly candidate: PicodashJsonValue
    consumed: boolean
    readonly registry: BindingPlanRegistryRecord
  }
  const repairPlans = new WeakMap<object, RepairRecord>()
  type StaleOverwriteRecord = {
    readonly binding: object
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
  currentSnapshot = freeze({ values, scopes }) as RootSnapshot<ValuesOf<Fields>>

  type StoreResult = CoreTransactionResult
  let store!: RootStore<Fields, StoreResult>
  const storeImplementation: RootStore<Fields, StoreResult> = {
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
      return transactAttributed({ [field.key]: baseline[field.key]! }, undefined, 'reset')
    },
    resetValueOrThrow(field) {
      const result = store.resetValue(field)
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
  }
  if (persistenceController)
    Object.defineProperty(storeImplementation, 'persistence', {
      value: persistenceController.capability,
      enumerable: true,
      writable: false,
      configurable: false,
    })
  Object.freeze(storeImplementation)
  runtimeController = new RuntimeController(storeImplementation as object)
  store = makeLifecycleFacade(storeImplementation, runtimeController)
  runtimeController.finalizeRoot(store as object)
  registerRuntimeController(store as object, runtimeController)
  runtimeController.setBindingInteractionCleanup(clearBindingInteraction)
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
    readonly includeRoot?: boolean
  }

  function persistCurrent(): 'unchanged' | 'saved' | 'pending' | undefined {
    return persistenceController?.persist(values, scopes)
  }

  function resultWithPersistence(result: CoreTransactionResult): CoreTransactionResult {
    if (!result.ok || !persistenceController) return result
    return Object.freeze({ ...result, persistence: persistCurrent()! }) as CoreTransactionResult
  }

  function transactAttributed(
    next: Record<string, unknown>,
    originScopeId?: string,
    source: 'programmatic' | 'interactive' | 'repair' | 'reset' = 'programmatic',
    options?: TransactionDispatchOptions,
  ): CoreTransactionResult {
    if (writing) throw new PicodashContractError('reentrant-write')
    if (!next || typeof next !== 'object' || Array.isArray(next))
      return rejectedResult([
        Object.freeze({
          code: 'invalid_json',
          path: freezePath([]),
          message: 'Values must be a record.',
        }),
      ])
    const keys = Object.keys(next)
    if (!keys.length) return resultWithPersistence(successfulResult())
    writing = true
    try {
      const built = buildCandidate(
        values as Record<string, PicodashJsonValue>,
        next,
        source,
        originScopeId,
      )
      if (built.issues.length) return rejectedResult(built.issues)
      const changedFields = fieldEntries
        .filter((key) => !picodashJsonEqual(values[key]!, built.candidate[key]!))
        .sort()
      if (!changedFields.length) {
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
      if (externalAdapterRuntime?.isUnhealthy())
        return rejectedResult([adapterUnhealthyIssue(originScopeId)])
      if (externalAdapterRuntime) {
        adapterEchoValues = built.candidate
        const context: AdapterWriteContext = Object.freeze({
          source,
          ...(originScopeId === undefined ? {} : { originScopeId }),
          targetScopeIds: Object.freeze(
            source === 'programmatic' || originScopeId === undefined ? [] : [originScopeId],
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
      for (const key of changedFields) fieldRevisions.set(key, (fieldRevisions.get(key) ?? 0) + 1)
      markDirtyBindingsStale(changedFields)
      options?.beforeDispatch?.()
      currentSnapshot = freeze({ values, scopes }) as RootSnapshot<ValuesOf<Fields>>
      const affectedChannels = collectScopedChannels()
      refreshScopedChannels(affectedChannels)
      const result = resultWithPersistence(successfulResult(changedFields))
      dispatchStoreSubscribers(affectedChannels, options?.includeRoot)
      return result
    } finally {
      writing = false
    }
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
  ): readonly TransactionIssue[] =>
    Object.freeze(
      issues.map((issue) =>
        Object.freeze({
          ...issue,
          fieldKey:
            record.field && typeof record.field === 'object'
              ? (record.field as { key: string }).key
              : undefined,
          scopeId: record.scopeId,
          itemId: record.itemId,
          alias: record.alias,
        }),
      ),
    )

  function setInteraction(
    record: import('../runtime-controller.js').BindingRecord,
    state: BindingInteractionState | undefined,
  ): void {
    const previous = interactionByScope.get(record.scopeId)
    const bindings = new Map(previous?.bindings ?? [])
    const items = new Map(previous?.items ?? [])
    const itemBindings = new Map(bindings.get(record.itemId) ?? [])
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
    if (next === previous) return
    if (next === EmptyInteraction) interactionByScope.delete(record.scopeId)
    else interactionByScope.set(record.scopeId, next)
    if (!suppressInteractionDispatch) {
      const affected = collectScopedChannels(record.scopeId)
      refreshScopedChannels(affected)
      dispatchStoreSubscribers(affected, false)
    }
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

  function setInputInternal(handle: object, input: PicodashJsonValue): CoreTransactionResult {
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
            const record: RepairRecord = {
              binding: handle,
              fieldKey,
              scopeId: binding.scopeId,
              itemId: binding.itemId,
              alias: binding.alias,
              revision: fieldRevisions.get(fieldKey)!,
              baseValue,
              draft,
              candidate: repair.value!,
              consumed: false,
              registry,
            }
            repairPlans.set(plan, record)
            registerBindingPlan(plan, registry)
          }
        }
      }
      setInteraction(binding, {
        fieldKey,
        draft,
        touched: true,
        inputIssues: enriched,
        ...(previous?.conflict ? { conflict: previous.conflict } : {}),
        baseRevision,
        baseValue,
      } as BindingInteractionState & { baseRevision: number; baseValue: PicodashJsonValue })
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
      },
    )
    if (!result.ok)
      setInteraction(binding, {
        fieldKey,
        draft,
        touched: true,
        inputIssues: previous?.inputIssues ?? Object.freeze([]),
        ...(previous?.conflict ? { conflict: previous.conflict } : {}),
        baseRevision,
        baseValue,
      } as BindingInteractionState)
    return result
  }

  function discardInputInternal(handle: object): boolean {
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

  function executeStaleInputOverwriteInternal(plan: object): CoreTransactionResult {
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
      },
    )
  }

  function executeRepairInternal(plan: object): CoreTransactionResult {
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
      },
    )
    return result
  }

  function validateScopeId(value: unknown): asserts value is string {
    const reason = classifyIdentity(value)
    if (reason) throw new PicodashContractError('invalid-scope-id', { reason })
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
    const discardUnpersisted = validateDestroyRootOptions(options)
    if (writing) throw new PicodashContractError('reentrant-write')
    if (controller.hasActiveLeases()) throw new PicodashContractError('root-has-active-leases')
    if (!discardUnpersisted && controller.hasUnpersistedState())
      throw new PicodashContractError('root-has-unpersisted-state')
    controller.destroyResources({ discardUnpersisted })
  }

  function destroyScopeInternal(
    scopeId: string,
    options?: DestroyScopeOptions,
  ): CoreTransactionResult {
    if (writing) throw new PicodashContractError('reentrant-write')
    validateScopeId(scopeId)
    const includeDescendants = validateDestroyOptions(options)
    const targets = new Set<string>([scopeId])
    if (includeDescendants) {
      const controller = runtimeControllerFor(store as object)
      for (const descendant of controller?.descendants(scopeId) ?? []) targets.add(descendant)
    }
    const changedScopeIds = [...targets].filter((id) => scopes.has(id)).sort()
    const changedInteractionScopeIds = [...targets]
      .filter((id) => interactionByScope.has(id))
      .sort()
    if (!changedScopeIds.length && !changedInteractionScopeIds.length)
      return resultWithPersistence(successfulResult())
    writing = true
    try {
      const nextEntries = [...scopes.entries()].filter(([id]) => !targets.has(id))
      scopes = nextEntries.length ? immutableMap(nextEntries) : EmptyScopes
      for (const id of targets) interactionByScope.delete(id)
      currentSnapshot = freeze({ values, scopes }) as RootSnapshot<ValuesOf<Fields>>
      const affectedChannels = new Set<ScopedChannel>()
      for (const id of new Set([...changedScopeIds, ...changedInteractionScopeIds]))
        for (const channel of collectScopedChannels(id)) affectedChannels.add(channel)
      refreshScopedChannels(affectedChannels)
      const result = resultWithPersistence(successfulResult([], changedScopeIds))
      dispatchStoreSubscribers(affectedChannels, changedScopeIds.length > 0)
      return result
    } finally {
      writing = false
    }
  }

  function makeScopedSnapshot(scopeId: string): ScopedSnapshot<ValuesOf<Fields>> {
    return freeze({
      values: currentSnapshot.values,
      scope: scopes.get(scopeId),
      interaction: interactionByScope.get(scopeId) ?? EmptyInteraction,
    })
  }

  function clearBindingInteraction(scopeId: string, itemId: string, alias: string): void {
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

  function getScoped(scopeId: string): ScopedStore<Fields, StoreResult> {
    validateScopeId(scopeId)
    const cached = scopedRefs.get(scopeId)?.deref() as ScopedStore<Fields, StoreResult> | undefined
    if (cached) return cached
    const channel =
      channelsById.get(scopeId) ??
      ({
        scopeId,
        snapshot: makeScopedSnapshot(scopeId),
        listeners: new Set<() => void>(),
      } satisfies ScopedChannel)
    const scoped: ScopedStore<Fields, StoreResult> = {
      kind: 'scoped',
      root: store,
      scopeId,
      fields,
      diagnostics: diagnosticsRuntime.facade,
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
        return transactAttributed({ [field.key]: baseline[field.key]! }, scopeId, 'reset')
      },
      resetValueOrThrow(field) {
        const result = scoped.resetValue(field)
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
    }
    if (persistenceController)
      Object.defineProperty(scoped, 'persistence', {
        value: persistenceController.capability,
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

  function metadataCommand(
    scopeId: string,
    transform: (previous: DurableScopeMetadata | undefined) => DurableScopeMetadata | undefined,
  ): CoreTransactionResult {
    if (writing) throw new PicodashContractError('reentrant-write')
    validateScopeId(scopeId)
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
