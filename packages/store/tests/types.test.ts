import { expectTypeOf, test } from 'vite-plus/test'
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
