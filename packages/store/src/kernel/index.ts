import type { StandardSchemaV1 } from '@standard-schema/spec'
import { clonePicodashValue, picodashJsonEqual } from '../json.js'
import {
  normalizeDashListMetadataRecord,
  normalizeDashPanelLayoutRecord,
  normalizeDurableScopeMetadata,
} from '../metadata.js'

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
  | 'unknown_field'
  | 'invalid_metadata'
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
  readonly fieldKey?: string
  readonly scopeId?: string
  readonly itemId?: string
  readonly alias?: string
}

export type PicodashValidationContext<Values extends object = Record<string, PicodashJsonValue>> = {
  readonly values: Readonly<Values>
  readonly field?: PicodashField<Values, keyof Values & string>
  readonly source: 'default' | 'initial' | 'programmatic'
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
    readonly source: 'default' | 'initial' | 'programmatic'
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

type InferredStoreConfig<Values extends Record<string, PicodashJsonValue>> = {
  readonly storeId?: string
  readonly schemaVersion?: number
  readonly valueOwner: 'store'
  readonly fields: InputFields<Values>
  readonly initialValues?: Partial<Values>
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

export type StoreOwnedConfig<Fields extends Record<string, FieldLike>> = {
  readonly storeId?: string
  readonly schemaVersion?: number
  readonly valueOwner: 'store'
  readonly fields: DefinitionsFor<Fields>
  readonly initialValues?: Partial<ValuesOf<Fields>>
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

export interface RootStore<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> extends RootMetadataCommands<Result> {
  readonly kind: 'root'
  readonly fields: PicodashFields<Fields>
  scope(scopeId: string): ScopedStore<Fields, Result>
  getState(): RootSnapshot<ValuesOf<Fields>>
  subscribe(listener: () => void): () => void
  setValue<K extends keyof Fields & string>(
    field: PicodashField<ValuesOf<Fields>, K>,
    value: ValuesOf<Fields>[K],
  ): Result
  setValueOrThrow<K extends keyof Fields & string>(
    field: PicodashField<ValuesOf<Fields>, K>,
    value: ValuesOf<Fields>[K],
  ): Extract<Result, { readonly ok: true }>
  setValues(values: Partial<ValuesOf<Fields>>): Result
  setValuesOrThrow(values: Partial<ValuesOf<Fields>>): Extract<Result, { readonly ok: true }>
}

export interface ScopedStore<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> extends ScopedMetadataCommands<Result> {
  readonly kind: 'scoped'
  readonly root: RootStore<Fields, Result>
  readonly scopeId: string
  readonly fields: PicodashFields<Fields>
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
  setValues(values: Partial<ValuesOf<Fields>>): Result
  setValuesOrThrow(values: Partial<ValuesOf<Fields>>): Extract<Result, { readonly ok: true }>
}

type ContractErrorCode =
  | 'invalid-configuration'
  | 'invalid-scope-id'
  | 'foreign-handle'
  | 'async-contract'
  | 'invalid-callback-result'
  | 'reentrant-write'

const BUILTIN_CODES = new Set<PicodashIssueCode>([
  'invalid_json',
  'parse_failed',
  'schema_failed',
  'validation_failed',
  'unknown_field',
  'invalid_metadata',
])

const isAppCode = (value: unknown): value is `app:${string}` =>
  typeof value === 'string' && value.startsWith('app:')

const validIssueCode = (value: unknown): value is PicodashIssueCode =>
  BUILTIN_CODES.has(value as PicodashIssueCode) || isAppCode(value)

const freezePath = (path: readonly (string | number)[]): readonly (string | number)[] =>
  Object.freeze([...path])

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
  | { readonly ok: false; readonly error: PicodashTransactionError }

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
): Extract<CoreTransactionResult, { readonly ok: false }> =>
  Object.freeze({ ok: false as const, error: new PicodashTransactionError(issues) })

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
  },
): RootStore<Definitions, CoreTransactionResult> {
  type Fields = Definitions
  if (!config || typeof config !== 'object' || config.valueOwner !== 'store')
    throw new PicodashContractError('invalid-configuration')
  if (!config.fields || typeof config.fields !== 'object' || Array.isArray(config.fields))
    throw new PicodashContractError('invalid-configuration')
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
  const fieldEntries = Object.keys(config.fields)
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

  let rootValidate: ValuesValidator<ValuesOf<Fields>> | undefined = configuredRootValidate
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
  let values = freeze(canonicalInitial.candidate) as Readonly<Record<string, PicodashJsonValue>>
  let scopes: ReadonlyMap<string, DurableScopeMetadata> = EmptyScopes
  let currentSnapshot = freeze({ values, scopes }) as RootSnapshot<ValuesOf<Fields>>
  const listeners = new Set<() => void>()
  const scopedRefs = new Map<string, WeakRef<object>>()
  type ScopedChannel = {
    readonly scopeId: string
    snapshot: ScopedSnapshot<ValuesOf<Fields>>
    readonly listeners: Set<() => void>
  }
  const scopedInternals = new WeakMap<object, ScopedChannel>()
  const channelsById = new Map<string, ScopedChannel>()
  const activeChannels = new Set<ScopedChannel>()
  let writing = false

  type StoreResult = CoreTransactionResult
  const store: RootStore<Fields, StoreResult> = {
    kind: 'root',
    fields,
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
    setValues(next) {
      return transact(next as Record<string, unknown>)
    },
    setValuesOrThrow(next) {
      const result = transact(next as Record<string, unknown>)
      if (!result.ok) throw result.error
      return result
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
  Object.freeze(store)

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

  function transactAttributed(
    next: Record<string, unknown>,
    originScopeId?: string,
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
    if (!keys.length) return successfulResult()
    writing = true
    try {
      const built = buildCandidate(
        values as Record<string, PicodashJsonValue>,
        next,
        'programmatic',
        originScopeId,
      )
      if (built.issues.length) return rejectedResult(built.issues)
      const changedFields = fieldEntries
        .filter((key) => !picodashJsonEqual(values[key]!, built.candidate[key]!))
        .sort()
      if (!changedFields.length) return successfulResult()
      values = freeze(built.candidate) as Readonly<Record<string, PicodashJsonValue>>
      currentSnapshot = freeze({ values, scopes }) as RootSnapshot<ValuesOf<Fields>>
      const affectedChannels = collectScopedChannels()
      refreshScopedChannels(affectedChannels)
      const result = successfulResult(changedFields)
      for (const listener of listeners) {
        try {
          listener()
        } catch {
          // Subscriber failures are isolated; the committed result remains true.
        }
      }
      notifyScoped(affectedChannels)
      return result
    } finally {
      writing = false
    }
  }

  function validateScopeId(value: unknown): asserts value is string {
    if (typeof value !== 'string')
      throw new PicodashContractError('invalid-scope-id', { reason: 'not-string' })
    if (value.trim().length === 0)
      throw new PicodashContractError('invalid-scope-id', { reason: 'empty' })
    if (value !== value.trim())
      throw new PicodashContractError('invalid-scope-id', { reason: 'surrounding-whitespace' })
    if (!isControlCharacterFree(value))
      throw new PicodashContractError('invalid-scope-id', { reason: 'control-character' })
  }

  function makeScopedSnapshot(scopeId: string): ScopedSnapshot<ValuesOf<Fields>> {
    return freeze({
      values: currentSnapshot.values,
      scope: scopes.get(scopeId),
      interaction: EmptyInteraction,
    })
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

  function notifyScoped(affected: Set<ScopedChannel>) {
    for (const channel of affected)
      for (const listener of channel.listeners) {
        try {
          listener()
        } catch {}
      }
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
      setValues(next) {
        return transactAttributed(next as Record<string, unknown>, scopeId)
      },
      setValuesOrThrow(next) {
        const result = scoped.setValues(next)
        if (!result.ok) throw result.error
        return result
      },
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
    Object.freeze(scoped)
    scopedInternals.set(scoped, channel)
    scopedRefs.set(scopeId, new WeakRef(scoped))
    return scoped
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
      if (metadataEqual(previous, candidate)) return successfulResult()
      const entries = [...scopes.entries()].filter(([id]) => id !== scopeId)
      if (candidate !== undefined) entries.push([scopeId, candidate])
      entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      scopes = entries.length ? immutableMap(entries) : EmptyScopes
      currentSnapshot = freeze({ values, scopes }) as RootSnapshot<ValuesOf<Fields>>
      const affectedChannels = collectScopedChannels(scopeId)
      refreshScopedChannels(affectedChannels)
      const result = successfulResult([], [scopeId])
      for (const listener of listeners) {
        try {
          listener()
        } catch {}
      }
      notifyScoped(affectedChannels)
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
