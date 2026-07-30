import { expect, expectTypeOf, test } from 'vite-plus/test'
import {
  analyzePicodashPanelDocument,
  applyPicodashPanelImport,
  createPicodashStore,
  importPicodashPanelDocument,
  parsePicodashPanelDocument,
  picodashPanelDocumentFilename,
  picodashPanelDocumentFormatFromFilename,
  picodashPanelDocumentMimeType,
  picodashPanelImportAccept,
  preparePicodashPanelImport,
  serializePicodashPanelValues,
  validatePicodashPanelDocument,
  type PicodashPanelImportAnalysis,
} from '../src/index.ts'

test('serializes every registered input and display field once as canonical JSON and YAML', () => {
  const store = createDocumentStore()
  const state = store.getState()
  state.registerItem({
    fields: {
      count: store.fields.count,
      summary: { field: store.fields.summary, mode: 'display' },
      title: store.fields.title,
    },
    id: 'compound',
  })
  state.registerItem({ field: store.fields.count, id: 'shared-count' })

  expect(JSON.parse(serializePicodashPanelValues(store.getState(), 'json'))).toEqual({
    count: 2,
    summary: '2 items',
    title: 'Current',
  })
  expect(
    parsePicodashPanelDocument(serializePicodashPanelValues(store.getState(), 'yaml'), 'yaml'),
  ).toEqual({ count: 2, summary: '2 items', title: 'Current' })
})

test('imports writable bindings atomically, preserves display bindings, and resets omitted fields', () => {
  const store = createDocumentStore()
  const state = store.getState()
  state.registerItem({
    fields: {
      count: store.fields.count,
      summary: { field: store.fields.summary, mode: 'display' },
      title: store.fields.title,
    },
    id: 'compound',
  })
  state.setFieldValues({ count: 8, title: 'Changed' })
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  const analysis = analyzePicodashPanelDocument({ count: 4, summary: '2 items' }, store.getState())
  expect(analysis).toMatchObject({
    plan: { resetFields: ['title'] },
    status: 'valid',
    values: { count: 4, title: 'Untitled' },
  })
  expect(Object.isFrozen(analysis)).toBe(true)
  if (analysis.status === 'invalid') throw new Error('Expected an applicable plan.')
  expect(Object.isFrozen(analysis.plan)).toBe(true)
  expect(Object.isFrozen(analysis.plan.document)).toBe(true)
  expect(Object.isFrozen(analysis.plan.outputs)).toBe(true)

  const result = store.getState().applyPanelImport(analysis)
  expect(result).toMatchObject({
    success: true,
    values: { count: 4, title: 'Untitled' },
  })
  expect(store.getState().values).toEqual({
    count: 4,
    summary: '2 items',
    title: 'Untitled',
  })
  expect(store.getState().fieldStates.title).toMatchObject({
    dirty: false,
    errors: [],
    touched: false,
  })
  expect(notifications).toBe(1)
  unsubscribe()
})

test('reports unknown, changed display-only, and invalid writable fields without mutation', () => {
  const store = createDocumentStore()
  const state = store.getState()
  state.registerItem({ field: store.fields.count, id: 'count' })
  state.registerItem({
    field: { field: store.fields.summary, mode: 'display' },
    id: 'summary',
  })
  const values = state.values

  expect(state.analyzePanelDocument({ count: 3, unknown: true })).toEqual({
    errors: { $: ['Unknown panel field: unknown.'] },
    status: 'invalid',
  })
  expect(state.analyzePanelDocument({ count: 3, summary: 'forged' })).toEqual({
    errors: {
      summary: ['Registered field is display-only and cannot be imported.'],
    },
    status: 'invalid',
  })
  expect(state.analyzePanelDocument({ count: -1, summary: '2 items' })).toEqual({
    errors: { count: ['Count must be non-negative.'] },
    status: 'invalid',
  })
  expect(() => importPicodashPanelDocument(store, '{"count":-1}', 'json')).toThrow(
    'Field "count": Count must be non-negative.',
  )
  expect(store.getState().values).toBe(values)
})

test('requires repair review and applies a reviewed compound plan in one mutation', () => {
  const store = createDocumentStore()
  store.getState().registerItem({
    fields: { count: store.fields.count, title: store.fields.title },
    id: 'compound',
  })
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  const analysis = preparePicodashPanelImport(store, '{"count":2.6,"title":"Imported"}', 'json')
  expect(analysis).toMatchObject({
    changes: [
      {
        after: { value: 3 },
        before: { value: 2.6 },
        errors: ['Count must be an integer.'],
        field: 'count',
      },
    ],
    status: 'repair',
    values: { count: 3, title: 'Imported' },
  })
  expect(store.getState().values).toMatchObject({ count: 2, title: 'Current' })
  expect(notifications).toBe(0)
  if (analysis.status !== 'repair') throw new Error('Expected repair analysis.')

  expect(applyPicodashPanelImport(store, analysis)).toEqual({
    count: 3,
    title: 'Imported',
  })
  expect(store.getState().values).toMatchObject({ count: 3, title: 'Imported' })
  expect(notifications).toBe(1)
  unsubscribe()
})

test('revalidates reviewed plans and rejects stale constraints without partial mutation', () => {
  let normalization: 'ceil' | 'round' = 'round'
  const store = createPicodashStore<{ count: number; title: string }>({
    fields: {
      count: {
        defaultValue: 1,
        parse: (input) =>
          typeof input === 'number' && Number.isInteger(input)
            ? { output: { value: input }, success: true }
            : {
                errors: ['Count must be an integer.'],
                repair: {
                  value:
                    normalization === 'round'
                      ? Math.round(Number(input))
                      : Math.ceil(Number(input)),
                },
                success: false,
              },
      },
      title: { defaultValue: 'Current' },
    },
    panelId: 'stale',
  })
  store.getState().registerItem({
    fields: { count: store.fields.count, title: store.fields.title },
    id: 'compound',
  })
  const analysis = store.getState().analyzePanelDocument({ count: 2.2, title: 'Imported' })
  if (analysis.status !== 'repair') throw new Error('Expected repair analysis.')

  normalization = 'ceil'
  const result = store.getState().applyPanelImport(analysis)
  expect(result).toMatchObject({ reason: 'stale', success: false })
  expect(store.getState().values).toEqual({ count: 1, title: 'Current' })
  expect(() => applyPicodashPanelImport(store, analysis)).toThrow(
    'Panel constraints changed while the import was awaiting review.',
  )
})

test('provides validation, parsing, filename, MIME, and accept-list helpers', () => {
  const store = createDocumentStore()
  store.getState().registerItem({ field: store.fields.count, id: 'count' })

  expect(validatePicodashPanelDocument({ count: 5 }, store.getState())).toEqual({ count: 5 })
  expect(() => validatePicodashPanelDocument([], store.getState())).toThrow('bare object')
  expect(() => parsePicodashPanelDocument('{', 'json')).toThrow('Could not parse JSON')
  expect(() => parsePicodashPanelDocument('count: .nan', 'yaml')).not.toThrow()
  expect(
    store.getState().analyzePanelDocument(parsePicodashPanelDocument('count: .nan', 'yaml')),
  ).toEqual({
    errors: { $: ['Imported values must contain finite numbers.'] },
    status: 'invalid',
  })

  expect(picodashPanelDocumentFormatFromFilename('scene.JSON')).toBe('json')
  expect(picodashPanelDocumentFormatFromFilename('scene.yml')).toBe('yaml')
  expect(() => picodashPanelDocumentFormatFromFilename('scene.txt')).toThrow('.json')
  expect(picodashPanelDocumentFilename(' Scene / Controls ', 'json')).toBe('Scene-Controls.json')
  expect(picodashPanelDocumentFilename('../', 'yaml')).toBe('panel.yaml')
  expect(picodashPanelDocumentMimeType('json')).toBe('application/json')
  expect(picodashPanelDocumentMimeType('yaml')).toBe('application/yaml')
  expect(picodashPanelImportAccept).toContain('.yml')
})

test('exposes typed synchronous analysis contracts on Store state', () => {
  const store = createDocumentStore()
  const analysis = store.getState().analyzePanelDocument({})

  expectTypeOf(analysis).toEqualTypeOf<
    PicodashPanelImportAnalysis<{
      count: number
      summary: string
      title: string
    }>
  >()
})

function createDocumentStore() {
  return createPicodashStore<{ count: number; summary: string; title: string }>({
    fields: {
      count: {
        defaultValue: 1,
        parse: (input) => {
          if (typeof input !== 'number' || input < 0) {
            return { errors: ['Count must be non-negative.'], success: false }
          }
          if (Number.isInteger(input)) return { output: { value: input }, success: true }
          return {
            errors: ['Count must be an integer.'],
            repair: { value: Math.round(input) },
            success: false,
          }
        },
      },
      summary: { defaultValue: '0 items' },
      title: { defaultValue: 'Untitled' },
    },
    initialValues: {
      count: 2,
      summary: '2 items',
      title: 'Current',
    },
    panelId: 'documents',
  })
}
