import { clonePicodashValue, picodashJsonEqual } from './json.js'
import {
  decodeDurableScopeMetadata,
  encodeDurableScopeMetadata,
  type SerializedDurableScopeMetadata,
} from './metadata.js'
import {
  runSchemaMigrations,
  type PicodashSchemaMigrationPayload,
  type SchemaMigrations,
} from './migration.js'
import type { PicodashField, PicodashJsonValue } from './kernel/index.js'

/** The disclosure marker used for fields that are configured as redacted. */
export type PicodashDocumentFieldValue =
  | Readonly<{ readonly status: 'included'; readonly value: PicodashJsonValue }>
  | Readonly<{ readonly status: 'redacted' }>

/** A deterministic serialized field entry. */
export type PicodashDocumentFieldEntry = readonly [
  fieldKey: string,
  entry: PicodashDocumentFieldValue,
]

export type PicodashRootDocument = Readonly<{
  readonly formatVersion: 1
  readonly kind: 'root'
  readonly storeId: string
  readonly schemaVersion: number
  readonly fields: readonly PicodashDocumentFieldEntry[]
  readonly scopes: readonly (readonly [string, SerializedDurableScopeMetadata])[]
}>

export type PicodashScopeDocument = Readonly<{
  readonly formatVersion: 1
  readonly kind: 'scope'
  readonly storeId: string
  readonly schemaVersion: number
  readonly scopeId: string
  readonly fields: readonly PicodashDocumentFieldEntry[]
  readonly scopes: readonly (readonly [string, SerializedDurableScopeMetadata])[]
}>

export type PicodashDocument = PicodashRootDocument | PicodashScopeDocument

export type PicodashDocumentFailureReason =
  | 'shape'
  | 'format'
  | 'kind'
  | 'identity'
  | 'schema'
  | 'fields'
  | 'scopes'
  | 'metadata'
  | 'foreign_store'
  | 'unknown_field'
  | 'incompatible_field'
  | 'missing_scope'
  | 'schema_migration_failed'
  | 'stale_plan'

/** Safe, structured failure for the pure document codec. */
export class PicodashDocumentError extends TypeError {
  readonly code = 'invalid_document' as const
  readonly reason: PicodashDocumentFailureReason
  readonly path: readonly [] = Object.freeze([]) as readonly []

  constructor(reason: PicodashDocumentFailureReason) {
    super('Invalid Store document.')
    this.name = 'PicodashDocumentError'
    this.reason = reason
  }
}

export type PicodashDocumentOptionOperation = 'export' | 'export-execution' | 'import-analysis'

export type PicodashDocumentOptionReason =
  | 'not-object'
  | 'unknown-key'
  | 'accessor-property'
  | 'invalid-target'
  | 'invalid-fields'
  | 'duplicate-field'
  | 'invalid-promotion'
  | 'invalid-mapping'
  | 'duplicate-target'
  | 'invalid-boolean'
  | 'confirmation-required'
  | 'unexpected-confirmation'

/** Safe option-validation failure. It intentionally contains no rejected values. */
export class PicodashDocumentOptionsError extends TypeError {
  readonly code = 'invalid-document-options' as const
  readonly operation: PicodashDocumentOptionOperation
  readonly reason: PicodashDocumentOptionReason

  constructor(operation: PicodashDocumentOptionOperation, reason: PicodashDocumentOptionReason) {
    super('Invalid Store document options.')
    this.name = 'PicodashDocumentOptionsError'
    this.operation = operation
    this.reason = reason
  }
}

const freeze = <T>(value: T): T => Object.freeze(value)
const own = (value: Record<string, unknown>, key: string): unknown => value[key]

const compareCodePoints = (left: string, right: string): number => {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0)!)
  const rightPoints = Array.from(right, (character) => character.codePointAt(0)!)
  const length = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index]! < rightPoints[index]!) return -1
    if (leftPoints[index]! > rightPoints[index]!) return 1
  }
  return leftPoints.length - rightPoints.length
}

const validIdentity = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return false
  for (const character of value) {
    const code = character.codePointAt(0)!
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return false
  }
  return true
}

const validFieldKey = (value: unknown): value is string =>
  validIdentity(value) && value !== '__proto__' && value !== 'prototype' && value !== 'constructor'

function strictRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return false
    for (const key of Reflect.ownKeys(Object.getOwnPropertyDescriptors(value))) {
      if (typeof key !== 'string') return false
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!
      if (!descriptor.enumerable || !('value' in descriptor)) return false
    }
    return true
  } catch {
    return false
  }
}

function strictArray(value: unknown): value is readonly unknown[] {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false
    const descriptors = Object.getOwnPropertyDescriptors(value)
    for (const key of Reflect.ownKeys(descriptors)) {
      if (key === 'length') continue
      if (typeof key !== 'string' || !/^0$|^[1-9]\d*$/.test(key) || Number(key) >= value.length)
        return false
      const descriptor = descriptors[key]!
      if (!descriptor.enumerable || !('value' in descriptor)) return false
    }
    for (let index = 0; index < value.length; index += 1)
      if (!Object.hasOwn(value, String(index))) return false
    return true
  } catch {
    return false
  }
}

const exactKeys = (
  value: unknown,
  expected: readonly string[],
): value is Record<string, unknown> => {
  if (!strictRecord(value)) return false
  const keys = Object.keys(value).sort(compareCodePoints)
  const wanted = [...expected].sort(compareCodePoints)
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index])
}

const sortedUnique = (values: readonly string[]): boolean => {
  let previous: string | undefined
  for (const value of values) {
    if (
      !validIdentity(value) ||
      (previous !== undefined && compareCodePoints(previous, value) >= 0)
    )
      return false
    previous = value
  }
  return true
}

function tuple(value: unknown, length: number): readonly unknown[] | undefined {
  if (!strictArray(value) || value.length !== length) return undefined
  return value
}

function documentFieldEntry(value: unknown): PicodashDocumentFieldEntry {
  const pair = tuple(value, 2)
  if (!pair || !validFieldKey(pair[0])) throw new PicodashDocumentError('fields')
  const entry = pair[1]
  if (!strictRecord(entry) || typeof own(entry, 'status') !== 'string')
    throw new PicodashDocumentError('fields')
  if (own(entry, 'status') === 'redacted') {
    if (!exactKeys(entry, ['status'])) throw new PicodashDocumentError('fields')
    return freeze([pair[0], freeze({ status: 'redacted' as const })] as const)
  }
  if (own(entry, 'status') !== 'included' || !exactKeys(entry, ['status', 'value']))
    throw new PicodashDocumentError('fields')
  let valueClone: PicodashJsonValue
  try {
    valueClone = clonePicodashValue(own(entry, 'value') as PicodashJsonValue)
  } catch {
    throw new PicodashDocumentError('fields')
  }
  return freeze([pair[0], freeze({ status: 'included' as const, value: valueClone })] as const)
}

function documentFields(value: unknown): readonly PicodashDocumentFieldEntry[] {
  if (!strictArray(value)) throw new PicodashDocumentError('fields')
  const entries: PicodashDocumentFieldEntry[] = []
  let previous: string | undefined
  for (const rawEntry of value) {
    const entry = documentFieldEntry(rawEntry)
    const key = entry[0]
    if (previous !== undefined && compareCodePoints(previous, key) >= 0)
      throw new PicodashDocumentError('fields')
    previous = key
    entries.push(entry)
  }
  return freeze(entries)
}

function documentScopes(
  value: unknown,
): readonly (readonly [string, SerializedDurableScopeMetadata])[] {
  if (!strictArray(value)) throw new PicodashDocumentError('scopes')
  const entries: [string, SerializedDurableScopeMetadata][] = []
  let previous: string | undefined
  for (const rawEntry of value) {
    const pair = tuple(rawEntry, 2)
    if (!pair || !validIdentity(pair[0])) throw new PicodashDocumentError('scopes')
    const scopeId = pair[0]
    if (previous !== undefined && compareCodePoints(previous, scopeId) >= 0)
      throw new PicodashDocumentError('scopes')
    previous = scopeId
    try {
      const metadata = decodeDurableScopeMetadata(pair[1])
      if (metadata === undefined) throw new Error('empty metadata')
      const encoded = encodeDurableScopeMetadata(metadata)
      if (encoded === undefined) throw new Error('empty metadata')
      entries.push(freeze([scopeId, encoded] as const))
    } catch {
      throw new PicodashDocumentError('metadata')
    }
  }
  return freeze(entries)
}

function canonicalDocument(value: unknown): PicodashDocument {
  if (!strictRecord(value)) throw new PicodashDocumentError('shape')
  const kind = own(value, 'kind')
  const expected =
    kind === 'root'
      ? ['formatVersion', 'kind', 'storeId', 'schemaVersion', 'fields', 'scopes']
      : kind === 'scope'
        ? ['formatVersion', 'kind', 'storeId', 'schemaVersion', 'scopeId', 'fields', 'scopes']
        : []
  if (expected.length === 0) throw new PicodashDocumentError('kind')
  if (!exactKeys(value, expected)) throw new PicodashDocumentError('shape')
  if (own(value, 'formatVersion') !== 1) throw new PicodashDocumentError('format')
  if (typeof kind !== 'string' || (kind !== 'root' && kind !== 'scope'))
    throw new PicodashDocumentError('kind')
  if (!validIdentity(own(value, 'storeId'))) throw new PicodashDocumentError('identity')
  if (
    !Number.isSafeInteger(own(value, 'schemaVersion')) ||
    Number(own(value, 'schemaVersion')) <= 0
  )
    throw new PicodashDocumentError('schema')
  if (kind === 'scope' && !validIdentity(own(value, 'scopeId')))
    throw new PicodashDocumentError('identity')
  const fields = documentFields(own(value, 'fields'))
  const scopes = documentScopes(own(value, 'scopes'))
  const base = {
    formatVersion: 1 as const,
    kind: kind as 'root' | 'scope',
    storeId: own(value, 'storeId') as string,
    schemaVersion: own(value, 'schemaVersion') as number,
    fields,
    scopes,
  }
  if (kind === 'scope')
    return freeze({ ...base, kind: 'scope' as const, scopeId: own(value, 'scopeId') as string })
  return freeze({ ...base, kind: 'root' as const })
}

/** Decode a parsed strict JSON value into the canonical detached document. */
export function decodePicodashDocument(value: unknown): PicodashDocument {
  return canonicalDocument(value)
}

/** Alias used by callers that already know they have a document-shaped value. */
export const normalizePicodashDocument = decodePicodashDocument

/** Encode a document by validating, sorting, detaching, and freezing it. */
export function encodePicodashDocument(value: PicodashDocument): PicodashDocument {
  if (!strictRecord(value)) throw new PicodashDocumentError('shape')
  const fields = own(value, 'fields')
  const scopes = own(value, 'scopes')
  if (!strictArray(fields) || !strictArray(scopes)) throw new PicodashDocumentError('shape')
  const sortedFields = [...fields].sort((left, right) => {
    const leftKey = strictArray(left) && typeof left[0] === 'string' ? left[0] : ''
    const rightKey = strictArray(right) && typeof right[0] === 'string' ? right[0] : ''
    return compareCodePoints(leftKey, rightKey)
  })
  const sortedScopes = [...scopes].sort((left, right) => {
    const leftKey = strictArray(left) && typeof left[0] === 'string' ? left[0] : ''
    const rightKey = strictArray(right) && typeof right[0] === 'string' ? right[0] : ''
    return compareCodePoints(leftKey, rightKey)
  })
  return canonicalDocument({ ...value, fields: sortedFields, scopes: sortedScopes })
}

export type PicodashExportFieldPolicy = Readonly<{
  readonly default: 'include' | 'redact' | 'omit'
  readonly allowPromotion?: 'with-confirmation'
}>

export type PicodashExportPolicy = Readonly<{
  readonly documents: Readonly<{ readonly defaultFieldPolicy: 'include' | 'redact' | 'omit' }>
  readonly fields: Readonly<Record<string, PicodashExportFieldPolicy>>
}>

export type PicodashExportConfig = Readonly<{
  readonly documents: Readonly<{ readonly defaultFieldPolicy: 'include' | 'redact' | 'omit' }>
  readonly fields?: Readonly<
    Record<string, 'include' | 'redact' | 'omit' | PicodashExportFieldPolicy>
  >
}>

const fieldPolicy = (value: unknown): PicodashExportFieldPolicy => {
  if (value === 'include' || value === 'redact' || value === 'omit')
    return freeze({ default: value })
  if (!strictRecord(value)) throw new Error('invalid policy')
  if (!Object.hasOwn(value, 'default')) throw new Error('invalid policy')
  if (Object.keys(value).some((key) => key !== 'default' && key !== 'allowPromotion'))
    throw new Error('invalid policy')
  const policy = own(value, 'default')
  const promotion = own(value, 'allowPromotion')
  if (policy !== 'include' && policy !== 'redact' && policy !== 'omit')
    throw new Error('invalid policy')
  if (promotion !== undefined && promotion !== 'with-confirmation')
    throw new Error('invalid policy')
  if (promotion !== undefined && policy !== 'redact') throw new Error('invalid policy')
  return freeze({
    default: policy,
    ...(promotion === undefined ? {} : { allowPromotion: promotion }),
  })
}

/** Normalize immutable export disclosure policy and reject unknown field keys. */
export function normalizePicodashExportPolicy(
  value: unknown,
  fieldKeys: readonly string[],
): PicodashExportPolicy {
  if (!strictRecord(value) || !Object.hasOwn(value, 'documents'))
    throw new TypeError('Invalid export policy.')
  if (Object.keys(value).some((key) => key !== 'documents' && key !== 'fields'))
    throw new TypeError('Invalid export policy.')
  const documents = own(value, 'documents')
  if (!strictRecord(documents) || !exactKeys(documents, ['defaultFieldPolicy']))
    throw new TypeError('Invalid export policy.')
  const defaultFieldPolicy = own(documents, 'defaultFieldPolicy')
  if (
    defaultFieldPolicy !== 'include' &&
    defaultFieldPolicy !== 'redact' &&
    defaultFieldPolicy !== 'omit'
  )
    throw new TypeError('Invalid export policy.')
  const declared = new Set(fieldKeys)
  const rawFields = own(value, 'fields')
  if (Object.hasOwn(value, 'fields') && rawFields === undefined)
    throw new TypeError('Invalid export policy.')
  if (rawFields !== undefined && !strictRecord(rawFields))
    throw new TypeError('Invalid export policy.')
  const fields: Record<string, PicodashExportFieldPolicy> = Object.create(null)
  const fieldRecord = (rawFields ?? {}) as Record<string, unknown>
  for (const key of Object.keys(fieldRecord).sort(compareCodePoints)) {
    if (!declared.has(key)) throw new TypeError('Invalid export policy.')
    try {
      fields[key] = fieldPolicy(own(fieldRecord, key))
    } catch {
      throw new TypeError('Invalid export policy.')
    }
  }
  return freeze({
    documents: freeze({ defaultFieldPolicy }),
    fields: freeze(fields),
  })
}

/** Alias matching the concise configuration terminology used by Store setup. */
export const normalizeExportPolicy = normalizePicodashExportPolicy

/** A real root-owned Store field handle; the private brand is retained at the public type boundary. */
export type PicodashDocumentFieldHandle<Values extends object = Record<string, PicodashJsonValue>> =
  PicodashField<Values, keyof Values & string>

export type PicodashRootExportOptions<Values extends object = Record<string, PicodashJsonValue>> =
  Readonly<{
    readonly scopeId?: string
    readonly includeDescendants: boolean
    readonly fields?: readonly PicodashDocumentFieldHandle<Values>[]
    readonly promoteFields?: readonly PicodashDocumentFieldHandle<Values>[]
  }>

export type PicodashScopedExportOptions<Values extends object = Record<string, PicodashJsonValue>> =
  Readonly<{
    readonly includeDescendants: boolean
    readonly fields?: readonly PicodashDocumentFieldHandle<Values>[]
    readonly promoteFields?: readonly PicodashDocumentFieldHandle<Values>[]
  }>

/** Root receiver export options; retained as the concise public alias. */
export type PicodashExportOptions<Values extends object = Record<string, PicodashJsonValue>> =
  PicodashRootExportOptions<Values>

export type PicodashExportExecutionOptions = Readonly<{
  readonly confirmRedactedPromotion: true
}>

export type PicodashImportFieldMappingTarget<
  Values extends object = Record<string, PicodashJsonValue>,
> = PicodashFieldMappingTarget<Values>
export type PicodashNormalizedFieldMap = readonly (readonly [
  string,
  PicodashImportFieldMappingTarget,
])[]
export type PicodashNormalizedScopeMap = readonly (readonly [string, string])[]

export type PicodashRootImportOptions<Values extends object = Record<string, PicodashJsonValue>> =
  Readonly<{
    readonly allowForeignStore?: boolean
    readonly createMissingScopes?: boolean
    readonly fieldMap?: Readonly<Record<string, PicodashFieldMappingTarget<Values>>>
    readonly scopeMap?: Readonly<Record<string, string>>
    readonly targetScopeId?: string
  }>

export type PicodashScopedImportOptions<Values extends object = Record<string, PicodashJsonValue>> =
  Readonly<{
    readonly allowForeignStore?: boolean
    readonly createMissingScopes?: boolean
    readonly fieldMap?: Readonly<Record<string, PicodashFieldMappingTarget<Values>>>
    readonly scopeMap?: Readonly<Record<string, string>>
  }>

export type PicodashFieldMappingTarget<Values extends object = Record<string, PicodashJsonValue>> =
  | PicodashDocumentFieldHandle<Values>
  | 'ignore'

/** Root receiver import options; retained as the concise public alias. */
export type PicodashImportOptions<Values extends object = Record<string, PicodashJsonValue>> =
  PicodashRootImportOptions<Values>

export type PicodashNormalizedImportOptions = Readonly<{
  readonly allowForeignStore: boolean
  readonly createMissingScopes: boolean
  readonly fieldMap: PicodashNormalizedFieldMap
  readonly scopeMap: PicodashNormalizedScopeMap
  readonly targetScopeId?: string
}>

function optionError(
  operation: PicodashDocumentOptionOperation,
  reason: PicodashDocumentOptionReason,
): never {
  throw new PicodashDocumentOptionsError(operation, reason)
}

function optionRecord(
  value: unknown,
  operation: PicodashDocumentOptionOperation,
  allowed: readonly string[],
): Record<string, unknown> {
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value))
    return optionError(operation, 'not-object')
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value)
    for (const key of Reflect.ownKeys(descriptors))
      if (typeof key !== 'string' || !allowed.includes(key))
        return optionError(operation, 'unknown-key')
    const record: Record<string, unknown> = Object.create(null)
    for (const key of Reflect.ownKeys(descriptors)) {
      const descriptor = descriptors[key as string]!
      if (!descriptor.enumerable) return optionError(operation, 'unknown-key')
      if (!('value' in descriptor)) return optionError(operation, 'accessor-property')
      record[key as string] = descriptor.value
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null)
      return optionError(operation, 'not-object')
    return record
  } catch (error) {
    if (error instanceof PicodashDocumentOptionsError) throw error
    return optionError(operation, 'not-object')
  }
}

function documentHandleKey(handle: unknown, operation: PicodashDocumentOptionOperation): string {
  if (!handle || typeof handle !== 'object' || Array.isArray(handle))
    return optionError(operation, 'invalid-fields')
  try {
    const descriptors = Object.getOwnPropertyDescriptors(handle)
    const descriptor = descriptors.key
    if (
      !descriptor ||
      !descriptor.enumerable ||
      !('value' in descriptor) ||
      !validFieldKey(descriptor.value)
    )
      return optionError(operation, 'invalid-fields')
    return descriptor.value
  } catch {
    return optionError(operation, 'invalid-fields')
  }
}

function normalizedHandles(
  value: unknown,
  operation: PicodashDocumentOptionOperation,
): readonly [readonly PicodashDocumentFieldHandle[], readonly string[]] {
  if (!strictArray(value)) return optionError(operation, 'invalid-fields')
  const keyed: [string, PicodashDocumentFieldHandle][] = []
  const seen = new Set<string>()
  for (const item of value) {
    const key = documentHandleKey(item, operation)
    if (seen.has(key)) return optionError(operation, 'duplicate-field')
    seen.add(key)
    keyed.push([key, item as PicodashDocumentFieldHandle])
  }
  keyed.sort(([left], [right]) => compareCodePoints(left, right))
  return [freeze(keyed.map(([, handle]) => handle)), freeze(keyed.map(([key]) => key))]
}

/** Validate exact export options for either a root or scoped receiver. */
export function normalizePicodashExportOptions(
  value: unknown,
  receiver: 'root' | 'scope' = 'root',
): PicodashExportOptions {
  if (value === undefined) value = { includeDescendants: false }
  const record = optionRecord(value, 'export', [
    'scopeId',
    'includeDescendants',
    'fields',
    'promoteFields',
  ])
  if (typeof own(record, 'includeDescendants') !== 'boolean')
    optionError('export', 'invalid-boolean')
  if (receiver === 'scope' && Object.hasOwn(record, 'scopeId'))
    optionError('export', 'invalid-target')
  if (Object.hasOwn(record, 'scopeId') && !validIdentity(own(record, 'scopeId')))
    optionError('export', 'invalid-target')
  const fields = Object.hasOwn(record, 'fields')
    ? normalizedHandles(own(record, 'fields'), 'export')
    : undefined
  const promoteFields = Object.hasOwn(record, 'promoteFields')
    ? normalizedHandles(own(record, 'promoteFields'), 'export')
    : undefined
  if (promoteFields !== undefined && fields !== undefined) {
    const selected = new Set(fields?.[1] ?? [])
    for (const key of promoteFields[1])
      if (!selected.has(key)) optionError('export', 'invalid-promotion')
  }
  return freeze({
    ...(Object.hasOwn(record, 'scopeId') ? { scopeId: own(record, 'scopeId') as string } : {}),
    includeDescendants: own(record, 'includeDescendants') as boolean,
    ...(fields === undefined ? {} : { fields: fields[0] }),
    ...(promoteFields === undefined ? {} : { promoteFields: promoteFields[0] }),
  })
}

/** Validate the one-use export confirmation object. */
export function normalizePicodashExportExecutionOptions(
  value: unknown,
  requiresConfirmation: boolean,
): PicodashExportExecutionOptions | undefined {
  if (!requiresConfirmation) {
    if (value !== undefined) optionError('export-execution', 'unexpected-confirmation')
    return undefined
  }
  if (value === undefined) optionError('export-execution', 'confirmation-required')
  const record = optionRecord(value, 'export-execution', ['confirmRedactedPromotion'])
  if (own(record, 'confirmRedactedPromotion') !== true)
    optionError('export-execution', 'confirmation-required')
  return freeze({ confirmRedactedPromotion: true as const })
}

/** Normalize a field map and reject duplicate target handles. */
export function normalizePicodashFieldMap(
  value: unknown,
  operation: PicodashDocumentOptionOperation = 'import-analysis',
): PicodashNormalizedFieldMap {
  if (value === undefined) return freeze([])
  if (!strictRecord(value)) return optionError(operation, 'invalid-mapping')
  const entries: [string, PicodashImportFieldMappingTarget][] = []
  const targets = new Set<string>()
  for (const sourceKey of Object.keys(value).sort(compareCodePoints)) {
    if (!validFieldKey(sourceKey)) optionError(operation, 'invalid-mapping')
    const target = own(value, sourceKey)
    if (target !== 'ignore') {
      const targetKey = documentHandleKey(target, operation)
      if (targets.has(targetKey)) optionError(operation, 'duplicate-target')
      targets.add(targetKey)
      entries.push([sourceKey, target as PicodashDocumentFieldHandle])
    } else {
      entries.push([sourceKey, 'ignore'])
    }
  }
  return freeze(entries.map(([source, target]) => freeze([source, target] as const)))
}

/** Normalize a scope map and reject duplicate target scope IDs. */
export function normalizePicodashScopeMap(
  value: unknown,
  operation: PicodashDocumentOptionOperation = 'import-analysis',
): PicodashNormalizedScopeMap {
  if (value === undefined) return freeze([])
  if (!strictRecord(value)) return optionError(operation, 'invalid-mapping')
  const entries: [string, string][] = []
  const targets = new Set<string>()
  for (const sourceKey of Object.keys(value).sort(compareCodePoints)) {
    const target = own(value, sourceKey)
    if (!validIdentity(sourceKey) || !validIdentity(target))
      optionError(operation, 'invalid-mapping')
    if (targets.has(target)) optionError(operation, 'duplicate-target')
    targets.add(target)
    entries.push([sourceKey, target])
  }
  return freeze(entries.map(([source, target]) => freeze([source, target] as const)))
}

/** Validate exact import analysis options for either a root or scoped receiver. */
export function normalizePicodashImportOptions(
  value: unknown,
  receiver: 'root' | 'scope' = 'root',
): PicodashNormalizedImportOptions {
  const record =
    value === undefined
      ? ({} as Record<string, unknown>)
      : optionRecord(value, 'import-analysis', [
          'allowForeignStore',
          'createMissingScopes',
          'fieldMap',
          'scopeMap',
          'targetScopeId',
        ])
  for (const key of ['allowForeignStore', 'createMissingScopes'] as const)
    if (Object.hasOwn(record, key) && typeof own(record, key) !== 'boolean')
      optionError('import-analysis', 'invalid-boolean')
  if (receiver === 'scope' && Object.hasOwn(record, 'targetScopeId'))
    optionError('import-analysis', 'invalid-target')
  if (Object.hasOwn(record, 'targetScopeId') && !validIdentity(own(record, 'targetScopeId')))
    optionError('import-analysis', 'invalid-target')
  return freeze({
    allowForeignStore: (own(record, 'allowForeignStore') as boolean | undefined) ?? false,
    createMissingScopes: (own(record, 'createMissingScopes') as boolean | undefined) ?? false,
    fieldMap: normalizePicodashFieldMap(own(record, 'fieldMap')),
    scopeMap: normalizePicodashScopeMap(own(record, 'scopeMap')),
    ...(Object.hasOwn(record, 'targetScopeId')
      ? { targetScopeId: own(record, 'targetScopeId') as string }
      : {}),
  })
}

export type PicodashExportPlanReview = Readonly<{
  readonly kind: 'export-plan'
  readonly documentKind: 'root' | 'scope'
  readonly scopeId?: string
  readonly fieldKeys: readonly string[]
  readonly promotedFieldKeys: readonly string[]
  readonly scopeIds: readonly string[]
}>

declare const picodashExportPlanBrand: unique symbol
export type PicodashExportPlan = PicodashExportPlanReview &
  Readonly<{ readonly [picodashExportPlanBrand]: 'PicodashExportPlan' }>

export type PicodashImportPlanReview = Readonly<{
  readonly kind: 'import-plan'
  readonly documentKind: 'root' | 'scope'
  readonly targetScopeId?: string
  readonly changedFields: readonly string[]
  readonly changedScopeIds: readonly string[]
  readonly ignoredFields: readonly string[]
  readonly createdScopes: readonly string[]
  readonly fieldRemaps: readonly (readonly [string, string])[]
  readonly scopeRemaps: readonly (readonly [string, string])[]
  readonly foreignStore: boolean
}>

declare const picodashImportPlanBrand: unique symbol
export type PicodashImportPlan = PicodashImportPlanReview &
  Readonly<{ readonly [picodashImportPlanBrand]: 'PicodashImportPlan' }>

/** Normalize value-free review information before a kernel-owned plan is branded. */
export function normalizePicodashExportPlanReview(
  value: PicodashExportPlanReview,
): PicodashExportPlanReview {
  const fields = [...value.fieldKeys].sort(compareCodePoints)
  const promoted = [...value.promotedFieldKeys].sort(compareCodePoints)
  const scopes = [...value.scopeIds].sort(compareCodePoints)
  if (!sortedUnique(fields) || !sortedUnique(promoted) || !sortedUnique(scopes))
    throw new TypeError('Invalid export plan review.')
  if (!promoted.every((key) => fields.includes(key)))
    throw new TypeError('Invalid export plan review.')
  if (value.documentKind !== 'root' && value.documentKind !== 'scope')
    throw new TypeError('Invalid export plan review.')
  if (value.scopeId !== undefined && !validIdentity(value.scopeId))
    throw new TypeError('Invalid export plan review.')
  return freeze({
    kind: 'export-plan',
    documentKind: value.documentKind,
    ...(value.scopeId === undefined ? {} : { scopeId: value.scopeId }),
    fieldKeys: freeze(fields),
    promotedFieldKeys: freeze(promoted),
    scopeIds: freeze(scopes),
  })
}

function normalizedRemaps(value: unknown): readonly (readonly [string, string])[] {
  if (!strictArray(value)) throw new TypeError('Invalid import plan review.')
  const entries: [string, string][] = []
  const source = new Set<string>()
  const target = new Set<string>()
  for (const raw of value) {
    const pair = tuple(raw, 2)
    if (!pair || !validIdentity(pair[0]) || !validIdentity(pair[1]))
      throw new TypeError('Invalid import plan review.')
    if (source.has(pair[0]) || target.has(pair[1]))
      throw new TypeError('Invalid import plan review.')
    source.add(pair[0])
    target.add(pair[1])
    entries.push([pair[0], pair[1]])
  }
  entries.sort(([left], [right]) => compareCodePoints(left, right))
  return freeze(entries.map(([left, right]) => freeze([left, right] as const)))
}

export function normalizePicodashImportPlanReview(
  value: PicodashImportPlanReview,
): PicodashImportPlanReview {
  if (value.documentKind !== 'root' && value.documentKind !== 'scope')
    throw new TypeError('Invalid import plan review.')
  if (value.targetScopeId !== undefined && !validIdentity(value.targetScopeId))
    throw new TypeError('Invalid import plan review.')
  if (typeof value.foreignStore !== 'boolean') throw new TypeError('Invalid import plan review.')
  const fields = (key: keyof PicodashImportPlanReview): readonly string[] => {
    const list = [...(value[key] as readonly string[])].sort(compareCodePoints)
    if (!sortedUnique(list)) throw new TypeError('Invalid import plan review.')
    return freeze(list)
  }
  return freeze({
    kind: 'import-plan',
    documentKind: value.documentKind,
    ...(value.targetScopeId === undefined ? {} : { targetScopeId: value.targetScopeId }),
    changedFields: fields('changedFields'),
    changedScopeIds: fields('changedScopeIds'),
    ignoredFields: fields('ignoredFields'),
    createdScopes: fields('createdScopes'),
    fieldRemaps: normalizedRemaps(value.fieldRemaps),
    scopeRemaps: normalizedRemaps(value.scopeRemaps),
    foreignStore: value.foreignStore,
  })
}

/** Remove redacted entries before import mapping or schema migration. */
export function stripRedactedPicodashDocumentFields(document: PicodashDocument): PicodashDocument {
  const decoded = decodePicodashDocument(document)
  const fields = decoded.fields.filter(([_, entry]) => entry.status === 'included')
  return encodePicodashDocument({ ...decoded, fields } as PicodashDocument)
}

export const stripRedactedFields = stripRedactedPicodashDocumentFields

/** Build the schema-migration payload after strict decode and redaction removal. */
export function documentToSchemaMigrationPayload(
  document: PicodashDocument,
): PicodashSchemaMigrationPayload {
  const stripped = stripRedactedPicodashDocumentFields(document)
  const values: Record<string, PicodashJsonValue> = Object.create(null)
  for (const [key, entry] of stripped.fields) {
    if (entry.status === 'included') values[key] = entry.value
  }
  const scopes = stripped.scopes.map(
    ([scopeId, metadata]) =>
      [scopeId, clonePicodashValue(metadata as unknown as PicodashJsonValue)] as const,
  )
  return freeze({
    schemaVersion: stripped.schemaVersion,
    values: freeze(values),
    scopes: freeze(scopes.map(([scopeId, metadata]) => freeze([scopeId, metadata] as const))),
  })
}

/** Rebuild a document from a migrated, validated schema payload. */
export function documentFromSchemaMigrationPayload(
  original: PicodashDocument,
  payload: PicodashSchemaMigrationPayload,
): PicodashDocument {
  const fields = Object.keys(payload.values)
    .sort(compareCodePoints)
    .map((key) => [key, { status: 'included' as const, value: payload.values[key]! }] as const)
  const scopes = payload.scopes.map(([scopeId, metadata]) => {
    try {
      const decoded = decodeDurableScopeMetadata(metadata)
      const encoded = decoded === undefined ? undefined : encodeDurableScopeMetadata(decoded)
      if (encoded === undefined) throw new Error('metadata')
      return [scopeId, encoded] as const
    } catch {
      throw new PicodashDocumentError('metadata')
    }
  })
  return encodePicodashDocument({
    ...original,
    schemaVersion: payload.schemaVersion,
    fields,
    scopes,
  } as PicodashDocument)
}

/** Run the complete schema chain for a document without invoking Store callbacks. */
export function migratePicodashDocument(
  document: PicodashDocument,
  targetSchemaVersion: number,
  migrations: SchemaMigrations | undefined,
): PicodashDocument {
  const payload = documentToSchemaMigrationPayload(document)
  const migrated = runSchemaMigrations(payload, targetSchemaVersion, migrations)
  return documentFromSchemaMigrationPayload(document, migrated)
}

export type PicodashDocumentOverlayInput = Readonly<{
  readonly document: PicodashDocument
  readonly targetValues: Readonly<Record<string, PicodashJsonValue>>
  readonly targetScopes: readonly (readonly [string, SerializedDurableScopeMetadata])[]
  readonly targetFieldKeys: readonly string[]
  readonly compatibleFieldKeys?: readonly string[]
  readonly targetScopeIds?: readonly string[]
  readonly options?: PicodashNormalizedImportOptions
}>

export type PicodashDocumentOverlay = Readonly<{
  readonly values: Readonly<Record<string, PicodashJsonValue>>
  readonly scopes: readonly (readonly [string, SerializedDurableScopeMetadata])[]
  readonly changedFields: readonly string[]
  readonly changedScopeIds: readonly string[]
  readonly ignoredFields: readonly string[]
  readonly createdScopes: readonly string[]
  readonly fieldRemaps: readonly (readonly [string, string])[]
  readonly scopeRemaps: readonly (readonly [string, string])[]
}>

const mapRecord = <T>(entries: readonly (readonly [string, T])[]): Map<string, T> =>
  new Map(entries.map(([key, value]) => [key, value]))

/** Apply version-one overlay semantics to detached pure JSON inputs. */
export function buildPicodashDocumentOverlay(
  input: PicodashDocumentOverlayInput,
): PicodashDocumentOverlay {
  const document = stripRedactedPicodashDocumentFields(input.document)
  const targetKeys = new Set(input.targetFieldKeys)
  const compatible = new Set(input.compatibleFieldKeys ?? input.targetFieldKeys)
  const options = input.options ?? normalizePicodashImportOptions(undefined)
  const fieldMappings = mapRecord(options.fieldMap)
  const values: Record<string, PicodashJsonValue> = Object.create(null)
  for (const [key, value] of Object.entries(input.targetValues))
    values[key] = clonePicodashValue(value)
  const changedFields: string[] = []
  const ignoredFields: string[] = []
  const fieldRemaps: [string, string][] = []
  const resolvedTargets = new Set<string>()
  for (const [sourceKey, entry] of document.fields) {
    if (entry.status !== 'included') continue
    const explicit = fieldMappings.get(sourceKey)
    if (explicit === 'ignore') {
      ignoredFields.push(sourceKey)
      continue
    }
    const targetKey =
      explicit === undefined ? sourceKey : (explicit as PicodashDocumentFieldHandle).key
    if (resolvedTargets.has(targetKey)) optionError('import-analysis', 'duplicate-target')
    resolvedTargets.add(targetKey)
    if (explicit !== undefined && targetKey !== sourceKey) fieldRemaps.push([sourceKey, targetKey])
    if (!targetKeys.has(targetKey)) throw new PicodashDocumentError('unknown_field')
    if (!compatible.has(targetKey)) throw new PicodashDocumentError('incompatible_field')
    const before = values[targetKey]
    values[targetKey] = clonePicodashValue(entry.value)
    if (before === undefined || !picodashJsonEqual(before, values[targetKey]!))
      changedFields.push(targetKey)
  }

  const targetScopeMap = new Map(
    input.targetScopes.map(([scopeId, metadata]) => [
      scopeId,
      clonePicodashValue(
        metadata as unknown as PicodashJsonValue,
      ) as unknown as SerializedDurableScopeMetadata,
    ]),
  )
  const targetScopeIds = new Set(
    input.targetScopeIds ?? input.targetScopes.map(([scopeId]) => scopeId),
  )
  const scopeMap = mapRecord(options.scopeMap)
  const scopeRemaps: [string, string][] = []
  const resolvedScopeTargets = new Map<string, string>()
  const createdScopes: string[] = []
  const scopes = new Map(targetScopeMap)
  let sourceScopeRoot: string | undefined = document.kind === 'scope' ? document.scopeId : undefined
  if (sourceScopeRoot !== undefined && options.targetScopeId !== undefined) {
    if (scopeMap.has(sourceScopeRoot) && scopeMap.get(sourceScopeRoot) !== options.targetScopeId)
      throw new PicodashDocumentError('missing_scope')
    scopeMap.set(sourceScopeRoot, options.targetScopeId)
  }
  if (sourceScopeRoot !== undefined) {
    const targetScopeRoot = scopeMap.get(sourceScopeRoot) ?? sourceScopeRoot
    resolvedScopeTargets.set(targetScopeRoot, sourceScopeRoot)
    const importsTargetRoot = document.scopes.some(([sourceId]) => sourceId === sourceScopeRoot)
    if (
      !targetScopeIds.has(targetScopeRoot) &&
      (!options.createMissingScopes || !importsTargetRoot)
    )
      throw new PicodashDocumentError('missing_scope')
  }
  const changedScopeIds: string[] = []
  for (const [sourceId, metadata] of document.scopes) {
    const targetId = scopeMap.get(sourceId) ?? sourceId
    const resolvedSource = resolvedScopeTargets.get(targetId)
    if (resolvedSource !== undefined && resolvedSource !== sourceId)
      optionError('import-analysis', 'duplicate-target')
    resolvedScopeTargets.set(targetId, sourceId)
    if (targetId !== sourceId) scopeRemaps.push([sourceId, targetId])
    const previous = scopes.get(targetId)
    if (previous === undefined) {
      if (!targetScopeIds.has(targetId)) {
        if (!options.createMissingScopes) throw new PicodashDocumentError('missing_scope')
        createdScopes.push(targetId)
      }
      changedScopeIds.push(targetId)
    } else if (
      !picodashJsonEqual(
        previous as unknown as PicodashJsonValue,
        metadata as unknown as PicodashJsonValue,
      )
    ) {
      changedScopeIds.push(targetId)
    }
    scopes.set(targetId, metadata)
  }
  const sortedValues = Object.create(null) as Record<string, PicodashJsonValue>
  for (const key of Object.keys(values).sort(compareCodePoints)) sortedValues[key] = values[key]!
  const sortedScopes = [...scopes.entries()]
    .sort(([left], [right]) => compareCodePoints(left, right))
    .map(([scopeId, metadata]) => freeze([scopeId, metadata] as const))
  return freeze({
    values: freeze(sortedValues),
    scopes: freeze(sortedScopes),
    changedFields: freeze([...new Set(changedFields)].sort(compareCodePoints)),
    changedScopeIds: freeze([...new Set(changedScopeIds)].sort(compareCodePoints)),
    ignoredFields: freeze([...new Set(ignoredFields)].sort(compareCodePoints)),
    createdScopes: freeze([...new Set(createdScopes)].sort(compareCodePoints)),
    fieldRemaps: freeze(
      fieldRemaps
        .sort(([left], [right]) => compareCodePoints(left, right))
        .map(([left, right]) => freeze([left, right] as const)),
    ),
    scopeRemaps: freeze(
      scopeRemaps
        .sort(([left], [right]) => compareCodePoints(left, right))
        .map(([left, right]) => freeze([left, right] as const)),
    ),
  })
}

export type PicodashExportFreshnessInput = Readonly<{
  readonly documentKind: 'root' | 'scope'
  readonly scopeId?: string
  readonly fieldKeys: readonly string[]
  readonly promotedFieldKeys: readonly string[]
  readonly values: readonly (readonly [string, PicodashJsonValue])[]
  readonly scopes: readonly (readonly [string, SerializedDurableScopeMetadata])[]
  readonly activeFieldKeys?: readonly string[]
  readonly descendantScopeIds?: readonly string[]
}>

export type PicodashImportFreshnessInput = Readonly<{
  readonly document: PicodashDocument
  readonly values: Readonly<Record<string, PicodashJsonValue>>
  readonly scopes: readonly (readonly [string, SerializedDurableScopeMetadata])[]
  readonly fieldMap: PicodashNormalizedFieldMap
  readonly scopeMap: PicodashNormalizedScopeMap
  readonly targetScopeId?: string
  readonly scopeExistence: readonly string[]
}>

/** Detach and order export freshness inputs; values stay internal to the freshness fingerprint. */
export function normalizePicodashExportFreshnessInput(
  input: PicodashExportFreshnessInput,
): PicodashExportFreshnessInput {
  const values = input.values
    .map(([key, value]) => freeze([key, clonePicodashValue(value)] as const))
    .sort(([left], [right]) => compareCodePoints(left, right))
  const scopes = input.scopes
    .map(([scopeId, metadata]) =>
      freeze([
        scopeId,
        encodeDurableScopeMetadata(decodeDurableScopeMetadata(metadata)!)!,
      ] as const),
    )
    .sort(([left], [right]) => compareCodePoints(left, right))
  const normalizeIds = (ids: readonly string[]) => freeze([...new Set(ids)].sort(compareCodePoints))
  return freeze({
    documentKind: input.documentKind,
    ...(input.scopeId === undefined ? {} : { scopeId: input.scopeId }),
    fieldKeys: normalizeIds(input.fieldKeys),
    promotedFieldKeys: normalizeIds(input.promotedFieldKeys),
    values: freeze(values),
    scopes: freeze(scopes),
    ...(input.activeFieldKeys === undefined
      ? {}
      : { activeFieldKeys: normalizeIds(input.activeFieldKeys) }),
    ...(input.descendantScopeIds === undefined
      ? {}
      : { descendantScopeIds: normalizeIds(input.descendantScopeIds) }),
  })
}

export const createPicodashExportFreshnessInput = normalizePicodashExportFreshnessInput

/** Detach the normalized migrated input and scope-existence facts used by import freshness. */
export function normalizePicodashImportFreshnessInput(
  input: PicodashImportFreshnessInput,
): PicodashImportFreshnessInput {
  const values: Record<string, PicodashJsonValue> = Object.create(null)
  for (const key of Object.keys(input.values).sort(compareCodePoints))
    values[key] = clonePicodashValue(input.values[key]!)
  const scopes = input.scopes
    .map(([scopeId, metadata]) =>
      freeze([
        scopeId,
        encodeDurableScopeMetadata(decodeDurableScopeMetadata(metadata)!)!,
      ] as const),
    )
    .sort(([left], [right]) => compareCodePoints(left, right))
  return freeze({
    document: decodePicodashDocument(input.document),
    values: freeze(values),
    scopes: freeze(scopes),
    fieldMap: normalizePicodashFieldMap(input.fieldMap),
    scopeMap: normalizePicodashScopeMap(input.scopeMap),
    ...(input.targetScopeId === undefined ? {} : { targetScopeId: input.targetScopeId }),
    scopeExistence: freeze([...new Set(input.scopeExistence)].sort(compareCodePoints)),
  })
}

export const createPicodashImportFreshnessInput = normalizePicodashImportFreshnessInput
