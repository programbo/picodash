import { fc } from '@fast-check/vitest'
import type { PicodashJsonValue } from '../../src/types.js'

/** Keys that are useful for exercising object-boundary and prototype-safety code. */
export const hostileJsonKeys = Object.freeze([
  '',
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'hasOwnProperty',
  '0',
  '01',
  '4294967294',
  '\u0000',
  'nested.key',
  'emoji-😀',
] as const)

/** Build an own-property-only record without assigning through a prototype setter. */
export function ownDataRecord(entries: readonly (readonly [string, PicodashJsonValue])[]) {
  const record = Object.create(null) as Record<string, PicodashJsonValue>
  for (const [key, value] of entries) {
    Object.defineProperty(record, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    })
  }
  return record
}

const jsonKeyArbitrary = fc.oneof(fc.string({ maxLength: 12 }), fc.constantFrom(...hostileJsonKeys))

/** Bounded, strict JSON values with finite numbers and dense arrays. */
const jsonArbitraries = fc.letrec((tie) => ({
  value: fc.oneof(
    fc.boolean(),
    fc.string({ maxLength: 32 }),
    fc.integer({ min: -1_000_000, max: 1_000_000 }),
    fc.double({ noNaN: true, noDefaultInfinity: true, min: -1_000_000, max: 1_000_000 }),
    fc.constant(null),
    tie('array'),
    tie('object'),
  ),
  array: fc.array(tie('value'), { maxLength: 8 }),
  object: fc.oneof(
    fc
      .array(fc.tuple(jsonKeyArbitrary, tie('value')), { maxLength: 8 })
      .map((entries) =>
        ownDataRecord(entries as readonly (readonly [string, PicodashJsonValue])[]),
      ),
    tie('hostileObject'),
  ),
  hostileObject: fc
    .tuple(fc.constantFrom(...hostileJsonKeys), tie('value'))
    .map(([key, value]) => ownDataRecord([[key, value as PicodashJsonValue]])),
}))

export const strictJsonValueArbitrary = jsonArbitraries.value as fc.Arbitrary<PicodashJsonValue>
export const hostileJsonObjectArbitrary =
  jsonArbitraries.hostileObject as fc.Arbitrary<PicodashJsonValue>

export interface InvalidJsonBoundaryCase {
  readonly name: string
  readonly description: string
  readonly value: unknown
  readonly readCount?: () => number
}

/** Freshly allocates values that strict JSON boundary code must reject. */
export function createInvalidJsonBoundaryCases(): InvalidJsonBoundaryCase[] {
  const cycle: unknown[] = []
  cycle.push(cycle)

  const sparse: unknown[] = []
  sparse.length = 2

  const extended = [] as unknown[] & { extra?: unknown }
  extended.push(1)
  extended.extra = 2

  const nonIndex = [] as unknown[] & { '01'?: unknown }
  nonIndex.push(1)
  nonIndex['01'] = 2

  const outOfRange = [] as unknown as unknown[] & { [key: string]: unknown }
  outOfRange.push(1)
  outOfRange['4294967295'] = 2

  const hiddenObject = Object.create(null) as Record<string, unknown>
  Object.defineProperty(hiddenObject, 'hidden', { value: 1, enumerable: false })

  const hiddenIndex: unknown[] = []
  Object.defineProperty(hiddenIndex, '0', { value: 1, enumerable: false })

  let accessorRead = 0
  const accessor = Object.create(null) as Record<string, unknown>
  Object.defineProperty(accessor, 'value', {
    enumerable: true,
    get() {
      accessorRead += 1
      return accessorRead
    },
  })

  const symbolKey = Object.create(null) as Record<PropertyKey, unknown>
  symbolKey[Symbol('hostile')] = 1

  const revoked = Proxy.revocable(Object.create(null), {})
  revoked.revoke()

  return [
    { name: 'cycle', description: 'self-referential array', value: cycle },
    { name: 'sparse-array', description: 'array with a missing index', value: sparse },
    { name: 'array-extension', description: 'array with an extra property', value: extended },
    { name: 'array-non-index', description: 'array with a non-index key', value: nonIndex },
    {
      name: 'array-out-of-range',
      description: 'array with an out-of-range index',
      value: outOfRange,
    },
    {
      name: 'hidden-object-property',
      description: 'non-enumerable object property',
      value: hiddenObject,
    },
    { name: 'hidden-array-index', description: 'non-enumerable array index', value: hiddenIndex },
    {
      name: 'accessor',
      description: 'getter property',
      value: accessor,
      readCount: () => accessorRead,
    },
    { name: 'symbol-key', description: 'symbol property key', value: symbolKey },
    { name: 'revoked-proxy', description: 'revoked proxy boundary', value: revoked.proxy },
    { name: 'undefined', description: 'undefined primitive', value: undefined },
    { name: 'bigint', description: 'bigint primitive', value: 1n },
    { name: 'function', description: 'function value', value: () => 1 },
    { name: 'symbol', description: 'symbol primitive', value: Symbol('hostile') },
    { name: 'nan', description: 'not-a-number', value: Number.NaN },
    { name: 'infinity', description: 'infinite number', value: Number.POSITIVE_INFINITY },
    { name: 'date', description: 'Date object', value: new Date(0) },
    { name: 'map', description: 'Map object', value: new Map() },
    { name: 'set', description: 'Set object', value: new Set() },
  ]
}
