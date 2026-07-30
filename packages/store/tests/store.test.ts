import { expect, expectTypeOf, test } from 'vite-plus/test'
import { createPicodashStore } from '../src/index.ts'
import type { PicodashField, PicodashStore, PicodashStoreState } from '../src/index.ts'

test('creates typed values from widened primitive defaults', () => {
  const store = createPicodashStore({
    fields: {
      bloom: { defaultValue: true },
      exposure: { defaultValue: 1.2 },
      label: { defaultValue: 'Scene' },
    },
    panelId: 'scene',
  })

  expect(store.getState()).toEqual({
    panelId: 'scene',
    values: { bloom: true, exposure: 1.2, label: 'Scene' },
  })
  expectTypeOf(store).toEqualTypeOf<
    PicodashStore<{ bloom: boolean; exposure: number; label: string }>
  >()
  expectTypeOf(store.getState()).toEqualTypeOf<
    PicodashStoreState<{ bloom: boolean; exposure: number; label: string }>
  >()
})

test('supports explicit unions and structured JSON values', () => {
  type SceneValues = {
    quality: 'draft' | 'balanced' | 'final'
    viewport: { height: number; width: number }
  }

  const store = createPicodashStore<SceneValues>({
    fields: {
      quality: { defaultValue: 'balanced' },
      viewport: { defaultValue: { height: 1080, width: 1920 } },
    },
    initialValues: {
      quality: 'final',
    },
    panelId: 'scene',
  })

  expect(store.getState().values).toEqual({
    quality: 'final',
    viewport: { height: 1080, width: 1920 },
  })
  expectTypeOf(store.getState().values.quality).toEqualTypeOf<'draft' | 'balanced' | 'final'>()
})

test('creates stable field handles with key and value inference', () => {
  const store = createPicodashStore({
    fields: {
      bloom: { defaultValue: true },
      exposure: { defaultValue: 1.2 },
    },
    panelId: 'scene',
  })

  const fields = store.fields

  expect(store.fields).toBe(fields)
  expect(store.fields.exposure).toBe(fields.exposure)
  expect(store.fields.exposure).toEqual({ key: 'exposure' })
  expect(store.fields.exposure.store).toBe(store)
  expect(Object.keys(store.fields.exposure)).toEqual(['key'])
  expect(Object.isFrozen(store.fields)).toBe(true)
  expect(Object.isFrozen(store.fields.exposure)).toBe(true)
  expectTypeOf(store.fields.exposure).toEqualTypeOf<
    PicodashField<{ bloom: boolean; exposure: number }, 'exposure'>
  >()
})

test('gives same-shaped Stores distinct runtime-owned handles', () => {
  const first = createPicodashStore({
    fields: { exposure: { defaultValue: 1 } },
    panelId: 'first',
  })
  const second = createPicodashStore({
    fields: { exposure: { defaultValue: 1 } },
    panelId: 'second',
  })

  expect(first.fields.exposure).not.toBe(second.fields.exposure)
  expect(first.fields.exposure.store).toBe(first)
  expect(second.fields.exposure.store).toBe(second)
})

test('isolates caller-owned defaults and initial values', () => {
  type Values = {
    defaults: { nested: number[] }
    initial: { nested: number[] }
  }

  const defaultValue = { nested: [1, 2] }
  const initialValue = { nested: [3, 4] }
  const store = createPicodashStore<Values>({
    fields: {
      defaults: { defaultValue },
      initial: { defaultValue },
    },
    initialValues: {
      initial: initialValue,
    },
    panelId: 'isolation',
  })

  defaultValue.nested.push(5)
  initialValue.nested.push(6)

  expect(store.getState().values).toEqual({
    defaults: { nested: [1, 2] },
    initial: { nested: [3, 4] },
  })
})

test('rejects runtime values that are not JSON-compatible', () => {
  expect(() =>
    createPicodashStore({
      fields: {
        amount: { defaultValue: Number.NaN },
      },
      panelId: 'invalid',
    }),
  ).toThrow('finite numbers')

  expect(() =>
    createPicodashStore({
      fields: {
        // @ts-expect-error Date is not a JSON-compatible field value.
        timestamp: { defaultValue: new Date() },
      },
      panelId: 'invalid',
    }),
  ).toThrow('plain objects')
})
