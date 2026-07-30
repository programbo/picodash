import { expect, test } from 'vite-plus/test'
import { z } from 'zod'
import { createPicodashStore } from '../src/index.ts'
import type { PicodashParser, PicodashValidator } from '../src/index.ts'

test('strict writes validate canonical values and reject without notifying or mutating', () => {
  const store = createPicodashStore<{ count: number }>({
    fields: {
      count: { defaultValue: 1, validate: z.coerce.number().int().nonnegative() },
    },
    panelId: 'validation',
  })
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  expect(store.getState().setFieldValue(store.fields.count, 4)).toEqual({ success: true })
  expect(store.getState().values.count).toBe(4)
  const beforeValues = store.getState().values
  const beforeFields = store.getState().fieldStates

  expect(store.getState().setFieldValues({ count: -1 })).toMatchObject({
    errors: { count: expect.any(Array) },
    success: false,
  })
  expect(store.getState().values).toBe(beforeValues)
  expect(store.getState().fieldStates).toBe(beforeFields)
  expect(notifications).toBe(1)
  unsubscribe()
})

test('interactive rejection retains a draft and accepted input clears it', () => {
  const store = createPicodashStore<{ count: number }>({
    fields: {
      count: {
        defaultValue: 1,
        validate: (value) =>
          value >= 0
            ? { success: true }
            : { errors: ['Count must be nonnegative.'], success: false },
      },
    },
    initialValues: { count: 2 },
    panelId: 'validation',
  })

  expect(store.getState().setFieldInput(store.fields.count, -3)).toEqual({
    errors: { count: ['Count must be nonnegative.'] },
    success: false,
  })
  expect(store.getState().values.count).toBe(2)
  expect(store.getState().fieldStates.count).toMatchObject({
    defaultValue: 1,
    dirty: true,
    draftValue: -3,
    errors: ['Count must be nonnegative.'],
    touched: true,
  })

  expect(store.getState().setFieldInput(store.fields.count, 5)).toEqual({ success: true })
  expect(store.getState().values.count).toBe(5)
  expect(store.getState().fieldStates.count).toEqual({
    defaultValue: 1,
    dirty: true,
    errors: [],
    touched: true,
  })
})

test('batch writes validate every candidate before one atomic mutation', () => {
  const store = createPicodashStore({
    fields: {
      alpha: { defaultValue: 1, validate: z.number().nonnegative() },
      beta: { defaultValue: 2, validate: z.number().nonnegative() },
    },
    panelId: 'validation',
  })
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  expect(store.getState().setFieldValues({ alpha: 3, beta: -1 })).toMatchObject({
    errors: { beta: expect.any(Array) },
    success: false,
  })
  expect(store.getState().values).toEqual({ alpha: 1, beta: 2 })
  expect(notifications).toBe(0)

  expect(store.getState().setFieldValues({ alpha: 3, beta: 4 })).toEqual({ success: true })
  expect(store.getState().values).toEqual({ alpha: 3, beta: 4 })
  expect(notifications).toBe(1)
  unsubscribe()
})

test('single and all-field resets use isolated canonical defaults', () => {
  const original = { nested: [1, 2] }
  const store = createPicodashStore({
    fields: {
      amount: { defaultValue: 1.6, validate: z.number().transform(Math.round) },
      config: { defaultValue: original },
    },
    panelId: 'validation',
  })
  original.nested.push(3)
  store.getState().setFieldValues({ amount: 9, config: { nested: [8] } })

  expect(store.getState().resetFieldValue(store.fields.amount)).toEqual({ success: true })
  expect(store.getState().values.amount).toBe(2)
  expect(store.getState().fieldStates.amount).toEqual({
    defaultValue: 2,
    dirty: false,
    errors: [],
    touched: false,
  })

  expect(store.getState().resetFields()).toEqual({ success: true })
  expect(store.getState().values).toEqual({ amount: 2, config: { nested: [1, 2] } })
  expect(store.getState().fieldStates.config.dirty).toBe(false)
})

test('initial values are canonicalized or preserve defaults with stable errors', () => {
  const store = createPicodashStore({
    fields: {
      count: { defaultValue: 1, validate: z.coerce.number().int().positive() },
      title: { defaultValue: 'Fallback', validate: z.string().min(2) },
    },
    initialValues: {
      count: '7' as unknown as number,
      title: '',
    },
    panelId: 'validation',
  })

  expect(store.getState().values).toEqual({ count: 7, title: 'Fallback' })
  expect(store.getState().fieldStates.count).toMatchObject({
    defaultValue: 1,
    dirty: true,
    errors: [],
    touched: false,
  })
  expect(store.getState().fieldStates.title).toMatchObject({
    defaultValue: 'Fallback',
    dirty: false,
    errors: [expect.any(String)],
    touched: false,
  })
})

test('invalid initial values expose an atomic repair proposal that can be aborted or accepted', () => {
  const bounded =
    (maximum: number): PicodashParser<number, false> =>
    (input) =>
      typeof input !== 'number'
        ? { errors: ['Amount must be a number.'], success: false }
        : input <= maximum
          ? { output: { value: input }, success: true }
          : {
              errors: [`Amount must not exceed ${maximum}.`],
              repair: { value: maximum },
              success: false,
            }
  const create = () =>
    createPicodashStore<{ amount: number; count: number }>({
      fields: {
        amount: { defaultValue: 1, parse: bounded(5) },
        count: { defaultValue: 2, parse: bounded(4) },
      },
      initialValues: { amount: 8, count: 9 },
      panelId: 'repair',
    })

  const aborted = create()
  expect(aborted.getInitialState()).toBe(aborted.getState())
  expect(aborted.getState().values).toEqual({ amount: 1, count: 2 })
  expect(aborted.getState().repairProposal).toMatchObject({
    changes: [
      {
        after: { value: 5 },
        before: { value: 1 },
        errors: ['Amount must not exceed 5.'],
        field: aborted.fields.amount,
      },
      {
        after: { value: 4 },
        before: { value: 2 },
        errors: ['Amount must not exceed 4.'],
        field: aborted.fields.count,
      },
    ],
    source: 'initial',
  })
  aborted.getState().abortRepairProposal()
  expect(aborted.getState().repairProposal).toBeNull()
  expect(aborted.getState().fieldStates.amount.errors).toEqual(['Amount must not exceed 5.'])

  const accepted = create()
  let notifications = 0
  const unsubscribe = accepted.subscribe(() => {
    notifications += 1
  })
  expect(accepted.getState().acceptRepairProposal()).toEqual({ success: true })
  expect(accepted.getState().values).toEqual({ amount: 5, count: 4 })
  expect(accepted.getState().repairProposal).toBeNull()
  expect(notifications).toBe(1)
  unsubscribe()
})

test('malformed, empty-issue, and asynchronous callback results fail synchronously', () => {
  const malformed = (() => ({ success: true })) as unknown as PicodashParser<number, false>
  const asyncValidator = {
    '~standard': {
      validate: async (value: unknown) => ({ value }),
      vendor: 'test',
      version: 1 as const,
    },
  }
  const store = createPicodashStore<{ deferred: number; emptyIssues: number; malformed: number }>({
    fields: {
      deferred: {
        defaultValue: 0,
        validate: {
          '~standard': {
            validate: (value: unknown) =>
              value === 0 ? { value: 0 } : asyncValidator['~standard'].validate(value),
            vendor: 'test',
            version: 1 as const,
          },
        } as PicodashValidator<number>,
      },
      emptyIssues: {
        defaultValue: 0,
        validate: {
          '~standard': {
            validate: (value: unknown) => (value === 0 ? { value: 0 } : { issues: [] }),
            vendor: 'test',
            version: 1 as const,
          },
        },
      },
      malformed: {
        defaultValue: 0,
        parse: (input, context) =>
          input === context.defaultValue
            ? { output: { value: 0 }, success: true }
            : malformed(input, context),
      },
    },
    panelId: 'validation',
  })
  const before = store.getState()

  expect(store.getState().setFieldValue(store.fields.malformed, 2)).toEqual({
    errors: { malformed: ['Parser returned an invalid result.'] },
    success: false,
  })
  expect(store.getState()).toBe(before)

  expect(store.getState().setFieldValue(store.fields.deferred, 2)).toEqual({
    errors: {
      deferred: [
        'Asynchronous parsers and validators are not supported. Return a synchronous result.',
      ],
    },
    success: false,
  })
  expect(store.getState().setFieldValue(store.fields.emptyIssues, 2)).toEqual({
    errors: { emptyIssues: ['Value is invalid.'] },
    success: false,
  })
})

test('unset output requires an explicit durable field contract', () => {
  const optional = createPicodashStore<{ label: string }>({
    fields: {
      label: {
        allowUnset: true,
        defaultValue: 'value',
        parse: (input) =>
          input === null
            ? { output: { unset: true }, success: true }
            : {
                output: {
                  value: typeof input === 'string' ? input : (JSON.stringify(input) ?? ''),
                },
                success: true,
              },
      },
    },
    panelId: 'optional',
  })

  expect(optional.getState().setFieldInput(optional.fields.label, null)).toEqual({
    success: true,
  })
  expect(optional.getState().values).not.toHaveProperty('label')

  const parser = (() => ({
    output: { unset: true },
    success: true,
  })) as unknown as PicodashParser<string, false>
  const required = createPicodashStore<{ label: string }>({
    fields: {
      label: {
        defaultValue: 'value',
        parse: (input, context) =>
          input === context.defaultValue
            ? { output: { value: 'value' }, success: true }
            : parser(input, context),
      },
    },
    panelId: 'required',
  })
  expect(required.getState().setFieldInput(required.fields.label, null)).toEqual({
    errors: { label: ['Field does not allow unset values.'] },
    success: false,
  })
})

test('Store-owned handles reject same-shaped handles from another Store', () => {
  const first = createPicodashStore({
    fields: { count: { defaultValue: 1 } },
    panelId: 'first',
  })
  const second = createPicodashStore({
    fields: { count: { defaultValue: 1 } },
    panelId: 'second',
  })
  const before = first.getState()

  expect(first.getState().setFieldValue(second.fields.count, 2)).toEqual({
    errors: { count: ['Field handle does not belong to this Picodash Store.'] },
    success: false,
  })
  expect(first.getState()).toBe(before)
})
