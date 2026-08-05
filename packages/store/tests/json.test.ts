import { describe, expect, it } from 'vite-plus/test'
import { fc, test as property } from '@fast-check/vitest'
import { clonePicodashValue, picodashJsonEqual } from '../src/json.js'
import type { PicodashJsonValue } from '../src/types.js'

const jsonArb: fc.Arbitrary<PicodashJsonValue> = fc.letrec((tie) => ({
  value: fc.oneof(
    fc.boolean(),
    fc.string(),
    fc.integer(),
    fc.constant(null),
    tie('array'),
    tie('object'),
  ),
  array: fc.array(tie('value')),
  object: fc.dictionary(fc.string(), tie('value')),
})).value as fc.Arbitrary<PicodashJsonValue>

describe('strict JSON kernel', () => {
  const assertTree = (input: any, output: any) => {
    if (!input || typeof input !== 'object') return
    expect(output).not.toBe(input)
    expect(Object.isFrozen(output)).toBe(true)
    if (Array.isArray(input)) input.forEach((entry, index) => assertTree(entry, output[index]))
    else Object.keys(input).forEach((key) => assertTree(input[key], output[key]))
  }

  property.prop([jsonArb])('clones equivalently, detached and recursively frozen', (value) => {
    const clone = clonePicodashValue(value)
    expect(picodashJsonEqual(clone, value)).toBe(true)
    assertTree(value, clone)
  })

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

  it('rejects cycles, sparse arrays, extensions, accessors and symbols', () => {
    const cycle: any[] = []
    cycle.push(cycle)
    expect(() => clonePicodashValue(cycle as never)).toThrow()
    expect(() => clonePicodashValue(Object.assign([], { 2: 1 }) as never)).toThrow()
    expect(() => clonePicodashValue(Object.assign([], { extra: 1 }) as never)).toThrow()
    expect(() => clonePicodashValue(Object.assign([], { '01': 1 }) as never)).toThrow()
    expect(() => clonePicodashValue(Object.assign([], { '4294967295': 1 }) as never)).toThrow()
    const hiddenIndex: any[] = []
    Object.defineProperty(hiddenIndex, '0', { value: 1, enumerable: false })
    expect(() => clonePicodashValue(hiddenIndex as never)).toThrow()
    const hiddenObject = {}
    Object.defineProperty(hiddenObject, 'x', { value: 1, enumerable: false })
    expect(() => clonePicodashValue(hiddenObject as never)).toThrow()
    let invoked = 0
    const accessor = {}
    Object.defineProperty(accessor, 'x', {
      enumerable: true,
      get() {
        invoked += 1
        return 1
      },
    })
    expect(() => clonePicodashValue(accessor as never)).toThrow()
    expect(invoked).toBe(0)
    expect(() => clonePicodashValue({ [Symbol('x')]: 1 } as never)).toThrow()
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
