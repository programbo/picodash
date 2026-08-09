import { describe, expect, it } from 'vite-plus/test'
import {
  acquireEntityLease,
  acquireProviderLease,
  acquireRelationshipLease,
} from '../src/integration.ts'
import { createPicodashStore, PicodashContractError } from '../src/index.ts'
import { registerRuntimeResource, runtimeControllerFor } from '../src/runtime-controller.ts'
import { createMemoryPersistence } from './support/memory-persistence.js'

const makeStore = () =>
  createPicodashStore({
    valueOwner: 'store',
    fields: { value: { defaultValue: 1 } },
  })

const failure = (run: () => unknown) => {
  try {
    run()
    throw new Error('expected failure')
  } catch (error) {
    expect(error).toBeInstanceOf(PicodashContractError)
    return error as PicodashContractError
  }
}

const expectUseAfterDestroy = (run: () => unknown) => {
  const error = failure(run)
  expect(error.code).toBe('use-after-destroy')
  expect(error.context).toEqual({})
}

describe('Store root destruction', () => {
  it('validates exact options privately and refuses in contract order', () => {
    const store = makeStore()
    let discarded = false
    registerRuntimeResource(store, {
      phase: 'capability',
      hasUnpersistedState: () => true,
      teardown: (context) => {
        discarded = context.discardUnpersisted
      },
    })
    for (const [options, reason] of [
      [null, 'not-object'],
      [[], 'not-object'],
      [1, 'not-object'],
      [() => undefined, 'not-object'],
      [{ extra: true }, 'unknown-key'],
      [{ [Symbol('PRIVATE_SENTINEL')]: true }, 'unknown-key'],
      [{ discardUnpersisted: false }, 'invalid-discard-unpersisted'],
    ] as const) {
      const error = failure(() => store.destroy(options as never))
      expect(error.code).toBe('invalid-destroy-options')
      expect(error.context).toEqual({ reason })
      expect(`${error.message}${error.stack}${JSON.stringify(error)}`).not.toContain(
        'PRIVATE_SENTINEL',
      )
    }
    let invoked = false
    const accessor = Object.defineProperty({}, 'discardUnpersisted', {
      get() {
        invoked = true
        return true
      },
    })
    expect(failure(() => store.destroy(accessor as never)).context).toEqual({
      reason: 'accessor-property',
    })
    expect(invoked).toBe(false)
    const provider = acquireProviderLease(store)
    expect(failure(() => store.destroy()).code).toBe('root-has-active-leases')
    expect(failure(() => store.destroy({ discardUnpersisted: true })).code).toBe(
      'root-has-active-leases',
    )
    expect(failure(() => store.destroy({ discardUnpersisted: 'yes' } as never)).code).toBe(
      'invalid-destroy-options',
    )
    provider.release()
    expect(failure(() => store.destroy()).code).toBe('root-has-unpersisted-state')
    store.destroy({ discardUnpersisted: true })
    expect(discarded).toBe(true)
    expect(failure(() => store.destroy()).code).toBe('use-after-destroy')
  })

  it('holds the write lock while root destroy options are reflected', () => {
    const store = makeStore()
    let nestedCode: string | undefined
    const options = new Proxy(
      { discardUnpersisted: true as const },
      {
        ownKeys(target) {
          try {
            store.setValue(store.fields.value, 2)
          } catch (error) {
            nestedCode = (error as PicodashContractError).code
          }
          return Reflect.ownKeys(target)
        },
      },
    )

    store.destroy(options)
    expect(nestedCode).toBe('reentrant-write')
  })

  it('refuses every active lease kind before pending-state checks', () => {
    const providerStore = makeStore()
    const provider = acquireProviderLease(providerStore)
    expect(failure(() => providerStore.destroy()).code).toBe('root-has-active-leases')
    provider.release()

    const entityStore = makeStore()
    const entityProvider = acquireProviderLease(entityStore)
    const entity = acquireEntityLease(entityStore.scope('entity'), {
      kind: 'dashList',
      host: entityProvider,
    })
    expect(failure(() => entityStore.destroy()).code).toBe('root-has-active-leases')
    entity.release()
    entityProvider.release()

    const relationshipStore = makeStore()
    const relationshipProvider = acquireProviderLease(relationshipStore)
    const parent = acquireEntityLease(relationshipStore.scope('parent'), {
      kind: 'dashList',
      host: relationshipProvider,
    })
    const child = acquireEntityLease(relationshipStore.scope('child'), {
      kind: 'dashList',
      host: relationshipProvider,
    })
    const relationship = acquireRelationshipLease(parent, child)
    expect(failure(() => relationshipStore.destroy()).code).toBe('root-has-active-leases')
    relationship.release()
    child.release()
    parent.release()
    relationshipProvider.release()
    relationshipStore.destroy()
    entityStore.destroy()
    providerStore.destroy()
  })

  it('tears down capability resources before kernel resources exactly once', () => {
    const store = makeStore()
    const events: string[] = []
    let capabilityCalls = 0
    const unregister = registerRuntimeResource(store, {
      phase: 'capability',
      teardown: () => {
        capabilityCalls += 1
        events.push('capability')
      },
    })
    unregister()
    unregister()
    registerRuntimeResource(store, {
      phase: 'capability',
      teardown: () => events.push('capability-2'),
    })
    registerRuntimeResource(store, {
      phase: 'kernel',
      teardown: () => events.push('kernel'),
    })
    store.destroy({ discardUnpersisted: true })
    expect(capabilityCalls).toBe(0)
    expect(events).toEqual(['capability-2', 'kernel'])
    expect(failure(() => store.getState()).code).toBe('use-after-destroy')
  })

  it('tears down persistence ownership without erasing durable state', () => {
    const persistence = createMemoryPersistence()
    const store = createPicodashStore({
      valueOwner: 'store',
      storeId: 'root-lifecycle-persistence',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    persistence.failNext('write')
    expect(store.setValues({ value: 2 })).toMatchObject({ ok: true, persistence: 'pending' })
    expect(() => store.destroy()).toThrowError(
      expect.objectContaining({ code: 'root-has-unpersisted-state' }),
    )
    const capability = store.persistence!
    store.destroy({ discardUnpersisted: true })
    expect(persistence.calls.some((call) => call.kind === 'remove')).toBe(false)
    expect(() => capability.getState()).toThrowError(/use-after-destroy/)
    const replacement = createPicodashStore({
      valueOwner: 'store',
      storeId: 'root-lifecycle-persistence',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    expect(replacement.getState().values.value).toBe(1)
    replacement.destroy()
  })

  it('keeps root destruction reentrant-safe during a write notification', () => {
    const store = makeStore()
    let malformed: PicodashContractError | undefined
    let reentrant: PicodashContractError | undefined
    store.subscribe(() => {
      try {
        store.destroy({ extra: true } as never)
      } catch (error) {
        malformed = error as PicodashContractError
      }
      try {
        store.destroy()
      } catch (error) {
        reentrant = error as PicodashContractError
      }
    })
    store.setValues({ value: 2 })
    expect(malformed?.code).toBe('invalid-destroy-options')
    expect(malformed?.context).toEqual({ reason: 'unknown-key' })
    expect(reentrant?.code).toBe('reentrant-write')
    expect(reentrant?.context).toEqual({})
    expect(store.getState().values.value).toBe(2)
    store.destroy()
  })

  it('makes root and scoped facades inert while preserving detached survivors', () => {
    const store = makeStore()
    const scoped = store.scope('scoped')
    expect(runtimeControllerFor(store as object)?.root).toBe(store)
    const snapshot = store.getState()
    const scopedSnapshot = scoped.getState()
    const rootMethodDescriptor = Object.getOwnPropertyDescriptor(store, 'getState')!
    const scopedMethodDescriptor = Object.getOwnPropertyDescriptor(scoped, 'getState')!
    const rootDescriptorMethod = rootMethodDescriptor.get!() as () => unknown
    const scopedDescriptorMethod = scopedMethodDescriptor.get!() as () => unknown
    const fields = store.fields
    const releasedProvider = acquireProviderLease(store)
    const releasedEntity = acquireEntityLease(scoped, {
      kind: 'dashList',
      host: releasedProvider,
    })
    const releaseProvider = releasedProvider.release.bind(releasedProvider)
    const releaseEntity = releasedEntity.release.bind(releasedEntity)
    releasedEntity.release()
    releasedProvider.release()
    let notifications = 0
    const unsubscribe = store.subscribe(() => notifications++)
    const scopedUnsubscribe = scoped.subscribe(() => undefined)
    /* eslint-disable @typescript-eslint/unbound-method */
    const rootMethods = [
      store.getState,
      store.subscribe,
      store.scope,
      store.setValue,
      store.setValueOrThrow,
      store.setValues,
      store.setValuesOrThrow,
      store.destroyScope,
      store.setDashPanelLayout,
      store.resetDashPanelLayout,
      store.setDashListRootOrder,
      store.removeDashListRootOrder,
      store.setDashListGroupOrder,
      store.removeDashListGroupOrder,
      store.setDashListCollapseOverride,
      store.removeDashListCollapseOverride,
      store.resetDashListMetadata,
      store.destroy,
    ]
    const scopedMethods = [
      scoped.getState,
      scoped.subscribe,
      scoped.scope,
      scoped.setValue,
      scoped.setValueOrThrow,
      scoped.setValues,
      scoped.setValuesOrThrow,
      scoped.destroyScope,
      scoped.setDashPanelLayout,
      scoped.resetDashPanelLayout,
      scoped.setDashListRootOrder,
      scoped.removeDashListRootOrder,
      scoped.setDashListGroupOrder,
      scoped.removeDashListGroupOrder,
      scoped.setDashListCollapseOverride,
      scoped.removeDashListCollapseOverride,
      scoped.resetDashListMetadata,
    ]
    /* eslint-enable @typescript-eslint/unbound-method */
    store.destroy()
    expect(notifications).toBe(0)
    expect(snapshot.values.value).toBe(1)
    expect(scopedSnapshot.values.value).toBe(1)
    expect(fields.value.key).toBe('value')
    unsubscribe()
    unsubscribe()
    scopedUnsubscribe()
    scopedUnsubscribe()
    releaseEntity()
    releaseProvider()
    for (const method of rootMethods)
      expectUseAfterDestroy(() => (method as (...args: never[]) => unknown)())
    for (const method of scopedMethods)
      expectUseAfterDestroy(() => (method as (...args: never[]) => unknown)())
    for (const read of [
      () => store.kind,
      () => store.fields,
      () => Reflect.get(store, 'getState'),
      () => scoped.kind,
      () => scoped.root,
      () => scoped.scopeId,
      () => scoped.fields,
    ])
      expectUseAfterDestroy(read)
    for (const reflect of [
      () => 'kind' in store,
      () => Object.keys(store),
      () => Reflect.ownKeys(store),
      () => Object.getOwnPropertyDescriptor(store, 'kind'),
      () => Object.getPrototypeOf(store),
      () => Reflect.set(store, 'kind', 'other'),
      () => Reflect.defineProperty(store, 'other', { value: true }),
      () => Reflect.deleteProperty(store, 'kind'),
      () => Reflect.setPrototypeOf(store, null),
      () => Object.preventExtensions(store),
      () => Object.isExtensible(store),
      () => 'kind' in scoped,
      () => Object.keys(scoped),
      () => Reflect.ownKeys(scoped),
      () => Object.getOwnPropertyDescriptor(scoped, 'kind'),
      () => Object.getPrototypeOf(scoped),
      () => Reflect.set(scoped, 'kind', 'other'),
      () => Reflect.defineProperty(scoped, 'other', { value: true }),
      () => Reflect.deleteProperty(scoped, 'kind'),
      () => Reflect.setPrototypeOf(scoped, null),
      () => Object.preventExtensions(scoped),
      () => Object.isExtensible(scoped),
    ])
      expectUseAfterDestroy(reflect)
    expectUseAfterDestroy(() => rootMethodDescriptor.get!())
    expectUseAfterDestroy(() => scopedMethodDescriptor.get!())
    expectUseAfterDestroy(rootDescriptorMethod)
    expectUseAfterDestroy(scopedDescriptorMethod)
    expectUseAfterDestroy(() => acquireProviderLease(store))
    expectUseAfterDestroy(() => acquireEntityLease(scoped, { kind: 'dashList' }))
    expectUseAfterDestroy(() => acquireEntityLease(scoped, null as never))
  })
})
