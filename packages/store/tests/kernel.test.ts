import { describe, expect, test } from 'vite-plus/test'
import { fc, test as property } from '@fast-check/vitest'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import {
  createPicodashStore,
  PicodashContractError,
  PicodashTransactionError,
} from '../src/index.ts'

describe('Store root kernel', () => {
  test('creates frozen nominal handles and a stable empty snapshot', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { count: { defaultValue: 1 } },
    })
    const first = store.getState()
    expect(Object.keys(store.fields.count)).toEqual(['key'])
    expect(Object.isFrozen(store.fields.count)).toBe(true)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.values)).toBe(true)
    expect(first.scopes.size).toBe(0)
    expect(store.setValues({})).toEqual({ ok: true, changedFields: [], changedScopeIds: [] })
    expect(store.getState()).toBe(first)
  })

  test('canonicalizes a whole candidate before every field validator and root validation', () => {
    const seen: Array<{ first: number; second: number }> = []
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        first: {
          defaultValue: 1,
          validate: (_value, context) => {
            expect(Object.isFrozen(context)).toBe(true)
            expect(Object.isFrozen(context.values)).toBe(true)
            seen.push({ first: context.values.first, second: context.values.second })
            return []
          },
        },
        second: {
          defaultValue: 2,
          validate: (_value, context) => {
            expect(Object.isFrozen(context)).toBe(true)
            expect(Object.isFrozen(context.values)).toBe(true)
            seen.push({ first: context.values.first, second: context.values.second })
            return []
          },
        },
      },
      validateValues: (values, context) => {
        expect(Object.isFrozen(context)).toBe(true)
        expect(Object.isFrozen(context.values)).toBe(true)
        expect(values).toEqual(
          expect.objectContaining({ first: expect.any(Number), second: expect.any(Number) }),
        )
        return []
      },
    })
    seen.length = 0
    const result = store.setValues({ second: 20, first: 10 })
    expect(result).toEqual({ ok: true, changedFields: ['first', 'second'], changedScopeIds: [] })
    expect(seen).toEqual([
      { first: 10, second: 20 },
      { first: 10, second: 20 },
    ])
    expect(store.getState().values).toEqual({ first: 10, second: 20 })
  })

  test('rejects atomically, including unknown and inherited keys', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { count: { defaultValue: 1 }, title: { defaultValue: 'a' } },
    })
    const before = store.getState()
    const inherited = Object.create({ toString: 3 }) as Record<string, unknown>
    inherited.count = 2
    const result = store.setValues(inherited as never)
    expect(result.ok).toBe(true)
    expect(store.getState().values.count).toBe(2)
    const unknown = store.setValues({ nope: 3 } as never)
    expect(unknown.ok).toBe(false)
    expect(store.getState()).not.toBe(before)
    expect(store.getState().values.title).toBe('a')
    if (!unknown.ok)
      expect(unknown.error.issues[0]).toMatchObject({ code: 'unknown_field', fieldKey: 'nope' })
  })

  test('reruns validation for semantic no-ops but does not notify', () => {
    let validations = 0
    let notifications = 0
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        count: {
          defaultValue: 1,
          validate: () => {
            validations += 1
            return []
          },
        },
      },
    })
    store.subscribe(() => {
      notifications += 1
    })
    validations = 0
    const empty = store.setValues({})
    expect(empty).toMatchObject({ ok: true, changedFields: [] })
    expect(validations).toBe(0)
    const result = store.setValues({ count: 1 })
    expect(result).toEqual({ ok: true, changedFields: [], changedScopeIds: [] })
    expect(validations).toBe(1)
    expect(notifications).toBe(0)
  })

  test('notifies all listeners despite exceptions and isolates reentrant writes', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { count: { defaultValue: 1 } },
    })
    const calls: string[] = []
    store.subscribe(() => {
      calls.push('first')
      expect(() => store.setValue(store.fields.count, 3)).toThrowError(
        expect.objectContaining({ code: 'reentrant-write' }),
      )
      throw new Error('subscriber failure')
    })
    store.subscribe(() => {
      calls.push('second')
    })
    expect(store.setValue(store.fields.count, 2)).toMatchObject({
      ok: true,
      changedFields: ['count'],
    })
    expect(calls).toEqual(['first', 'second'])
  })

  test('preserves the same transaction error for OrThrow', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        count: {
          defaultValue: 1,
          validate: (value) => ((value as number) === 2 ? [{ message: 'No.' }] : []),
        },
      },
    })
    const result = store.setValue(store.fields.count, 2)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(() => store.setValueOrThrow(store.fields.count, 2)).toThrow(result.error)
      expect(result.error).toBeInstanceOf(PicodashTransactionError)
    }
  })

  test('rejects forged and foreign handles with no public owner marker', () => {
    const first = createPicodashStore({
      valueOwner: 'store',
      fields: { count: { defaultValue: 1 } },
    })
    const second = createPicodashStore({
      valueOwner: 'store',
      fields: { count: { defaultValue: 1 } },
    })
    expect(Object.getOwnPropertyNames(first.fields.count)).toEqual(['key'])
    expect(() => first.setValue(second.fields.count, 2)).toThrowError(PicodashContractError)
    expect(() => first.setValue({ key: 'count' } as never, 2)).toThrowError(PicodashContractError)
  })

  test('accepts empty stores and rejects invalid construction identities and values', () => {
    const empty = createPicodashStore({ valueOwner: 'store', fields: {} })
    expect(empty.getState().values).toEqual({})
    expect(Object.isFrozen(empty.getState().values)).toBe(true)
    expect(Object.isFrozen(empty.getState().scopes)).toBe(true)
    expect(Object.isFrozen(empty.setValues({}))).toBe(true)

    for (const storeId of [
      '',
      ' leading',
      'trailing ',
      'c0\u0000',
      'c0\u001f',
      'del\u007f',
      'c1\u0080',
      'c1\u009f',
    ])
      expect(() => createPicodashStore({ valueOwner: 'store', storeId, fields: {} })).toThrowError(
        PicodashContractError,
      )
    for (const key of [
      '',
      ' leading',
      'c0\u0000',
      'c0\u001f',
      'line\nfeed',
      'del\u007f',
      'c1\u0080',
      'c1\u009f',
      '__proto__',
      'prototype',
      'constructor',
    ]) {
      const fields = Object.create(null)
      fields[key] = { defaultValue: 1 }
      expect(() => createPicodashStore({ valueOwner: 'store', fields })).toThrowError(
        PicodashContractError,
      )
    }

    expect(() =>
      createPicodashStore({ valueOwner: 'store', fields: {}, schemaVersion: 1 }),
    ).toThrowError(PicodashContractError)
    expect(() =>
      createPicodashStore({ valueOwner: 'store', fields: {}, storeId: 'app', schemaVersion: 0 }),
    ).toThrowError(PicodashContractError)
    expect(() =>
      createPicodashStore({ valueOwner: 'store', fields: {}, storeId: 'app', schemaVersion: -1 }),
    ).toThrowError(PicodashContractError)
    expect(() =>
      createPicodashStore({ valueOwner: 'store', fields: {}, storeId: 'app', schemaVersion: 1.5 }),
    ).toThrowError(PicodashContractError)
    expect(() =>
      createPicodashStore({
        valueOwner: 'store',
        fields: {},
        storeId: 'app',
        schemaVersion: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrowError(PicodashContractError)
    expect(() =>
      createPicodashStore({ valueOwner: 'store', fields: {}, storeId: 'app', schemaVersion: 1 }),
    ).not.toThrow()

    expect(() =>
      createPicodashStore({
        valueOwner: 'store',
        fields: { value: { defaultValue: new Date() as never } },
      }),
    ).toThrowError(PicodashContractError)
    expect(() =>
      createPicodashStore({
        valueOwner: 'store',
        fields: { value: { defaultValue: 1 } },
        initialValues: { value: Number.NaN } as never,
      }),
    ).toThrowError(PicodashContractError)
    expect(() =>
      createPicodashStore({ valueOwner: 'store', fields: {}, initialValues: [] as never }),
    ).toThrowError(PicodashContractError)
  })

  test('captures schema, field, and root callback references at construction', () => {
    let schemaCalls = 0
    let fieldCalls = 0
    let rootCalls = 0
    const schema = {
      '~standard': {
        version: 1 as const,
        vendor: 'capture-test',
        validate: (value: unknown) => {
          schemaCalls += 1
          return { value, issues: undefined }
        },
      },
    } as unknown as StandardSchemaV1<unknown, number>
    const config = {
      valueOwner: 'store' as const,
      fields: {
        value: {
          defaultValue: 1 as number,
          schema,
          validate: () => {
            fieldCalls += 1
            return []
          },
        },
      },
      validateValues: () => {
        rootCalls += 1
        return []
      },
    }
    const store = createPicodashStore(config)
    schemaCalls = 0
    fieldCalls = 0
    rootCalls = 0
    ;(schema['~standard'] as { validate: (value: unknown) => unknown }).validate = () => {
      throw new Error('mutated schema')
    }
    ;(config.fields.value as { validate: () => readonly never[] }).validate = () => {
      throw new Error('mutated field')
    }
    ;(config as { validateValues: () => readonly never[] }).validateValues = () => {
      throw new Error('mutated root')
    }
    expect(store.setValues({ value: 2 })).toMatchObject({ ok: true, changedFields: ['value'] })
    expect(schemaCalls).toBe(1)
    expect(fieldCalls).toBe(1)
    expect(rootCalls).toBe(1)
  })

  test('runs root validation once with source and absolute paths', () => {
    const defaultSources: string[] = []
    expect(() =>
      createPicodashStore({
        valueOwner: 'store',
        fields: { value: { defaultValue: 1 } },
        validateValues: (_values, context) => {
          defaultSources.push(context.source)
          return [{ message: 'bad', path: ['value'] }]
        },
      }),
    ).toThrowError(PicodashContractError)
    expect(defaultSources).toEqual(['default'])

    const initialSources: string[] = []
    const initial = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 as number } },
      initialValues: { value: 2 },
      validateValues: (_values, context) => {
        initialSources.push(context.source)
        return []
      },
    })
    expect(initial.getState().values).toEqual({ value: 2 })
    expect(initialSources).toEqual(['initial'])

    let programmaticCalls = 0
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 as number } },
      validateValues: (_values, context) => {
        if (context.source === 'programmatic') {
          programmaticCalls += 1
          return [{ message: 'root rejected', path: ['value'] }]
        }
        return []
      },
    })
    const result = store.setValues({ value: 2 })
    expect(programmaticCalls).toBe(1)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues[0]?.path).toEqual(['value'])
  })

  test('normalizes root malformed, async, and ordinary callback failures privately', () => {
    expect(() =>
      createPicodashStore({
        valueOwner: 'store',
        fields: { value: { defaultValue: 1 } },
        validateValues: () => ({ nope: true }) as never,
      }),
    ).toThrowError(PicodashContractError)
    expect(() =>
      createPicodashStore({
        valueOwner: 'store',
        fields: { value: { defaultValue: 1 } },
        validateValues: () => Promise.resolve([]) as never,
      }),
    ).toThrowError(PicodashContractError)
    const ordinary = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
      validateValues: (_values, context) => {
        if (context.source === 'programmatic') throw new Error('private root cause')
        return []
      },
    })
    const result = ordinary.setValues({ value: 2 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(JSON.stringify(result.error)).not.toContain('private root cause')
  })

  test('rejects mixed batches atomically and ignores inherited keys', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        first: { defaultValue: 1 as number },
        second: {
          defaultValue: 2 as number,
          validate: (value) => (value === 9 ? [{ message: 'no' }] : []),
        },
      },
    })
    let notifications = 0
    store.subscribe(() => {
      notifications += 1
    })
    const before = store.getState()
    const unknown = store.setValues({ first: 5, toString: 7 } as never)
    expect(unknown.ok).toBe(false)
    expect(store.getState()).toBe(before)
    expect(notifications).toBe(0)
    const rejected = store.setValues({ first: 5, second: 9 })
    expect(rejected.ok).toBe(false)
    expect(store.getState()).toBe(before)
    expect(notifications).toBe(0)
    const invalidJson = store.setValues({ first: new Date() } as never)
    expect(invalidJson.ok).toBe(false)
    expect(store.getState()).toBe(before)
    expect(notifications).toBe(0)

    const inherited = Object.create({ second: 99 }) as Record<string, unknown>
    inherited.first = 3
    expect(store.setValues(inherited as never)).toMatchObject({
      ok: true,
      changedFields: ['first'],
    })
    expect(store.getState().values).toEqual({ first: 3, second: 2 })
  })

  test('freezes every public result and preserves no-op snapshot references', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const initial = store.getState()
    let notifications = 0
    const unsubscribe = store.subscribe(() => {
      notifications += 1
    })
    expect(Object.isFrozen(store)).toBe(true)
    expect(Object.isFrozen(store.fields)).toBe(true)
    expect(Object.isFrozen(initial.scopes)).toBe(true)
    const empty = store.setValues({})
    expect(Object.isFrozen(empty)).toBe(true)
    expect(Object.keys(empty)).toEqual(['ok', 'changedFields', 'changedScopeIds'])
    if (empty.ok) {
      expect(Object.isFrozen(empty.changedFields)).toBe(true)
      expect(Object.isFrozen(empty.changedScopeIds)).toBe(true)
    }
    expect(store.getState()).toBe(initial)
    const noop = store.setValues({ value: 1 })
    expect(Object.isFrozen(noop)).toBe(true)
    expect(store.getState()).toBe(initial)
    expect(notifications).toBe(0)
    const changed = store.setValues({ value: 2 })
    expect(Object.isFrozen(changed)).toBe(true)
    expect(Object.keys(changed)).toEqual(['ok', 'changedFields', 'changedScopeIds'])
    if (changed.ok) {
      expect(Object.isFrozen(changed.changedFields)).toBe(true)
      expect(Object.isFrozen(changed.changedScopeIds)).toBe(true)
    }
    expect(notifications).toBe(1)
    const invalid = store.setValues({ missing: 1 } as never)
    expect(Object.isFrozen(invalid)).toBe(true)
    expect(Object.keys(invalid)).toEqual(['ok', 'error'])
    if (!invalid.ok) {
      expect(Object.isFrozen(invalid.error)).toBe(true)
      expect(Object.isFrozen(invalid.error.issues)).toBe(true)
      expect(Object.isFrozen(invalid.error.issues[0]?.path)).toBe(true)
    }
    const invalidRecord = store.setValues([] as never)
    expect(Object.isFrozen(invalidRecord)).toBe(true)
    expect(Object.keys(invalidRecord)).toEqual(['ok', 'error'])
    unsubscribe()
    unsubscribe()
  })

  test('validates one changed multi-field batch, notifies once, and supports OrThrow success', () => {
    let validations = 0
    let notifications = 0
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        first: {
          defaultValue: 1 as number,
          validate: () => {
            validations += 1
            return []
          },
        },
        second: {
          defaultValue: 2 as number,
          validate: () => {
            validations += 1
            return []
          },
        },
      },
    })
    store.subscribe(() => {
      notifications += 1
    })
    validations = 0
    const result = store.setValues({ second: 20, first: 10 })
    expect(result).toMatchObject({ ok: true, changedFields: ['first', 'second'] })
    expect(Object.isFrozen(result)).toBe(true)
    if (result.ok) expect(Object.isFrozen(result.changedFields)).toBe(true)
    expect(validations).toBe(2)
    expect(notifications).toBe(1)
    const thrown = store.setValueOrThrow(store.fields.first, 11)
    expect(thrown).toMatchObject({ ok: true, changedFields: ['first'] })
  })

  test('nested writes from every validator are rejected as reentrant writes', () => {
    let schemaStore!: ReturnType<typeof createPicodashStore>
    const schema = {
      '~standard': {
        version: 1 as const,
        vendor: 'reentrant-test',
        validate: (value: unknown) => {
          if (value === 2) schemaStore.setValues({ value: 3 })
          return { value, issues: undefined }
        },
      },
    } as unknown as StandardSchemaV1<unknown, number>
    schemaStore = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1, schema } },
    })
    expect(() => schemaStore.setValues({ value: 2 })).toThrowError(
      expect.objectContaining({ code: 'reentrant-write' }),
    )

    let fieldStore!: ReturnType<typeof createPicodashStore>
    fieldStore = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1 as number,
          validate: (value) => {
            if (value === 2) fieldStore.setValues({ value: 3 })
            return []
          },
        },
      },
    })
    expect(() => fieldStore.setValues({ value: 2 })).toThrowError(
      expect.objectContaining({ code: 'reentrant-write' }),
    )

    let rootStore!: ReturnType<typeof createPicodashStore>
    rootStore = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 as number } },
      validateValues: (values) => {
        if (values.value === 2) rootStore.setValues({ value: 3 })
        return []
      },
    })
    expect(() => rootStore.setValues({ value: 2 })).toThrowError(
      expect.objectContaining({ code: 'reentrant-write' }),
    )
  })
})

property.prop([fc.integer(), fc.integer()])(
  'reports sorted deterministic changes independent of batch key insertion order',
  (first, second) => {
    const make = (values: Record<'first' | 'second', number>) =>
      createPicodashStore({
        valueOwner: 'store',
        fields: { first: { defaultValue: 0 }, second: { defaultValue: 0 } },
      }).setValues(values)
    const forward = make({ first, second })
    const reverse = make({ second, first })
    const expected = [...(first === 0 ? [] : ['first']), ...(second === 0 ? [] : ['second'])]
    expect(forward).toMatchObject({ ok: true, changedFields: expected })
    expect(reverse).toMatchObject({ ok: true, changedFields: expected })
  },
)
