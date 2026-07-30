import { expect, test, vi } from 'vite-plus/test'
import {
  createPicodashStore,
  PICODASH_ERROR_CODES,
  type PicodashAdapterWriteContext,
  type PicodashValueAdapter,
} from '../src/index.ts'

type Values = { count: number; title: string }

function createExternalValues(
  initial: Values,
  setImplementation?: (
    nextValues: Values,
    context: PicodashAdapterWriteContext<Values>,
  ) => boolean | undefined | void,
) {
  let snapshot = initial
  const listeners = new Set<() => void>()
  const writes: { context: PicodashAdapterWriteContext<Values>; values: Values }[] = []
  const adapter: PicodashValueAdapter<Values> = {
    id: 'host',
    getSnapshot: () => snapshot,
    setValues(nextValues, context) {
      writes.push({ context, values: nextValues })
      if (setImplementation !== undefined) return setImplementation(nextValues, context)
      snapshot = nextValues
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return {
    adapter,
    notify() {
      for (const listener of listeners) listener()
    },
    setSnapshot(values: Values) {
      snapshot = values
    },
    writes,
  }
}

function createExternalStore(external: ReturnType<typeof createExternalValues>) {
  return createPicodashStore<Values>({
    adapter: external.adapter,
    fields: {
      count: {
        defaultValue: 1,
        parse: (input) =>
          typeof input === 'number' && input >= 0
            ? { output: { value: input }, success: true }
            : {
                errors: ['Count must be non-negative.'],
                repair: typeof input === 'number' ? { value: Math.max(0, input) } : undefined,
                success: false,
              },
      },
      title: { defaultValue: 'Untitled' },
    },
    panelId: 'external',
  })
}

test('uses the host snapshot as the complete SSR-safe initial record', () => {
  const external = createExternalValues({ count: 2, title: 'Host' })
  const store = createExternalStore(external)

  expect(store.getInitialState()).toBe(store.getState())
  expect(store.getInitialState().values).toEqual({ count: 2, title: 'Host' })
  expect(external.writes).toHaveLength(0)
})

test('delivers one complete record for a batch, reset, import, and repair', () => {
  const external = createExternalValues({ count: 2, title: 'Host' })
  const store = createExternalStore(external)

  expect(store.getState().setFieldValues({ count: 3, title: 'Batch' })).toEqual({
    success: true,
  })
  expect(store.getState().resetFields()).toEqual({ success: true })
  store.getState().registerItem({
    fields: { count: store.fields.count, title: store.fields.title },
    id: 'fields',
  })
  const analysis = store.getState().analyzePanelDocument({ count: 4, title: 'Import' })
  if (analysis.status === 'invalid') throw new Error('Expected a valid import.')
  expect(store.getState().applyPanelImport(analysis).success).toBe(true)

  expect(external.writes.map(({ context }) => context.source)).toEqual([
    'programmatic',
    'reset',
    'import',
  ])
  expect(external.writes.map(({ values }) => values)).toEqual([
    { count: 3, title: 'Batch' },
    { count: 1, title: 'Untitled' },
    { count: 4, title: 'Import' },
  ])

  external.setSnapshot({ count: -2, title: 'Repair' })
  external.notify()
  expect(store.getState().repairProposal?.source).toBe('adapter')
  expect(store.getState().acceptRepairProposal()).toEqual({ success: true })
  expect(external.writes.at(-1)).toMatchObject({
    context: { panelId: 'external', source: 'repair' },
    values: { count: 0, title: 'Import' },
  })
})

test('accepts valid host updates without writing back or creating loops', () => {
  const external = createExternalValues({ count: 2, title: 'Host' })
  const store = createExternalStore(external)
  const listener = vi.fn()
  store.subscribe(listener)

  external.setSnapshot({ count: 7, title: 'Updated' })
  external.notify()

  expect(store.getState().values).toEqual({ count: 7, title: 'Updated' })
  expect(external.writes).toHaveLength(0)
  expect(listener).toHaveBeenCalledTimes(1)

  expect(store.getState().setFieldValue(store.fields.count, 8)).toEqual({ success: true })
  expect(external.writes).toHaveLength(1)
  expect(listener).toHaveBeenCalledTimes(2)
})

test('retains the last valid record and diagnoses invalid host snapshots', () => {
  const external = createExternalValues({ count: 2, title: 'Host' })
  const store = createExternalStore(external)

  external.setSnapshot({ count: -4, title: 'Invalid' })
  external.notify()

  expect(store.getState().values).toEqual({ count: 2, title: 'Host' })
  expect(store.getState().fieldStates.count.errors).toEqual(['Count must be non-negative.'])
  expect(store.getState().repairProposal).toMatchObject({ source: 'adapter' })
  expect(store.diagnostics.getSnapshot()).toContainEqual(
    expect.objectContaining({
      code: PICODASH_ERROR_CODES.INVALID_ADAPTER_SNAPSHOT,
      identity: { adapterId: 'host', panelId: 'external' },
    }),
  )
  expect(store.getState().diagnostics).toBe(store.diagnostics.getSnapshot())

  external.setSnapshot({ count: 5, title: 'Recovered' })
  external.notify()
  expect(store.getState().values).toEqual({ count: 5, title: 'Recovered' })
  expect(
    store.diagnostics
      .getSnapshot()
      .some(({ code }) => code === PICODASH_ERROR_CODES.INVALID_ADAPTER_SNAPSHOT),
  ).toBe(false)
  expect(store.getState().diagnostics).toBe(store.diagnostics.getSnapshot())
})

test('clears adapter errors when the host recovers to the last valid record', () => {
  const external = createExternalValues({ count: 2, title: 'Host' })
  const store = createExternalStore(external)

  external.setSnapshot({ count: -4, title: 'Invalid' })
  external.notify()
  expect(store.getState().fieldStates.count.errors).not.toHaveLength(0)
  expect(store.getState().repairProposal).not.toBeNull()

  external.setSnapshot({ count: 2, title: 'Host' })
  external.notify()

  expect(store.getState().values).toEqual({ count: 2, title: 'Host' })
  expect(store.getState().fieldStates.count.errors).toEqual([])
  expect(store.getState().repairProposal).toBeNull()
})

test('reports adapter rejection separately from a stale import plan', () => {
  const external = createExternalValues({ count: 2, title: 'Host' }, () => false)
  const store = createExternalStore(external)
  store.getState().registerItem({
    fields: { count: store.fields.count, title: store.fields.title },
    id: 'fields',
  })
  const analysis = store.getState().analyzePanelDocument({ count: 4, title: 'Import' })
  if (analysis.status === 'invalid') throw new Error('Expected a valid import.')

  expect(store.getState().applyPanelImport(analysis)).toMatchObject({
    diagnostic: { code: PICODASH_ERROR_CODES.REJECTED_WRITE },
    reason: 'adapter-rejected',
    success: false,
  })
})

test.each([
  {
    code: PICODASH_ERROR_CODES.REJECTED_WRITE,
    name: 'thrown',
    set: () => {
      throw new Error('no')
    },
  },
  {
    code: PICODASH_ERROR_CODES.REJECTED_WRITE,
    name: 'rejected',
    set: () => false,
  },
  {
    code: PICODASH_ERROR_CODES.NON_SYNCHRONOUS_WRITE,
    name: 'promise',
    set: () => Promise.resolve() as unknown as undefined,
  },
  {
    code: PICODASH_ERROR_CODES.REJECTED_WRITE,
    name: 'stale',
    set: () => undefined,
  },
])('rejects $name adapter writes without advancing canonical values', ({ code, set }) => {
  const external = createExternalValues({ count: 2, title: 'Host' }, set)
  const store = createExternalStore(external)
  const listener = vi.fn()
  store.subscribe(listener)

  const result = store.getState().setFieldValue(store.fields.count, 9)

  expect(result).toMatchObject({ diagnostic: { code }, success: false })
  expect(store.getState().values).toEqual({ count: 2, title: 'Host' })
  expect(listener).toHaveBeenCalledTimes(1)
})

test('invalid initial snapshots preserve defaults and expose repair', () => {
  const external = createExternalValues({ count: -3, title: 'Host' })
  const store = createExternalStore(external)

  expect(store.getInitialState().values).toEqual({ count: 1, title: 'Untitled' })
  expect(store.getInitialState().repairProposal).toMatchObject({ source: 'adapter' })
  expect(store.getState().acceptRepairProposal()).toEqual({ success: true })
  expect(store.getState().values).toEqual({ count: 0, title: 'Untitled' })
  expect(external.writes).toHaveLength(1)
})
