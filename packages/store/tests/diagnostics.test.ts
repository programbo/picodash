import { describe, expect, it } from 'vite-plus/test'
import {
  createPicodashStore,
  PicodashContractError,
  type PicodashDiagnostic,
} from '../src/index.ts'
import { createDiagnosticsRuntime } from '../src/diagnostics.ts'
import { createMemoryPersistence } from './support/memory-persistence.js'

const makeStore = () =>
  createPicodashStore({
    valueOwner: 'store',
    fields: { value: { defaultValue: 1 } },
  })

const entries = (store: ReturnType<typeof makeStore>) => [...store.diagnostics.getState().current]

const failure = (run: () => unknown) => {
  try {
    run()
    throw new Error('expected failure')
  } catch (error) {
    expect(error).toBeInstanceOf(PicodashContractError)
    return error as PicodashContractError
  }
}

describe('Store core diagnostics', () => {
  it('starts immutable, root-wide, and detached', () => {
    const store = makeStore()
    const scoped = store.scope('settings')
    const snapshot = store.diagnostics.getState()
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.current)).toBe(true)
    expect(store.diagnostics.getState().current).toBe(scoped.diagnostics.getState().current)
    expect(() => Map.prototype.set.call(snapshot.current, 'private', {})).toThrow()
    expect(entries(store)).toEqual([])
  })

  it('aggregates root subscriber failures, notifies diagnostics once, and recovers', () => {
    const store = makeStore()
    const diagnosticsNotifications: ReadonlyMap<string, unknown>[] = []
    const unsubscribeDiagnostics = store.diagnostics.subscribe(() => {
      diagnosticsNotifications.push(store.diagnostics.getState().current)
    })
    const throwing = store.subscribe(() => {
      throw new Error('PRIVATE_CAUSE')
    })
    let later = 0
    store.subscribe(() => {
      later += 1
    })
    const result = store.setValues({ value: 2 })
    expect(result.ok).toBe(true)
    expect(later).toBe(1)
    const first = entries(store)
    expect(first).toHaveLength(1)
    expect(first[0]?.[1]).toMatchObject({
      code: 'subscriber_exception',
      severity: 'error',
      message: 'A Store subscriber threw.',
      count: 1,
      lastOccurrence: 1,
      identity: { kind: 'subscriber', surface: 'root' },
    })
    expect(JSON.stringify(first)).not.toContain('PRIVATE_CAUSE')
    expect(diagnosticsNotifications).toHaveLength(1)
    throwing()
    store.setValues({ value: 3 })
    expect(entries(store)).toEqual([])
    expect(diagnosticsNotifications).toHaveLength(2)
    unsubscribeDiagnostics()
  })

  it('counts every thrown callback, keeps occurrence monotonic, and does not recover on no-op', () => {
    const store = makeStore()
    const first = store.subscribe(() => {
      throw new Error('first')
    })
    const second = store.subscribe(() => {
      throw new Error('second')
    })
    store.setValues({ value: 2 })
    expect(entries(store)[0]?.[1]).toMatchObject({ count: 2, lastOccurrence: 2 })
    store.setValues({ value: 2 })
    expect(entries(store)[0]?.[1]).toMatchObject({ count: 2, lastOccurrence: 2 })
    first()
    second()
    store.setValues({ value: 3 })
    expect(entries(store)).toEqual([])
  })

  it('tracks distinct scopes and recovers only on the affected dispatch', () => {
    const store = makeStore()
    const first = store.scope('first')
    const second = store.scope('second')
    const firstUnsubscribe = first.subscribe(() => {
      throw new Error('first')
    })
    const secondUnsubscribe = second.subscribe(() => {
      throw new Error('second')
    })
    store.setValues({ value: 2 })
    expect(entries(store).map(([, diagnostic]) => diagnostic.identity)).toEqual([
      { kind: 'subscriber', surface: 'scope', scopeId: 'first' },
      { kind: 'subscriber', surface: 'scope', scopeId: 'second' },
    ])
    firstUnsubscribe()
    store.setDashListRootOrder('first', ['item'])
    expect(entries(store).map(([, diagnostic]) => diagnostic.identity)).toEqual([
      { kind: 'subscriber', surface: 'scope', scopeId: 'second' },
    ])
    secondUnsubscribe()
    store.setDashListRootOrder('second', ['item'])
    expect(entries(store)).toEqual([])
  })

  it('dispatches each committed surface once and keeps unrelated scopes quiet', () => {
    const store = makeStore()
    const first = store.scope('first')
    const second = store.scope('second')
    let rootCalls = 0
    let firstCalls = 0
    let secondCalls = 0
    store.subscribe(() => {
      rootCalls += 1
    })
    first.subscribe(() => {
      firstCalls += 1
    })
    second.subscribe(() => {
      secondCalls += 1
    })

    store.setValues({ value: 2 })
    expect({ rootCalls, firstCalls, secondCalls }).toEqual({
      rootCalls: 1,
      firstCalls: 1,
      secondCalls: 1,
    })

    store.setDashListRootOrder('first', ['item'])
    expect({ rootCalls, firstCalls, secondCalls }).toEqual({
      rootCalls: 2,
      firstCalls: 2,
      secondCalls: 1,
    })
  })

  it('records diagnostics-listener failures after the current dispatch without recursion', () => {
    const store = makeStore()
    store.subscribe(() => {
      throw new Error('root')
    })
    const observed: ReadonlyMap<string, PicodashDiagnostic>[] = []
    const diagnosticsUnsubscribe = store.diagnostics.subscribe(() => {
      observed.push(store.diagnostics.getState().current)
      throw new Error('diagnostics')
    })
    let later = 0
    store.diagnostics.subscribe(() => {
      later += 1
    })
    store.setValues({ value: 2 })
    expect(observed).toHaveLength(1)
    expect(later).toBe(1)
    expect([...observed[0]!.values()].map((entry) => entry.identity)).toEqual([
      { kind: 'subscriber', surface: 'root' },
    ])
    expect(entries(store).map(([, diagnostic]) => diagnostic.identity)).toEqual([
      { kind: 'subscriber', surface: 'root' },
      { kind: 'subscriber', surface: 'diagnostics' },
    ])
    diagnosticsUnsubscribe()
  })

  it('normalizes escaping reentrant writes and destroys while continuing later listeners', () => {
    const store = makeStore()
    let later = 0
    store.subscribe(() => store.setValues({ value: 2 }))
    store.subscribe(() => {
      later += 1
    })
    store.setValues({ value: 2 })
    expect(later).toBe(1)
    expect(entries(store)[0]?.[1]).toMatchObject({
      identity: { kind: 'subscriber', surface: 'root' },
    })

    const destroyStore = makeStore()
    destroyStore.subscribe(() => destroyStore.destroy())
    expect(() => destroyStore.setValues({ value: 2 })).not.toThrow()
    expect(entries(destroyStore)[0]?.[1]).toMatchObject({
      identity: { kind: 'subscriber', surface: 'root' },
    })
  })

  it('supports private capability aggregation and recovery', () => {
    const runtime = createDiagnosticsRuntime({
      assertActive: () => undefined,
      invalidListener: () => {
        throw new Error('invalid listener')
      },
    })
    runtime.dispatch([
      {
        surface: 'capability',
        capability: 'persistence',
        listeners: [
          () => {
            throw new Error('PRIVATE_CAPABILITY')
          },
        ],
      },
    ])
    const capabilityEntry = [...runtime.facade.getState().current.values()][0]!
    expect(capabilityEntry.identity).toEqual({
      kind: 'subscriber',
      surface: 'capability',
      capability: 'persistence',
    })
    expect(JSON.stringify(capabilityEntry)).not.toContain('PRIVATE_CAPABILITY')
    runtime.dispatch([{ surface: 'capability', capability: 'persistence', listeners: [] }])
    expect([...runtime.facade.getState().current]).toEqual([])
  })

  it('correlates Store persistence failures with capability dispatch and recovery', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore({
      valueOwner: 'store',
      storeId: 'diagnostics-persistence',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    let capabilityCalls = 0
    const unsubscribe = store.persistence!.subscribe(() => {
      capabilityCalls += 1
    })
    persistence.failNext('write', new Error('PRIVATE_DRIVER_CAUSE'))
    store.setValues({ value: 2 })
    expect(capabilityCalls).toBeGreaterThan(0)
    const failureDiagnostic = [...store.diagnostics.getState().current.values()].find(
      (diagnostic) => diagnostic.code === 'persistence_failure',
    )
    expect(failureDiagnostic).toMatchObject({
      code: 'persistence_failure',
      identity: { kind: 'persistence' },
      reason: 'write-failed',
    })
    expect(JSON.stringify(failureDiagnostic)).not.toContain('PRIVATE_DRIVER_CAUSE')
    store.persistence!.flush()
    expect(
      [...store.diagnostics.getState().current.values()].some(
        (diagnostic) => diagnostic.code === 'persistence_failure',
      ),
    ).toBe(false)
    unsubscribe()
    store.destroy()
  })

  it('allocates opaque keys that stay stable across recovery and recurrence', () => {
    const store = makeStore()
    const scoped = store.scope('private-scope')
    const rootUnsubscribe = store.subscribe(() => {
      throw new Error('root')
    })
    store.setValues({ value: 2 })
    const rootKey = [...store.diagnostics.getState().current.keys()][0]!
    expect(rootKey).not.toContain('root')
    expect(rootKey).not.toContain('private-scope')

    rootUnsubscribe()
    store.setValues({ value: 3 })
    expect(store.diagnostics.getState().current.size).toBe(0)

    const recurringUnsubscribe = store.subscribe(() => {
      throw new Error('root again')
    })
    const scopedUnsubscribe = scoped.subscribe(() => {
      throw new Error('scope')
    })
    store.setValues({ value: 4 })
    const keys = [...store.diagnostics.getState().current.keys()]
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(rootKey)
    expect(keys[1]).not.toBe(rootKey)
    expect(keys[1]).not.toContain('scope')
    recurringUnsubscribe()
    scopedUnsubscribe()
  })

  it('guards every diagnostics facade and captured descriptor method after destroy', () => {
    const store = makeStore()
    const diagnostics = store.diagnostics
    const getState = Reflect.get(diagnostics, 'getState') as typeof diagnostics.getState
    const subscribe = Reflect.get(diagnostics, 'subscribe') as typeof diagnostics.subscribe
    const descriptor = Object.getOwnPropertyDescriptor(diagnostics, 'getState')!
    const descriptorGetter = Reflect.get(descriptor, 'get') as () => unknown
    const descriptorMethod = descriptorGetter.call(diagnostics) as () => unknown

    expect(Object.isFrozen(diagnostics)).toBe(true)
    expect(Object.keys(diagnostics)).toEqual(['getState', 'subscribe'])
    expect('getState' in diagnostics).toBe(true)
    expect(Object.getPrototypeOf(diagnostics)).toBe(Object.prototype)
    expect(getState).toBe(Reflect.get(diagnostics, 'getState'))
    expect(descriptorMethod).toBe(getState)
    expect(Reflect.set(diagnostics, 'extra', true)).toBe(false)
    expect(Reflect.defineProperty(diagnostics, 'extra', { value: true })).toBe(false)
    expect(Reflect.deleteProperty(diagnostics, 'getState')).toBe(false)
    expect(Reflect.setPrototypeOf(diagnostics, Object.create(null))).toBe(false)
    expect(Reflect.preventExtensions(diagnostics)).toBe(true)
    expect(Reflect.isExtensible(diagnostics)).toBe(false)

    store.destroy()
    const destroyedOperations: readonly [string, () => unknown][] = [
      ['get', () => diagnostics.getState()],
      ['subscribe', () => diagnostics.subscribe(() => undefined)],
      ['getState method', () => getState()],
      ['subscribe method', () => subscribe(() => undefined)],
      ['descriptor getter', () => descriptorGetter.call(diagnostics)],
      ['descriptor method', () => descriptorMethod()],
      ['has', () => 'getState' in diagnostics],
      ['ownKeys', () => Object.keys(diagnostics)],
      ['descriptor', () => Object.getOwnPropertyDescriptor(diagnostics, 'getState')],
      ['prototype', () => Object.getPrototypeOf(diagnostics)],
      ['set', () => Reflect.set(diagnostics, 'extra', true)],
      ['defineProperty', () => Reflect.defineProperty(diagnostics, 'extra', { value: true })],
      ['deleteProperty', () => Reflect.deleteProperty(diagnostics, 'getState')],
      ['setPrototypeOf', () => Reflect.setPrototypeOf(diagnostics, Object.prototype)],
      ['preventExtensions', () => Reflect.preventExtensions(diagnostics)],
      ['isExtensible', () => Reflect.isExtensible(diagnostics)],
    ]
    for (const [label, operation] of destroyedOperations)
      expect(() => operation(), label).toThrowError(
        expect.objectContaining({ code: 'use-after-destroy' }),
      )
  })

  it('tears down with the root and preserves detached snapshots and idempotent unsubscribe', () => {
    const store = makeStore()
    const diagnostics = store.diagnostics
    const snapshot = diagnostics.getState()
    const unsubscribe = diagnostics.subscribe(() => undefined)
    store.destroy()
    expect(snapshot.current.size).toBe(0)
    unsubscribe()
    unsubscribe()
    expect(failure(() => diagnostics.getState()).code).toBe('use-after-destroy')
    expect(failure(() => diagnostics.subscribe(() => undefined)).code).toBe('use-after-destroy')
  })
})
