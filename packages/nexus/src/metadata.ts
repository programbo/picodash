import type {
  DashStackMetadataRecord,
  DashPanelDockPositionRecord,
  DashPanelLayoutRecord,
  DashPanelPlacementRecord,
  DashPanelSnapPositionRecord,
  DurableScopeMetadata,
} from './kernel/index.js'

const SNAP_POSITIONS = new Set<DashPanelSnapPositionRecord>([
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
])

const DOCK_POSITIONS = new Set<DashPanelDockPositionRecord>([
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
  'full-left',
  'center-left',
  'full-right',
  'center-right',
  'full-top',
  'center-top',
  'full-bottom',
  'center-bottom',
])

type SerializedStringMap = readonly (readonly [string, readonly string[]])[]
type SerializedBooleanMap = readonly (readonly [string, boolean])[]
const immutableMaps = new WeakSet<object>()

/** The JSON projection used by Nexus persistence for DashStack metadata. */
export type SerializedDashStackMetadataRecord = {
  readonly rootOrder?: readonly string[]
  readonly groupOrders: SerializedStringMap
  readonly collapseOverrides: SerializedBooleanMap
}

/** The JSON projection used by Nexus persistence for DashPanel metadata. */
export type SerializedDashPanelLayoutRecord = DashPanelLayoutRecord

/** The JSON projection used by Nexus persistence for a durable scope. */
export type SerializedDurableScopeMetadata = {
  readonly dashPanelHotkey?: string
  readonly dashGroupHotkeys?: readonly (readonly [string, string])[]
  readonly dashStack?: SerializedDashStackMetadataRecord
  readonly dashPanel?: SerializedDashPanelLayoutRecord
}

/**
 * Normalizes a complete in-memory DashStack record into detached, immutable Nexus data.
 * The helper is intentionally internal; DashStack translates its public model at the integration
 * boundary rather than importing this package's implementation types.
 */
export function normalizeDashStackMetadataRecord(input: unknown): DashStackMetadataRecord {
  if (!isRecord(input) || !hasExactKeys(input, ['rootOrder', 'groupOrders', 'collapseOverrides']))
    throw invalidMetadata()

  const rootOrder = !Object.hasOwn(input, 'rootOrder')
    ? undefined
    : ownValue(input, 'rootOrder') === undefined
      ? undefined
      : normalizeIdList(ownValue(input, 'rootOrder'))
  const groupOrders = normalizeStringMap(ownValue(input, 'groupOrders'), normalizeIdList)
  const collapseOverrides = normalizeBooleanMap(ownValue(input, 'collapseOverrides'))

  return freezeRecord({
    ...(rootOrder === undefined ? {} : { rootOrder }),
    groupOrders,
    collapseOverrides,
  })
}

/** Normalizes and validates a complete in-memory DashPanel layout record. */
export function normalizeDashPanelLayoutRecord(input: unknown): DashPanelLayoutRecord {
  if (
    !isRecord(input) ||
    Object.keys(input).some(
      (key) => !['version', 'placement', 'preferredPosition', 'manualSize'].includes(key),
    ) ||
    ownValue(input, 'version') !== 2
  )
    throw invalidMetadata()
  const placement = Object.hasOwn(input, 'placement')
    ? normalizePlacement(ownValue(input, 'placement'))
    : undefined
  let preferredPosition: { readonly x: number; readonly y: number } | undefined
  if (Object.hasOwn(input, 'preferredPosition')) {
    const position = ownValue(input, 'preferredPosition')
    if (!isRecord(position) || !hasExactKeys(position, ['x', 'y'])) throw invalidMetadata()
    const x = ownValue(position, 'x'),
      y = ownValue(position, 'y')
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) throw invalidMetadata()
    preferredPosition = freezeRecord({ x: normalizeNumber(x), y: normalizeNumber(y) })
  }
  let manualSize: DashPanelLayoutRecord['manualSize']
  if (Object.hasOwn(input, 'manualSize')) {
    const size = ownValue(input, 'manualSize')
    if (!isRecord(size) || Object.keys(size).some((key) => key !== 'width' && key !== 'height'))
      throw invalidMetadata()
    const width = ownValue(size, 'width'),
      height = ownValue(size, 'height')
    if (Object.hasOwn(size, 'width') && (!isFiniteNumber(width) || width <= 0))
      throw invalidMetadata()
    if (Object.hasOwn(size, 'height') && (!isFiniteNumber(height) || height <= 0))
      throw invalidMetadata()
    if (isFiniteNumber(width) && width > 0)
      manualSize = freezeRecord({ width, ...(isFiniteNumber(height) ? { height } : {}) })
    else if (isFiniteNumber(height) && height > 0) manualSize = freezeRecord({ height })
    else throw invalidMetadata()
  }
  const base = {
    version: 2 as const,
    ...(placement ? { placement } : {}),
    ...(preferredPosition ? { preferredPosition } : {}),
    ...(manualSize ? { manualSize } : {}),
  }
  if (placement) return freezeRecord({ ...base, placement })
  if (preferredPosition) return freezeRecord({ ...base, preferredPosition })
  if (manualSize) return freezeRecord({ ...base, manualSize })
  throw invalidMetadata()
}

/** Normalizes both product domains atomically; empty domains are omitted. */
export function normalizeDurableScopeMetadata(input: unknown): DurableScopeMetadata | undefined {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, ['dashStack', 'dashPanel', 'dashPanelHotkey', 'dashGroupHotkeys'])
  )
    throw invalidMetadata()

  // Validate both products before constructing the result. This keeps malformed complete records
  // from partially entering a scope snapshot or persistence transaction.
  const dashStackCandidate =
    !Object.hasOwn(input, 'dashStack') || ownValue(input, 'dashStack') === undefined
      ? undefined
      : normalizeDashStackMetadataRecord(ownValue(input, 'dashStack'))
  const dashPanel =
    !Object.hasOwn(input, 'dashPanel') || ownValue(input, 'dashPanel') === undefined
      ? undefined
      : normalizeDashPanelLayoutRecord(ownValue(input, 'dashPanel'))
  const dashPanelHotkey =
    ownValue(input, 'dashPanelHotkey') === undefined
      ? undefined
      : normalizeDashPanelHotkey(ownValue(input, 'dashPanelHotkey'))
  const dashGroupHotkeys =
    ownValue(input, 'dashGroupHotkeys') === undefined
      ? undefined
      : normalizeStringMap(ownValue(input, 'dashGroupHotkeys'), normalizeDashPanelHotkey)
  const dashStack =
    dashStackCandidate !== undefined && isEmptyDashStack(dashStackCandidate)
      ? undefined
      : dashStackCandidate
  if (
    dashStack === undefined &&
    dashPanel === undefined &&
    dashPanelHotkey === undefined &&
    !dashGroupHotkeys?.size
  )
    return undefined

  return freezeRecord({
    ...(dashStack === undefined ? {} : { dashStack }),
    ...(dashPanel === undefined ? {} : { dashPanel }),
    ...(dashPanelHotkey === undefined ? {} : { dashPanelHotkey }),
    ...(!dashGroupHotkeys?.size ? {} : { dashGroupHotkeys }),
  })
}

/** Decodes a JSON metadata projection, rejecting duplicate serialized map keys. */
export function decodeDurableScopeMetadata(input: unknown): DurableScopeMetadata | undefined {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, ['dashStack', 'dashPanel', 'dashPanelHotkey', 'dashGroupHotkeys'])
  )
    throw invalidMetadata()
  if (
    (Object.hasOwn(input, 'dashStack') && ownValue(input, 'dashStack') === undefined) ||
    (Object.hasOwn(input, 'dashPanel') && ownValue(input, 'dashPanel') === undefined) ||
    (Object.hasOwn(input, 'dashPanelHotkey') && ownValue(input, 'dashPanelHotkey') === undefined) ||
    (Object.hasOwn(input, 'dashGroupHotkeys') && ownValue(input, 'dashGroupHotkeys') === undefined)
  )
    throw invalidMetadata()
  const dashStackCandidate = !Object.hasOwn(input, 'dashStack')
    ? undefined
    : decodeDashStackMetadataRecord(ownValue(input, 'dashStack'))
  const dashPanel = !Object.hasOwn(input, 'dashPanel')
    ? undefined
    : normalizeDashPanelLayoutRecord(ownValue(input, 'dashPanel'))
  const dashPanelHotkey =
    ownValue(input, 'dashPanelHotkey') === undefined
      ? undefined
      : normalizeDashPanelHotkey(ownValue(input, 'dashPanelHotkey'))
  const dashGroupHotkeys =
    ownValue(input, 'dashGroupHotkeys') === undefined
      ? undefined
      : decodeStringMap(ownValue(input, 'dashGroupHotkeys'), normalizeDashPanelHotkey)
  const dashStack =
    dashStackCandidate !== undefined && isEmptyDashStack(dashStackCandidate)
      ? undefined
      : dashStackCandidate
  if (
    dashStack === undefined &&
    dashPanel === undefined &&
    dashPanelHotkey === undefined &&
    !dashGroupHotkeys?.size
  )
    return undefined
  return freezeRecord({
    ...(dashStack === undefined ? {} : { dashStack }),
    ...(dashPanel === undefined ? {} : { dashPanel }),
    ...(dashPanelHotkey === undefined ? {} : { dashPanelHotkey }),
    ...(!dashGroupHotkeys?.size ? {} : { dashGroupHotkeys }),
  })
}

/**
 * Hydration-only cutover for the exact, obsolete prototype Panel payload. This discards that
 * product's preference rather than migrating it, while retaining independently valid List data.
 * Documents and ordinary writes remain strict v2 and never invoke this recovery path.
 */
export function decodeHydratedScopeMetadata(input: unknown): {
  readonly metadata: DurableScopeMetadata | undefined
  readonly obsoletePanel: boolean
} {
  if (
    isRecord(input) &&
    hasExactKeys(input, ['dashStack', 'dashPanel', 'dashPanelHotkey', 'dashGroupHotkeys'])
  ) {
    const panel = ownValue(input, 'dashPanel')
    if (isRecord(panel) && hasExactKeys(panel, ['placement', 'preferredPosition'])) {
      normalizePlacement(ownValue(panel, 'placement'))
      const position = ownValue(panel, 'preferredPosition')
      if (
        !isRecord(position) ||
        !hasExactKeys(position, ['x', 'y']) ||
        !isFiniteNumber(ownValue(position, 'x')) ||
        !isFiniteNumber(ownValue(position, 'y'))
      )
        throw invalidMetadata()
      const retained = { ...input }
      delete retained.dashPanel
      const metadata = decodeDurableScopeMetadata(retained)
      return { metadata, obsoletePanel: true }
    }
  }
  return { metadata: decodeDurableScopeMetadata(input), obsoletePanel: false }
}

export function decodeDashStackMetadataRecord(input: unknown): DashStackMetadataRecord {
  if (!isRecord(input) || !hasExactKeys(input, ['rootOrder', 'groupOrders', 'collapseOverrides']))
    throw invalidMetadata()
  if (Object.hasOwn(input, 'rootOrder') && ownValue(input, 'rootOrder') === undefined)
    throw invalidMetadata()
  const rootOrder = !Object.hasOwn(input, 'rootOrder')
    ? undefined
    : normalizeIdList(ownValue(input, 'rootOrder'))
  const groupOrders = decodeStringMap(ownValue(input, 'groupOrders'), normalizeIdList)
  const collapseOverrides = decodeBooleanMap(ownValue(input, 'collapseOverrides'))
  return freezeRecord({
    ...(rootOrder === undefined ? {} : { rootOrder }),
    groupOrders,
    collapseOverrides,
  })
}

export function encodeDurableScopeMetadata(
  input: DurableScopeMetadata | undefined,
): SerializedDurableScopeMetadata | undefined {
  if (input === undefined) return undefined
  const normalized = normalizeDurableScopeMetadata(input)
  if (normalized === undefined) return undefined
  return freezeRecord({
    ...(normalized.dashGroupHotkeys === undefined
      ? {}
      : {
          dashGroupHotkeys: Object.freeze(
            [...normalized.dashGroupHotkeys].map((entry) => Object.freeze(entry)),
          ),
        }),
    ...(normalized.dashStack === undefined
      ? {}
      : { dashStack: encodeDashStackMetadataRecord(normalized.dashStack) }),
    ...(normalized.dashPanel === undefined ? {} : { dashPanel: normalized.dashPanel }),
    ...(normalized.dashPanelHotkey === undefined
      ? {}
      : { dashPanelHotkey: normalized.dashPanelHotkey }),
  })
}

export function encodeDashStackMetadataRecord(
  input: DashStackMetadataRecord,
): SerializedDashStackMetadataRecord {
  const normalized = normalizeDashStackMetadataRecord(input)
  return freezeRecord({
    ...(normalized.rootOrder === undefined ? {} : { rootOrder: normalized.rootOrder }),
    groupOrders: encodeStringMap(normalized.groupOrders),
    collapseOverrides: encodeBooleanMap(normalized.collapseOverrides),
  })
}

function normalizePlacement(input: unknown): DashPanelPlacementRecord {
  if (
    !isRecord(input) ||
    typeof ownValue(input, 'mode') !== 'string' ||
    !hasExactKeys(input, ['mode', 'disposition'])
  )
    throw invalidMetadata()
  const mode = ownValue(input, 'mode')
  const disposition = ownValue(input, 'disposition')
  if (!isRecord(disposition) || typeof ownValue(disposition, 'kind') !== 'string')
    throw invalidMetadata()
  const kind = ownValue(disposition, 'kind')

  if (mode === 'floating') {
    if (kind === 'free' && hasExactKeys(disposition, ['kind']))
      return freezeRecord({ mode: 'floating', disposition: freezeRecord({ kind: 'free' }) })
    if (kind === 'snapped' && hasExactKeys(disposition, ['kind', 'position'])) {
      const position = ownValue(disposition, 'position')
      if (isSnapPosition(position))
        return freezeRecord({
          mode: 'floating',
          disposition: freezeRecord({ kind: 'snapped', position }),
        })
    }
    throw invalidMetadata()
  }

  if (mode === 'fixed') {
    if (kind === 'docked' && hasExactKeys(disposition, ['kind', 'position'])) {
      const position = ownValue(disposition, 'position')
      if (isDockPosition(position))
        return freezeRecord({
          mode: 'fixed',
          disposition: freezeRecord({ kind: 'docked', position }),
        })
    }
    throw invalidMetadata()
  }

  if (mode === 'hybrid') {
    if (kind === 'free' && hasExactKeys(disposition, ['kind']))
      return freezeRecord({ mode: 'hybrid', disposition: freezeRecord({ kind: 'free' }) })
    if (
      kind === 'snapped' &&
      hasExactKeys(disposition, ['kind', 'position']) &&
      (ownValue(disposition, 'position') === 'top' ||
        ownValue(disposition, 'position') === 'bottom')
    )
      return freezeRecord({
        mode: 'hybrid',
        disposition: freezeRecord({
          kind: 'snapped',
          position: ownValue(disposition, 'position') as 'top' | 'bottom',
        }),
      })
    if (kind === 'docked' && hasExactKeys(disposition, ['kind', 'position'])) {
      const position = ownValue(disposition, 'position')
      if (isDockPosition(position))
        return freezeRecord({
          mode: 'hybrid',
          disposition: freezeRecord({ kind: 'docked', position }),
        })
    }
  }
  throw invalidMetadata()
}

function normalizeIdList(input: unknown): readonly string[] {
  if (!isArrayValue(input) || !isPlainDataArray(input)) throw invalidMetadata()
  const seen = new Set<string>()
  const values: string[] = []
  for (let index = 0, length = arrayLength(input); index < length; index += 1) {
    const value = ownArrayValue(input, index)
    if (!isValidIdentifier(value) || seen.has(value)) throw invalidMetadata()
    seen.add(value)
    values.push(value)
  }
  return Object.freeze(values)
}

function ownArrayValue(value: readonly unknown[], index: number): unknown {
  try {
    return value[index]
  } catch {
    throw invalidMetadata()
  }
}

function arrayLength(value: readonly unknown[]): number {
  try {
    return value.length
  } catch {
    throw invalidMetadata()
  }
}

function normalizeStringMap<Value>(
  input: unknown,
  normalizeValue: (value: unknown) => Value,
): ReadonlyMap<string, Value> {
  if (!isAcceptedMap(input)) throw invalidMetadata()
  const entries: [string, Value][] = []
  try {
    for (const [key, value] of input.entries()) {
      if (!isValidIdentifier(key)) throw invalidMetadata()
      entries.push([key, normalizeValue(value)])
    }
  } catch {
    throw invalidMetadata()
  }
  entries.sort(compareEntries)
  return immutableMap(entries)
}

function normalizeBooleanMap(input: unknown): ReadonlyMap<string, boolean> {
  if (!isAcceptedMap(input)) throw invalidMetadata()
  const entries: [string, boolean][] = []
  try {
    for (const [key, value] of input.entries()) {
      if (!isValidIdentifier(key) || typeof value !== 'boolean') throw invalidMetadata()
      entries.push([key, value])
    }
  } catch {
    throw invalidMetadata()
  }
  entries.sort(compareEntries)
  return immutableMap(entries)
}

function decodeStringMap<Value>(
  input: unknown,
  normalizeValue: (value: unknown) => Value,
): ReadonlyMap<string, Value> {
  if (!isArrayValue(input) || !isPlainDataArray(input)) throw invalidMetadata()
  const entries: [string, Value][] = []
  const seen = new Set<string>()
  for (let index = 0, length = arrayLength(input); index < length; index += 1) {
    const entry = ownArrayValue(input, index)
    if (!isArrayValue(entry) || arrayLength(entry) !== 2 || !isPlainDataArray(entry))
      throw invalidMetadata()
    const key = ownArrayValue(entry, 0)
    if (!isValidIdentifier(key) || seen.has(key)) throw invalidMetadata()
    seen.add(key)
    entries.push([key, normalizeValue(ownArrayValue(entry, 1))])
  }
  entries.sort(compareEntries)
  return immutableMap(entries)
}

function decodeBooleanMap(input: unknown): ReadonlyMap<string, boolean> {
  if (!isArrayValue(input) || !isPlainDataArray(input)) throw invalidMetadata()
  const entries: [string, boolean][] = []
  const seen = new Set<string>()
  for (let index = 0, length = arrayLength(input); index < length; index += 1) {
    const entry = ownArrayValue(input, index)
    if (!isArrayValue(entry) || arrayLength(entry) !== 2 || !isPlainDataArray(entry))
      throw invalidMetadata()
    const key = ownArrayValue(entry, 0)
    const entryValue = ownArrayValue(entry, 1)
    if (!isValidIdentifier(key) || seen.has(key) || typeof entryValue !== 'boolean')
      throw invalidMetadata()
    seen.add(key)
    entries.push([key, entryValue])
  }
  entries.sort(compareEntries)
  return immutableMap(entries)
}

function encodeStringMap(input: ReadonlyMap<string, readonly string[]>): SerializedStringMap {
  const entries: [string, readonly string[]][] = []
  for (const [key, value] of input.entries()) entries.push([key, value])
  entries.sort(compareEntries)
  return Object.freeze(entries.map(([key, value]) => Object.freeze([key, value] as const)))
}

function encodeBooleanMap(input: ReadonlyMap<string, boolean>): SerializedBooleanMap {
  const entries: [string, boolean][] = []
  for (const [key, value] of input.entries()) entries.push([key, value])
  entries.sort(compareEntries)
  return Object.freeze(entries.map(([key, value]) => Object.freeze([key, value] as const)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (typeof value !== 'object' || value === null || isArrayValue(value)) return false
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return false
    const descriptors = Object.getOwnPropertyDescriptors(value)
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string') return false
      const descriptor = descriptors[key]!
      if (!descriptor.enumerable || !('value' in descriptor)) return false
    }
  } catch {
    return false
  }
  return true
}

function ownValue(value: Record<string, unknown>, key: string): unknown {
  try {
    return Object.hasOwn(value, key) ? value[key] : undefined
  } catch {
    throw invalidMetadata()
  }
}

function isArrayValue(value: unknown): value is readonly unknown[] {
  try {
    return Array.isArray(value)
  } catch {
    throw invalidMetadata()
  }
}

function hasExactKeys(value: Record<string, unknown>, optional: readonly string[]): boolean {
  const allowed = new Set(optional)
  for (const key of Object.keys(value)) if (!allowed.has(key)) return false
  return optional.every(
    (key) =>
      key === 'rootOrder' ||
      key === 'dashStack' ||
      key === 'dashPanel' ||
      key === 'dashPanelHotkey' ||
      key === 'dashGroupHotkeys' ||
      Object.hasOwn(value, key),
  )
}

function isPlainDataArray(value: readonly unknown[]): boolean {
  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) return false
    const descriptors = Object.getOwnPropertyDescriptors(value)
    for (const key of Reflect.ownKeys(descriptors)) {
      if (
        typeof key !== 'string' ||
        (key !== 'length' && (!/^0$|^[1-9]\d*$/.test(key) || Number(key) >= value.length))
      )
        return false
      if (key !== 'length' && (!descriptors[key]!.enumerable || !('value' in descriptors[key]!)))
        return false
    }
    for (let index = 0; index < value.length; index += 1)
      if (!descriptors[String(index)] || !('value' in descriptors[String(index)]!)) return false
  } catch {
    return false
  }
  return true
}

function isValidIdentifier(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) return false
  for (const character of value) {
    const code = character.codePointAt(0)!
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return false
  }
  return true
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeNumber(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

function isSnapPosition(value: unknown): value is DashPanelSnapPositionRecord {
  return typeof value === 'string' && SNAP_POSITIONS.has(value as DashPanelSnapPositionRecord)
}

function isDockPosition(value: unknown): value is DashPanelDockPositionRecord {
  return typeof value === 'string' && DOCK_POSITIONS.has(value as DashPanelDockPositionRecord)
}

function compareEntries(
  left: readonly [string, unknown],
  right: readonly [string, unknown],
): number {
  return left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0
}

function freezeRecord<T extends object>(value: T): T {
  return Object.freeze(Object.assign(Object.create(null), value)) as T
}

function immutableMap<K, V>(entries: readonly (readonly [K, V])[]): ReadonlyMap<K, V> {
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
  const frozen = Object.freeze(facade)
  immutableMaps.add(frozen)
  return frozen
}

function isAcceptedMap(value: unknown): value is ReadonlyMap<unknown, unknown> {
  try {
    return (
      (typeof value === 'object' && value !== null && value instanceof Map) ||
      (typeof value === 'object' && value !== null && immutableMaps.has(value))
    )
  } catch {
    return false
  }
}

function isEmptyDashStack(record: DashStackMetadataRecord): boolean {
  return (
    (record.rootOrder === undefined || record.rootOrder.length === 0) &&
    record.groupOrders.size === 0 &&
    record.collapseOverrides.size === 0
  )
}

function invalidMetadata(): TypeError {
  return new TypeError('Invalid Nexus metadata record.')
}

function normalizeDashPanelHotkey(input: unknown): string {
  if (
    typeof input !== 'string' ||
    !input.length ||
    input.length > 128 ||
    input.trim() !== input ||
    /[\p{Cc}\p{Cf}]/u.test(input)
  )
    throw invalidMetadata()
  return input
}
