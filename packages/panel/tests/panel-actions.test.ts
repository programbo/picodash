import { expect, test } from 'vite-plus/test'
import { picodashAlignmentValues } from '../src/inputs/alignment.tsx'
import { segmentedEnabledOptionValues } from '../src/inputs/segmented.tsx'
import { selectOptionValues } from '../src/inputs/select.tsx'
import { collapsibleGroupsForState } from '../src/picodash-panel-action-state.ts'
import {
  importPicodashPanelDocument,
  parsePicodashPanelDocument,
  serializePicodashPanelValues,
  picodashPanelDocumentFilename,
  picodashPanelDocumentFormatFromFilename,
  validatePicodashPanelDocument,
} from '../src/picodash-panel-documents.ts'
import { createPicodashPanelStore } from '../src/picodash-panel-store.ts'
import type {
  PicodashItemRegistration,
  PicodashPanelStore,
  PicodashValue,
} from '../src/picodash-panel-types.ts'

test('aggregates visible collapsible groups using defaults and explicit state', () => {
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  registerGroup(store, 'expanded', { collapsible: true, defaultCollapsed: false })
  registerGroup(store, 'collapsed', { collapsible: true, defaultCollapsed: true })
  registerGroup(store, 'fixed', { collapsible: false, defaultCollapsed: true })
  registerGroup(store, 'hidden', {
    collapsible: true,
    defaultCollapsed: true,
    hidden: true,
  })

  expect(collapsibleGroupsForState(store.getState())).toEqual([
    { collapsed: false, id: 'expanded' },
    { collapsed: true, id: 'collapsed' },
  ])

  store.getState().setGroupCollapsed('expanded', true)
  expect(collapsibleGroupsForState(store.getState())).toEqual([
    { collapsed: true, id: 'expanded' },
    { collapsed: true, id: 'collapsed' },
  ])
})

test('bulk group disclosure updates eligible groups in one transaction', () => {
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  registerGroup(store, 'alpha', { collapsible: true })
  registerGroup(store, 'beta', { collapsible: true, defaultCollapsed: true })
  registerGroup(store, 'hidden', { collapsible: true, hidden: true })
  registerGroup(store, 'fixed', { collapsible: false })
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  store.getState().setAllCollapsibleGroupsCollapsed(true)

  expect(notifications).toBe(1)
  expect(store.getState().collapsedGroups).toMatchObject({ alpha: true, beta: true })
  expect(store.getState().collapsedGroups.hidden).toBeUndefined()
  expect(store.getState().collapsedGroups.fixed).toBeUndefined()

  store.getState().setAllCollapsibleGroupsCollapsed(true)
  expect(notifications).toBe(1)

  store.getState().setAllCollapsibleGroupsCollapsed(false)
  expect(notifications).toBe(2)
  expect(collapsibleGroupsForState(store.getState()).every((group) => !group.collapsed)).toBe(true)
  unsubscribe()
})

test('atomically replaces registered values and resets omitted fields', () => {
  const store = createPicodashPanelStore({
    initialValues: { alpha: 'default', beta: 2, stale: true },
    panelId: 'inspect',
  })
  registerField(store, 'alpha', 'default')
  registerField(store, 'beta', 2)
  registerField(store, 'gamma')
  store.getState().setFieldValue('alpha', 'current')
  store.getState().setFieldValue('beta', 9)
  store.getState().setFieldValue('gamma', ['current'])
  store.getState().setFieldValue('stale', false)
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  store.getState().replaceRegisteredFieldValues({ alpha: 'imported' })

  expect(notifications).toBe(1)
  expect(store.getState().values).toEqual({
    alpha: 'imported',
    beta: 2,
    stale: false,
  })
  expect(store.getState().fields.alpha).toMatchObject({ dirty: true, touched: true })
  expect(store.getState().fields.beta).toMatchObject({ dirty: false, touched: false })
  expect(store.getState().fields.gamma).toMatchObject({ dirty: false, touched: false })
  expect(store.getState().fields.stale).toMatchObject({ dirty: true, touched: true })
  unsubscribe()
})

test('rejects an invalid registered-value replacement without notifying subscribers', () => {
  const store = createPicodashPanelStore({
    initialValues: { alpha: 2, beta: 4 },
    panelId: 'inspect',
  })
  registerField(store, 'alpha', 2, {
    validate: (value) => ({
      errors: typeof value === 'number' && value <= 10 ? [] : ['Alpha must be at most 10.'],
      success: typeof value === 'number' && value <= 10,
    }),
  })
  registerField(store, 'beta', 4)
  const initialValues = store.getState().values
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  const result = store.getState().replaceRegisteredFieldValues({ alpha: 20, beta: 8 })

  expect(result).toEqual({
    errors: { alpha: ['Alpha must be at most 10.'] },
    success: false,
  })
  expect(store.getState().values).toBe(initialValues)
  expect(notifications).toBe(0)
  unsubscribe()
})

test('keeps initial values separate from registered reset defaults', () => {
  const store = createPicodashPanelStore({
    initialValues: { opacity: 0.72 },
    panelId: 'scene',
  })
  store.getState().registerItem({
    field: 'opacity',
    id: 'opacity-control',
    kind: 'control',
    defaultValue: 0,
    parentId: 'root',
    reorderable: true,
  })
  expect(store.getState().values.opacity).toBe(0.72)
  expect(store.getState().fields.opacity?.defaultValue).toBe(0)
  store.getState().setFieldDefault('opacity', 0.85)
  store.getState().unregisterItem('opacity-control')
  store.getState().registerItem({
    field: 'opacity',
    id: 'opacity-control',
    kind: 'control',
    defaultValue: 0,
    parentId: 'root',
    reorderable: true,
  })
  store.getState().setFieldValue('opacity', 0.4)

  store.getState().resetRegisteredFields()

  expect(store.getState().values.opacity).toBe(0.85)
  expect(store.getState().fields.opacity).toMatchObject({
    defaultValue: 0.85,
    dirty: false,
    touched: false,
  })
})

test('updates the field default when a registered item declares a genuine default change', () => {
  const store = createPicodashPanelStore({ panelId: 'scene' })
  store.getState().registerItem({
    defaultValue: 0,
    field: 'opacity',
    id: 'opacity-control',
    kind: 'control',
    parentId: 'root',
    reorderable: true,
  })
  store.getState().setFieldDefault('opacity', 0.85)

  store.getState().registerItem({
    defaultValue: null,
    field: 'opacity',
    id: 'opacity-control',
    kind: 'control',
    parentId: 'root',
    reorderable: true,
  })
  store.getState().setFieldValue('opacity', 0.4)
  store.getState().resetRegisteredFields()

  expect(store.getState().values.opacity).toBeNull()
  expect(store.getState().fields.opacity?.defaultValue).toBeNull()
})

test('updates reset metadata when a control remounts with a new default', () => {
  const store = createPicodashPanelStore({ panelId: 'scene' })
  registerField(store, 'opacity', 0)
  store.getState().setFieldValue('opacity', 0.4)
  store.setState((state) => ({
    fields: {
      ...state.fields,
      opacity: {
        ...state.fields.opacity!,
        errors: ['Out of range'],
      },
    },
  }))

  store.getState().unregisterItem('opacity-control')
  registerField(store, 'opacity', 0.75)

  expect(store.getState().values.opacity).toBe(0.4)
  expect(store.getState().fields.opacity).toEqual({
    defaultValue: 0.75,
    dirty: true,
    errors: [],
    touched: true,
  })

  store.getState().resetRegisteredFields()

  expect(store.getState().values.opacity).toBe(0.75)
  expect(store.getState().fields.opacity).toEqual({
    defaultValue: 0.75,
    dirty: false,
    errors: [],
    touched: false,
  })
})

test('rejects conflicting defaults from active shared-field owners', () => {
  const store = createPicodashPanelStore({ panelId: 'scene' })
  registerField(store, 'opacity', 0, { id: 'opacity-a' })
  registerField(store, 'opacity', 1, { id: 'opacity-b' })

  expect(store.getState().items['opacity-b']?.field).toBe('opacity')
  expect(store.getState().fields.opacity?.errors).toEqual([
    'Field "opacity" has conflicting defaults across active items.',
  ])
  expect(store.getState().setFieldValue('opacity', 0.4)).toEqual({
    errors: {
      opacity: ['Field "opacity" has conflicting defaults across active items.'],
    },
    success: false,
  })

  store.getState().unregisterItem('opacity-b')
  expect(store.getState().setFieldValue('opacity', 0.4)).toEqual({ success: true })
  expect(store.getState().values.opacity).toBe(0.4)
})

test('serializes only currently registered fields as JSON and YAML', () => {
  const store = createPicodashPanelStore({
    initialValues: { hidden: false, stale: 'ignore', visible: 1 },
    panelId: 'inspect',
  })
  registerField(store, 'visible', 1)
  registerField(store, 'hidden', false, { hidden: true })
  store.getState().registerItem({
    id: 'summary',
    kind: 'control',
    parentId: 'root',
    reorderable: false,
  })

  const json = serializePicodashPanelValues(store.getState(), 'json')
  const yaml = serializePicodashPanelValues(store.getState(), 'yaml')

  expect(JSON.parse(json)).toEqual({ visible: 1, hidden: false })
  expect(parsePicodashPanelDocument(yaml, 'yaml')).toEqual({ visible: 1, hidden: false })
})

test('exports display-only fields but excludes them from import and reset actions', () => {
  const store = createPicodashPanelStore({
    initialValues: {
      editable: 'default',
      hidden: 'hidden default',
      summary: 'derived current',
    },
    panelId: 'inspect',
  })
  registerField(store, 'editable', 'default')
  registerField(store, 'hidden', 'hidden default', { hidden: true })
  registerField(store, 'summary', 'derived default', { valueMode: 'display' })
  store.getState().setFieldValue('editable', 'current')
  store.getState().setFieldValue('hidden', 'hidden current')

  const expectedExport = {
    editable: 'current',
    hidden: 'hidden current',
    summary: 'derived current',
  }
  expect(JSON.parse(serializePicodashPanelValues(store.getState(), 'json'))).toEqual(expectedExport)
  expect(
    parsePicodashPanelDocument(serializePicodashPanelValues(store.getState(), 'yaml'), 'yaml'),
  ).toEqual(expectedExport)
  expect(
    validatePicodashPanelDocument(
      { editable: 'imported', hidden: 'hidden imported', summary: 'ignored' },
      store.getState(),
    ),
  ).toEqual({ editable: 'imported', hidden: 'hidden imported' })

  importPicodashPanelDocument(
    store,
    '{"editable":"imported","hidden":"hidden imported","summary":"ignored"}',
    'json',
  )
  expect(store.getState().values).toMatchObject({
    editable: 'imported',
    hidden: 'hidden imported',
    summary: 'derived current',
  })

  store.getState().resetRegisteredFields()
  expect(store.getState().values).toMatchObject({
    editable: 'default',
    hidden: 'hidden default',
    summary: 'derived current',
  })
  expect(store.getState().fields.summary).toMatchObject({ dirty: false, touched: false })
})

test('parses and validates JSON and YAML panel documents', () => {
  const store = createPicodashPanelStore({
    initialValues: { enabled: true, quality: 'balanced', range: [1, 2] },
    panelId: 'inspect',
  })
  registerField(store, 'enabled', true)
  registerField(store, 'quality', 'balanced')
  registerField(store, 'range', [1, 2])

  expect(
    validatePicodashPanelDocument(
      parsePicodashPanelDocument('{"quality":"final","enabled":false}', 'json'),
      store.getState(),
    ),
  ).toEqual({ enabled: false, quality: 'final', range: [1, 2] })
  expect(
    validatePicodashPanelDocument(
      parsePicodashPanelDocument('quality: draft\nrange:\n  - 3\n  - 7\n', 'yaml'),
      store.getState(),
    ),
  ).toEqual({ enabled: true, quality: 'draft', range: [3, 7] })
})

test('validates imported alignment values against the registered alignment options', () => {
  const store = createPicodashPanelStore({
    initialValues: { alignment: 'center', enabled: true },
    panelId: 'inspect',
  })
  registerField(store, 'alignment', 'center', {
    validate: allowedStringValidator(picodashAlignmentValues),
  })
  registerField(store, 'enabled', true)

  importPicodashPanelDocument(store, '{"alignment":"bottom-right","enabled":false}', 'json')
  expect(store.getState().values).toMatchObject({
    alignment: 'bottom-right',
    enabled: false,
  })

  const initialValues = store.getState().values
  const initialFields = store.getState().fields

  expectRepairWithoutMutation(store, '{"alignment":"baseline","enabled":true}', 'json')
  expectRepairWithoutMutation(store, 'alignment: diagonal\nenabled: true\n', 'yaml')

  expect(store.getState().values).toBe(initialValues)
  expect(store.getState().fields).toBe(initialFields)
  expect(store.getState().values).toMatchObject({
    alignment: 'bottom-right',
    enabled: false,
  })
})

test('validates imported segmented values against the latest registered options', () => {
  const store = createPicodashPanelStore({
    initialValues: { density: 'compact', enabled: true },
    panelId: 'inspect',
  })
  registerField(store, 'enabled', true)
  registerField(store, 'density', 'compact', {
    validate: allowedStringValidator(
      segmentedEnabledOptionValues([
        'compact',
        { disabled: true, label: 'Comfortable (unavailable)', value: 'comfortable' },
        'spacious',
      ]),
    ),
  })

  importPicodashPanelDocument(store, '{"density":"spacious","enabled":false}', 'json')
  expect(store.getState().values).toMatchObject({ density: 'spacious', enabled: false })

  const disabledInitialValues = store.getState().values
  const disabledInitialFields = store.getState().fields
  expectRepairWithoutMutation(store, '{"density":"comfortable","enabled":true}', 'json')
  expectRepairWithoutMutation(store, 'density: comfortable\nenabled: true\n', 'yaml')
  expect(store.getState().values).toBe(disabledInitialValues)
  expect(store.getState().fields).toBe(disabledInitialFields)

  registerField(store, 'density', 'compact', {
    validate: allowedStringValidator(segmentedEnabledOptionValues(['compact', 'comfortable'])),
  })
  importPicodashPanelDocument(store, 'density: comfortable\nenabled: true\n', 'yaml')
  expect(store.getState().values).toMatchObject({ density: 'comfortable', enabled: true })

  const initialValues = store.getState().values
  const initialFields = store.getState().fields

  expectRepairWithoutMutation(store, '{"density":"spacious","enabled":false}', 'json')
  expectRepairWithoutMutation(store, 'density: spacious\nenabled: false\n', 'yaml')

  expect(store.getState().values).toBe(initialValues)
  expect(store.getState().fields).toBe(initialFields)
  expect(store.getState().values).toMatchObject({ density: 'comfortable', enabled: true })
})

test('validates imported select values against the latest registered options', () => {
  const store = createPicodashPanelStore({
    initialValues: { enabled: true, quality: 'balanced' },
    panelId: 'inspect',
  })
  registerField(store, 'enabled', true)
  registerSelectField(
    store,
    'quality',
    'balanced',
    selectOptionValues([
      'balanced',
      { disabled: true, label: 'Draft (unavailable)', value: 'draft' },
      'final',
    ]),
  )

  importPicodashPanelDocument(store, '{"quality":"final","enabled":false}', 'json')
  expect(store.getState().values).toMatchObject({ enabled: false, quality: 'final' })

  importPicodashPanelDocument(store, 'quality: draft\nenabled: true\n', 'yaml')
  expect(store.getState().values).toMatchObject({ enabled: true, quality: 'draft' })

  registerSelectField(store, 'quality', 'balanced', selectOptionValues(['balanced', 'preview']))
  const initialValues = store.getState().values
  const initialFields = store.getState().fields

  expectRepairWithoutMutation(store, '{"quality":"final","enabled":false}', 'json')
  expectRepairWithoutMutation(store, 'quality: draft\nenabled: false\n', 'yaml')

  expect(store.getState().values).toBe(initialValues)
  expect(store.getState().fields).toBe(initialFields)
  expect(store.getState().values).toMatchObject({ enabled: true, quality: 'draft' })
})

test('rejects invalid imports without partially updating the store', () => {
  const store = createPicodashPanelStore({
    initialValues: { enabled: true, quality: 'balanced' },
    panelId: 'inspect',
  })
  registerField(store, 'enabled', true)
  registerField(store, 'quality', undefined, {
    validate: allowedStringValidator(['balanced', 'draft', 'final']),
  })
  store.getState().setFieldValue('quality', 'final')
  const initialValues = store.getState().values
  const initialFields = store.getState().fields

  expect(() =>
    importPicodashPanelDocument(store, '{"quality":"draft","unknown":true}', 'json'),
  ).toThrow(/Unknown panel field: unknown/)
  expect(() => importPicodashPanelDocument(store, '{"quality":false}', 'json')).toThrow(
    /Value must be one of/,
  )
  expect(() => importPicodashPanelDocument(store, '[]', 'json')).toThrow(/bare object/)
  expect(() => importPicodashPanelDocument(store, 'quality: .nan', 'yaml')).toThrow(/finite number/)

  expect(store.getState().values).toBe(initialValues)
  expect(store.getState().fields).toBe(initialFields)
})

test('derives import formats and sanitized export filenames', () => {
  expect(picodashPanelDocumentFormatFromFilename('scene.JSON')).toBe('json')
  expect(picodashPanelDocumentFormatFromFilename('scene.yml')).toBe('yaml')
  expect(picodashPanelDocumentFormatFromFilename('scene.yaml')).toBe('yaml')
  expect(() => picodashPanelDocumentFormatFromFilename('scene.txt')).toThrow(/\.json/)
  expect(picodashPanelDocumentFilename(' Scene / Controls ', 'json')).toBe('Scene-Controls.json')
  expect(picodashPanelDocumentFilename('../', 'yaml')).toBe('panel.yaml')
})

function registerGroup(
  store: PicodashPanelStore,
  id: string,
  overrides: Partial<PicodashItemRegistration> = {},
) {
  store.getState().registerItem({
    id,
    kind: 'group',
    parentId: 'root',
    reorderable: true,
    ...overrides,
  })
}

function registerField(
  store: PicodashPanelStore,
  field: string,
  defaultValue?: PicodashValue,
  overrides: Partial<PicodashItemRegistration> = {},
) {
  store.getState().registerItem({
    defaultValue,
    field,
    id: `${field}-control`,
    kind: 'control',
    parentId: 'root',
    reorderable: true,
    ...overrides,
  })
}

function registerSelectField(
  store: PicodashPanelStore,
  field: string,
  defaultValue: string,
  allowedValues: readonly string[],
) {
  registerField(store, field, defaultValue, {
    validate: allowedStringValidator(allowedValues),
  })
}

function allowedStringValidator(allowedValues: readonly string[]) {
  return (value: PicodashValue) =>
    typeof value === 'string' && allowedValues.includes(value)
      ? { success: true as const }
      : {
          errors: [
            allowedValues.length === 0
              ? 'Field has no registered options.'
              : `Value must be one of: ${allowedValues.map((entry) => JSON.stringify(entry)).join(', ')}.`,
          ],
          success: false as const,
        }
}

function expectRepairWithoutMutation(
  store: PicodashPanelStore,
  source: string,
  format: 'json' | 'yaml',
) {
  const values = store.getState().values
  const fields = store.getState().fields
  expect(importPicodashPanelDocument(store, source, format).status).toBe('repair')
  expect(store.getState().values).toBe(values)
  expect(store.getState().fields).toBe(fields)
}
