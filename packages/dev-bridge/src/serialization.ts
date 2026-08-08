import type { PicodashDiagnostic, PicodashJsonValue } from '@picodash/store'
import type { PicodashDevBridgeDisclosure, PicodashDevBridgeSnapshot, StoreLike } from './types.js'

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
  store: StoreLike,
  disclosure: Partial<PicodashDevBridgeDisclosure> = {},
) {
  const fieldKeys = Object.keys(store.fields).sort()
  const values = [...(disclosure.valueFields ?? [])]
  const scopeIds = [...(disclosure.scopeIds ?? [])]
  const unique = (items: readonly string[]) => [...new Set(items)]
  if (!values.every((key) => typeof key === 'string' && fieldKeys.includes(key)))
    throw new Error('invalid disclosure field')
  if (!scopeIds.every((id) => typeof id === 'string')) throw new Error('invalid disclosure scope')
  for (const scopeId of scopeIds) store.scope(scopeId)
  return {
    fieldKeys,
    valueFields: unique(values),
    scopeIds: unique(scopeIds),
    diagnostics: disclosure.diagnostics === true,
  }
}

export function makeSnapshot(
  store: StoreLike,
  disclosure: ReturnType<typeof validateDisclosure>,
): PicodashDevBridgeSnapshot {
  const state = store.getState()
  const values = Object.fromEntries(
    disclosure.valueFields
      .filter((key) => Object.hasOwn(state.values, key))
      .map((key) => [key, state.values[key]]),
  ) as Record<string, PicodashJsonValue>
  const scopes = disclosure.scopeIds.map((id) => {
    const scoped = store.scope(id)
    const scopedState = scoped.getState() as { scope?: unknown }
    return {
      id,
      ...(scopedState.scope === undefined
        ? {}
        : { metadata: metadataToJson(scopedState.scope) as PicodashJsonValue }),
    }
  })
  const diagnostics = disclosure.diagnostics
    ? [...store.diagnostics.getState().current.entries()].map(([key, diagnostic]) =>
        diagnosticToJson(key, diagnostic),
      )
    : undefined
  return {
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
