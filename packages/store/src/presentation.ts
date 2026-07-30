import type {
  PicodashJsonValue,
  PicodashPresentationContract,
  PicodashPresentationValueContract,
} from './types.js'

export interface PicodashPresentationFieldValues {
  readonly currentValue?: PicodashJsonValue
  readonly defaultValue: PicodashJsonValue
  readonly hasCurrentValue: boolean
}

export function normalizePicodashPresentationContract(
  value: unknown,
): PicodashPresentationContract | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['accepts', 'component', 'id'])) return null
  if (!isNonEmptyString(value.component) || !isNonEmptyString(value.id)) return null

  const accepts = normalizeValueContract(value.accepts)
  if (accepts === null) return null

  return Object.freeze({
    accepts,
    component: value.component,
    id: value.id,
  })
}

export function picodashPresentationContractsEqual(
  left: PicodashPresentationContract,
  right: PicodashPresentationContract,
): boolean {
  return (
    left.component === right.component &&
    left.id === right.id &&
    JSON.stringify(left.accepts) === JSON.stringify(right.accepts)
  )
}

export function picodashPresentationContractsCompatible(
  left: PicodashPresentationContract,
  right: PicodashPresentationContract,
): boolean {
  return JSON.stringify(left.accepts) === JSON.stringify(right.accepts)
}

export function picodashPresentationAcceptsValue(
  contract: PicodashPresentationValueContract,
  value: PicodashJsonValue | undefined,
): boolean {
  if (value === undefined) return contract.allowUnset === true

  switch (contract.kind) {
    case 'array':
      return Array.isArray(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'media':
    case 'object':
    case 'visualization':
      return isRecord(value)
    case 'null':
      return value === null
    case 'number':
      return typeof value === 'number' && (contract.finite !== true || Number.isFinite(value))
    case 'string':
      return (
        typeof value === 'string' &&
        (contract.values === undefined || contract.values.includes(value))
      )
    case 'tuple':
      return Array.isArray(value) && value.length === contract.length
  }
}

function normalizeValueContract(value: unknown): PicodashPresentationValueContract | null {
  if (!isRecord(value) || !isNonEmptyString(value.kind)) return null
  if (value.allowUnset !== undefined && typeof value.allowUnset !== 'boolean') {
    return null
  }

  const base = value.allowUnset === undefined ? {} : { allowUnset: value.allowUnset }
  switch (value.kind) {
    case 'array':
    case 'boolean':
    case 'media':
    case 'null':
    case 'object':
    case 'visualization':
      return hasOnlyKeys(value, ['allowUnset', 'kind'])
        ? Object.freeze({ ...base, kind: value.kind })
        : null
    case 'number':
      if (
        !hasOnlyKeys(value, ['allowUnset', 'finite', 'kind']) ||
        (value.finite !== undefined && typeof value.finite !== 'boolean')
      ) {
        return null
      }
      return Object.freeze({
        ...base,
        ...(value.finite === undefined ? {} : { finite: value.finite }),
        kind: 'number',
      })
    case 'string': {
      if (!hasOnlyKeys(value, ['allowUnset', 'kind', 'values'])) return null
      if (
        value.values !== undefined &&
        (!Array.isArray(value.values) ||
          value.values.length === 0 ||
          value.values.some((entry) => typeof entry !== 'string') ||
          new Set(value.values).size !== value.values.length)
      ) {
        return null
      }
      const values =
        value.values === undefined
          ? undefined
          : Object.freeze([...value.values].sort((left, right) => left.localeCompare(right)))
      return Object.freeze({
        ...base,
        kind: 'string',
        ...(values === undefined ? {} : { values }),
      })
    }
    case 'tuple':
      return hasOnlyKeys(value, ['allowUnset', 'kind', 'length']) &&
        Number.isSafeInteger(value.length) &&
        typeof value.length === 'number' &&
        value.length >= 0
        ? Object.freeze({ ...base, kind: 'tuple', length: value.length })
        : null
    default:
      return null
  }
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed)
  return Object.keys(value).every((key) => allowedKeys.has(key))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
