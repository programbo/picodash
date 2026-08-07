import type { PicodashDiagnostic } from './diagnostics.js'
import type {
  CoreTransactionResult,
  PicodashJsonValue,
  DurableScopeMetadata,
} from './kernel/index.js'
import type { SerializedDurableScopeMetadata } from './metadata.js'
import { decodeDurableScopeMetadata, encodeDurableScopeMetadata } from './metadata.js'
import { PicodashInitializationError } from './adapter.js'

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

export type PersistenceWriteStatus = 'unchanged' | 'saved' | 'pending'

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
}

export type PersistenceCodecRecord = Readonly<{
  readonly values: Readonly<Record<string, PicodashJsonValue>>
  readonly scopes: ReadonlyMap<string, DurableScopeMetadata>
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

const sortedEntries = <V>(map: ReadonlyMap<string, V>): readonly (readonly [string, V])[] =>
  [...map.entries()].sort(([left], [right]) => compareCodePoints(left, right))

const serializedScopes = (scopes: ReadonlyMap<string, DurableScopeMetadata>) =>
  sortedEntries(scopes).map(
    ([scopeId, metadata]) => [scopeId, encodeDurableScopeMetadata(metadata)!] as const,
  )

const persistenceContent = (
  schemaVersion: number,
  values: Readonly<Record<string, PicodashJsonValue>>,
  scopes: ReadonlyMap<string, DurableScopeMetadata>,
  includeField: (key: string) => boolean,
) => {
  const disclosed: Record<string, PicodashJsonValue> = Object.create(null)
  for (const key of Object.keys(values).sort()) if (includeField(key)) disclosed[key] = values[key]!
  return canonicalJson({
    schemaVersion,
    valueOwner: 'store',
    values: disclosed,
    scopes: serializedScopes(scopes),
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

export function encodePersistenceEnvelope(input: {
  readonly storeId: string
  readonly schemaVersion: number
  readonly revision: number
  readonly writerId: string
  readonly values: Readonly<Record<string, PicodashJsonValue>>
  readonly scopes: ReadonlyMap<string, DurableScopeMetadata>
  readonly includeField: (key: string) => boolean
}): PersistenceCodecRecord {
  const values: Record<string, PicodashJsonValue> = Object.create(null)
  for (const key of Object.keys(input.values).sort())
    if (input.includeField(key)) values[key] = input.values[key]!
  const scopes = serializedScopes(input.scopes)
  const envelope = {
    kind: 'picodash-store-envelope' as const,
    formatVersion: 1 as const,
    storeId: input.storeId,
    schemaVersion: input.schemaVersion,
    revision: input.revision,
    writerId: input.writerId,
    valueOwner: 'store' as const,
    values,
    scopes,
  }
  return freeze({
    values: freeze(values),
    scopes: immutableMap(input.scopes),
    revision: input.revision,
    writerId: input.writerId,
    content: persistenceContent(
      input.schemaVersion,
      input.values,
      input.scopes,
      input.includeField,
    ),
    envelope: freeze(envelope),
    serialized: canonicalJson(envelope),
  })
}

export function decodePersistenceEnvelope(
  raw: unknown,
  expected: { readonly storeId: string; readonly schemaVersion: number },
  options: { readonly allowString?: boolean } = {},
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
    if (
      hasExactKeys(value, [
        'formatVersion',
        'kind',
        'revision',
        'schemaVersion',
        'scopes',
        'storeId',
        'valueOwner',
        'writerId',
      ]) &&
      value.valueOwner === 'external'
    )
      return { ok: false, reason: 'authority' }
    if (
      !hasExactKeys(value, [
        'formatVersion',
        'kind',
        'revision',
        'schemaVersion',
        'scopes',
        'storeId',
        'valueOwner',
        'values',
        'writerId',
      ])
    )
      return { ok: false, reason: 'shape' }
    if (value.kind !== 'picodash-store-envelope' || value.formatVersion !== 1)
      return { ok: false, reason: 'format' }
    if (value.storeId !== expected.storeId) return { ok: false, reason: 'identity' }
    if (value.schemaVersion !== expected.schemaVersion) return { ok: false, reason: 'schema' }
    if (value.valueOwner !== 'store') return { ok: false, reason: 'authority' }
    if (!Number.isSafeInteger(value.revision) || (value.revision as number) <= 0)
      return { ok: false, reason: 'format' }
    if (
      typeof value.writerId !== 'string' ||
      value.writerId.trim() !== value.writerId ||
      value.writerId.length === 0 ||
      hasControlCharacter(value.writerId)
    )
      return { ok: false, reason: 'format' }
    if (!isRecord(value.values)) return { ok: false, reason: 'values' }
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
  expected: { readonly storeId: string; readonly schemaVersion: number },
  normalizeValues: (values: unknown) => Readonly<Record<string, PicodashJsonValue>> | undefined,
):
  | { readonly ok: true; readonly record: PersistenceHydrationRecord }
  | { readonly ok: false; readonly reason: PersistenceDecodeReason } {
  const decoded = decodePersistenceEnvelope(raw, expected, { allowString: false })
  if (!decoded.ok) return decoded
  const values = normalizeValues(decoded.envelope.values)
  if (!values) return { ok: false, reason: 'values' }
  const scopes = new Map<string, DurableScopeMetadata>()
  try {
    for (const [scopeId, metadata] of decoded.envelope.scopes) {
      const normalized = decodeDurableScopeMetadata(metadata)
      if (normalized !== undefined) scopes.set(scopeId, normalized)
    }
  } catch {
    return { ok: false, reason: 'metadata' }
  }
  return {
    ok: true,
    record: Object.freeze({
      values,
      scopes: immutableMap(scopes),
      revision: decoded.envelope.revision,
      writerId: decoded.envelope.writerId,
    }),
  }
}

type PersistenceValues = Readonly<Record<string, PicodashJsonValue>>
type PersistenceScopes = ReadonlyMap<string, DurableScopeMetadata>

export type PersistenceController = {
  readonly initialValues: PersistenceValues
  readonly initialScopes: PersistenceScopes
  readonly initialRevision: number
  readonly initialWriterId: string
  readonly capability: PicodashPersistence
  readonly hasUnpersistedState: () => boolean
  readonly persist: (values: PersistenceValues, scopes: PersistenceScopes) => PersistenceWriteStatus
  readonly destroy: (discardUnpersisted: boolean) => void
}

type PersistenceControllerOptions = {
  readonly storageKey: string
  readonly driver: PicodashPersistenceDriver
  readonly storeId: string
  readonly schemaVersion: number
  readonly baselineValues: PersistenceValues
  readonly initialEnvelope?: unknown
  readonly normalizeValues: (values: unknown) => PersistenceValues | undefined
  readonly onExternalValues: (values: PersistenceValues, scopes: PersistenceScopes) => void
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
      | HydrationSourceConflictReason,
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
          : 'invalid-persistence-envelope'
    throw new PicodashInitializationError(reason, code)
  }

  const decodeStructured = (input: unknown, allowString = true) => {
    const result = decodePersistenceEnvelope(input, options, { allowString })
    if (!result.ok) throw new PersistenceDecodeError(result.reason)
    const raw = result.envelope
    const disclosedValues = raw.values as Readonly<Record<string, PicodashJsonValue>>
    for (const key of Object.keys(disclosedValues))
      if (!options.includeField(key)) throw new PersistenceDecodeError('values')
    for (const key of Object.keys(options.baselineValues))
      if (options.includeField(key) && !Object.hasOwn(disclosedValues, key))
        throw new PersistenceDecodeError('values')
    const normalizedValues = options.normalizeValues(disclosedValues)
    if (!normalizedValues) throw new PersistenceDecodeError('values')
    const values = normalizedValues as PersistenceValues
    const scopes = new Map<string, DurableScopeMetadata>()
    for (const [scopeId, metadata] of raw.scopes) {
      try {
        const normalized = decodeDurableScopeMetadata(metadata)
        if (normalized !== undefined) scopes.set(scopeId, normalized)
      } catch {
        throw new PersistenceDecodeError('metadata')
      }
    }
    const content = persistenceContent(options.schemaVersion, values, scopes, options.includeField)
    return {
      values,
      scopes: immutableMap(scopes),
      revision: raw.revision,
      writerId: raw.writerId,
      content,
    }
  }

  let driverRaw: string | null = null
  try {
    driverRaw = options.driver.read(options.storageKey)
  } catch {
    failInit('read')
  }
  let driverRecord: ReturnType<typeof decodeStructured> | undefined
  if (driverRaw !== null) {
    const decoded = decodePersistenceEnvelope(driverRaw, options)
    if (!decoded.ok) return failInit(decoded.reason)
    try {
      driverRecord = decodeStructured(decoded.envelope)
    } catch (error) {
      if (error instanceof PersistenceDecodeError) return failInit(error.reason)
      throw error
    }
  }
  let initialRecord: ReturnType<typeof decodeStructured> | undefined
  if (options.initialEnvelope !== undefined)
    try {
      initialRecord = decodeStructured(options.initialEnvelope, false)
    } catch (error) {
      if (error instanceof PersistenceDecodeError) return failInit(error.reason)
      throw error
    }
  if (driverRecord && initialRecord) {
    if (driverRecord.revision !== initialRecord.revision) failInit('revision')
    if (driverRecord.content !== initialRecord.content) failInit('content')
  }
  const selected = driverRecord ?? initialRecord
  let values = selected?.values ?? options.baselineValues
  let scopes: PersistenceScopes = selected?.scopes ?? new Map()
  let durableRevision = driverRecord?.revision ?? null
  let durableWriterId = driverRecord?.writerId ?? null
  let liveRevision = selected?.revision ?? 0
  let writerId = selected?.writerId ?? newWriterId()
  let pending: PersistenceCodecRecord | undefined
  let lastError: PicodashPersistenceDiagnostic | undefined
  let conflict: PicodashPersistenceConflict | undefined
  let writing = false
  let active = true
  let confirmedContent =
    selected?.content ??
    persistenceContent(options.schemaVersion, values, scopes, options.includeField)
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
      pending = encodePersistenceEnvelope({
        storeId: options.storeId,
        schemaVersion: options.schemaVersion,
        revision,
        writerId,
        values,
        scopes,
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
      const decoded = decodePersistenceEnvelope(raw, options)
      if (!decoded.ok) return { invalid: decoded.reason } as const
      try {
        return decodeStructured(decoded.envelope)
      } catch (error) {
        if (error instanceof PersistenceDecodeError) return { invalid: error.reason } as const
        return 'error' as const
      }
    } catch {
      return 'error' as const
    }
  }
  const isInvalidCurrent = (
    value: ReturnType<typeof readCurrent>,
  ): value is { invalid: PersistenceDecodeReason } =>
    !!value && typeof value === 'object' && 'invalid' in value
  const isStructuredCurrent = (
    value: ReturnType<typeof readCurrent>,
  ): value is ReturnType<typeof decodeStructured> =>
    !!value && typeof value === 'object' && 'content' in value
  const markConflict = (
    reason: PicodashPersistenceConflict['reason'],
    record?: ReturnType<typeof decodeStructured>,
  ) => {
    conflict = stateFreeze({
      reason,
      localRevision: liveRevision,
      localWriterId: writerId,
      durableRevision: record?.revision ?? durableRevision,
      durableWriterId: record?.writerId ?? durableWriterId,
    })
    pending =
      pending ??
      encodePersistenceEnvelope({
        storeId: options.storeId,
        schemaVersion: options.schemaVersion,
        revision: liveRevision || 1,
        writerId,
        values,
        scopes,
        includeField: options.includeField,
      })
    options.withKernelWrite(() => options.onConflict(conflict!))
    publish()
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
      isStructuredCurrent(current) &&
      (current.revision !== durableRevision ||
        current.writerId !== durableWriterId ||
        current.content !== confirmedContent)
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
        after.content !== candidate.content ||
        after.revision !== candidate.revision ||
        after.writerId !== candidate.writerId
      ) {
        recordFailure('write-verification-failed')
        publish()
        return 'pending'
      }
      pending = undefined
      lastError = undefined
      durableRevision = after.revision
      durableWriterId = after.writerId
      confirmedContent = after.content
      options.withKernelWrite(() => options.onRecovery())
      publish()
      return 'saved'
    } finally {
      writing = false
    }
  }
  establishSubscription()
  const racedRecord = readCurrent()
  if (racedRecord === 'error') failInit('read')
  if (isInvalidCurrent(racedRecord)) failInit(racedRecord.invalid)
  if (isStructuredCurrent(racedRecord)) {
    if (initialRecord) {
      if (racedRecord.revision !== initialRecord.revision) failInit('revision')
      if (racedRecord.content !== initialRecord.content) failInit('content')
    }
    driverRecord = racedRecord
    values = racedRecord.values as PersistenceValues
    scopes = racedRecord.scopes
    durableRevision = racedRecord.revision
    durableWriterId = racedRecord.writerId
    liveRevision = racedRecord.revision
    writerId = racedRecord.writerId
    confirmedContent = racedRecord.content
    state = stateFreeze({
      status: 'clean',
      durableRevision,
      liveRevision,
      hasPendingEnvelope: false,
    })
  }
  if (!driverRecord && initialRecord) {
    liveRevision = initialRecord.revision + 1
    writerId = newWriterId()
    const seed = encodePersistenceEnvelope({
      storeId: options.storeId,
      schemaVersion: options.schemaVersion,
      revision: liveRevision,
      writerId,
      values: initialRecord!.values!,
      scopes: initialRecord.scopes,
      includeField: options.includeField,
    })
    const seeded = verifyAndWrite(seed)
    if (seeded !== 'saved') failInit('seed-verification')
    durableRevision = liveRevision
    durableWriterId = writerId
  }
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
            current.content !== confirmedContent ||
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
  ): PersistenceWriteStatus => {
    const candidate = encodePersistenceEnvelope({
      storeId: options.storeId,
      schemaVersion: options.schemaVersion,
      revision: Math.max(liveRevision, durableRevision ?? 0) + 1,
      writerId,
      values: nextValues,
      scopes: nextScopes,
      includeField: options.includeField,
    })
    if (
      candidate.content === confirmedContent ||
      (pending && pending.content === candidate.content)
    )
      return 'unchanged'
    values = nextValues
    scopes = nextScopes
    liveRevision = candidate.revision
    pending = candidate
    publish()
    return verifyAndWrite(candidate)
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
  }
  return {
    initialValues: values,
    initialScopes: scopes,
    initialRevision: liveRevision,
    initialWriterId: writerId,
    capability,
    hasUnpersistedState: () => pending !== undefined,
    persist,
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
