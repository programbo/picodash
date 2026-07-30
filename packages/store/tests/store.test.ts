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

  expect(store.getState()).toMatchObject({
    fieldStates: {
      bloom: { defaultValue: true, dirty: false, errors: [], touched: false },
      exposure: { defaultValue: 1.2, dirty: false, errors: [], touched: false },
      label: { defaultValue: 'Scene', dirty: false, errors: [], touched: false },
    },
    panelId: 'scene',
    repairProposal: null,
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
  expect(Object.keys(store.fields.exposure)).toEqual(['key'])
  expect(Object.isFrozen(store.fields)).toBe(true)
  expect(Object.isFrozen(store.fields.exposure)).toBe(true)
  expect(store.ownsField(store.fields.exposure)).toBe(true)
  expect(store).not.toHaveProperty('setState')
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
  expect(first.ownsField(first.fields.exposure)).toBe(true)
  expect(first.ownsField(second.fields.exposure)).toBe(false)
  expect(second.ownsField(second.fields.exposure)).toBe(true)
})

test('builds one complete initial snapshot for SSR consumers', () => {
  const store = createPicodashStore<{ count: number; title: string }>({
    fields: {
      count: { defaultValue: 1 },
      title: {
        defaultValue: 'Fallback',
        validate: (value) =>
          value.length > 0 ? { success: true } : { errors: ['Required.'], success: false },
      },
    },
    initialValues: { count: 2, title: '' },
    panelId: 'ssr',
  })

  expect(store.getInitialState()).toBe(store.getState())
  expect(store.getInitialState()).toMatchObject({
    fieldStates: {
      count: { defaultValue: 1, dirty: true, errors: [], touched: false },
      title: { defaultValue: 'Fallback', dirty: false, errors: ['Required.'], touched: false },
    },
    values: { count: 2, title: 'Fallback' },
  })
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
