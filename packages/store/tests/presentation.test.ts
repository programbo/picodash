import { expect, expectTypeOf, test } from 'vite-plus/test'
import {
  createPicodashStore,
  normalizePicodashPresentationContract,
  PICODASH_ERROR_CODES,
  type PicodashItemRegistration,
  type PicodashPresentationContract,
} from '../src/index.ts'

const finiteNumber = {
  accepts: { finite: true, kind: 'number' },
  component: '@picodash/panel/Slider',
  id: 'slider:number:v1',
} as const satisfies PicodashPresentationContract<number>

test('registers compatible presentations that intentionally share a field', () => {
  const store = createPicodashStore({
    fields: { exposure: { defaultValue: 1.2 } },
    panelId: 'scene',
  })

  expect(
    store.getState().registerItem({
      field: {
        field: store.fields.exposure,
        presentation: finiteNumber,
      },
      id: 'exposure-slider',
    }),
  ).toEqual({ success: true })
  expect(
    store.getState().registerItem({
      field: {
        field: store.fields.exposure,
        mode: 'display',
        presentation: {
          ...finiteNumber,
          component: '@picodash/panel/Metric',
          id: 'metric:number:v1',
        },
      },
      id: 'exposure-metric',
    }),
  ).toEqual({
    errors: [
      expect.objectContaining({
        code: 'conflicting-field-mode',
        field: 'exposure',
      }),
    ],
    success: false,
  })

  expect(
    store.getState().registerItem({
      field: {
        field: store.fields.exposure,
        presentation: {
          ...finiteNumber,
          component: '@picodash/panel/NumberField',
          id: 'number-field:number:v1',
        },
      },
      id: 'exposure-number-field',
    }),
  ).toEqual({ success: true })
  expect(store.getState().items['exposure-number-field']?.bindings[0]?.presentation).toEqual({
    accepts: { finite: true, kind: 'number' },
    component: '@picodash/panel/NumberField',
    id: 'number-field:number:v1',
  })
})

test('rejects current/default incompatibility atomically with a structured diagnostic', () => {
  const store = createPicodashStore({
    fields: {
      count: { defaultValue: 1 },
      mode: { defaultValue: 'auto' },
    },
    panelId: 'compatibility',
  })
  store.getState().setFieldValue(store.fields.mode, 'manual')

  const result = store.getState().registerItem({
    fields: {
      count: {
        field: store.fields.count,
        presentation: finiteNumber,
      },
      mode: {
        field: store.fields.mode,
        presentation: {
          accepts: { kind: 'string', values: ['auto'] },
          component: '@picodash/panel/Select',
          id: 'select:auto:v1',
        },
      },
    },
    id: 'compound',
  })

  expect(result).toMatchObject({
    errors: [
      {
        alias: 'mode',
        code: 'incompatible-field-presentation',
        diagnostic: {
          code: PICODASH_ERROR_CODES.INCOMPATIBLE_FIELD_DASHLET,
          identity: {
            bindingId: 'mode',
            component: '@picodash/panel/Select',
            fieldKey: 'mode',
            itemId: 'compound',
            panelId: 'compatibility',
          },
        },
      },
    ],
    success: false,
  })
  expect(store.getState().items).toEqual({})
  expect(store.diagnostics.getSnapshot()).toHaveLength(1)
})

test('rejects conflicting shared contracts and reused constraint identities', () => {
  const store = createPicodashStore({
    fields: {
      first: { defaultValue: 'auto' },
      second: { defaultValue: 'manual' },
    },
    panelId: 'shared',
  })
  store.getState().registerItem({
    field: {
      field: store.fields.first,
      presentation: {
        accepts: { kind: 'string', values: ['auto', 'manual'] },
        component: '@picodash/panel/Select',
        id: 'select:mode:v1',
      },
    },
    id: 'first',
  })

  expect(
    store.getState().registerItem({
      field: {
        field: store.fields.first,
        presentation: {
          accepts: { kind: 'string', values: ['auto'] },
          component: '@picodash/panel/Badge',
          id: 'badge:auto:v1',
        },
      },
      id: 'incompatible-share',
    }),
  ).toMatchObject({
    errors: [{ code: 'incompatible-field-presentation' }],
    success: false,
  })

  expect(
    store.getState().registerItem({
      field: {
        field: store.fields.second,
        presentation: {
          accepts: { kind: 'string', values: ['manual'] },
          component: '@picodash/panel/Select',
          id: 'select:mode:v1',
        },
      },
      id: 'reused-id',
    }),
  ).toMatchObject({
    errors: [{ code: 'conflicting-presentation-contract' }],
    success: false,
  })
  expect(Object.keys(store.getState().items)).toEqual(['first'])
})

test('rejects malformed or callback-bearing presentation contracts', () => {
  const store = createPicodashStore({
    fields: { count: { defaultValue: 1 } },
    panelId: 'serializable',
  })

  const result = store.getState().registerItem({
    field: {
      field: store.fields.count,
      presentation: {
        accepts: { kind: 'number' },
        component: '@picodash/panel/Slider',
        id: 'slider:number:v1',
        validate: () => true,
      } as PicodashPresentationContract<number>,
    },
    id: 'callback',
  })

  expect(result).toMatchObject({
    errors: [{ code: 'invalid-presentation-contract' }],
    success: false,
  })
  expect(store.getState().items).toEqual({})
  expect(
    normalizePicodashPresentationContract({
      accepts: { kind: 'string', values: ['b', 'a'] },
      component: 'Select',
      id: 'select:v1',
    }),
  ).toEqual({
    accepts: { kind: 'string', values: ['a', 'b'] },
    component: 'Select',
    id: 'select:v1',
  })
})

test('presentation descriptors preserve field-specific type inference', () => {
  const store = createPicodashStore({
    fields: { enabled: { defaultValue: true }, threshold: { defaultValue: 10 } },
    panelId: 'types',
  })
  const registration = {
    fields: {
      enabled: {
        field: store.fields.enabled,
        presentation: {
          accepts: { kind: 'boolean' },
          component: 'Switch',
          id: 'switch:boolean:v1',
        },
      },
      threshold: {
        field: store.fields.threshold,
        presentation: finiteNumber,
      },
    },
    id: 'typed',
  } satisfies PicodashItemRegistration<{ enabled: boolean; threshold: number }>

  expectTypeOf(registration.fields.threshold.presentation).toEqualTypeOf(finiteNumber)

  const invalid: PicodashItemRegistration<{ enabled: boolean; threshold: number }> = {
    field: {
      // @ts-expect-error Boolean fields cannot declare numeric presentation contracts.
      field: store.fields.enabled,
      presentation: finiteNumber,
    },
    id: 'invalid',
  }
  expect(invalid.id).toBe('invalid')
})
