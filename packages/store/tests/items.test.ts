import { expect, expectTypeOf, test } from 'vite-plus/test'
import {
  createPicodashStore,
  registeredWritableFields,
  type PicodashItemRegistration,
} from '../src/index.ts'

test('registers single and compound items as one ownership boundary', () => {
  const store = createPicodashStore({
    fields: {
      enabled: { defaultValue: true },
      fps: { defaultValue: 60 },
      threshold: { defaultValue: 30 },
    },
    panelId: 'scene',
  })

  expect(
    store.getState().registerItem({
      field: store.fields.enabled,
      id: 'enabled',
      label: 'Enabled',
    }),
  ).toEqual({ success: true })
  expect(
    store.getState().registerItem({
      fields: {
        fps: { field: store.fields.fps, mode: 'display' },
        threshold: store.fields.threshold,
      },
      id: 'render-health',
    }),
  ).toEqual({ success: true })

  expect(Object.keys(store.getState().items)).toEqual(['enabled', 'render-health'])
  expect(store.getState().items['render-health']?.bindings).toEqual([
    { alias: 'fps', field: store.fields.fps, mode: 'display' },
    { alias: 'threshold', field: store.fields.threshold, mode: 'input' },
  ])
  expect(registeredWritableFields(store.getState().items)).toEqual([
    store.fields.enabled,
    store.fields.threshold,
  ])
})

test('rejects foreign, duplicate, and conflicting field bindings without mutation', () => {
  const store = createPicodashStore({
    fields: { count: { defaultValue: 1 }, label: { defaultValue: 'Count' } },
    panelId: 'first',
  })
  const foreign = createPicodashStore({
    fields: { count: { defaultValue: 1 } },
    panelId: 'second',
  })

  const foreignResult = store.getState().registerItem({
    field: foreign.fields.count,
    id: 'foreign',
  })
  expect(foreignResult).toMatchObject({
    errors: [{ alias: 'value', code: 'foreign-field', itemId: 'foreign' }],
    success: false,
  })

  const duplicateResult = store.getState().registerItem({
    fields: {
      primary: store.fields.count,
      secondary: store.fields.count,
    },
    id: 'duplicate',
  })
  expect(duplicateResult).toMatchObject({
    errors: [
      {
        alias: 'secondary',
        code: 'duplicate-field-binding',
        field: 'count',
        itemId: 'duplicate',
      },
    ],
    success: false,
  })

  expect(
    store.getState().registerItem({
      field: store.fields.count,
      id: 'input',
    }),
  ).toEqual({ success: true })
  expect(
    store.getState().registerItem({
      field: store.fields.count,
      id: 'shared-input',
    }),
  ).toEqual({ success: true })
  const conflictResult = store.getState().registerItem({
    field: { field: store.fields.count, mode: 'display' },
    id: 'display',
  })
  expect(conflictResult).toMatchObject({
    errors: [
      {
        code: 'conflicting-field-mode',
        field: 'count',
        itemId: 'display',
      },
    ],
    success: false,
  })

  expect(Object.keys(store.getState().items)).toEqual(['input', 'shared-input'])
})

test('retains order and collapse slots across unmount and remount', () => {
  const store = createPicodashStore({
    fields: { first: { defaultValue: 1 }, second: { defaultValue: 2 } },
    panelId: 'slots',
  })
  const state = store.getState()
  state.registerItem({
    collapsible: true,
    defaultCollapsed: true,
    field: store.fields.first,
    id: 'first',
  })
  state.registerItem({ field: store.fields.second, id: 'second' })
  state.setItemOrder('root', ['second', 'first'])
  state.setItemCollapsed('first', false)
  state.unregisterItem('first')

  expect(store.getState().itemMetadata).toEqual({
    collapsed: { first: false },
    order: { root: ['second', 'first'] },
  })

  store.getState().registerItem({ collapsible: true, field: store.fields.first, id: 'first' })
  expect(store.getState().itemMetadata).toEqual({
    collapsed: { first: false },
    order: { root: ['second', 'first'] },
  })
})

test('accepts identical registration replays and rejects concurrent duplicate item contracts', () => {
  const store = createPicodashStore({
    fields: { count: { defaultValue: 1 }, label: { defaultValue: 'Count' } },
    panelId: 'duplicate-items',
  })
  const registration = {
    field: store.fields.count,
    id: 'counter',
    label: 'Counter',
  } as const
  expect(store.getState().registerItem(registration)).toEqual({ success: true })

  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })
  expect(store.getState().registerItem(registration)).toEqual({ success: true })
  expect(store.getState().registerItem({ ...registration, label: 'Other' })).toMatchObject({
    errors: [{ code: 'duplicate-item-id', itemId: 'counter' }],
    success: false,
  })
  expect(notifications).toBe(0)
  expect(store.getState().items.counter?.label).toBe('Counter')
  unsubscribe()
})

test('resets every registered writable field atomically and excludes display bindings', () => {
  let rejectReset = false
  const store = createPicodashStore<{ display: number; first: number; second: number }>({
    fields: {
      display: { defaultValue: 1 },
      first: { defaultValue: 2 },
      second: {
        defaultValue: 3,
        validate: (_value, context) =>
          rejectReset && context.source === 'reset'
            ? { errors: ['Reset unavailable.'], success: false }
            : { success: true },
      },
    },
    panelId: 'reset',
  })
  store.getState().registerItem({
    fields: {
      display: { field: store.fields.display, mode: 'display' },
      first: store.fields.first,
      second: store.fields.second,
    },
    id: 'compound',
  })
  store.getState().setFieldValues({ display: 10, first: 20, second: 30 })

  rejectReset = true
  expect(store.getState().resetRegisteredFields()).toEqual({
    errors: { second: ['Reset unavailable.'] },
    success: false,
  })
  expect(store.getState().values).toEqual({ display: 10, first: 20, second: 30 })

  rejectReset = false
  expect(store.getState().resetRegisteredFields()).toEqual({ success: true })
  expect(store.getState().values).toEqual({ display: 10, first: 2, second: 3 })
})

test('types mutually exclusive single and compound registrations', () => {
  const store = createPicodashStore({
    fields: { count: { defaultValue: 1 }, title: { defaultValue: 'Count' } },
    panelId: 'types',
  })

  const compound = {
    fields: {
      count: store.fields.count,
      title: { field: store.fields.title, mode: 'display' },
    },
    id: 'compound',
  } satisfies PicodashItemRegistration<{ count: number; title: string }>
  expectTypeOf(compound.fields.count).toEqualTypeOf(store.fields.count)

  store.getState().registerItem(compound)
  store.getState().registerItem({
    // @ts-expect-error Field handles from unknown value records are rejected.
    field: { key: 'missing' },
    id: 'missing',
  })

  // @ts-expect-error A registration cannot declare both field and fields.
  const invalid: PicodashItemRegistration<{ count: number; title: string }> = {
    field: store.fields.count,
    fields: { title: store.fields.title },
    id: 'invalid',
  }
  expect(invalid.id).toBe('invalid')
})
