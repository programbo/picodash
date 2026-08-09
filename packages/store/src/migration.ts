import { clonePicodashValue } from './json.js'
import type { PicodashJsonValue } from './kernel/index.js'

export type PicodashSchemaMigrationPayload = Readonly<{
  readonly schemaVersion: number
  readonly values: Readonly<Record<string, PicodashJsonValue>>
  readonly scopes: readonly (readonly [scopeId: string, metadata: PicodashJsonValue])[]
}>

export type PicodashSchemaMigration = (
  payload: PicodashSchemaMigrationPayload,
) => PicodashSchemaMigrationPayload

export type SchemaMigrations = Readonly<Record<number, PicodashSchemaMigration>>

export type SchemaMigrationFailureReason =
  | 'source-newer'
  | 'missing-step'
  | 'callback-threw'
  | 'async-result'
  | 'invalid-result'
  | 'wrong-version'
  | 'final-validation'

export class SchemaMigrationError extends Error {
  readonly reason: SchemaMigrationFailureReason

  constructor(reason: SchemaMigrationFailureReason) {
    super(reason)
    this.name = 'SchemaMigrationError'
    this.reason = reason
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
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

const isStrictArray = (value: unknown): value is readonly unknown[] => {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false
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

const isPromiseLike = (value: unknown): boolean => {
  try {
    return (
      !!value &&
      (typeof value === 'object' || typeof value === 'function') &&
      typeof (value as { then?: unknown }).then === 'function'
    )
  } catch {
    return true
  }
}

const validVersionKey = (key: string): boolean =>
  /^(?:0|[1-9]\d*)$/.test(key) && Number.isSafeInteger(Number(key)) && Number(key) > 0

const hasExactKeys = (value: object, expected: readonly string[]): boolean => {
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const keys = Reflect.ownKeys(descriptors)
  if (keys.length !== expected.length || keys.some((key) => typeof key !== 'string')) return false
  const sorted = (keys as string[]).sort()
  const wanted = [...expected].sort()
  return sorted.every((key, index) => {
    if (key !== wanted[index]) return false
    const descriptor = descriptors[key]!
    return descriptor.enumerable && 'value' in descriptor
  })
}

const validScopeId = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return false
  for (const character of value) {
    const code = character.codePointAt(0)!
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return false
  }
  return true
}

/** Captures and validates an immutable migration registry during Store construction. */
export function normalizeSchemaMigrations(
  migrations: unknown,
  targetSchemaVersion: number,
): SchemaMigrations {
  if (!migrations || typeof migrations !== 'object' || Array.isArray(migrations))
    throw new Error('invalid migration configuration')
  const prototype = Object.getPrototypeOf(migrations)
  if (prototype !== Object.prototype && prototype !== null)
    throw new Error('invalid migration configuration')
  const descriptors = Object.getOwnPropertyDescriptors(migrations)
  const captured = Object.create(null) as Record<number, PicodashSchemaMigration>
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !validVersionKey(key)) throw new Error('invalid migration key')
    const version = Number(key)
    if (version >= targetSchemaVersion) throw new Error('invalid migration key')
    const descriptor = descriptors[key]!
    if (
      !descriptor.enumerable ||
      !('value' in descriptor) ||
      typeof descriptor.value !== 'function'
    )
      throw new Error('invalid migration callback')
    Object.defineProperty(captured, version, {
      value: descriptor.value,
      enumerable: true,
      writable: false,
      configurable: false,
    })
  }
  return Object.freeze(captured)
}

/** Validates a migration registry without retaining the caller-owned record. */
export function validateSchemaMigrations(
  migrations: unknown,
  targetSchemaVersion: number,
): asserts migrations is SchemaMigrations {
  normalizeSchemaMigrations(migrations, targetSchemaVersion)
}

function freezePayload(value: PicodashSchemaMigrationPayload): PicodashSchemaMigrationPayload {
  const cloned = clonePicodashValue(value as unknown as PicodashJsonValue) as Record<
    string,
    PicodashJsonValue
  >
  return cloned as unknown as PicodashSchemaMigrationPayload
}

function validPayload(value: unknown): value is PicodashSchemaMigrationPayload {
  if (!isRecord(value)) return false
  if (!hasExactKeys(value, ['schemaVersion', 'values', 'scopes'])) return false
  if (!Number.isSafeInteger(value.schemaVersion) || (value.schemaVersion as number) <= 0)
    return false
  if (!isRecord(value.values) || !isStrictArray(value.scopes)) return false
  const scopeIds = new Set<string>()
  for (const entry of value.scopes) {
    if (
      !isStrictArray(entry) ||
      entry.length !== 2 ||
      !validScopeId(entry[0]) ||
      scopeIds.has(entry[0])
    )
      return false
    scopeIds.add(entry[0])
    try {
      clonePicodashValue(entry[1] as PicodashJsonValue)
    } catch {
      return false
    }
  }
  try {
    for (const entry of Object.values(value.values)) clonePicodashValue(entry as PicodashJsonValue)
  } catch {
    return false
  }
  return true
}

function canonicalPayload(value: unknown): PicodashSchemaMigrationPayload | undefined {
  try {
    const payload = freezePayload(value as PicodashSchemaMigrationPayload)
    return validPayload(payload) ? payload : undefined
  } catch {
    return undefined
  }
}

/** Runs the complete N -> N+1 chain against detached, deeply frozen JSON payloads. */
export function runSchemaMigrations(
  input: PicodashSchemaMigrationPayload,
  targetSchemaVersion: number,
  migrations: SchemaMigrations | undefined,
): PicodashSchemaMigrationPayload {
  const payload = canonicalPayload(input)
  if (!payload) throw new SchemaMigrationError('invalid-result')
  if (payload.schemaVersion > targetSchemaVersion) throw new SchemaMigrationError('source-newer')
  if (payload.schemaVersion === targetSchemaVersion) return payload
  const registry = migrations ?? ({} as SchemaMigrations)
  let current = payload
  while (current.schemaVersion < targetSchemaVersion) {
    const callback = registry[current.schemaVersion]
    if (typeof callback !== 'function') throw new SchemaMigrationError('missing-step')
    let result: unknown
    try {
      result = callback(current)
    } catch {
      throw new SchemaMigrationError('callback-threw')
    }
    if (isPromiseLike(result)) throw new SchemaMigrationError('async-result')
    const next = canonicalPayload(result)
    if (!next) throw new SchemaMigrationError('invalid-result')
    if (next.schemaVersion !== current.schemaVersion + 1)
      throw new SchemaMigrationError('wrong-version')
    current = next
  }
  return current
}
