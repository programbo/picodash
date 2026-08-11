import { describe, expect, it } from 'vite-plus/test'
import {
  acquireEntityLease,
  acquireProviderLease,
  acquireRelationshipLease,
} from '../src/integration.ts'
import { createPicodashNexus, PicodashContractError } from '../src/index.ts'
import { registerRuntimeResource, runtimeControllerFor } from '../src/runtime-controller.ts'
import { createMemoryPersistence } from './support/memory-persistence.js'

const makeNexus = () =>
  createPicodashNexus({
    valueOwner: 'nexus',
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

describe('Nexus root destruction', () => {
  it('validates exact options privately and refuses in contract order', () => {
    const nexus = makeNexus()
    let discarded = false
    registerRuntimeResource(nexus, {
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
      const error = failure(() => nexus.destroy(options as never))
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
    expect(failure(() => nexus.destroy(accessor as never)).context).toEqual({
      reason: 'accessor-property',
    })
    expect(invoked).toBe(false)
    const provider = acquireProviderLease(nexus)
    expect(failure(() => nexus.destroy()).code).toBe('root-has-active-leases')
    expect(failure(() => nexus.destroy({ discardUnpersisted: true })).code).toBe(
      'root-has-active-leases',
    )
    expect(failure(() => nexus.destroy({ discardUnpersisted: 'yes' } as never)).code).toBe(
      'invalid-destroy-options',
    )
    provider.release()
    expect(failure(() => nexus.destroy()).code).toBe('root-has-unpersisted-state')
    nexus.destroy({ discardUnpersisted: true })
    expect(discarded).toBe(true)
    expect(failure(() => nexus.destroy()).code).toBe('use-after-destroy')
  })

  it('holds the write lock while root destroy options are reflected', () => {
    const nexus = makeNexus()
    let nestedCode: string | undefined
    const options = new Proxy(
      { discardUnpersisted: true as const },
      {
        ownKeys(target) {
          try {
            nexus.setValue(nexus.fields.value, 2)
          } catch (error) {
            nestedCode = (error as PicodashContractError).code
          }
          return Reflect.ownKeys(target)
        },
      },
    )

    nexus.destroy(options)
    expect(nestedCode).toBe('reentrant-write')
  })

  it('refuses every active lease kind before pending-state checks', () => {
    const providerNexus = makeNexus()
    const provider = acquireProviderLease(providerNexus)
    expect(failure(() => providerNexus.destroy()).code).toBe('root-has-active-leases')
    provider.release()

    const entityNexus = makeNexus()
    const entityProvider = acquireProviderLease(entityNexus)
    const entity = acquireEntityLease(entityNexus.scope('entity'), {
      kind: 'dashList',
      host: entityProvider,
    })
    expect(failure(() => entityNexus.destroy()).code).toBe('root-has-active-leases')
    entity.release()
    entityProvider.release()

    const relationshipNexus = makeNexus()
    const relationshipProvider = acquireProviderLease(relationshipNexus)
    const parent = acquireEntityLease(relationshipNexus.scope('parent'), {
      kind: 'dashList',
      host: relationshipProvider,
    })
    const child = acquireEntityLease(relationshipNexus.scope('child'), {
      kind: 'dashList',
      host: relationshipProvider,
    })
    const relationship = acquireRelationshipLease(parent, child)
    expect(failure(() => relationshipNexus.destroy()).code).toBe('root-has-active-leases')
    relationship.release()
    child.release()
    parent.release()
    relationshipProvider.release()
    relationshipNexus.destroy()
    entityNexus.destroy()
    providerNexus.destroy()
  })

  it('tears down capability resources before kernel resources exactly once', () => {
    const nexus = makeNexus()
    const events: string[] = []
    let capabilityCalls = 0
    const unregister = registerRuntimeResource(nexus, {
      phase: 'capability',
      teardown: () => {
        capabilityCalls += 1
        events.push('capability')
      },
    })
    unregister()
    unregister()
    registerRuntimeResource(nexus, {
      phase: 'capability',
      teardown: () => events.push('capability-2'),
    })
    registerRuntimeResource(nexus, {
      phase: 'kernel',
      teardown: () => events.push('kernel'),
    })
    nexus.destroy({ discardUnpersisted: true })
    expect(capabilityCalls).toBe(0)
    expect(events).toEqual(['capability-2', 'kernel'])
    expect(failure(() => nexus.getState()).code).toBe('use-after-destroy')
  })

  it('tears down persistence ownership without erasing durable state', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'root-lifecycle-persistence',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    persistence.failNext('write')
    expect(nexus.setValues({ value: 2 })).toMatchObject({ ok: true, persistence: 'pending' })
    expect(() => nexus.destroy()).toThrowError(
      expect.objectContaining({ code: 'root-has-unpersisted-state' }),
    )
    const capability = nexus.persistence!
    nexus.destroy({ discardUnpersisted: true })
    expect(persistence.calls.some((call) => call.kind === 'remove')).toBe(false)
    expect(() => capability.getState()).toThrowError(/use-after-destroy/)
    const replacement = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'root-lifecycle-persistence',
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

  it('guards cached root and scoped capability objects after destruction', () => {
    const persistence = createMemoryPersistence()
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'root-lifecycle-capabilities',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      export: { documents: { defaultFieldPolicy: 'include' } },
      persistence: {
        storageKey: 'state',
        driver: persistence,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    const scoped = nexus.scope('scope')
    expect(nexus.persistence).toBe(scoped.persistence)
    expect(nexus.metadataRecovery).toBe(scoped.metadataRecovery)
    const capabilities = [
      nexus.documents,
      scoped.documents,
      nexus.persistence,
      nexus.metadataRecovery,
      nexus.diagnostics,
    ].map((capability) => ({ capability, property: Reflect.ownKeys(capability)[0]! }))

    nexus.destroy()
    for (const { capability, property } of capabilities) {
      expect(() => Object.keys(capability)).toThrowError(/use-after-destroy/)
      expect(() => Reflect.get(capability, property)).toThrowError(/use-after-destroy/)
    }
  })

  it('keeps root destruction reentrant-safe during a write notification', () => {
    const nexus = makeNexus()
    let malformed: PicodashContractError | undefined
    let reentrant: PicodashContractError | undefined
    nexus.subscribe(() => {
      try {
        nexus.destroy({ extra: true } as never)
      } catch (error) {
        malformed = error as PicodashContractError
      }
      try {
        nexus.destroy()
      } catch (error) {
        reentrant = error as PicodashContractError
      }
    })
    nexus.setValues({ value: 2 })
    expect(malformed?.code).toBe('invalid-destroy-options')
    expect(malformed?.context).toEqual({ reason: 'unknown-key' })
    expect(reentrant?.code).toBe('reentrant-write')
    expect(reentrant?.context).toEqual({})
    expect(nexus.getState().values.value).toBe(2)
    nexus.destroy()
  })

  it('makes root and scoped facades inert while preserving detached survivors', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('scoped')
    expect(runtimeControllerFor(nexus as object)?.root).toBe(nexus)
    const snapshot = nexus.getState()
    const scopedSnapshot = scoped.getState()
    const rootMethodDescriptor = Object.getOwnPropertyDescriptor(nexus, 'getState')!
    const scopedMethodDescriptor = Object.getOwnPropertyDescriptor(scoped, 'getState')!
    const rootDescriptorMethod = rootMethodDescriptor.get!() as () => unknown
    const scopedDescriptorMethod = scopedMethodDescriptor.get!() as () => unknown
    const fields = nexus.fields
    const releasedProvider = acquireProviderLease(nexus)
    const releasedEntity = acquireEntityLease(scoped, {
      kind: 'dashList',
      host: releasedProvider,
    })
    const releaseProvider = releasedProvider.release.bind(releasedProvider)
    const releaseEntity = releasedEntity.release.bind(releasedEntity)
    releasedEntity.release()
    releasedProvider.release()
    let notifications = 0
    const unsubscribe = nexus.subscribe(() => notifications++)
    const scopedUnsubscribe = scoped.subscribe(() => undefined)
    /* eslint-disable @typescript-eslint/unbound-method */
    const rootMethods = [
      nexus.getState,
      nexus.subscribe,
      nexus.scope,
      nexus.setValue,
      nexus.setValueOrThrow,
      nexus.setValues,
      nexus.setValuesOrThrow,
      nexus.inspectRegisteredValueReset,
      nexus.destroyScope,
      nexus.setDashPanelLayout,
      nexus.resetDashPanelLayout,
      nexus.setDashListRootOrder,
      nexus.removeDashListRootOrder,
      nexus.setDashListGroupOrder,
      nexus.removeDashListGroupOrder,
      nexus.setDashListCollapseOverride,
      nexus.removeDashListCollapseOverride,
      nexus.updateDashListCollapseOverrides,
      nexus.resetDashListMetadata,
      nexus.destroy,
    ]
    const scopedMethods = [
      scoped.getState,
      scoped.subscribe,
      scoped.scope,
      scoped.setValue,
      scoped.setValueOrThrow,
      scoped.setValues,
      scoped.setValuesOrThrow,
      scoped.inspectRegisteredValueReset,
      scoped.destroyScope,
      scoped.setDashPanelLayout,
      scoped.resetDashPanelLayout,
      scoped.setDashListRootOrder,
      scoped.removeDashListRootOrder,
      scoped.setDashListGroupOrder,
      scoped.removeDashListGroupOrder,
      scoped.setDashListCollapseOverride,
      scoped.removeDashListCollapseOverride,
      scoped.updateDashListCollapseOverrides,
      scoped.resetDashListMetadata,
    ]
    /* eslint-enable @typescript-eslint/unbound-method */
    nexus.destroy()
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
      () => nexus.kind,
      () => nexus.fields,
      () => Reflect.get(nexus, 'getState'),
      () => scoped.kind,
      () => scoped.root,
      () => scoped.scopeId,
      () => scoped.fields,
    ])
      expectUseAfterDestroy(read)
    for (const reflect of [
      () => 'kind' in nexus,
      () => Object.keys(nexus),
      () => Reflect.ownKeys(nexus),
      () => Object.getOwnPropertyDescriptor(nexus, 'kind'),
      () => Object.getPrototypeOf(nexus),
      () => Reflect.set(nexus, 'kind', 'other'),
      () => Reflect.defineProperty(nexus, 'other', { value: true }),
      () => Reflect.deleteProperty(nexus, 'kind'),
      () => Reflect.setPrototypeOf(nexus, null),
      () => Object.preventExtensions(nexus),
      () => Object.isExtensible(nexus),
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
    expectUseAfterDestroy(() => acquireProviderLease(nexus))
    expectUseAfterDestroy(() => acquireEntityLease(scoped, { kind: 'dashList' }))
    expectUseAfterDestroy(() => acquireEntityLease(scoped, null as never))
  })
})
