import { describe, expect, it } from 'vite-plus/test'
import { test as property } from '@fast-check/vitest'
import { clonePicodashValue, picodashJsonEqual } from '../src/json.js'
import {
  createInvalidJsonBoundaryCases,
  hostileJsonKeys,
  hostileJsonObjectArbitrary,
  strictJsonValueArbitrary,
} from './support/json-fixtures.js'

describe('strict JSON kernel', () => {
  const assertTree = (input: any, output: any) => {
    if (!input || typeof input !== 'object') return
    expect(output).not.toBe(input)
    expect(Object.isFrozen(output)).toBe(true)
    if (Array.isArray(input)) input.forEach((entry, index) => assertTree(entry, output[index]))
    else Object.keys(input).forEach((key) => assertTree(input[key], output[key]))
  }

  property.prop([strictJsonValueArbitrary])(
    'clones equivalently, detached and recursively frozen',
    (value) => {
      const clone = clonePicodashValue(value)
      expect(picodashJsonEqual(clone, value)).toBe(true)
      assertTree(value, clone)
    },
  )

  it.each([
    ['undefined', undefined],
    ['bigint', 1n],
    ['function', () => 1],
    ['symbol', Symbol('x')],
    ['infinity', Infinity],
    ['nan', NaN],
    ['negative infinity', -Infinity],
    ['date', new Date()],
    ['map', new Map()],
    ['set', new Set()],
    [
      'class instance',
      new (class Example {
        value = 1
      })(),
    ],
  ])('rejects %s', (_name: string, value: unknown) =>
    expect(() => clonePicodashValue(value as never)).toThrow(),
  )

  it('rejects every freshly allocated invalid boundary case', () => {
    const boundaries = createInvalidJsonBoundaryCases()
    const freshBoundaries = createInvalidJsonBoundaryCases()
    boundaries.forEach((boundary, index) => {
      const fresh = freshBoundaries[index]
      if (boundary.value !== null && typeof boundary.value === 'object')
        expect(Object.is(boundary.value, fresh?.value)).toBe(false)
      expect(() => clonePicodashValue(boundary.value as never), boundary.name).toThrow()
      if (boundary.readCount !== undefined) expect(boundary.readCount()).toBe(0)
    })
  })

  property.prop([hostileJsonObjectArbitrary])('generates an own hostile key', (hostile) => {
    expect(hostile).not.toBeNull()
    expect(Object.keys(hostile as object)).toHaveLength(1)
    expect(hostileJsonKeys).toContain(Object.keys(hostile as object)[0])
  })

  it('clones repeated acyclic references independently', () => {
    const shared = { value: 1 }
    const clone = clonePicodashValue({ a: shared, b: shared } as never) as any
    expect(clone.a).not.toBe(clone.b)
    expect(clone.a).not.toBe(shared)
    expect(clone.b).not.toBe(shared)
  })

  it('preserves hostile nested keys and normalizes negative zero', () => {
    const hostile = Object.create(null)
    Object.defineProperty(hostile, '__proto__', { value: { polluted: true }, enumerable: true })
    const value = clonePicodashValue({ hostile, nested: { ['__proto__']: -0 } } as never) as any
    expect(value.nested['__proto__']).toBe(0)
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('obeys semantic equality laws', () => {
    expect(picodashJsonEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(picodashJsonEqual([1, 2], [2, 1])).toBe(false)
    expect(picodashJsonEqual(-0, 0)).toBe(true)
  })
})
