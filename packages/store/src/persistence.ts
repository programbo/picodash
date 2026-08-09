import type { PicodashDiagnostic } from './diagnostics.js'
import { clonePicodashValue, picodashJsonEqual } from './json.js'
import type {
  CoreTransactionResult,
  PicodashJsonValue,
  DurableScopeMetadata,
} from './kernel/index.js'
import type { SerializedDurableScopeMetadata } from './metadata.js'
import { decodeDurableScopeMetadata, encodeDurableScopeMetadata } from './metadata.js'
import { PicodashInitializationError } from './adapter.js'
import {
  runSchemaMigrations,
  SchemaMigrationError,
  type SchemaMigrationFailureReason,
  type SchemaMigrations,
  type PicodashSchemaMigrationPayload,
} from './migration.js'
import type { PicodashQuarantinedScopeMetadata } from './metadata-recovery.js'

export interface PicodashPersistenceDriver {
  readonly identity: object
  read(storageKey: string): string | null
  write(storageKey: string, envelope: string): void
  remove(storageKey: string): void
  subscribe?(storageKey: string, listener: () => void): () => void
}

export type StoreOwnedPersistenceConfig<
  Fields extends Record<string, { readonly defaultValue: PicodashJsonValue }>,
> = Readonly<{
  storageKey: string
  driver: PicodashPersistenceDriver
  values: {
    defaultFieldPolicy: 'include' | 'omit'
    fields?: Partial<Record<keyof Fields & string, 'include' | 'omit'>>
  }
}>

export type ExternalOwnedPersistenceConfig = Readonly<{
  storageKey: string
  driver: PicodashPersistenceDriver
  values?: never
}>

export type PersistenceWriteStatus = 'unchanged' | 'saved' | 'pending'
export type PersistenceValueOwner = 'store' | 'external'

export type PicodashEnvelopeHeader = Readonly<{
  kind: 'picodash-store-envelope'
  formatVersion: 1
  storeId: string
  schemaVersion: number
  revision: number
  writerId: string
  scopes: readonly (readonly [string, SerializedDurableScopeMetadata])[]
}>

export type PicodashEnvelopeInput<
  Values extends Record<string, PicodashJsonValue> = Record<string, PicodashJsonValue>,
> =
  | (PicodashEnvelopeHeader & {
      readonly valueOwner: 'store'
      readonly values: Readonly<Values>
    })
  | (PicodashEnvelopeHeader & {
      readonly valueOwner: 'external'
      readonly values?: never
    })

export type PersistentTransactionResult =
  | (Extract<CoreTransactionResult, { readonly ok: true }> & {
      readonly persistence: PersistenceWriteStatus
    })
  | Extract<CoreTransactionResult, { readonly ok: false }>

export type PicodashPersistenceConflict = Readonly<{
  reason: 'foreign-envelope' | 'foreign-removal'
  localRevision: number
  localWriterId: string
  durableRevision: number | null
  durableWriterId: string | null
}>

export type PersistenceFailureReason =
  | 'read-failed'
  | 'write-failed'
  | 'write-verification-failed'
  | 'invalid-later-envelope'
  | 'remove-failed'
  | 'remove-verification-failed'

export type PersistenceConflictResolutionOptions =
  | Readonly<{ readonly mode: 'reload' }>
  | Readonly<{ readonly mode: 'overwrite' }>
  | Readonly<{ readonly mode: 'reconcile'; readonly onOverlap: 'local' | 'durable' }>

declare const persistenceConflictResolutionPlanBrand: unique symbol
export type PicodashPersistenceConflictResolutionPlan = Readonly<{
  readonly [persistenceConflictResolutionPlanBrand]: 'PicodashPersistenceConflictResolutionPlan'
  readonly kind: 'persistence-conflict-resolution-plan'
  readonly mode: PersistenceConflictResolutionOptions['mode']
}>

declare const persistenceErasePlanBrand: unique symbol
export type PicodashPersistenceErasePlan = Readonly<{
  readonly [persistenceErasePlanBrand]: 'PicodashPersistenceErasePlan'
  readonly kind: 'persistence-erase-plan'
  readonly hasDurableEnvelope: boolean
  readonly discardsPendingEnvelope: boolean
}>

export type PersistenceEraseResult =
  | Readonly<{
      readonly ok: true
      readonly erased: boolean
      readonly discardedPendingEnvelope: boolean
    }>
  | Readonly<{
      readonly ok: false
      readonly error: import('./kernel/index.js').PicodashTransactionError
    }>

export type PersistenceDriverUnavailableReason =
  | 'read'
  | 'subscribe'
  | 'seed-write'
  | 'seed-verification'
export type InvalidPersistenceEnvelopeReason =
  | 'syntax'
  | 'shape'
  | 'format'
  | 'identity'
  | 'schema'
  | 'authority'
  | 'values'
  | 'metadata'
export type HydrationSourceConflictReason = 'revision' | 'content'
export type SchemaMigrationFailure = SchemaMigrationFailureReason

export type PicodashPersistenceDiagnostic = PicodashDiagnostic<
  'persistence_failure',
  Readonly<{ readonly kind: 'persistence' }>,
  'error'
> & { readonly reason: PersistenceFailureReason }

export type PicodashPersistenceState =
  | Readonly<{
      status: 'clean'
      durableRevision: number | null
      liveRevision: number
      hasPendingEnvelope: false
      lastError?: never
      conflict?: never
    }>
  | Readonly<{
      status: 'pending'
      durableRevision: number | null
      liveRevision: number
      hasPendingEnvelope: true
      lastError?: never
      conflict?: never
    }>
  | Readonly<{
      status: 'error'
      durableRevision: number | null
      liveRevision: number
      hasPendingEnvelope: true
      lastError: PicodashPersistenceDiagnostic
      conflict?: never
    }>
  | Readonly<{
      status: 'conflict'
      durableRevision: number | null
      liveRevision: number
      hasPendingEnvelope: true
      lastError?: never
      conflict: PicodashPersistenceConflict
    }>

export interface PicodashPersistence {
  getState(): PicodashPersistenceState
  subscribe(listener: () => void): () => void
  flush(): PersistenceWriteStatus
  createConflictResolutionPlan(
    options: PersistenceConflictResolutionOptions,
  ): PicodashPersistenceConflictResolutionPlan
  executeConflictResolution(
    plan: PicodashPersistenceConflictResolutionPlan,
  ): PersistentTransactionResult
  createErasePlan(): PicodashPersistenceErasePlan
  executeErase(
    plan: PicodashPersistenceErasePlan,
    options: { readonly confirm: true },
  ): PersistenceEraseResult
}

export type PersistenceCodecRecord = Readonly<{
  readonly values: Readonly<Record<string, PicodashJsonValue>>
  readonly scopes: ReadonlyMap<string, DurableScopeMetadata>
  readonly quarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>
  readonly revision: number
  readonly writerId: string
  readonly content: string
  readonly envelope: PicodashEnvelopeInput
  readonly serialized: string
}>

export type PersistenceDecodeReason = InvalidPersistenceEnvelopeReason

export type PersistenceHydrationRecord = Readonly<{
  readonly values: Readonly<Record<string, PicodashJsonValue>>
  readonly scopes: ReadonlyMap<string, DurableScopeMetadata>
  readonly revision: number
  readonly writerId: string
  readonly quarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>
  readonly unknownFieldCount: number
}>

const hasExactKeys = (value: object, keys: readonly string[]) => {
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const own = Reflect.ownKeys(descriptors)
  if (own.some((key) => typeof key !== 'string')) return false
  if (own.length !== keys.length) return false
  const sorted = (own as string[]).sort()
  const expected = [...keys].sort()
  if (!sorted.every((key, index) => key === expected[index])) return false
  return sorted.every((key) => {
    const descriptor = descriptors[key]!
    return descriptor.enumerable && 'value' in descriptor
  })
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

const isStrictArray = (value: unknown): value is readonly unknown[] => {
  if (!Array.isArray(value)) return false
  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const key of Reflect.ownKeys(descriptors)) {
    if (key === 'length') continue
    if (typeof key !== 'string' || !/^\d+$/.test(key)) return false
    const descriptor = descriptors[key]!
    if (!descriptor.enumerable || !('value' in descriptor)) return false
  }
  for (let index = 0; index < value.length; index += 1)
    if (!Object.hasOwn(value, String(index))) return false
  return true
}

const compareCodePoints = (left: string, right: string): number => {
  const leftPoints = Array.from(left, (value) => value.codePointAt(0)!)
  const rightPoints = Array.from(right, (value) => value.codePointAt(0)!)
  const length = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index]! < rightPoints[index]!) return -1
    if (leftPoints[index]! > rightPoints[index]!) return 1
  }
  return leftPoints.length - rightPoints.length
}

const strictScopeTuple = (
  value: unknown,
): readonly [string, SerializedDurableScopeMetadata] | undefined => {
  try {
    if (!Array.isArray(value)) return undefined
    const descriptors = Object.getOwnPropertyDescriptors(value)
    const own = Reflect.ownKeys(descriptors)
    if (own.length !== 3 || !own.includes('0') || !own.includes('1') || !own.includes('length'))
      return undefined
    const length = descriptors.length as unknown as PropertyDescriptor | undefined
    const first = descriptors[0] as PropertyDescriptor | undefined
    const second = descriptors[1] as PropertyDescriptor | undefined
    if (
      !length ||
      !('value' in length) ||
      length.value !== 2 ||
      !first ||
      !second ||
      !first.enumerable ||
      !second.enumerable ||
      !('value' in first) ||
      !('value' in second) ||
      typeof first.value !== 'string' ||
      !isValidIdentity(first.value)
    )
      return undefined
    for (const key of own)
      if (typeof key !== 'string' || (key !== '0' && key !== '1' && key !== 'length'))
        return undefined
    return [first.value, second.value as SerializedDurableScopeMetadata]
  } catch {
    return undefined
  }
}

const freeze = <T>(value: T): T => Object.freeze(value)

const immutableMap = <K, V>(entries: Iterable<readonly [K, V]>): ReadonlyMap<K, V> => {
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

const serializedScopes = (
  scopes: ReadonlyMap<string, DurableScopeMetadata>,
  quarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata> = new Map(),
) => {
  const entries: [string, SerializedDurableScopeMetadata | PicodashJsonValue][] = []
  for (const [scopeId, metadata] of scopes) {
    const encoded = encodeDurableScopeMetadata(metadata)
    if (encoded !== undefined) entries.push([scopeId, encoded])
  }
  for (const [scopeId, record] of quarantinedScopes)
    if (!scopes.has(scopeId)) entries.push([scopeId, record.raw])
  return entries.sort(([left], [right]) => compareCodePoints(left, right))
}

const persistenceContent = (
  schemaVersion: number,
  values: Readonly<Record<string, PicodashJsonValue>>,
  scopes: ReadonlyMap<string, DurableScopeMetadata>,
  includeField: (key: string) => boolean,
  quarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata> = new Map(),
  valueOwner: PersistenceValueOwner = 'store',
) => {
  const disclosed: Record<string, PicodashJsonValue> = Object.create(null)
  for (const key of Object.keys(values).sort()) if (includeField(key)) disclosed[key] = values[key]!
  return valueOwner === 'external'
    ? canonicalJson({
        schemaVersion,
        valueOwner,
        scopes: serializedScopes(scopes, quarantinedScopes),
      })
    : canonicalJson({
        schemaVersion,
        valueOwner,
        values: disclosed,
        scopes: serializedScopes(scopes, quarantinedScopes),
      })
}

const hasControlCharacter = (value: string): boolean => {
  for (const character of value) {
    const code = character.codePointAt(0)!
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true
  }
  return false
}

const isValidIdentity = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.trim() === value &&
  !hasControlCharacter(value)

export function canonicalJson(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input === 'boolean' || typeof input === 'string') return input
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) throw new Error('invalid json')
      return Object.is(input, -0) ? 0 : input
    }
    if (Array.isArray(input)) {
      if (!isStrictArray(input)) throw new Error('invalid json')
      return input.map(normalize)
    }
    if (isRecord(input)) {
      if (!hasExactKeys(input, Object.keys(input))) throw new Error('invalid json')
      const result: Record<string, unknown> = Object.create(null)
      for (const key of Object.keys(input).sort()) result[key] = normalize(input[key])
      return result
    }
    throw new Error('invalid json')
  }
  return JSON.stringify(normalize(value))
}

type PersistenceEnvelopeEncodeBase = Readonly<{
  readonly storeId: string
  readonly schemaVersion: number
  readonly revision: number
  readonly writerId: string
  readonly scopes: ReadonlyMap<string, DurableScopeMetadata>
  readonly quarantinedScopes?: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>
  readonly includeField: (key: string) => boolean
}>

type PersistenceEnvelopeEncodeInput = PersistenceEnvelopeEncodeBase &
  (
    | Readonly<{
        readonly valueOwner: 'external'
        readonly values?: never
      }>
    | Readonly<{
        readonly valueOwner?: 'store'
        readonly values: Readonly<Record<string, PicodashJsonValue>>
      }>
  )

type PersistenceEnvelopeEncodeInternalInput = PersistenceEnvelopeEncodeBase &
  Readonly<{
    readonly valueOwner?: PersistenceValueOwner
    readonly values?: Readonly<Record<string, PicodashJsonValue>>
  }>

const encodePersistenceEnvelopeInternal = (
  input: PersistenceEnvelopeEncodeInternalInput,
): PersistenceCodecRecord => {
  const sourceValues = input.values ?? Object.create(null)
  const values: Record<string, PicodashJsonValue> = Object.create(null)
  for (const key of Object.keys(sourceValues).sort())
    if (input.includeField(key)) values[key] = sourceValues[key]!
  const scopes = serializedScopes(input.scopes, input.quarantinedScopes)
  const valueOwner = input.valueOwner ?? 'store'
  const envelope = {
    kind: 'picodash-store-envelope' as const,
    formatVersion: 1 as const,
    storeId: input.storeId,
    schemaVersion: input.schemaVersion,
    revision: input.revision,
    writerId: input.writerId,
    valueOwner,
    ...(valueOwner === 'store' ? { values } : {}),
    scopes,
  }
  return freeze({
    values: freeze(valueOwner === 'external' ? Object.create(null) : values),
    scopes: immutableMap(input.scopes),
    quarantinedScopes: immutableMap(input.quarantinedScopes ?? new Map()),
    revision: input.revision,
    writerId: input.writerId,
    content: persistenceContent(
      input.schemaVersion,
      sourceValues,
      input.scopes,
      input.includeField,
      input.quarantinedScopes,
      valueOwner,
    ),
    envelope: freeze(envelope) as unknown as PicodashEnvelopeInput,
    serialized: canonicalJson(envelope),
  })
}

export function encodePersistenceEnvelope(
  input: PersistenceEnvelopeEncodeInput,
): PersistenceCodecRecord {
  return encodePersistenceEnvelopeInternal(input)
}

export function decodePersistenceEnvelope(
  raw: unknown,
  expected: {
    readonly storeId: string
    readonly schemaVersion?: number
    readonly valueOwner?: PersistenceValueOwner
  },
  options: {
    readonly allowString?: boolean
    readonly allowOlderSchema?: boolean
    readonly allowSchemaMismatch?: boolean
  } = {},
):
  | { readonly ok: true; readonly envelope: PicodashEnvelopeInput }
  | { readonly ok: false; readonly reason: PersistenceDecodeReason } {
  let value: unknown = raw
  if (typeof raw === 'string' && options.allowString !== false) {
    try {
      value = JSON.parse(raw)
    } catch {
      return { ok: false, reason: 'syntax' }
    }
  }
  try {
    if (!isRecord(value)) return { ok: false, reason: 'shape' }
    const owner = value.valueOwner
    const expectedOwner = expected.valueOwner ?? 'store'
    if (owner !== 'store' && owner !== 'external') return { ok: false, reason: 'authority' }
    if (owner !== expectedOwner) return { ok: false, reason: 'authority' }
    const commonKeys = [
      'formatVersion',
      'kind',
      'revision',
      'schemaVersion',
      'scopes',
      'storeId',
      'valueOwner',
      'writerId',
    ] as const
    if (owner === 'external') {
      if (Object.hasOwn(value, 'values')) return { ok: false, reason: 'values' }
      if (!hasExactKeys(value, commonKeys)) return { ok: false, reason: 'shape' }
    } else if (!hasExactKeys(value, [...commonKeys, 'values']))
      return { ok: false, reason: 'shape' }
    if (value.kind !== 'picodash-store-envelope' || value.formatVersion !== 1)
      return { ok: false, reason: 'format' }
    if (value.storeId !== expected.storeId) return { ok: false, reason: 'identity' }
    if (
      expected.schemaVersion !== undefined &&
      value.schemaVersion !== expected.schemaVersion &&
      !(
        options.allowSchemaMismatch ||
        (options.allowOlderSchema &&
          typeof value.schemaVersion === 'number' &&
          value.schemaVersion < expected.schemaVersion)
      )
    )
      return { ok: false, reason: 'schema' }
    if (!Number.isSafeInteger(value.revision) || (value.revision as number) <= 0)
      return { ok: false, reason: 'format' }
    if (
      typeof value.writerId !== 'string' ||
      value.writerId.trim() !== value.writerId ||
      value.writerId.length === 0 ||
      hasControlCharacter(value.writerId)
    )
      return { ok: false, reason: 'format' }
    if (owner === 'store' && !isRecord(value.values)) return { ok: false, reason: 'values' }
    if (!isStrictArray(value.scopes)) return { ok: false, reason: 'metadata' }
    const scopes = new Map<string, SerializedDurableScopeMetadata>()
    let previousScopeId: string | undefined
    for (const entry of value.scopes) {
      const tuple = strictScopeTuple(entry)
      if (!tuple) return { ok: false, reason: 'metadata' }
      const [scopeId, metadata] = tuple
      if (previousScopeId !== undefined && compareCodePoints(previousScopeId, scopeId) >= 0)
        return { ok: false, reason: 'metadata' }
      previousScopeId = scopeId
      scopes.set(scopeId, metadata)
    }
    canonicalJson(value)
    return {
      ok: true,
      envelope: freeze({
        ...value,
        scopes: freeze([...scopes.entries()]),
      }) as unknown as PicodashEnvelopeInput,
    }
  } catch {
    return { ok: false, reason: 'metadata' }
  }
}

/** Decodes a Store-owned envelope for driver-free initial hydration. */
export function hydratePersistenceEnvelope(
  raw: unknown,
  expected: {
    readonly storeId: string
    readonly schemaVersion: number
    readonly valueOwner?: PersistenceValueOwner
  },
  normalizeValues: (values: unknown) => Readonly<Record<string, PicodashJsonValue>> | undefined,
  options: {
    readonly migrations?: SchemaMigrations
    readonly valueOwner?: PersistenceValueOwner
    readonly countUnknownFields?: (values: Readonly<Record<string, PicodashJsonValue>>) => number
    readonly onUnknownFieldCount?: (count: number) => void
    readonly onQuarantine?: (scopeId: string) => void
  } = {},
):
  | { readonly ok: true; readonly record: PersistenceHydrationRecord }
  | { readonly ok: false; readonly reason: PersistenceDecodeReason } {
  const decoded = decodePersistenceEnvelope(raw, expected, {
    allowString: false,
    allowSchemaMismatch: options.migrations !== undefined,
  })
  if (!decoded.ok) return decoded
  let migrated: PicodashSchemaMigrationPayload
  try {
    migrated = runSchemaMigrations(
      {
        schemaVersion: decoded.envelope.schemaVersion,
        values:
          decoded.envelope.valueOwner === 'external'
            ? {}
            : (decoded.envelope.values as Readonly<Record<string, PicodashJsonValue>>),
        scopes: decoded.envelope.scopes as readonly (readonly [string, PicodashJsonValue])[],
      },
      expected.schemaVersion,
      options.migrations,
    )
  } catch (error) {
    if (error instanceof SchemaMigrationError)
      throw new PicodashInitializationError(error.reason, 'schema-migration-failed')
    throw new PicodashInitializationError('invalid-result', 'schema-migration-failed')
  }
  if (decoded.envelope.valueOwner === 'external' && Object.keys(migrated.values).length > 0)
    throw new PicodashInitializationError('invalid-result', 'schema-migration-failed')
  const values = normalizeValues(migrated.values)
  if (!values) return { ok: false, reason: 'values' }
  const unknownFieldCount = options.countUnknownFields?.(migrated.values) ?? 0
  const scopes = new Map<string, DurableScopeMetadata>()
  const quarantinedScopes = new Map<string, PicodashQuarantinedScopeMetadata>()
  try {
    for (const [scopeId, metadata] of migrated.scopes) {
      try {
        const normalized = decodeDurableScopeMetadata(metadata)
        if (normalized !== undefined) scopes.set(scopeId, normalized)
      } catch {
        const rawMetadata = clonePicodashValue(metadata as PicodashJsonValue)
        quarantinedScopes.set(scopeId, Object.freeze({ scopeId, raw: rawMetadata }))
        options.onQuarantine?.(scopeId)
      }
    }
  } catch {
    return { ok: false, reason: 'metadata' }
  }
  options.onUnknownFieldCount?.(unknownFieldCount)
  return {
    ok: true,
    record: Object.freeze({
      values,
      scopes: immutableMap(scopes),
      quarantinedScopes: immutableMap(quarantinedScopes),
      unknownFieldCount,
      revision: decoded.envelope.revision,
      writerId: decoded.envelope.writerId,
    }),
  }
}

type PersistenceValues = Readonly<Record<string, PicodashJsonValue>>
type PersistenceScopes = ReadonlyMap<string, DurableScopeMetadata>

type PersistenceProjection = Readonly<{
  readonly values: PersistenceValues
  readonly scopes: PersistenceScopes
  readonly quarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>
  readonly content: string
}>

export type PersistenceConflictResolutionSnapshot = Readonly<{
  readonly mode: PersistenceConflictResolutionOptions['mode']
  readonly onOverlap?: 'local' | 'durable'
  readonly fingerprint: string
}>

export type PersistenceEraseSnapshot = Readonly<{
  readonly fingerprint: string
  readonly hasDurableEnvelope: boolean
  readonly discardsPendingEnvelope: boolean
  readonly observationFingerprint: string
}>

export type PersistenceResolutionOutcome =
  | Readonly<{
      readonly ok: true
      readonly changedFields: readonly string[]
      readonly changedScopeIds: readonly string[]
      readonly persistence: PersistenceWriteStatus
    }>
  | Readonly<{ readonly ok: false; readonly reason: 'stale' | 'failed' }>

export type PersistenceEraseOutcome =
  | Readonly<{
      readonly ok: true
      readonly erased: boolean
      readonly discardedPendingEnvelope: boolean
    }>
  | Readonly<{ readonly ok: false; readonly reason: 'stale' | 'failed' }>

export type PersistenceController = {
  readonly initialValues: PersistenceValues
  readonly initialScopes: PersistenceScopes
  readonly initialQuarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>
  readonly initialRevision: number
  readonly initialWriterId: string
  readonly capability: PicodashPersistence
  readonly hasUnpersistedState: () => boolean
  readonly persist: (
    values: PersistenceValues,
    scopes: PersistenceScopes,
    quarantinedScopes?: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>,
  ) => PersistenceWriteStatus
  readonly createConflictResolutionSnapshot: (
    options: PersistenceConflictResolutionOptions,
  ) => PersistenceConflictResolutionSnapshot
  readonly executeConflictResolution: (
    snapshot: PersistenceConflictResolutionSnapshot,
  ) => PersistenceResolutionOutcome
  readonly createEraseSnapshot: () => PersistenceEraseSnapshot
  readonly executeErase: (snapshot: PersistenceEraseSnapshot) => PersistenceEraseOutcome
  readonly destroy: (discardUnpersisted: boolean) => void
}

type PersistenceControllerOptions = {
  readonly storageKey: string
  readonly driver: PicodashPersistenceDriver
  readonly storeId: string
  readonly schemaVersion: number
  readonly baselineValues: PersistenceValues
  readonly valueOwner?: PersistenceValueOwner
  readonly initialEnvelope?: unknown
  readonly migrations?: SchemaMigrations
  readonly normalizeValues: (values: unknown) => PersistenceValues | undefined
  readonly onUnknownFieldCount?: (count: number) => void
  readonly onUnknownFieldsRecovered?: () => void
  readonly onQuarantine?: (scopeId: string) => void
  readonly onExternalValues: (values: PersistenceValues, scopes: PersistenceScopes) => void
  readonly onApply: (
    values: PersistenceValues,
    scopes: PersistenceScopes,
    quarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>,
  ) => Readonly<{
    readonly changedFields: readonly string[]
    readonly changedScopeIds: readonly string[]
  }>
  readonly createConflictResolutionPlan: (
    options: PersistenceConflictResolutionOptions,
  ) => PicodashPersistenceConflictResolutionPlan
  readonly executeConflictResolution: (
    plan: PicodashPersistenceConflictResolutionPlan,
  ) => PersistentTransactionResult
  readonly createErasePlan: () => PicodashPersistenceErasePlan
  readonly executeErase: (
    plan: PicodashPersistenceErasePlan,
    options: { readonly confirm: true },
  ) => PersistenceEraseResult
  readonly onFailure: (reason: PersistenceFailureReason) => PicodashPersistenceDiagnostic
  readonly onRecovery: () => void
  readonly onConflict: (conflict: PicodashPersistenceConflict) => void
  readonly includeField: (key: string) => boolean
  readonly onUseAfterDestroy: () => never
  readonly dispatchCapability: (listeners: Iterable<() => void>) => void
  readonly withKernelWrite: <T>(run: () => T) => T
}

const ownership = new WeakMap<object, Map<string, object>>()
let writerCounter = 0
const newWriterId = () => {
  writerCounter += 1
  return `writer-${writerCounter.toString(36)}`
}

const stateFreeze = <T>(value: T): T => Object.freeze(value)

class PersistenceDecodeError extends Error {
  readonly reason: PersistenceDecodeReason

  constructor(reason: PersistenceDecodeReason) {
    super(reason)
    this.name = 'PersistenceDecodeError'
    this.reason = reason
  }
}

export function createPersistenceController(
  options: PersistenceControllerOptions,
): PersistenceController {
  const valueOwner = options.valueOwner ?? 'store'
  const isExternalOwner = valueOwner === 'external'
  if (!options.driver || typeof options.driver !== 'object' || !options.driver.identity)
    throw new PicodashInitializationError('read', 'persistence-driver-unavailable')
  const owners = ownership.get(options.driver.identity) ?? new Map<string, object>()
  if (owners.has(options.storageKey))
    throw new Error(`persistence-identity-in-use:${options.storageKey}`)
  const owner = Object.freeze({})
  owners.set(options.storageKey, owner)
  ownership.set(options.driver.identity, owners)
  let released = false
  let releaseSubscription: (() => void) | undefined
  const releaseOwnership = () => {
    if (released) return
    released = true
    owners.delete(options.storageKey)
    if (owners.size === 0) ownership.delete(options.driver.identity)
  }

  const failInit = (
    reason:
      | PersistenceDriverUnavailableReason
      | InvalidPersistenceEnvelopeReason
      | HydrationSourceConflictReason
      | SchemaMigrationFailureReason,
  ): never => {
    releaseSubscription?.()
    releaseSubscription = undefined
    releaseOwnership()
    const code =
      reason === 'read' ||
      reason === 'subscribe' ||
      reason === 'seed-write' ||
      reason === 'seed-verification'
        ? 'persistence-driver-unavailable'
        : reason === 'revision' || reason === 'content'
          ? 'hydration-source-conflict'
          : reason === 'source-newer' ||
              reason === 'missing-step' ||
              reason === 'callback-threw' ||
              reason === 'async-result' ||
              reason === 'invalid-result' ||
              reason === 'wrong-version' ||
              reason === 'final-validation'
            ? 'schema-migration-failed'
            : 'invalid-persistence-envelope'
    throw new PicodashInitializationError(reason, code)
  }

  const decodeRaw = (input: unknown, allowString = true) => {
    const result = decodePersistenceEnvelope(
      input,
      {
        storeId: options.storeId,
        schemaVersion: options.schemaVersion,
        valueOwner,
      },
      { allowString, allowSchemaMismatch: options.migrations !== undefined },
    )
    if (!result.ok) throw new PersistenceDecodeError(result.reason)
    return result.envelope
  }
  const sourceContent = (raw: PicodashEnvelopeInput): string =>
    raw.valueOwner === 'external'
      ? canonicalJson({
          schemaVersion: raw.schemaVersion,
          valueOwner: raw.valueOwner,
          scopes: raw.scopes,
        })
      : canonicalJson({
          schemaVersion: raw.schemaVersion,
          valueOwner: raw.valueOwner,
          values: raw.values,
          scopes: raw.scopes,
        })
  const decodeStructured = (input: unknown, allowString = true) => {
    const raw = decodeRaw(input, allowString)
    let migrated: PicodashSchemaMigrationPayload
    try {
      migrated = runSchemaMigrations(
        {
          schemaVersion: raw.schemaVersion,
          values:
            raw.valueOwner === 'external'
              ? {}
              : (raw.values as Readonly<Record<string, PicodashJsonValue>>),
          scopes: raw.scopes as readonly (readonly [string, PicodashJsonValue])[],
        },
        options.schemaVersion,
        options.migrations,
      )
    } catch (error) {
      if (error instanceof SchemaMigrationError) throw error
      throw new SchemaMigrationError('invalid-result')
    }
    if (isExternalOwner && Object.keys(migrated.values).length > 0)
      throw new SchemaMigrationError('invalid-result')
    const disclosedValues = migrated.values
    let unknownFieldCount = 0
    const unknownValues: Record<string, PicodashJsonValue> = Object.create(null)
    for (const key of Object.keys(disclosedValues))
      if (!Object.hasOwn(options.baselineValues, key)) {
        unknownFieldCount += 1
        unknownValues[key] = disclosedValues[key]!
      }
    const normalizedValues = isExternalOwner
      ? options.baselineValues
      : options.normalizeValues(disclosedValues)
    if (!normalizedValues) throw new SchemaMigrationError('final-validation')
    const values = normalizedValues as PersistenceValues
    const scopes = new Map<string, DurableScopeMetadata>()
    const quarantinedScopes = new Map<string, PicodashQuarantinedScopeMetadata>()
    for (const [scopeId, metadata] of migrated.scopes) {
      try {
        const normalized = decodeDurableScopeMetadata(metadata)
        if (normalized !== undefined) scopes.set(scopeId, normalized)
      } catch {
        quarantinedScopes.set(
          scopeId,
          Object.freeze({ scopeId, raw: clonePicodashValue(metadata as PicodashJsonValue) }),
        )
      }
    }
    const content = persistenceContent(
      options.schemaVersion,
      values,
      scopes,
      options.includeField,
      quarantinedScopes,
      valueOwner,
    )
    return {
      values,
      scopes: immutableMap(scopes),
      quarantinedScopes: immutableMap(quarantinedScopes),
      revision: raw.revision,
      writerId: raw.writerId,
      content,
      sourceContent: sourceContent(raw),
      fenceContent: canonicalJson({ content, unknownValues }),
      unknownFieldCount,
      valueOwner,
    }
  }

  type StructuredObservation = ReturnType<typeof decodeStructured>
  type InvalidObservation = Readonly<{
    readonly invalid: PersistenceDecodeReason | SchemaMigrationFailureReason
    readonly fingerprint: string
  }>
  type EraseObservation = StructuredObservation | InvalidObservation | undefined

  let driverRaw: string | null = null
  try {
    driverRaw = options.driver.read(options.storageKey)
  } catch {
    failInit('read')
  }
  let driverRecord: ReturnType<typeof decodeStructured> | undefined
  let driverRawEnvelope: PicodashEnvelopeInput | undefined
  if (driverRaw !== null) {
    try {
      driverRawEnvelope = decodeRaw(driverRaw)
    } catch (error) {
      if (error instanceof PersistenceDecodeError) return failInit(error.reason)
      throw error
    }
  }
  let initialRecord: ReturnType<typeof decodeStructured> | undefined
  let initialRawEnvelope: PicodashEnvelopeInput | undefined
  if (options.initialEnvelope !== undefined)
    try {
      initialRawEnvelope = decodeRaw(options.initialEnvelope, false)
    } catch (error) {
      if (error instanceof PersistenceDecodeError) return failInit(error.reason)
      throw error
    }
  if (driverRawEnvelope && initialRawEnvelope) {
    if (driverRawEnvelope.revision !== initialRawEnvelope.revision) failInit('revision')
    if (sourceContent(driverRawEnvelope) !== sourceContent(initialRawEnvelope)) failInit('content')
  }
  if (driverRawEnvelope)
    try {
      driverRecord = decodeStructured(driverRawEnvelope)
    } catch (error) {
      if (error instanceof SchemaMigrationError)
        return failInit(error.reason as SchemaMigrationFailureReason)
      throw error
    }
  if (initialRawEnvelope)
    try {
      initialRecord = decodeStructured(initialRawEnvelope, false)
    } catch (error) {
      if (error instanceof SchemaMigrationError)
        return failInit(error.reason as SchemaMigrationFailureReason)
      throw error
    }
  const selected = driverRecord ?? initialRecord
  let values = selected?.values ?? options.baselineValues
  let scopes: PersistenceScopes = selected?.scopes ?? new Map()
  let quarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata> =
    selected?.quarantinedScopes ?? new Map()
  let durableRevision = driverRecord?.revision ?? null
  let durableWriterId = driverRecord?.writerId ?? null
  let liveRevision = selected?.revision ?? 0
  let writerId = selected?.writerId ?? newWriterId()
  let pending: PersistenceCodecRecord | undefined
  let lastError: PicodashPersistenceDiagnostic | undefined
  let conflict: PicodashPersistenceConflict | undefined
  let conflictGeneration = 0
  let writing = false
  let active = true
  let confirmedContent =
    selected?.content ??
    persistenceContent(
      options.schemaVersion,
      values,
      scopes,
      options.includeField,
      quarantinedScopes,
      valueOwner,
    )
  let confirmedFenceContent =
    selected?.fenceContent ?? canonicalJson({ content: confirmedContent, unknownValues: {} })
  let confirmedValues: PersistenceValues = values
  let confirmedScopes: PersistenceScopes = scopes
  let confirmedQuarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata> =
    quarantinedScopes
  let conflictObservation: StructuredObservation | undefined
  let conflictWasRemoval = false
  let eraseObservation: EraseObservation
  const listeners = new Set<() => void>()
  let state: PicodashPersistenceState = stateFreeze({
    status: 'clean',
    durableRevision,
    liveRevision,
    hasPendingEnvelope: false,
  })
  const publish = () => {
    const next: PicodashPersistenceState = conflict
      ? stateFreeze({
          status: 'conflict',
          durableRevision,
          liveRevision,
          hasPendingEnvelope: true,
          conflict,
        })
      : lastError
        ? stateFreeze({
            status: 'error',
            durableRevision,
            liveRevision,
            hasPendingEnvelope: true,
            lastError,
          })
        : pending
          ? stateFreeze({
              status: 'pending',
              durableRevision,
              liveRevision,
              hasPendingEnvelope: true,
            })
          : stateFreeze({
              status: 'clean',
              durableRevision,
              liveRevision,
              hasPendingEnvelope: false,
            })
    if (JSON.stringify(state) === JSON.stringify(next)) return
    state = next
    options.withKernelWrite(() => options.dispatchCapability(listeners))
  }
  const recordFailure = (reason: PersistenceFailureReason) => {
    if (!pending) {
      const revision = Math.max(liveRevision, durableRevision ?? 0) + 1
      pending = encodePersistenceEnvelopeInternal({
        storeId: options.storeId,
        schemaVersion: options.schemaVersion,
        revision,
        writerId,
        values,
        scopes,
        quarantinedScopes,
        valueOwner,
        includeField: options.includeField,
      })
      liveRevision = revision
    }
    lastError = stateFreeze(options.withKernelWrite(() => options.onFailure(reason)))
  }
  const readCurrent = () => {
    try {
      const raw = options.driver.read(options.storageKey)
      if (raw === null) return undefined
      const decoded = decodePersistenceEnvelope(
        raw,
        {
          storeId: options.storeId,
          schemaVersion: options.schemaVersion,
          valueOwner,
        },
        { allowSchemaMismatch: options.migrations !== undefined },
      )
      if (!decoded.ok) return { invalid: decoded.reason, fingerprint: raw } as const
      try {
        return decodeStructured(decoded.envelope)
      } catch (error) {
        if (error instanceof PersistenceDecodeError)
          return { invalid: error.reason, fingerprint: raw } as const
        if (error instanceof SchemaMigrationError)
          return { invalid: error.reason, fingerprint: raw } as const
        return 'error' as const
      }
    } catch {
      return 'error' as const
    }
  }
  const isInvalidCurrent = (value: ReturnType<typeof readCurrent>): value is InvalidObservation =>
    !!value && typeof value === 'object' && 'invalid' in value
  const isStructuredCurrent = (
    value: ReturnType<typeof readCurrent>,
  ): value is ReturnType<typeof decodeStructured> =>
    !!value && typeof value === 'object' && 'content' in value
  const policyValues = (
    source: PersistenceValues,
    candidate: PersistenceValues,
  ): PersistenceValues => {
    const merged: Record<string, PicodashJsonValue> = Object.create(null)
    for (const key of Object.keys(source)) merged[key] = source[key]!
    for (const key of Object.keys(candidate))
      if (options.includeField(key)) merged[key] = candidate[key]!
    return freeze(merged)
  }
  const projection = (
    sourceValues: PersistenceValues,
    sourceScopes: PersistenceScopes,
    sourceQuarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>,
  ): PersistenceProjection => {
    const encoded = encodePersistenceEnvelopeInternal({
      storeId: options.storeId,
      schemaVersion: options.schemaVersion,
      revision: 1,
      writerId: writerId,
      values: sourceValues,
      scopes: sourceScopes,
      quarantinedScopes: sourceQuarantinedScopes,
      valueOwner,
      includeField: options.includeField,
    })
    return Object.freeze({
      values: encoded.values,
      scopes: encoded.scopes,
      quarantinedScopes: encoded.quarantinedScopes,
      content: encoded.content,
    })
  }
  const recordFingerprint = (record: EraseObservation): string =>
    record === undefined
      ? 'absent'
      : isInvalidCurrent(record)
        ? canonicalJson({ present: true, invalid: record.invalid, source: record.fingerprint })
        : canonicalJson({
            present: true,
            revision: record.revision,
            writerId: record.writerId,
            sourceContent: record.sourceContent,
          })
  const localFingerprint = () =>
    canonicalJson({
      content: pending?.content ?? projection(values, scopes, quarantinedScopes).content,
      revision: liveRevision,
      writerId,
    })
  const planFingerprint = (
    kind: 'conflict' | 'erase',
    observation: EraseObservation = conflictObservation,
  ) =>
    canonicalJson({
      kind,
      generation: conflictGeneration,
      conflict: conflict
        ? {
            reason: conflict.reason,
            localRevision: conflict.localRevision,
            localWriterId: conflict.localWriterId,
            durableRevision: conflict.durableRevision,
            durableWriterId: conflict.durableWriterId,
          }
        : null,
      observation: recordFingerprint(observation),
      removal: conflictWasRemoval,
      confirmedContent,
      confirmedFenceContent,
      local: localFingerprint(),
      pending: pending !== undefined,
    })
  const markConflict = (
    reason: PicodashPersistenceConflict['reason'],
    record?: ReturnType<typeof decodeStructured>,
  ) => {
    const nextConflict = stateFreeze({
      reason,
      localRevision: liveRevision,
      localWriterId: writerId,
      durableRevision: record?.revision ?? durableRevision,
      durableWriterId: record?.writerId ?? durableWriterId,
    })
    const unchanged =
      conflict !== undefined &&
      conflict.reason === nextConflict.reason &&
      conflict.durableRevision === nextConflict.durableRevision &&
      conflict.durableWriterId === nextConflict.durableWriterId
    if (!unchanged) conflictGeneration += 1
    conflict = nextConflict
    conflictObservation = record
    conflictWasRemoval = record === undefined
    pending =
      pending ??
      encodePersistenceEnvelopeInternal({
        storeId: options.storeId,
        schemaVersion: options.schemaVersion,
        revision: liveRevision || 1,
        writerId,
        values,
        scopes,
        quarantinedScopes,
        valueOwner,
        includeField: options.includeField,
      })
    options.withKernelWrite(() => options.onConflict(conflict!))
    publish()
  }
  const confirmDurable = (after: StructuredObservation): PersistenceWriteStatus => {
    pending = undefined
    lastError = undefined
    durableRevision = after.revision
    durableWriterId = after.writerId
    confirmedContent = after.content
    confirmedFenceContent = after.fenceContent
    confirmedValues = values
    confirmedScopes = scopes
    confirmedQuarantinedScopes = quarantinedScopes
    conflict = undefined
    conflictObservation = undefined
    conflictWasRemoval = false
    options.withKernelWrite(() => options.onRecovery())
    options.onUnknownFieldsRecovered?.()
    publish()
    return 'saved'
  }
  const verifyAndWrite = (candidate: PersistenceCodecRecord): PersistenceWriteStatus => {
    if (conflict) return 'pending'
    const current = readCurrent()
    if (current === 'error') {
      recordFailure('read-failed')
      publish()
      return 'pending'
    }
    if (isInvalidCurrent(current)) {
      recordFailure('invalid-later-envelope')
      publish()
      return 'pending'
    }
    if (!current && durableRevision !== null) {
      markConflict('foreign-removal')
      return 'pending'
    }
    if (
      pending === candidate &&
      isStructuredCurrent(current) &&
      current.sourceContent === sourceContent(candidate.envelope) &&
      current.revision === candidate.revision &&
      current.writerId === candidate.writerId
    )
      return confirmDurable(current)
    if (
      isStructuredCurrent(current) &&
      (current.revision !== durableRevision ||
        current.writerId !== durableWriterId ||
        current.fenceContent !== confirmedFenceContent)
    ) {
      markConflict('foreign-envelope', current)
      return 'pending'
    }
    writing = true
    try {
      try {
        options.driver.write(options.storageKey, candidate.serialized)
      } catch {
        recordFailure('write-failed')
        publish()
        return 'pending'
      }
      const after = readCurrent()
      if (
        !isStructuredCurrent(after) ||
        after.sourceContent !== sourceContent(candidate.envelope) ||
        after.revision !== candidate.revision ||
        after.writerId !== candidate.writerId
      ) {
        recordFailure('write-verification-failed')
        publish()
        return 'pending'
      }
      return confirmDurable(after)
    } finally {
      writing = false
    }
  }
  establishSubscription()
  const racedRecord = readCurrent()
  if (racedRecord === 'error') failInit('read')
  if (isInvalidCurrent(racedRecord)) failInit(racedRecord.invalid)
  if (racedRecord === undefined && driverRecord !== undefined) {
    pending = undefined
    lastError = undefined
    conflict = undefined
    conflictObservation = undefined
    conflictWasRemoval = false
    driverRecord = undefined
    values = initialRecord?.values ?? options.baselineValues
    scopes = initialRecord?.scopes ?? new Map()
    quarantinedScopes = initialRecord?.quarantinedScopes ?? new Map()
    durableRevision = null
    durableWriterId = null
    liveRevision = initialRecord?.revision ?? 0
    writerId = initialRecord?.writerId ?? newWriterId()
    confirmedContent =
      initialRecord?.content ??
      persistenceContent(
        options.schemaVersion,
        values,
        scopes,
        options.includeField,
        quarantinedScopes,
        valueOwner,
      )
    confirmedFenceContent =
      initialRecord?.fenceContent ?? canonicalJson({ content: confirmedContent, unknownValues: {} })
    confirmedValues = values
    confirmedScopes = scopes
    confirmedQuarantinedScopes = quarantinedScopes
    state = stateFreeze({
      status: 'clean',
      durableRevision,
      liveRevision,
      hasPendingEnvelope: false,
    })
  }
  if (isStructuredCurrent(racedRecord)) {
    if (initialRecord) {
      if (racedRecord.revision !== initialRecord.revision) failInit('revision')
      if (racedRecord.sourceContent !== initialRecord.sourceContent) failInit('content')
    }
    driverRecord = racedRecord
    pending = undefined
    lastError = undefined
    conflict = undefined
    conflictObservation = undefined
    conflictWasRemoval = false
    values = racedRecord.values as PersistenceValues
    scopes = racedRecord.scopes
    quarantinedScopes = racedRecord.quarantinedScopes
    durableRevision = racedRecord.revision
    durableWriterId = racedRecord.writerId
    liveRevision = racedRecord.revision
    writerId = racedRecord.writerId
    confirmedContent = racedRecord.content
    confirmedFenceContent = racedRecord.fenceContent
    confirmedValues = racedRecord.values
    confirmedScopes = racedRecord.scopes
    confirmedQuarantinedScopes = racedRecord.quarantinedScopes
    state = stateFreeze({
      status: 'clean',
      durableRevision,
      liveRevision,
      hasPendingEnvelope: false,
    })
  }
  let seededInitialEnvelope = false
  if (!driverRecord && initialRecord) {
    liveRevision = initialRecord.revision + 1
    writerId = newWriterId()
    const seed = encodePersistenceEnvelopeInternal({
      storeId: options.storeId,
      schemaVersion: options.schemaVersion,
      revision: liveRevision,
      writerId,
      values: initialRecord!.values!,
      scopes: initialRecord.scopes,
      quarantinedScopes: initialRecord.quarantinedScopes,
      valueOwner,
      includeField: options.includeField,
    })
    const seeded = verifyAndWrite(seed)
    if (seeded !== 'saved') failInit('seed-verification')
    durableRevision = liveRevision
    durableWriterId = writerId
    confirmedValues = seed.values
    confirmedScopes = seed.scopes
    confirmedQuarantinedScopes = seed.quarantinedScopes
    seededInitialEnvelope = true
  }
  const activatedRecord = driverRecord ?? initialRecord
  options.onUnknownFieldCount?.(
    seededInitialEnvelope ? 0 : (activatedRecord?.unknownFieldCount ?? 0),
  )
  for (const scopeId of quarantinedScopes.keys()) options.onQuarantine?.(scopeId)
  function establishSubscription(): void {
    try {
      if (options.driver.subscribe) {
        const result = options.driver.subscribe(options.storageKey, () => {
          if (!active || writing) return
          const current = readCurrent()
          if (current === 'error') {
            recordFailure('read-failed')
            publish()
            return
          }
          if (isInvalidCurrent(current)) {
            recordFailure('invalid-later-envelope')
            publish()
            return
          }
          if (!current) {
            if (durableRevision === null && initialRecord !== undefined) return
            markConflict('foreign-removal')
            return
          }
          if (!isStructuredCurrent(current)) return
          if (
            current.fenceContent !== confirmedFenceContent ||
            current.writerId !== durableWriterId ||
            current.revision !== durableRevision
          ) {
            markConflict('foreign-envelope', current)
            return
          }
          if (lastError !== undefined) {
            lastError = undefined
            options.withKernelWrite(() => options.onRecovery())
            publish()
          }
        })
        if (typeof result !== 'function') failInit('subscribe')
        releaseSubscription = result
      }
    } catch {
      failInit('subscribe')
    }
  }

  const persist = (
    nextValues: PersistenceValues,
    nextScopes: PersistenceScopes,
    nextQuarantinedScopes: ReadonlyMap<
      string,
      PicodashQuarantinedScopeMetadata
    > = quarantinedScopes,
  ): PersistenceWriteStatus => {
    const candidate = encodePersistenceEnvelopeInternal({
      storeId: options.storeId,
      schemaVersion: options.schemaVersion,
      revision: Math.max(liveRevision, durableRevision ?? 0) + 1,
      writerId,
      values: nextValues,
      scopes: nextScopes,
      quarantinedScopes: nextQuarantinedScopes,
      valueOwner,
      includeField: options.includeField,
    })
    if (candidate.content === confirmedContent) {
      values = nextValues
      scopes = nextScopes
      quarantinedScopes = nextQuarantinedScopes
      if (conflict) {
        pending = candidate
        publish()
        return 'unchanged'
      }
      const recovered = pending !== undefined || lastError !== undefined
      pending = undefined
      lastError = undefined
      liveRevision = durableRevision ?? 0
      if (recovered) options.withKernelWrite(() => options.onRecovery())
      publish()
      return 'unchanged'
    }
    if (pending && pending.content === candidate.content) {
      values = nextValues
      scopes = nextScopes
      quarantinedScopes = nextQuarantinedScopes
      return 'unchanged'
    }
    values = nextValues
    scopes = nextScopes
    quarantinedScopes = nextQuarantinedScopes
    liveRevision = candidate.revision
    pending = candidate
    publish()
    return verifyAndWrite(candidate)
  }
  type ScopeUnit =
    | Readonly<{ readonly kind: 'metadata'; readonly value: DurableScopeMetadata }>
    | Readonly<{ readonly kind: 'quarantine'; readonly value: PicodashQuarantinedScopeMetadata }>

  const scopeUnits = (
    sourceScopes: PersistenceScopes,
    sourceQuarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>,
  ): ReadonlyMap<string, ScopeUnit> => {
    const units = new Map<string, ScopeUnit>()
    for (const [scopeId, metadata] of sourceScopes)
      units.set(scopeId, Object.freeze({ kind: 'metadata', value: metadata }))
    for (const [scopeId, record] of sourceQuarantinedScopes)
      if (!units.has(scopeId))
        units.set(scopeId, Object.freeze({ kind: 'quarantine', value: record }))
    return units
  }
  const scopeUnitFingerprint = (unit: ScopeUnit | undefined): string => {
    if (unit === undefined) return 'absent'
    return unit.kind === 'metadata'
      ? canonicalJson(encodeDurableScopeMetadata(unit.value) ?? null)
      : canonicalJson(unit.value.raw)
  }
  const mergeSide = <T>(
    base: T | undefined,
    local: T | undefined,
    durable: T | undefined,
    equal: (left: T | undefined, right: T | undefined) => boolean,
    onOverlap: 'local' | 'durable',
  ): T | undefined => {
    if (equal(local, durable)) return local
    if (equal(local, base)) return durable
    if (equal(durable, base)) return local
    return onOverlap === 'local' ? local : durable
  }
  const readResolutionTarget = (
    expected: PersistenceConflictResolutionSnapshot | PersistenceEraseSnapshot,
  ) => {
    const current = readCurrent()
    if (current === 'error') return { ok: false as const, reason: 'failed' as const }
    if ('mode' in expected && isInvalidCurrent(current))
      return { ok: false as const, reason: 'failed' as const }
    const currentObservation =
      isStructuredCurrent(current) || isInvalidCurrent(current) ? current : undefined
    const currentRecord = isStructuredCurrent(current) ? current : undefined
    const capturedObservation = 'mode' in expected ? conflictObservation : eraseObservation
    if (recordFingerprint(currentObservation) !== recordFingerprint(capturedObservation))
      return { ok: false as const, reason: 'stale' as const }
    if (planFingerprint('conflict') !== expected.fingerprint && 'mode' in expected)
      return { ok: false as const, reason: 'stale' as const }
    if (
      planFingerprint('erase', eraseObservation) !== expected.fingerprint &&
      !('mode' in expected)
    )
      return { ok: false as const, reason: 'stale' as const }
    return { ok: true as const, current: currentRecord }
  }
  const createConflictResolutionSnapshot = (
    input: PersistenceConflictResolutionOptions,
  ): PersistenceConflictResolutionSnapshot => {
    if (!conflict) throw new Error('not-conflicted')
    const observed = readCurrent()
    if (observed === undefined || isStructuredCurrent(observed)) {
      conflictObservation = observed
      conflictWasRemoval = observed === undefined
    }
    return Object.freeze({
      mode: input.mode,
      ...(input.mode === 'reconcile' ? { onOverlap: input.onOverlap } : {}),
      fingerprint: planFingerprint('conflict'),
    })
  }
  const executeConflictResolution = (
    snapshot: PersistenceConflictResolutionSnapshot,
  ): PersistenceResolutionOutcome => {
    if (!active) return { ok: false, reason: 'failed' }
    return options.withKernelWrite(() => {
      const target = readResolutionTarget(snapshot)
      if (!target.ok) return target
      const durable = target.current
      const durableValues = durable?.values ?? options.baselineValues
      const durableScopes = durable?.scopes ?? new Map<string, DurableScopeMetadata>()
      const durableQuarantine = durable?.quarantinedScopes ?? new Map()
      const localProjection = projection(values, scopes, quarantinedScopes)
      const baseProjection = projection(
        confirmedValues,
        confirmedScopes,
        confirmedQuarantinedScopes,
      )
      const durableProjection = projection(durableValues, durableScopes, durableQuarantine)
      let resolvedValues: PersistenceValues
      let resolvedScopes: PersistenceScopes
      let resolvedQuarantine: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>
      if (snapshot.mode === 'reload') {
        resolvedValues = isExternalOwner ? values : policyValues(values, durableValues)
        resolvedScopes = durableScopes
        resolvedQuarantine = durableQuarantine
      } else if (snapshot.mode === 'overwrite') {
        resolvedValues = values
        resolvedScopes = scopes
        resolvedQuarantine = quarantinedScopes
      } else {
        const localPersisted = localProjection.values
        const basePersisted = baseProjection.values
        const durablePersisted = durableProjection.values
        const mergedPersisted: Record<string, PicodashJsonValue> = Object.create(null)
        const valueKeys = new Set([
          ...Object.keys(basePersisted),
          ...Object.keys(localPersisted),
          ...Object.keys(durablePersisted),
        ])
        for (const key of valueKeys) {
          const chosen = mergeSide(
            basePersisted[key],
            localPersisted[key],
            durablePersisted[key],
            (left, right) => picodashJsonEqual(left as never, right as never),
            snapshot.onOverlap!,
          )
          if (chosen !== undefined) mergedPersisted[key] = chosen
        }
        if (isExternalOwner) resolvedValues = values
        else {
          const normalized = options.normalizeValues(mergedPersisted)
          if (!normalized) {
            options.withKernelWrite(() => options.onFailure('invalid-later-envelope'))
            return { ok: false, reason: 'failed' }
          }
          resolvedValues = policyValues(values, normalized)
        }
        const localUnits = scopeUnits(scopes, quarantinedScopes)
        const baseUnits = scopeUnits(confirmedScopes, confirmedQuarantinedScopes)
        const durableUnits = scopeUnits(durableScopes, durableQuarantine)
        const mergedScopes = new Map<string, DurableScopeMetadata>()
        const mergedQuarantine = new Map<string, PicodashQuarantinedScopeMetadata>()
        const scopeIds = new Set([
          ...baseUnits.keys(),
          ...localUnits.keys(),
          ...durableUnits.keys(),
        ])
        for (const scopeId of scopeIds) {
          const chosen = mergeSide(
            baseUnits.get(scopeId),
            localUnits.get(scopeId),
            durableUnits.get(scopeId),
            (left, right) => scopeUnitFingerprint(left) === scopeUnitFingerprint(right),
            snapshot.onOverlap!,
          )
          if (chosen?.kind === 'metadata') mergedScopes.set(scopeId, chosen.value)
          if (chosen?.kind === 'quarantine') mergedQuarantine.set(scopeId, chosen.value)
        }
        resolvedScopes = immutableMap(mergedScopes)
        resolvedQuarantine = immutableMap(mergedQuarantine)
      }
      const candidate = encodePersistenceEnvelopeInternal({
        storeId: options.storeId,
        schemaVersion: options.schemaVersion,
        revision: Math.max(liveRevision, durable?.revision ?? 0, durableRevision ?? 0) + 1,
        writerId,
        values: resolvedValues,
        scopes: resolvedScopes,
        quarantinedScopes: resolvedQuarantine,
        valueOwner,
        includeField: options.includeField,
      })
      const shouldWrite =
        snapshot.mode === 'overwrite' || snapshot.mode === 'reload'
          ? snapshot.mode === 'overwrite'
          : candidate.content !== durableProjection.content
      let after = durable
      if (shouldWrite) {
        writing = true
        try {
          try {
            options.driver.write(options.storageKey, candidate.serialized)
          } catch {
            options.withKernelWrite(() => options.onFailure('write-failed'))
            return { ok: false, reason: 'failed' }
          }
          const verified = readCurrent()
          after = isStructuredCurrent(verified) ? verified : undefined
          if (
            !isStructuredCurrent(after) ||
            after.sourceContent !== sourceContent(candidate.envelope) ||
            after.revision !== candidate.revision ||
            after.writerId !== candidate.writerId
          ) {
            options.withKernelWrite(() => options.onFailure('write-verification-failed'))
            return { ok: false, reason: 'failed' }
          }
        } finally {
          writing = false
        }
      }
      const appliedValues = snapshot.mode === 'overwrite' ? values : resolvedValues
      const appliedScopes = snapshot.mode === 'overwrite' ? scopes : resolvedScopes
      const appliedQuarantine =
        snapshot.mode === 'overwrite' ? quarantinedScopes : resolvedQuarantine
      const changed =
        snapshot.mode === 'overwrite'
          ? { changedFields: Object.freeze([]), changedScopeIds: Object.freeze([]) }
          : options.onApply(appliedValues, appliedScopes, appliedQuarantine)
      values = appliedValues
      scopes = appliedScopes
      quarantinedScopes = appliedQuarantine
      pending = undefined
      lastError = undefined
      conflict = undefined
      conflictObservation = undefined
      conflictWasRemoval = false
      if (isStructuredCurrent(after)) {
        durableRevision = after.revision
        durableWriterId = after.writerId
        confirmedContent = after.content
        confirmedFenceContent = after.fenceContent
        confirmedValues = appliedValues
        confirmedScopes = appliedScopes
        confirmedQuarantinedScopes = appliedQuarantine
        liveRevision = Math.max(liveRevision, after.revision)
        if (after.unknownFieldCount > 0) options.onUnknownFieldCount?.(after.unknownFieldCount)
        else options.onUnknownFieldsRecovered?.()
      } else {
        durableRevision = null
        durableWriterId = null
        confirmedContent = projection(appliedValues, appliedScopes, appliedQuarantine).content
        confirmedFenceContent = canonicalJson({ content: confirmedContent, unknownValues: {} })
        confirmedValues = appliedValues
        confirmedScopes = appliedScopes
        confirmedQuarantinedScopes = appliedQuarantine
        options.onUnknownFieldsRecovered?.()
      }
      options.withKernelWrite(() => options.onRecovery())
      publish()
      return {
        ok: true,
        changedFields: changed.changedFields,
        changedScopeIds: changed.changedScopeIds,
        persistence: shouldWrite ? 'saved' : 'unchanged',
      }
    })
  }
  const createEraseSnapshot = (): PersistenceEraseSnapshot => {
    const current = readCurrent()
    eraseObservation =
      isStructuredCurrent(current) || isInvalidCurrent(current) ? current : undefined
    return Object.freeze({
      fingerprint: planFingerprint('erase', eraseObservation),
      hasDurableEnvelope: eraseObservation !== undefined,
      discardsPendingEnvelope: pending !== undefined,
      observationFingerprint: recordFingerprint(eraseObservation),
    })
  }
  const executeErase = (snapshot: PersistenceEraseSnapshot): PersistenceEraseOutcome => {
    if (!active) return { ok: false, reason: 'failed' }
    return options.withKernelWrite(() => {
      const target = readResolutionTarget(snapshot)
      if (!target.ok) return target
      writing = true
      try {
        try {
          options.driver.remove(options.storageKey)
        } catch {
          options.withKernelWrite(() => options.onFailure('remove-failed'))
          return { ok: false, reason: 'failed' }
        }
        const after = readCurrent()
        if (after !== undefined) {
          options.withKernelWrite(() => options.onFailure('remove-verification-failed'))
          return { ok: false, reason: 'failed' }
        }
      } finally {
        writing = false
      }
      const discardedPendingEnvelope = pending !== undefined
      pending = undefined
      conflict = undefined
      conflictObservation = undefined
      conflictWasRemoval = false
      lastError = undefined
      durableRevision = null
      durableWriterId = null
      confirmedValues = values
      confirmedScopes = scopes
      confirmedQuarantinedScopes = quarantinedScopes
      confirmedContent = projection(values, scopes, quarantinedScopes).content
      confirmedFenceContent = canonicalJson({ content: confirmedContent, unknownValues: {} })
      options.withKernelWrite(() => options.onRecovery())
      publish()
      return {
        ok: true,
        erased: snapshot.hasDurableEnvelope,
        discardedPendingEnvelope,
      }
    })
  }
  const capability: PicodashPersistence = {
    getState: () => {
      if (!active) return options.onUseAfterDestroy()
      return state
    },
    subscribe(listener) {
      if (!active) return options.onUseAfterDestroy()
      if (typeof listener !== 'function') throw new Error('invalid listener')
      listeners.add(listener)
      let subscribed = true
      return () => {
        if (subscribed) {
          subscribed = false
          listeners.delete(listener)
        }
      }
    },
    flush() {
      if (!active) return options.onUseAfterDestroy()
      return options.withKernelWrite(() => {
        if (!pending || conflict) return pending ? 'pending' : 'unchanged'
        return verifyAndWrite(pending)
      })
    },
    createConflictResolutionPlan(input) {
      if (!active) return options.onUseAfterDestroy()
      return options.createConflictResolutionPlan(input)
    },
    executeConflictResolution(plan) {
      if (!active) return options.onUseAfterDestroy()
      return options.executeConflictResolution(plan)
    },
    createErasePlan() {
      if (!active) return options.onUseAfterDestroy()
      return options.createErasePlan()
    },
    executeErase(plan, eraseOptions) {
      if (!active) return options.onUseAfterDestroy()
      return options.executeErase(plan, eraseOptions)
    },
  }
  return {
    initialValues: values,
    initialScopes: scopes,
    initialQuarantinedScopes: quarantinedScopes,
    initialRevision: liveRevision,
    initialWriterId: writerId,
    capability,
    hasUnpersistedState: () => pending !== undefined,
    persist,
    createConflictResolutionSnapshot,
    executeConflictResolution,
    createEraseSnapshot,
    executeErase,
    destroy(discard) {
      active = false
      if (discard) pending = undefined
      releaseSubscription?.()
      releaseSubscription = undefined
      listeners.clear()
      releaseOwnership()
    },
  }
}
