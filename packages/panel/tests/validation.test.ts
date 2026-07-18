import { expect, test } from 'vite-plus/test'
import { z } from 'zod'
import {
  analyzeTweakerPanelDocument,
  applyTweakerPanelImport,
} from '../src/tweaker-panel-documents.ts'
import { createTweakerPanelStore } from '../src/tweaker-panel-store.ts'
import type {
  TweakerItemRegistration,
  TweakerPanelStore,
  TweakerValue,
} from '../src/tweaker-panel-types.ts'
import {
  jsonCompatibilityError,
  type TweakerParser,
  type TweakerValidator,
} from '../src/tweaker-validation.ts'

test('JSON compatibility accepts only arrays and plain records', () => {
  class CustomValue {
    value = 'custom'
  }

  const nullPrototypeRecord = Object.assign(Object.create(null) as Record<string, unknown>, {
    enabled: true,
    nested: { count: 1 },
  })

  expect(jsonCompatibilityError({ enabled: true, nested: [1, null, 'value'] })).toBeUndefined()
  expect(jsonCompatibilityError(nullPrototypeRecord)).toBeUndefined()

  const unsupportedValues = [
    ['Date', new Date('2026-01-01T00:00:00.000Z')],
    ['Map', new Map([['key', 'value']])],
    ['Set', new Set(['value'])],
    ['class instance', new CustomValue()],
  ] as const

  for (const [label, value] of unsupportedValues) {
    expect(jsonCompatibilityError(value), `top-level ${label}`).toBe(
      'Value at $ must be a plain object or array.',
    )
    expect(jsonCompatibilityError({ nested: value }), `nested ${label}`).toBe(
      'Value at $.nested must be a plain object or array.',
    )
  }
})

test('isolates nested initial values and metadata from caller-owned objects', () => {
  const nestedStrings = ['original']
  const initialValues = {
    nested: {
      items: [{ enabled: true }, nestedStrings],
    },
  }
  const initialMeta = {
    presentation: {
      tags: ['primary'],
    },
  }
  const store = createTweakerPanelStore({
    initialMeta,
    initialValues,
    panelId: 'validation',
  })
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  initialValues.nested.items[0] = { enabled: false }
  nestedStrings.push('mutated')
  initialMeta.presentation.tags.push('mutated')

  expect(store.getState().values).toEqual({
    nested: {
      items: [{ enabled: true }, ['original']],
    },
  })
  expect(store.getState().meta).toEqual({
    presentation: {
      tags: ['primary'],
    },
  })
  expect(notifications).toBe(0)
  unsubscribe()
})

test('strict programmatic writes validate without retaining rejected values', () => {
  const store = createTweakerPanelStore({
    initialValues: { count: 2 },
    panelId: 'validation',
  })
  registerField(store, 'count', 1, {
    validate: z.number().int().min(0),
  })
  const beforeValues = store.getState().values
  const beforeFields = store.getState().fields
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  const rejected = store.getState().setFieldValue('count', -1)

  expect(rejected).toMatchObject({ success: false })
  expect(store.getState().values).toBe(beforeValues)
  expect(store.getState().fields).toBe(beforeFields)
  expect(notifications).toBe(0)

  expect(store.getState().setFieldValue('count', 3)).toEqual({ success: true })
  expect(store.getState().values.count).toBe(3)
  expect(notifications).toBe(1)
  unsubscribe()
})

test('interactive failures retain a draft and errors while preserving the accepted value', () => {
  const store = createTweakerPanelStore({
    initialValues: { count: 2 },
    panelId: 'validation',
  })
  registerField(store, 'count', 1, {
    validate: (value) =>
      typeof value === 'number' && value >= 0
        ? { success: true }
        : { errors: ['Count must be positive.'], success: false },
  })

  expect(store.getState().setFieldInput('count', -2)).toEqual({
    errors: { count: ['Count must be positive.'] },
    success: false,
  })
  expect(store.getState().values.count).toBe(2)
  expect(store.getState().fields.count).toMatchObject({
    draftValue: -2,
    errors: ['Count must be positive.'],
    touched: true,
  })

  expect(store.getState().setFieldInput('count', 4)).toEqual({ success: true })
  expect(store.getState().values.count).toBe(4)
  expect(store.getState().fields.count).toEqual({
    defaultValue: 1,
    dirty: true,
    errors: [],
    touched: true,
  })
})

test('batch writes are validated and committed in one transaction', () => {
  const store = createTweakerPanelStore({
    initialValues: { alpha: 1, beta: 2 },
    panelId: 'validation',
  })
  registerField(store, 'alpha', 0, { validate: z.number().nonnegative() })
  registerField(store, 'beta', 0, { validate: z.number().nonnegative() })
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  expect(store.getState().setFieldValues({ alpha: 3, beta: -1 })).toMatchObject({
    errors: { beta: expect.any(Array) },
    success: false,
  })
  expect(store.getState().values).toMatchObject({ alpha: 1, beta: 2 })
  expect(notifications).toBe(0)

  expect(store.getState().setFieldValues({ alpha: 3, beta: 4 })).toEqual({ success: true })
  expect(store.getState().values).toMatchObject({ alpha: 3, beta: 4 })
  expect(notifications).toBe(1)
  unsubscribe()
})

test('uses Standard Schema output and rejects asynchronous validators', () => {
  const store = createTweakerPanelStore({ panelId: 'validation' })
  registerField(store, 'count', 0, { validate: z.coerce.number().int() })

  expect(store.getState().setFieldValue('count', '7')).toEqual({ success: true })
  expect(store.getState().values.count).toBe(7)

  const asyncValidator = {
    '~standard': {
      validate: async (value: unknown) => ({ value }),
      vendor: 'async-test',
      version: 1 as const,
    },
  } as TweakerValidator
  registerField(store, 'deferred', 0, { validate: asyncValidator })
  const before = store.getState().values
  const result = store.getState().setFieldValue('deferred', 1)
  expect(result).toMatchObject({
    errors: {
      deferred: [
        'Asynchronous parsers and validators are not supported. Return a synchronous result.',
      ],
    },
    success: false,
  })
  expect(store.getState().values).toBe(before)

  const asyncParser = (async (input: unknown) => ({
    output: { value: input as TweakerValue },
    success: true as const,
  })) as unknown as TweakerParser
  registerField(store, 'deferred-parser', 0, { parse: asyncParser })
  expect(store.getState().setFieldValue('deferred-parser', 1)).toMatchObject({
    errors: {
      'deferred-parser': [
        'Asynchronous parsers and validators are not supported. Return a synchronous result.',
      ],
    },
    success: false,
  })
})

test('shared field parsers must agree on one canonical output', () => {
  const store = createTweakerPanelStore({ panelId: 'validation' })
  const plusOne: TweakerParser = (input) => ({
    output: { value: Number(input) + 1 },
    success: true,
  })
  const plusTwo: TweakerParser = (input) => ({
    output: { value: Number(input) + 2 },
    success: true,
  })
  registerField(store, 'shared', 0, { id: 'first', parse: plusOne })
  registerField(store, 'shared', 0, { id: 'second', parse: plusTwo })

  const result = store.getState().setFieldValue('shared', 1)
  expect(result).toMatchObject({
    errors: { shared: [expect.stringMatching(/conflicting canonical outputs/)] },
    success: false,
  })
})

test('shared field validators aggregate their errors', () => {
  const store = createTweakerPanelStore({ panelId: 'validation' })
  registerField(store, 'shared', 0, {
    id: 'minimum',
    validate: () => ({ errors: ['Below minimum.'], success: false }),
  })
  registerField(store, 'shared', 0, {
    id: 'maximum',
    validate: () => ({ errors: ['Above maximum.'], success: false }),
  })

  expect(store.getState().setFieldValue('shared', 1)).toEqual({
    errors: { shared: ['Below minimum.', 'Above maximum.'] },
    success: false,
  })
})

test('unregistering a shared-field contract clears its stale repair proposal', () => {
  const store = createTweakerPanelStore({
    initialValues: { shared: 8 },
    panelId: 'validation',
  })
  const boundedParser =
    (maximum: number): TweakerParser =>
    (input) =>
      typeof input === 'number' && input <= maximum
        ? { output: { value: input }, success: true }
        : {
            errors: [`Value must not exceed ${maximum}.`],
            repair: { value: maximum },
            success: false,
          }

  registerField(store, 'shared', 1, { id: 'remaining', parse: boundedParser(10) })
  registerField(store, 'shared', 1, { id: 'temporary', parse: boundedParser(5) })
  expect(store.getState().repairProposal).toMatchObject({
    changes: [{ after: { value: 1 }, field: 'shared' }],
    source: 'constraint',
  })

  store.getState().unregisterItem('temporary')

  expect(store.getState().values.shared).toBe(8)
  expect(store.getState().fields.shared?.errors).toEqual([])
  expect(store.getState().repairProposal).toBeNull()
})

test('unregistering a shared-field contract clears stale draft errors without changing the value', () => {
  const store = createTweakerPanelStore({
    initialValues: { shared: 4 },
    panelId: 'validation',
  })
  registerField(store, 'shared', 1, {
    id: 'remaining',
    validate: z.number().nonnegative(),
  })
  registerField(store, 'shared', 1, {
    id: 'temporary',
    validate: z.number().max(5),
  })
  expect(store.getState().setFieldInput('shared', 8)).toMatchObject({ success: false })
  expect(store.getState().fields.shared).toMatchObject({
    draftValue: 8,
    errors: [expect.any(String)],
  })

  store.getState().unregisterItem('temporary')

  expect(store.getState().values.shared).toBe(4)
  expect(store.getState().fields.shared).not.toHaveProperty('draftValue')
  expect(store.getState().fields.shared?.errors).toEqual([])
  expect(store.getState().repairProposal).toBeNull()
})

test('parsers can explicitly unset a field', () => {
  const store = createTweakerPanelStore({
    initialValues: { optional: 'value' },
    panelId: 'validation',
  })
  registerField(store, 'optional', undefined, {
    parse: (input) =>
      input === null
        ? { output: { unset: true }, success: true }
        : {
            output: {
              value: typeof input === 'string' ? input : (JSON.stringify(input) ?? ''),
            },
            success: true,
          },
  })

  expect(store.getState().setFieldValue('optional', null)).toEqual({ success: true })
  expect(store.getState().values).not.toHaveProperty('optional')
})

test('display-only fields reject programmatic and interactive writes', () => {
  const store = createTweakerPanelStore({
    initialValues: { summary: 'Derived' },
    panelId: 'validation',
  })
  registerField(store, 'summary', 'Fallback', { valueMode: 'display' })
  const before = store.getState().values

  expect(store.getState().setFieldValue('summary', 'Changed')).toEqual({
    errors: { summary: ['Display fields cannot be edited.'] },
    success: false,
  })
  expect(store.getState().setFieldInput('summary', 'Changed')).toEqual({
    errors: { summary: ['Display fields cannot be edited.'] },
    success: false,
  })
  expect(store.getState().values).toBe(before)
})

test('direct resets reject display-only fields without changing their value or field state', () => {
  const store = createTweakerPanelStore({
    initialValues: { summary: 'Derived' },
    panelId: 'validation',
  })
  registerField(store, 'summary', undefined, { valueMode: 'display' })
  store.setState((state) => ({
    fields: {
      ...state.fields,
      summary: {
        ...state.fields.summary!,
        dirty: true,
        draftValue: 'Pending',
        errors: ['Stale derived value.'],
        touched: true,
      },
    },
  }))
  const beforeValues = store.getState().values
  const beforeFields = store.getState().fields
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  expect(store.getState().resetFieldValue('summary')).toEqual({
    errors: { summary: ['Display fields cannot be edited.'] },
    success: false,
  })
  expect(store.getState().values).toBe(beforeValues)
  expect(store.getState().fields).toBe(beforeFields)
  expect(notifications).toBe(0)
  unsubscribe()
})

test('batch resets skip display-only fields and commit writable fields once', () => {
  const store = createTweakerPanelStore({
    initialValues: { count: 9, summary: 'Derived' },
    panelId: 'validation',
  })
  registerField(store, 'count', 1)
  registerField(store, 'summary', undefined, { valueMode: 'display' })
  store.setState((state) => ({
    fields: {
      ...state.fields,
      summary: {
        ...state.fields.summary!,
        dirty: true,
        errors: ['Stale derived value.'],
        touched: true,
      },
    },
  }))
  const beforeDisplayField = store.getState().fields.summary
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  expect(store.getState().resetFields()).toEqual({ success: true })
  expect(store.getState().values).toEqual({ count: 1, summary: 'Derived' })
  expect(store.getState().fields.summary).toBe(beforeDisplayField)
  expect(store.getState().fields.count).toMatchObject({
    dirty: false,
    errors: [],
    touched: false,
  })
  expect(notifications).toBe(1)
  unsubscribe()
})

test('batch resets remain atomic when a writable field default is invalid', () => {
  const store = createTweakerPanelStore({
    initialValues: { alpha: 8, beta: 9, summary: 'Derived' },
    panelId: 'validation',
  })
  registerField(store, 'alpha', 1, { validate: z.number().positive() })
  registerField(store, 'beta', -1, { validate: z.number().positive() })
  registerField(store, 'summary', undefined, { valueMode: 'display' })
  const beforeValues = store.getState().values
  const beforeFields = store.getState().fields
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  expect(store.getState().resetFields()).toMatchObject({
    errors: { beta: expect.any(Array) },
    success: false,
  })
  expect(store.getState().values).toBe(beforeValues)
  expect(store.getState().fields).toBe(beforeFields)
  expect(notifications).toBe(0)
  unsubscribe()
})

test('reset validates every default atomically and clears stale field state on success', () => {
  const store = createTweakerPanelStore({ panelId: 'validation' })
  registerField(store, 'alpha', 1, { validate: z.number().positive() })
  registerField(store, 'beta', -1, { validate: z.number().positive() })
  store.getState().setFieldInput('alpha', 'bad')
  const before = store.getState().values

  expect(store.getState().resetRegisteredFields()).toMatchObject({
    errors: { beta: expect.any(Array) },
    success: false,
  })
  expect(store.getState().values).toBe(before)

  store.getState().setFieldDefault('beta', 2)
  expect(store.getState().resetRegisteredFields()).toEqual({ success: true })
  expect(store.getState().values).toMatchObject({ alpha: 1, beta: 2 })
  expect(store.getState().fields.alpha).toEqual({
    defaultValue: 1,
    dirty: false,
    errors: [],
    touched: false,
  })
})

test('malformed parser results return field errors without throwing or mutating accepted values', () => {
  const invalidResults = [
    { success: true },
    { output: null, success: true },
    { output: {}, success: true },
    { output: { unset: false }, success: true },
    { output: { unset: true, value: 2 }, success: true },
    { success: false },
    { errors: ['Invalid.'], repair: {}, success: false },
  ]

  for (const [index, invalidResult] of invalidResults.entries()) {
    const field = `malformed-${index}`
    const store = createTweakerPanelStore({
      initialValues: { [field]: 1 },
      panelId: 'validation',
    })
    const parse = (() => invalidResult) as unknown as TweakerParser
    registerField(store, field, 1, { parse })
    const beforeValues = store.getState().values
    const beforeFields = store.getState().fields
    let notifications = 0
    const unsubscribe = store.subscribe(() => {
      notifications += 1
    })

    expect(store.getState().setFieldValue(field, 2)).toEqual({
      errors: { [field]: ['Parser returned an invalid result.'] },
      success: false,
    })
    expect(store.getState().values).toBe(beforeValues)
    expect(store.getState().fields).toBe(beforeFields)
    expect(notifications).toBe(0)

    expect(store.getState().setFieldInput(field, 2)).toEqual({
      errors: { [field]: ['Parser returned an invalid result.'] },
      success: false,
    })
    expect(store.getState().values).toBe(beforeValues)
    expect(store.getState().fields[field]).toMatchObject({
      draftValue: 2,
      errors: ['Parser returned an invalid result.'],
      touched: true,
    })
    expect(notifications).toBe(1)
    unsubscribe()
  }
})

test('setFieldDefault validates an unset field before inserting its reset baseline', () => {
  const store = createTweakerPanelStore({ panelId: 'validation' })
  registerField(store, 'count', undefined, {
    parse: (input) =>
      typeof input === 'number' && Number.isFinite(input)
        ? { output: { value: Math.min(input, 10) }, success: true }
        : { errors: ['Count must be a finite number.'], success: false },
  })
  registerField(store, 'count', undefined, {
    id: 'nonnegative-count',
    validate: z.number().nonnegative(),
  })
  const beforeValues = store.getState().values
  const beforeFields = store.getState().fields
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  store.getState().setFieldDefault('count', 'invalid')

  expect(store.getState().values).toBe(beforeValues)
  expect(store.getState().fields).toBe(beforeFields)
  expect(store.getState().fields.count?.defaultValue).toBeUndefined()
  expect(notifications).toBe(0)

  store.getState().setFieldDefault('count', 8)

  expect(store.getState().values.count).toBe(8)
  expect(store.getState().fields.count?.defaultValue).toBe(8)
  expect(notifications).toBe(1)
  unsubscribe()
})

test('reactive contracts create observable repair proposals with accept and abort semantics', () => {
  const store = createTweakerPanelStore({
    initialValues: { amount: 8 },
    panelId: 'validation',
  })
  const boundedParser =
    (maximum: number): TweakerParser =>
    (input) => {
      if (typeof input !== 'number') {
        return { errors: ['Amount must be a number.'], success: false }
      }
      return input <= maximum
        ? { output: { value: input }, success: true }
        : {
            errors: [`Amount must not exceed ${maximum}.`],
            repair: { value: maximum },
            success: false,
          }
    }
  registerField(store, 'amount', 1, { parse: boundedParser(10) })
  store.getState().setFieldValue('amount', 8)

  registerField(store, 'amount', 1, { parse: boundedParser(5) })
  expect(store.getState().repairProposal).toMatchObject({
    changes: [
      {
        after: { value: 5 },
        before: { value: 8 },
        errors: ['Amount must not exceed 5.'],
        field: 'amount',
      },
    ],
    source: 'constraint',
  })

  store.getState().abortRepairProposal()
  expect(store.getState().values.amount).toBe(8)
  expect(store.getState().fields.amount).toMatchObject({
    dirty: true,
    errors: ['Amount must not exceed 5.'],
    touched: true,
  })

  registerField(store, 'amount', 1, { parse: boundedParser(4) })
  expect(store.getState().acceptRepairProposal()).toEqual({ success: true })
  expect(store.getState().values.amount).toBe(4)
  expect(store.getState().fields.amount).toMatchObject({
    dirty: true,
    errors: [],
    touched: true,
  })
})

test('import analysis reports repairs and applies the reviewed document atomically', () => {
  const store = createTweakerPanelStore({
    initialValues: { count: 2, title: 'Current' },
    panelId: 'validation',
  })
  registerField(store, 'count', 1, {
    parse: (input) => {
      if (typeof input === 'number' && Number.isInteger(input)) {
        return { output: { value: input }, success: true }
      }
      return {
        errors: ['Count must be an integer.'],
        repair: { value: Math.round(Number(input)) },
        success: false,
      }
    },
  })
  registerField(store, 'title', 'Untitled', { validate: z.string().min(1) })
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  const analysis = analyzeTweakerPanelDocument({ count: 2.6, title: 'Imported' }, store.getState())
  expect(analysis).toMatchObject({
    changes: [{ after: { value: 3 }, field: 'count' }],
    status: 'repair',
    values: { count: 3, title: 'Imported' },
  })
  expect(store.getState().values).toMatchObject({ count: 2, title: 'Current' })
  expect(notifications).toBe(0)

  if (analysis.status !== 'repair') throw new Error('Expected a repair plan.')
  applyTweakerPanelImport(store, analysis)
  expect(store.getState().values).toMatchObject({ count: 3, title: 'Imported' })
  expect(notifications).toBe(1)
  unsubscribe()
})

function registerField(
  store: TweakerPanelStore,
  field: string,
  defaultValue?: TweakerValue,
  overrides: Partial<TweakerItemRegistration> = {},
) {
  store.getState().registerItem({
    defaultValue,
    field,
    id: `${field}-item`,
    kind: 'control',
    parentId: 'root',
    reorderable: true,
    ...overrides,
  })
}
