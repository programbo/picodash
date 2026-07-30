import { expect, expectTypeOf, test } from 'vite-plus/test'
import {
  createPicodashStore,
  PICODASH_ERROR_CODES,
  type PicodashItemRegistration,
} from '@picodash/store'
import {
  PicodashItem,
  type PicodashCompoundDisplayFieldContext,
  type PicodashCompoundInputFieldContext,
} from '../src/index.ts'
import {
  picodashCompoundFieldIds,
  resetPicodashCompoundItemFields,
  setPicodashCompoundItemFieldInput,
  stabilizePicodashCompoundItemFields,
} from '../src/components/panel/PicodashItem.tsx'
import { picodashNumberPresentation } from '../src/inputs/internal/presentation-contracts.ts'
import type { AnyPicodashStore } from '../src/state/panel/picodash-panel-types.ts'

const store = createPicodashStore({
  fields: {
    enabled: { defaultValue: true },
    summary: { defaultValue: 'Ready' },
    volume: { defaultValue: 2 },
  },
  panelId: 'compound-contract',
})

const compoundFields = {
  enabled: store.fields.enabled,
  summary: { field: store.fields.summary, mode: 'display' },
  volume: { field: store.fields.volume, presentation: picodashNumberPresentation },
} as const

test('compound contexts infer writable and display alias capabilities', () => {
  const element = (
    <PicodashItem fields={compoundFields} id="transport">
      {(item) => {
        expectTypeOf(item.fields.enabled).toMatchTypeOf<
          PicodashCompoundInputFieldContext<boolean>
        >()
        expectTypeOf(item.fields.summary).toMatchTypeOf<
          PicodashCompoundDisplayFieldContext<string>
        >()
        item.fields.enabled.setInput(false)
        item.fields.volume.reset()
        item.reset()

        // @ts-expect-error Display aliases intentionally omit mutation methods.
        item.fields.summary.setInput('Changed')
        // @ts-expect-error Compound aliases expose reset, not the singular resetValue contract.
        item.fields.enabled.resetValue()
        return null
      }}
    </PicodashItem>
  )
  expect(element.props.fields).toBe(compoundFields)
})

test('singular field and compound fields are mutually exclusive', () => {
  const invalid = (
    // @ts-expect-error A Dashlet registers either one field or one compound fields map.
    <PicodashItem field={store.fields.enabled} fields={compoundFields} id="invalid" />
  )
  expect(invalid.props.id).toBe('invalid')
})

test('compound aliases register as one item', () => {
  const registration = {
    fields: compoundFields,
    id: 'transport-registration',
  } satisfies PicodashItemRegistration<{
    enabled: boolean
    summary: string
    volume: number
  }>

  expect(store.getState().registerItem(registration)).toEqual({ success: true })
  expect(Object.keys(store.getState().items)).toEqual(['transport-registration'])
  expect(store.getState().items['transport-registration']?.bindings).toHaveLength(3)
})

test('inline compound maps preserve one semantic registration boundary across rerenders', () => {
  let stableFields: Parameters<typeof stabilizePicodashCompoundItemFields>[0] | undefined
  let registrationBoundaries = 0

  for (let render = 0; render < 3; render += 1) {
    const inlineFields = {
      enabled: store.fields.enabled,
      summary: { field: store.fields.summary, mode: 'display' as const },
      volume: {
        field: store.fields.volume,
        presentation: {
          accepts: { finite: true, kind: 'number' as const },
          component: '@picodash/panel/Number',
          id: 'number:finite:v1',
        },
      },
    }
    const nextStableFields = stabilizePicodashCompoundItemFields(stableFields, inlineFields)
    if (nextStableFields !== stableFields) registrationBoundaries += 1
    stableFields = nextStableFields
  }

  expect(registrationBoundaries).toBe(1)
  expect(
    stabilizePicodashCompoundItemFields(stableFields, {
      ...compoundFields,
      summary: { field: store.fields.summary, mode: 'input' },
    }),
  ).not.toBe(stableFields)
})

test('compound reset is atomic and skips display aliases', () => {
  store.getState().setFieldValues({ enabled: false, summary: 'Busy', volume: 8 })
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  resetPicodashCompoundItemFields(store as unknown as AnyPicodashStore, compoundFields)
  unsubscribe()

  expect(store.getState().values).toEqual({
    enabled: true,
    summary: 'Busy',
    volume: 2,
  })
  expect(notifications).toBe(1)
})

test('compound reset honors disabled and read-only state', () => {
  store.getState().setFieldValues({ enabled: false, volume: 9 })
  resetPicodashCompoundItemFields(store as unknown as AnyPicodashStore, compoundFields, true)
  expect(store.getState().values).toMatchObject({ enabled: false, volume: 9 })

  resetPicodashCompoundItemFields(store as unknown as AnyPicodashStore, compoundFields, false, true)
  expect(store.getState().values).toMatchObject({ enabled: false, volume: 9 })
})

test('compound input setters write candidates and honor disabled and read-only state', () => {
  setPicodashCompoundItemFieldInput(store as unknown as AnyPicodashStore, store.fields.volume, 5)
  expect(store.getState().values.volume).toBe(5)

  setPicodashCompoundItemFieldInput(
    store as unknown as AnyPicodashStore,
    store.fields.volume,
    6,
    true,
  )
  setPicodashCompoundItemFieldInput(
    store as unknown as AnyPicodashStore,
    store.fields.volume,
    7,
    false,
    true,
  )
  expect(store.getState().values.volume).toBe(5)
})

test('compound alias IDs are stable and unique', () => {
  expect(picodashCompoundFieldIds('transport', 'enabled')).toEqual(
    picodashCompoundFieldIds('transport', 'enabled'),
  )
  expect(picodashCompoundFieldIds('transport', 'enabled')).toEqual({
    errorId: 'transport:enabled:errors',
    inputId: 'transport:enabled:input',
    labelId: 'transport:enabled:label',
  })
  expect(picodashCompoundFieldIds('transport', 'summary').inputId).not.toBe(
    picodashCompoundFieldIds('transport', 'enabled').inputId,
  )
})

test('built-in presentation descriptors produce structured incompatibility diagnostics', () => {
  const incompatible = createPicodashStore({
    fields: { title: { defaultValue: 'Picodash' } },
    panelId: 'presentation-diagnostic',
  })
  const result = incompatible.getState().registerItem({
    field: {
      field: incompatible.fields.title,
      presentation: picodashNumberPresentation as never,
    },
    id: 'number-for-title',
  })

  expect(result).toMatchObject({
    errors: [
      {
        code: 'incompatible-field-presentation',
        diagnostic: {
          code: PICODASH_ERROR_CODES.INCOMPATIBLE_FIELD_DASHLET,
          identity: {
            component: '@picodash/panel/Number',
            fieldKey: 'title',
            itemId: 'number-for-title',
            panelId: 'presentation-diagnostic',
          },
        },
      },
    ],
    success: false,
  })
  expect(incompatible.diagnostics.getSnapshot()[0]?.documentationUrl).toContain(
    '/diagnostics/incompatible-field-dashlet',
  )
})
