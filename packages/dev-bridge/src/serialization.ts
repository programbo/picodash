import {
  NEXUS_INTERACTION_TYPES,
  type PicodashDiagnostic,
  type PicodashJsonValue,
} from '@picodash/nexus'
import type { PicodashDevBridgeDisclosure, PicodashDevBridgeSnapshot, NexusLike } from './types.js'

const isJson = (value: unknown): value is PicodashJsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJson)
  if (typeof value === 'object') {
    try {
      return Object.values(value as Record<string, unknown>).every(isJson)
    } catch {
      return false
    }
  }
  return false
}

const safeJsonObject = (value: unknown): Record<string, PicodashJsonValue> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  try {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) =>
      isJson(item),
    )
    return Object.fromEntries(entries) as Record<string, PicodashJsonValue>
  } catch {
    return {}
  }
}

export function validateDisclosure(
  nexus: NexusLike,
  disclosure: Partial<PicodashDevBridgeDisclosure> = {},
) {
  const fieldKeys = Object.keys(nexus.fields).sort()
  const values = [...(disclosure.valueFields ?? [])]
  const scopeIds = [...(disclosure.scopeIds ?? [])]
  const observationNames = [...(disclosure.observationNames ?? [])]
  if (
    observationNames.length > 64 ||
    !observationNames.every(
      (name) =>
        typeof name === 'string' &&
        name.length > 0 &&
        name.length <= 256 &&
        !name.split('').some((char) => {
          const code = char.charCodeAt(0)
          return code <= 31 || (code >= 127 && code <= 159)
        }),
    )
  )
    throw new Error('invalid observation disclosure')
  const eventScopeIds = [...(disclosure.eventScopeIds ?? [])]
  const eventTypes = [...(disclosure.eventTypes ?? [])]
  const unique = (items: readonly string[]) => [...new Set(items)]
  if (!values.every((key) => typeof key === 'string' && fieldKeys.includes(key)))
    throw new Error('invalid disclosure field')
  if (!scopeIds.every((id) => typeof id === 'string')) throw new Error('invalid disclosure scope')
  if (eventScopeIds.length > 256 || !eventScopeIds.every((id) => typeof id === 'string'))
    throw new Error('invalid disclosure event scope')
  for (const scopeId of scopeIds) nexus.scope(scopeId)
  for (const scopeId of eventScopeIds) nexus.scope(scopeId)
  if (!eventTypes.every((type) => NEXUS_INTERACTION_TYPES.includes(type)))
    throw new Error('invalid disclosure event type')
  return {
    fieldKeys,
    valueFields: unique(values),
    scopeIds: unique(scopeIds),
    observationNames: unique(observationNames),
    diagnostics: disclosure.diagnostics === true,
    eventScopeIds: unique(eventScopeIds),
    eventTypes: [...new Set(eventTypes)],
  }
}

export function makeSnapshot(
  nexus: NexusLike,
  disclosure: ReturnType<typeof validateDisclosure>,
  source?: import('./types.js').PicodashDevBridgeObservationSource,
): PicodashDevBridgeSnapshot {
  const state = nexus.getState()
  const values = Object.fromEntries(
    disclosure.valueFields
      .filter((key) => Object.hasOwn(state.values, key))
      .map((key) => [key, state.values[key]]),
  ) as Record<string, PicodashJsonValue>
  const scopes = disclosure.scopeIds.map((id) => {
    const scoped = nexus.scope(id)
    const scopedState = scoped.getState() as { scope?: unknown }
    return {
      id,
      ...(scopedState.scope === undefined
        ? {}
        : { metadata: metadataToJson(scopedState.scope) as PicodashJsonValue }),
    }
  })
  const diagnostics = disclosure.diagnostics
    ? [...nexus.diagnostics.getState().current.entries()].map(([key, diagnostic]) =>
        diagnosticToJson(key, diagnostic),
      )
    : undefined
  return {
    ...(disclosure.observationNames.length
      ? { observations: readObservations(disclosure.observationNames, source) }
      : {}),
    ...(disclosure.valueFields.length ? { values } : {}),
    ...(disclosure.scopeIds.length ? { scopes } : {}),
    ...(diagnostics ? { diagnostics } : {}),
  }
}

export function snapshotsEqual(
  left: PicodashDevBridgeSnapshot,
  right: PicodashDevBridgeSnapshot,
): boolean {
  return canonicalJson(left) === canonicalJson(right)
}

function metadataToJson(value: unknown): unknown {
  if (value instanceof Map || value instanceof Set || isReadonlyMapLike(value)) {
    return [...(value as Map<unknown, unknown>).entries()].map(([key, item]) => [
      key,
      metadataToJson(item),
    ])
  }
  if (Array.isArray(value)) return value.map(metadataToJson)
  if (value && typeof value === 'object') {
    try {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, metadataToJson(item)]),
      )
    } catch {
      return {}
    }
  }
  return value
}

function isReadonlyMapLike(value: unknown): value is ReadonlyMap<unknown, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { entries?: unknown }).entries === 'function'
  )
}

function diagnosticToJson(
  key: string,
  diagnostic: PicodashDiagnostic,
): NonNullable<PicodashDevBridgeSnapshot['diagnostics']>[number] {
  return {
    key,
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    identity: safeJsonObject(diagnostic.identity),
    count: diagnostic.count,
    lastOccurrence: diagnostic.lastOccurrence,
  }
}

export function snapshotsEqualValue(
  snapshot: PicodashDevBridgeSnapshot,
  field: string,
  value: PicodashJsonValue,
): boolean {
  return (
    Object.hasOwn(snapshot.values ?? {}, field) &&
    canonicalJson(snapshot.values?.[field]) === canonicalJson(value)
  )
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value)
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`
  }
  return 'null'
}

/** Validate and clone only deliberately disclosed values. Fail closed without leaking errors. */
function readObservations(
  names: readonly string[],
  source?: import('./types.js').PicodashDevBridgeObservationSource,
): Record<string, import('./types.js').PicodashDevBridgeObservation> {
  let result: unknown
  try {
    result = source?.getSnapshot()
  } catch {
    result = undefined
  }
  let remaining = 256000
  return Object.fromEntries(
    names.map((name) => {
      try {
        if (
          !result ||
          typeof result !== 'object' ||
          Array.isArray(result) ||
          !Object.hasOwn(result, name)
        )
          throw new Error()
        const value: unknown = Reflect.get(result, name)
        let count = 0
        const ancestors = new Set<object>()
        const valid = (item: unknown, depth: number): item is PicodashJsonValue => {
          if (++count > 10000 || depth > 24) return false
          if (item === null || typeof item === 'boolean' || typeof item === 'string')
            return typeof item !== 'string' || item.length <= 64000
          if (typeof item === 'number') return Number.isFinite(item)
          if (!item || typeof item !== 'object' || ancestors.has(item)) return false
          if (
            !Array.isArray(item) &&
            Object.getPrototypeOf(item) !== Object.prototype &&
            Object.getPrototypeOf(item) !== null
          )
            return false
          ancestors.add(item)
          const ok = Object.values(item).every((child) => valid(child, depth + 1))
          ancestors.delete(item)
          return ok
        }
        if (!valid(value, 0)) throw new Error()
        const text = JSON.stringify(value)
        const bytes = new TextEncoder().encode(text).length
        if (bytes > 64000 || bytes > remaining) throw new Error()
        remaining -= bytes
        return [name, { status: 'available', value: JSON.parse(text) }]
      } catch {
        return [name, { status: 'unavailable' }]
      }
    }),
  )
}
