import { describe, expect, it } from 'vite-plus/test'
import {
  createPicodashNexus,
  PicodashContractError,
  type PicodashDiagnostic,
} from '../src/index.ts'
import { createDiagnosticsRuntime } from '../src/diagnostics.ts'
import { createMemoryPersistence } from './support/memory-persistence.js'

const makeNexus = () =>
  createPicodashNexus({
    valueOwner: 'nexus',
    fields: { value: { defaultValue: 1 } },
  })

const entries = (nexus: ReturnType<typeof makeNexus>) => [...nexus.diagnostics.getState().current]

const failure = (run: () => unknown) => {
  try {
    run()
    throw new Error('expected failure')
  } catch (error) {
    expect(error).toBeInstanceOf(PicodashContractError)
    return error as PicodashContractError
  }
}

describe('Nexus core diagnostics', () => {
  it('starts immutable, root-wide, and detached', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('settings')
    const snapshot = nexus.diagnostics.getState()
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.current)).toBe(true)
    expect(nexus.diagnostics.getState().current).toBe(scoped.diagnostics.getState().current)
    expect(() => Map.prototype.set.call(snapshot.current, 'private', {})).toThrow()
    expect(entries(nexus)).toEqual([])
  })

  it('aggregates root subscriber failures, notifies diagnostics once, and recovers', () => {
    const nexus = makeNexus()
    const diagnosticsNotifications: ReadonlyMap<string, unknown>[] = []
    const unsubscribeDiagnostics = nexus.diagnostics.subscribe(() => {
      diagnosticsNotifications.push(nexus.diagnostics.getState().current)
    })
    const throwing = nexus.subscribe(() => {
      throw new Error('PRIVATE_CAUSE')
    })
    let later = 0
    nexus.subscribe(() => {
      later += 1
    })
    const result = nexus.setValues({ value: 2 })
    expect(result.ok).toBe(true)
    expect(later).toBe(1)
    const first = entries(nexus)
    expect(first).toHaveLength(1)
    expect(first[0]?.[1]).toMatchObject({
      code: 'subscriber_exception',
      severity: 'error',
      message: 'A Nexus subscriber threw.',
      count: 1,
      lastOccurrence: 1,
      identity: { kind: 'subscriber', surface: 'root' },
    })
    expect(JSON.stringify(first)).not.toContain('PRIVATE_CAUSE')
    expect(diagnosticsNotifications).toHaveLength(1)
    throwing()
    nexus.setValues({ value: 3 })
    expect(entries(nexus)).toEqual([])
    expect(diagnosticsNotifications).toHaveLength(2)
    unsubscribeDiagnostics()
  })

  it('counts every thrown callback, keeps occurrence monotonic, and does not recover on no-op', () => {
    const nexus = makeNexus()
    const first = nexus.subscribe(() => {
      throw new Error('first')
    })
    const second = nexus.subscribe(() => {
      throw new Error('second')
    })
    nexus.setValues({ value: 2 })
    expect(entries(nexus)[0]?.[1]).toMatchObject({ count: 2, lastOccurrence: 2 })
    nexus.setValues({ value: 2 })
    expect(entries(nexus)[0]?.[1]).toMatchObject({ count: 2, lastOccurrence: 2 })
    first()
    second()
    nexus.setValues({ value: 3 })
    expect(entries(nexus)).toEqual([])
  })

  it('tracks distinct scopes and recovers only on the affected dispatch', () => {
    const nexus = makeNexus()
    const first = nexus.scope('first')
    const second = nexus.scope('second')
    const firstUnsubscribe = first.subscribe(() => {
      throw new Error('first')
    })
    const secondUnsubscribe = second.subscribe(() => {
      throw new Error('second')
    })
    nexus.setValues({ value: 2 })
    expect(entries(nexus).map(([, diagnostic]) => diagnostic.identity)).toEqual([
      { kind: 'subscriber', surface: 'scope', scopeId: 'first' },
      { kind: 'subscriber', surface: 'scope', scopeId: 'second' },
    ])
    firstUnsubscribe()
    nexus.setDashListRootOrder('first', ['item'])
    expect(entries(nexus).map(([, diagnostic]) => diagnostic.identity)).toEqual([
      { kind: 'subscriber', surface: 'scope', scopeId: 'second' },
    ])
    secondUnsubscribe()
    nexus.setDashListRootOrder('second', ['item'])
    expect(entries(nexus)).toEqual([])
  })

  it('dispatches each committed surface once and keeps unrelated scopes quiet', () => {
    const nexus = makeNexus()
    const first = nexus.scope('first')
    const second = nexus.scope('second')
    let rootCalls = 0
    let firstCalls = 0
    let secondCalls = 0
    nexus.subscribe(() => {
      rootCalls += 1
    })
    first.subscribe(() => {
      firstCalls += 1
    })
    second.subscribe(() => {
      secondCalls += 1
    })

    nexus.setValues({ value: 2 })
    expect({ rootCalls, firstCalls, secondCalls }).toEqual({
      rootCalls: 1,
      firstCalls: 1,
      secondCalls: 1,
    })

    nexus.setDashListRootOrder('first', ['item'])
    expect({ rootCalls, firstCalls, secondCalls }).toEqual({
      rootCalls: 2,
      firstCalls: 2,
      secondCalls: 1,
    })
  })

  it('records diagnostics-listener failures after the current dispatch without recursion', () => {
    const nexus = makeNexus()
    nexus.subscribe(() => {
      throw new Error('root')
    })
    const observed: ReadonlyMap<string, PicodashDiagnostic>[] = []
    const diagnosticsUnsubscribe = nexus.diagnostics.subscribe(() => {
      observed.push(nexus.diagnostics.getState().current)
      throw new Error('diagnostics')
    })
    let later = 0
    nexus.diagnostics.subscribe(() => {
      later += 1
    })
    nexus.setValues({ value: 2 })
    expect(observed).toHaveLength(1)
    expect(later).toBe(1)
    expect([...observed[0]!.values()].map((entry) => entry.identity)).toEqual([
      { kind: 'subscriber', surface: 'root' },
    ])
    expect(entries(nexus).map(([, diagnostic]) => diagnostic.identity)).toEqual([
      { kind: 'subscriber', surface: 'root' },
      { kind: 'subscriber', surface: 'diagnostics' },
    ])
    diagnosticsUnsubscribe()
  })

  it('normalizes escaping reentrant writes and destroys while continuing later listeners', () => {
    const nexus = makeNexus()
    let later = 0
    nexus.subscribe(() => nexus.setValues({ value: 2 }))
    nexus.subscribe(() => {
      later += 1
    })
    nexus.setValues({ value: 2 })
    expect(later).toBe(1)
    expect(entries(nexus)[0]?.[1]).toMatchObject({
      identity: { kind: 'subscriber', surface: 'root' },
    })

    const destroyNexus = makeNexus()
    destroyNexus.subscribe(() => destroyNexus.destroy())
    expect(() => destroyNexus.setValues({ value: 2 })).not.toThrow()
    expect(entries(destroyNexus)[0]?.[1]).toMatchObject({
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

  it('correlates Nexus persistence failures with capability dispatch and recovery', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'diagnostics-persistence',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    let capabilityCalls = 0
    const unsubscribe = nexus.persistence!.subscribe(() => {
      capabilityCalls += 1
    })
    persistence.failNext('write', new Error('PRIVATE_DRIVER_CAUSE'))
    nexus.setValues({ value: 2 })
    expect(capabilityCalls).toBeGreaterThan(0)
    const failureDiagnostic = [...nexus.diagnostics.getState().current.values()].find(
      (diagnostic) => diagnostic.code === 'persistence_failure',
    )
    expect(failureDiagnostic).toMatchObject({
      code: 'persistence_failure',
      identity: { kind: 'persistence' },
      reason: 'write-failed',
    })
    expect(JSON.stringify(failureDiagnostic)).not.toContain('PRIVATE_DRIVER_CAUSE')
    nexus.persistence!.flush()
    expect(
      [...nexus.diagnostics.getState().current.values()].some(
        (diagnostic) => diagnostic.code === 'persistence_failure',
      ),
    ).toBe(false)
    unsubscribe()
    nexus.destroy()
  })

  it('allocates opaque keys that stay stable across recovery and recurrence', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('private-scope')
    const rootUnsubscribe = nexus.subscribe(() => {
      throw new Error('root')
    })
    nexus.setValues({ value: 2 })
    const rootKey = [...nexus.diagnostics.getState().current.keys()][0]!
    expect(rootKey).not.toContain('root')
    expect(rootKey).not.toContain('private-scope')

    rootUnsubscribe()
    nexus.setValues({ value: 3 })
    expect(nexus.diagnostics.getState().current.size).toBe(0)

    const recurringUnsubscribe = nexus.subscribe(() => {
      throw new Error('root again')
    })
    const scopedUnsubscribe = scoped.subscribe(() => {
      throw new Error('scope')
    })
    nexus.setValues({ value: 4 })
    const keys = [...nexus.diagnostics.getState().current.keys()]
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(rootKey)
    expect(keys[1]).not.toBe(rootKey)
    expect(keys[1]).not.toContain('scope')
    recurringUnsubscribe()
    scopedUnsubscribe()
  })

  it('guards every diagnostics facade and captured descriptor method after destroy', () => {
    const nexus = makeNexus()
    const diagnostics = nexus.diagnostics
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

    nexus.destroy()
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
    const nexus = makeNexus()
    const diagnostics = nexus.diagnostics
    const snapshot = diagnostics.getState()
    const unsubscribe = diagnostics.subscribe(() => undefined)
    nexus.destroy()
    expect(snapshot.current.size).toBe(0)
    unsubscribe()
    unsubscribe()
    expect(failure(() => diagnostics.getState()).code).toBe('use-after-destroy')
    expect(failure(() => diagnostics.subscribe(() => undefined)).code).toBe('use-after-destroy')
  })
})
