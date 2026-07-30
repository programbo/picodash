import { expectTypeOf, test } from 'vite-plus/test'
import { z } from 'zod'
import { createPicodashStore } from '../src/index.ts'

test('requires every explicit value field and checks its value type', () => {
  type Values = {
    enabled: boolean
    mode: 'safe' | 'fast'
  }

  createPicodashStore<Values>({
    // @ts-expect-error Every value key requires a field definition.
    fields: {
      enabled: { defaultValue: true },
    },
    panelId: 'missing-field',
  })

  createPicodashStore<Values>({
    fields: {
      enabled: { defaultValue: true },
      // @ts-expect-error Explicit value records constrain defaults.
      mode: { defaultValue: 'unknown' },
    },
    panelId: 'wrong-default',
  })
})

test('constrains initial values to declared fields and value types', () => {
  const store = createPicodashStore({
    fields: {
      count: { defaultValue: 1 },
      title: { defaultValue: 'Panel' },
    },
    initialValues: {
      count: 2,
    },
    panelId: 'initial-values',
  })

  expectTypeOf(store.getState().values).toEqualTypeOf<{ count: number; title: string }>()

  createPicodashStore<{ count: number }>({
    fields: {
      count: { defaultValue: 1 },
    },
    initialValues: {
      // @ts-expect-error Initial values retain field value types.
      count: 'two',
    },
    panelId: 'wrong-initial-value',
  })
})

test('types single writes by owned handles and batch writes by value records', () => {
  const store = createPicodashStore<{
    count: number
    mode: 'safe' | 'fast'
  }>({
    fields: {
      count: { defaultValue: 1 },
      mode: { defaultValue: 'safe' },
    },
    panelId: 'writes',
  })

  store.getState().setFieldValue(store.fields.mode, 'fast')
  store.getState().setFieldValues({ count: 2, mode: 'safe' })

  // @ts-expect-error A field handle constrains its value.
  store.getState().setFieldValue(store.fields.mode, 'unknown')
  // @ts-expect-error Batch writes reject unknown fields.
  store.getState().setFieldValues({ missing: true })
  // @ts-expect-error Single-field APIs do not accept string keys.
  store.getState().resetFieldValue('mode')
  expectTypeOf(store).not.toHaveProperty('setState')
})

test('Standard Schema output drives inferred field values', () => {
  const store = createPicodashStore({
    fields: {
      mode: {
        defaultValue: 'safe',
        validate: z.enum(['safe', 'fast']),
      },
    },
    panelId: 'schema-inference',
  })

  expectTypeOf(store.getState().values.mode).toEqualTypeOf<'safe' | 'fast'>()
})
