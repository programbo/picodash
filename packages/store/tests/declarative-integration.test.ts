import { describe, expect, it } from 'vite-plus/test'
import { createPicodashStore, PicodashContractError } from '../src/index.ts'
import {
  createDeclarativeEntityToken,
  createDeclarativeIntegrationHost,
} from '../src/declarative-integration.ts'
import {
  acquireEntityLease,
  acquireProviderLease,
  acquireRelationshipLease,
} from '../src/integration.ts'

const makeStore = () =>
  createPicodashStore({
    valueOwner: 'store',
    fields: { value: { defaultValue: 1 } },
  })

const expectContract = (run: () => unknown, code: string) => {
  try {
    run()
    throw new Error('expected failure')
  } catch (error) {
    expect(error).toBeInstanceOf(PicodashContractError)
    expect((error as PicodashContractError).code).toBe(code)
  }
}

describe('package-private declarative Store integration host', () => {
  it('queues children before their parent and Provider, then activates parent-first', () => {
    const store = makeStore()
    const host = createDeclarativeIntegrationHost(store)
    const parent = createDeclarativeEntityToken()
    const child = createDeclarativeEntityToken()

    host.mountEntity({ token: child, store: store.scope('child'), kind: 'dashList', parent })
    host.mountProvider()
    host.mountEntity({ token: parent, store: store.scope('parent'), kind: 'dashPanel' })

    expect(() => store.destroy()).toThrow()
    host.unmountProvider()
    expect(() => store.destroy()).not.toThrow()
  })

  it('activates a nested subtree added while the host is active', () => {
    const store = makeStore()
    const host = createDeclarativeIntegrationHost(store)
    const parent = createDeclarativeEntityToken()
    const child = createDeclarativeEntityToken()
    host.mountProvider()
    host.mountEntity({ token: parent, store: store.scope('parent'), kind: 'dashPanel' })
    host.mountEntity({ token: child, store: store.scope('child'), kind: 'dashList', parent })
    host.unmountEntity(parent)
    host.unmountEntity(child)
    host.unmountEntity(child)
    host.unmountProvider()
    host.unmountProvider()
    expect(() => store.destroy()).not.toThrow()
  })

  it('uses the nearest entity host and omits same-scope relationships', () => {
    const store = makeStore()
    const host = createDeclarativeIntegrationHost(store)
    const panel = createDeclarativeEntityToken()
    const sameScopeList = createDeclarativeEntityToken()
    host.mountProvider()
    host.mountEntity({ token: panel, store: store.scope('shared'), kind: 'dashPanel' })
    host.mountEntity({
      token: sameScopeList,
      store: store.scope('shared'),
      kind: 'dashList',
      parent: panel,
    })
    host.unmountEntity(panel)
    host.unmountProvider()
    expect(() => store.destroy()).not.toThrow()
  })

  it('releases an active subtree deepest-first and makes descendant cleanup a no-op', () => {
    const store = makeStore()
    const host = createDeclarativeIntegrationHost(store)
    const parent = createDeclarativeEntityToken()
    const child = createDeclarativeEntityToken()
    const grandchild = createDeclarativeEntityToken()
    host.mountProvider()
    host.mountEntity({ token: parent, store: store.scope('parent'), kind: 'dashPanel' })
    host.mountEntity({ token: child, store: store.scope('child'), kind: 'dashList', parent })
    host.mountEntity({
      token: grandchild,
      store: store.scope('grandchild'),
      kind: 'dashPanel',
      parent: child,
    })
    host.unmountEntity(parent)
    host.unmountEntity(child)
    host.unmountProvider()
    expect(() => store.destroy()).not.toThrow()
  })

  it('reruns identity and graph checks after Strict Mode-style cleanup/setup', () => {
    const store = makeStore()
    const host = createDeclarativeIntegrationHost(store)
    const first = createDeclarativeEntityToken()
    host.mountEntity({ token: first, store: store.scope('strict'), kind: 'dashList' })
    host.mountProvider()
    host.unmountProvider()

    const second = createDeclarativeEntityToken()
    host.mountEntity({ token: second, store: store.scope('strict'), kind: 'dashList' })
    host.mountProvider()
    host.unmountProvider()
    expect(() => store.destroy()).not.toThrow()
  })

  it('rolls back duplicate entities and removes the failed active declaration', () => {
    const store = makeStore()
    const host = createDeclarativeIntegrationHost(store)
    const first = createDeclarativeEntityToken()
    const duplicate = createDeclarativeEntityToken()
    host.mountProvider()
    host.mountEntity({ token: first, store: store.scope('same'), kind: 'dashList' })
    expect(() =>
      host.mountEntity({ token: duplicate, store: store.scope('same'), kind: 'dashList' }),
    ).toThrowError(/duplicate-entity/)
    host.unmountProvider()
    expect(() => store.destroy()).not.toThrow()
  })

  it('rolls back foreign-root activation and releases the Provider lease', () => {
    const first = makeStore()
    const second = makeStore()
    const host = createDeclarativeIntegrationHost(first)
    host.mountEntity({
      token: createDeclarativeEntityToken(),
      store: second.scope('foreign'),
      kind: 'dashList',
    })
    expectContract(() => host.mountProvider(), 'invalid-integration-handle')
    expect(() => first.destroy()).not.toThrow()
    expect(() => second.destroy()).not.toThrow()
  })

  it('rolls back a relationship-parent conflict without stranding leases', () => {
    const store = makeStore()
    const host = createDeclarativeIntegrationHost(store)
    const firstParent = createDeclarativeEntityToken()
    const firstChild = createDeclarativeEntityToken()
    const secondParent = createDeclarativeEntityToken()
    const secondChild = createDeclarativeEntityToken()
    host.mountProvider()
    host.mountEntity({ token: firstParent, store: store.scope('first-parent'), kind: 'dashPanel' })
    host.mountEntity({
      token: firstChild,
      store: store.scope('child'),
      kind: 'dashList',
      parent: firstParent,
    })
    host.mountEntity({ token: secondParent, store: store.scope('second-parent'), kind: 'dashList' })
    expect(() =>
      host.mountEntity({
        token: secondChild,
        store: store.scope('child'),
        kind: 'dashPanel',
        parent: secondParent,
      }),
    ).toThrowError(/relationship-parent-conflict/)
    host.unmountProvider()
    expect(() => store.destroy()).not.toThrow()
  })

  it('does not activate parentless entities before the Provider and tolerates idempotent teardown', () => {
    const store = makeStore()
    const host = createDeclarativeIntegrationHost(store)
    const token = createDeclarativeEntityToken()
    host.mountEntity({ token, store: store.scope('queued'), kind: 'dashList' })
    expect(() => store.destroy()).not.toThrow()
  })

  it('surfaces Provider conflicts while leaving the failed host retryable', () => {
    const store = makeStore()
    const first = createDeclarativeIntegrationHost(store)
    const second = createDeclarativeIntegrationHost(store)
    second.mountEntity({
      token: createDeclarativeEntityToken(),
      store: store.scope('retry'),
      kind: 'dashList',
    })
    first.mountProvider()
    expectContract(() => second.mountProvider(), 'duplicate-provider')
    first.unmountProvider()
    second.mountProvider()
    second.unmountProvider()
    expect(() => store.destroy()).not.toThrow()
  })

  it('keeps the primitive integration surface usable after the internal move', () => {
    const store = makeStore()
    const provider = acquireProviderLease(store)
    const parent = acquireEntityLease(store.scope('parent'), { kind: 'dashPanel', host: provider })
    const child = acquireEntityLease(store.scope('child'), { kind: 'dashList', host: parent })
    const relationship = acquireRelationshipLease(parent, child)
    relationship.release()
    child.release()
    parent.release()
    provider.release()
    expect(() => store.destroy()).not.toThrow()
  })
})
