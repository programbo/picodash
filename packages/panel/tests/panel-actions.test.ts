import { expect, test } from 'vite-plus/test'
import { collapsibleGroupsForState } from '../src/tweaker-panel-action-state.ts'
import {
  importTweakerPanelDocument,
  parseTweakerPanelDocument,
  serializeTweakerPanelValues,
  tweakerPanelDocumentFilename,
  tweakerPanelDocumentFormatFromFilename,
  validateTweakerPanelDocument,
} from '../src/tweaker-panel-documents.ts'
import { createTweakerPanelStore } from '../src/tweaker-panel-store.ts'
import type {
  TweakerItemRegistration,
  TweakerPanelStore,
  TweakerValue,
} from '../src/tweaker-panel-types.ts'

test('aggregates visible collapsible groups using defaults and explicit state', () => {
  const store = createTweakerPanelStore({ panelId: 'inspect' })
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
  const store = createTweakerPanelStore({ panelId: 'inspect' })
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
  const store = createTweakerPanelStore({
    defaultValues: { alpha: 'default', beta: 2, stale: true },
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

test('retains panel and dynamic field defaults across unchanged control fallback registration', () => {
  const store = createTweakerPanelStore({
    defaultValues: { opacity: 0.72 },
    panelId: 'scene',
  })
  store.getState().registerItem({
    fieldId: 'opacity',
    id: 'opacity-control',
    kind: 'control',
    defaultValue: 0,
    parentId: 'root',
    placement: 'auto',
    reorderable: true,
  })
  expect(store.getState().fields.opacity?.defaultValue).toBe(0.72)
  store.getState().setFieldDefault('opacity', 0.85)
  store.getState().registerItem({
    fieldId: 'opacity',
    id: 'opacity-control',
    kind: 'control',
    defaultValue: 0,
    parentId: 'root',
    placement: 'auto',
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
  const store = createTweakerPanelStore({ panelId: 'scene' })
  store.getState().registerItem({
    defaultValue: 0,
    fieldId: 'opacity',
    id: 'opacity-control',
    kind: 'control',
    parentId: 'root',
    placement: 'auto',
    reorderable: true,
  })
  store.getState().setFieldDefault('opacity', 0.85)

  store.getState().registerItem({
    defaultValue: null,
    fieldId: 'opacity',
    id: 'opacity-control',
    kind: 'control',
    parentId: 'root',
    placement: 'auto',
    reorderable: true,
  })
  store.getState().setFieldValue('opacity', 0.4)
  store.getState().resetRegisteredFields()

  expect(store.getState().values.opacity).toBeNull()
  expect(store.getState().fields.opacity?.defaultValue).toBeNull()
})

test('serializes only currently registered fields as JSON and YAML', () => {
  const store = createTweakerPanelStore({
    defaultValues: { hidden: false, stale: 'ignore', visible: 1 },
    panelId: 'inspect',
  })
  registerField(store, 'visible', 1)
  registerField(store, 'hidden', false, { hidden: true })
  store.getState().registerItem({
    id: 'summary',
    kind: 'control',
    parentId: 'root',
    placement: 'auto',
    reorderable: false,
  })

  const json = serializeTweakerPanelValues(store.getState(), 'json')
  const yaml = serializeTweakerPanelValues(store.getState(), 'yaml')

  expect(JSON.parse(json)).toEqual({ visible: 1, hidden: false })
  expect(parseTweakerPanelDocument(yaml, 'yaml')).toEqual({ visible: 1, hidden: false })
})

test('parses and validates JSON and YAML panel documents', () => {
  const store = createTweakerPanelStore({
    defaultValues: { enabled: true, quality: 'balanced', range: [1, 2] },
    panelId: 'inspect',
  })
  registerField(store, 'enabled', true)
  registerField(store, 'quality', 'balanced')
  registerField(store, 'range', [1, 2])

  expect(
    validateTweakerPanelDocument(
      parseTweakerPanelDocument('{"quality":"final","enabled":false}', 'json'),
      store.getState(),
    ),
  ).toEqual({ enabled: false, quality: 'final' })
  expect(
    validateTweakerPanelDocument(
      parseTweakerPanelDocument('quality: draft\nrange:\n  - 3\n  - 7\n', 'yaml'),
      store.getState(),
    ),
  ).toEqual({ quality: 'draft', range: [3, 7] })
})

test('rejects invalid imports without partially updating the store', () => {
  const store = createTweakerPanelStore({
    defaultValues: { enabled: true, quality: 'balanced' },
    panelId: 'inspect',
  })
  registerField(store, 'enabled', true)
  registerField(store, 'quality', 'balanced')
  store.getState().setFieldValue('quality', 'final')
  const initialValues = store.getState().values
  const initialFields = store.getState().fields

  expect(() =>
    importTweakerPanelDocument(store, '{"quality":"draft","unknown":true}', 'json'),
  ).toThrow(/Unknown panel field: unknown/)
  expect(() => importTweakerPanelDocument(store, '{"quality":false}', 'json')).toThrow(
    /expects string, received boolean/,
  )
  expect(() => importTweakerPanelDocument(store, '[]', 'json')).toThrow(/bare object/)
  expect(() => importTweakerPanelDocument(store, 'quality: .nan', 'yaml')).toThrow(/finite number/)

  expect(store.getState().values).toBe(initialValues)
  expect(store.getState().fields).toBe(initialFields)
})

test('derives import formats and sanitized export filenames', () => {
  expect(tweakerPanelDocumentFormatFromFilename('scene.JSON')).toBe('json')
  expect(tweakerPanelDocumentFormatFromFilename('scene.yml')).toBe('yaml')
  expect(tweakerPanelDocumentFormatFromFilename('scene.yaml')).toBe('yaml')
  expect(() => tweakerPanelDocumentFormatFromFilename('scene.txt')).toThrow(/\.json/)
  expect(tweakerPanelDocumentFilename(' Scene / Controls ', 'json')).toBe('Scene-Controls.json')
  expect(tweakerPanelDocumentFilename('../', 'yaml')).toBe('panel.yaml')
})

function registerGroup(
  store: TweakerPanelStore,
  id: string,
  overrides: Partial<TweakerItemRegistration> = {},
) {
  store.getState().registerItem({
    id,
    kind: 'group',
    parentId: 'root',
    placement: 'auto',
    reorderable: true,
    ...overrides,
  })
}

function registerField(
  store: TweakerPanelStore,
  fieldId: string,
  defaultValue?: TweakerValue,
  overrides: Partial<TweakerItemRegistration> = {},
) {
  store.getState().registerItem({
    defaultValue,
    fieldId,
    id: `${fieldId}-control`,
    kind: 'control',
    parentId: 'root',
    placement: 'auto',
    reorderable: true,
    ...overrides,
  })
}
