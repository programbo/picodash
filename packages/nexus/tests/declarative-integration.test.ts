import { describe, expect, it } from 'vite-plus/test'
import { createPicodashNexus, PicodashContractError } from '../src/index.ts'
import {
  createDeclarativeEntityToken,
  createDeclarativeIntegrationHost,
  createDeclarativeStandaloneIntegrationHost,
} from '../src/declarative-integration.ts'
import {
  acquireEntityLease,
  acquireProviderLease,
  acquireRelationshipLease,
} from '../src/integration.ts'

const makeNexus = () =>
  createPicodashNexus({
    valueOwner: 'nexus',
    fields: { value: { defaultValue: 1 } },
  })

const expectContract = (run: () => unknown, code: string, context?: Record<string, string>) => {
  try {
    run()
    throw new Error('expected failure')
  } catch (error) {
    expect(error).toBeInstanceOf(PicodashContractError)
    expect((error as PicodashContractError).code).toBe(code)
    if (context) expect((error as PicodashContractError).context).toEqual(context)
  }
}

describe('package-private declarative Nexus integration host', () => {
  it('queues standalone descendants before root mount and activates parent-first', () => {
    const nexus = makeNexus()
    const host = createDeclarativeStandaloneIntegrationHost(nexus)
    const root = createDeclarativeEntityToken()
    const child = createDeclarativeEntityToken()
    host.mountEntity({ token: child, nexus: nexus.scope('child'), kind: 'dashList', parent: root })
    host.mountRoot({ token: root, nexus: nexus.scope('root'), kind: 'dashList' })
    expect(() => nexus.destroy()).toThrow()
    host.unmountRoot(root)
    host.unmountEntity(child)
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('creates a relationship for a different-scope standalone descendant', () => {
    const nexus = makeNexus()
    const host = createDeclarativeStandaloneIntegrationHost(nexus)
    const root = createDeclarativeEntityToken()
    const child = createDeclarativeEntityToken()
    host.mountEntity({ token: child, nexus: nexus.scope('child'), kind: 'dashList', parent: root })
    host.mountRoot({ token: root, nexus: nexus.scope('root'), kind: 'dashList' })
    host.unmountRoot(root)
    host.unmountEntity(child)
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rejects a same-scope nested standalone DashList as a duplicate entity', () => {
    const nexus = makeNexus()
    const host = createDeclarativeStandaloneIntegrationHost(nexus)
    const root = createDeclarativeEntityToken()
    const child = createDeclarativeEntityToken()
    host.mountEntity({ token: child, nexus: nexus.scope('same'), kind: 'dashList', parent: root })
    expectContract(
      () => host.mountRoot({ token: root, nexus: nexus.scope('same'), kind: 'dashList' }),
      'duplicate-entity',
      { scopeId: 'same', entityKind: 'dashList' },
    )
    host.unmountRoot(root)
    host.unmountEntity(child)
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rejects a direct DashPanel child of the standalone DashList host', () => {
    const nexus = makeNexus()
    const host = createDeclarativeStandaloneIntegrationHost(nexus)
    const root = createDeclarativeEntityToken()
    const child = createDeclarativeEntityToken()
    host.mountEntity({ token: child, nexus: nexus.scope('panel'), kind: 'dashPanel', parent: root })
    expectContract(
      () => host.mountRoot({ token: root, nexus: nexus.scope('root'), kind: 'dashList' }),
      'invalid-integration-handle',
      { role: 'host', reason: 'wrong-kind' },
    )
    host.unmountRoot(root)
    host.unmountEntity(child)
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rolls back a failed standalone root activation and allows retry', () => {
    const first = makeNexus()
    const second = makeNexus()
    const host = createDeclarativeStandaloneIntegrationHost(first)
    const root = createDeclarativeEntityToken()
    const child = createDeclarativeEntityToken()
    host.mountEntity({
      token: child,
      nexus: second.scope('foreign'),
      kind: 'dashList',
      parent: root,
    })
    expectContract(
      () => host.mountRoot({ token: root, nexus: first.scope('root'), kind: 'dashList' }),
      'invalid-integration-handle',
      { role: 'host', reason: 'foreign-root' },
    )
    host.unmountEntity(child)
    host.mountRoot({ token: root, nexus: first.scope('root'), kind: 'dashList' })
    host.unmountRoot(root)
    expect(() => first.destroy()).not.toThrow()
    expect(() => second.destroy()).not.toThrow()
  })

  it('queues children before their parent and Provider, then activates parent-first', () => {
    const nexus = makeNexus()
    const host = createDeclarativeIntegrationHost(nexus)
    const parent = createDeclarativeEntityToken()
    const child = createDeclarativeEntityToken()

    host.mountEntity({ token: child, nexus: nexus.scope('child'), kind: 'dashList', parent })
    host.mountProvider()
    host.mountEntity({ token: parent, nexus: nexus.scope('parent'), kind: 'dashPanel' })

    expect(() => nexus.destroy()).toThrow()
    host.unmountProvider()
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('activates a nested subtree added while the host is active', () => {
    const nexus = makeNexus()
    const host = createDeclarativeIntegrationHost(nexus)
    const parent = createDeclarativeEntityToken()
    const child = createDeclarativeEntityToken()
    host.mountProvider()
    host.mountEntity({ token: parent, nexus: nexus.scope('parent'), kind: 'dashPanel' })
    host.mountEntity({ token: child, nexus: nexus.scope('child'), kind: 'dashList', parent })
    host.unmountEntity(parent)
    host.unmountEntity(child)
    host.unmountEntity(child)
    host.unmountProvider()
    host.unmountProvider()
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('uses the nearest entity host and omits same-scope relationships', () => {
    const nexus = makeNexus()
    const host = createDeclarativeIntegrationHost(nexus)
    const panel = createDeclarativeEntityToken()
    const sameScopeList = createDeclarativeEntityToken()
    host.mountProvider()
    host.mountEntity({ token: panel, nexus: nexus.scope('shared'), kind: 'dashPanel' })
    host.mountEntity({
      token: sameScopeList,
      nexus: nexus.scope('shared'),
      kind: 'dashList',
      parent: panel,
    })
    host.unmountEntity(panel)
    host.unmountProvider()
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('releases an active subtree deepest-first and makes descendant cleanup a no-op', () => {
    const nexus = makeNexus()
    const host = createDeclarativeIntegrationHost(nexus)
    const parent = createDeclarativeEntityToken()
    const child = createDeclarativeEntityToken()
    const grandchild = createDeclarativeEntityToken()
    host.mountProvider()
    host.mountEntity({ token: parent, nexus: nexus.scope('parent'), kind: 'dashPanel' })
    host.mountEntity({ token: child, nexus: nexus.scope('child'), kind: 'dashList', parent })
    host.mountEntity({
      token: grandchild,
      nexus: nexus.scope('grandchild'),
      kind: 'dashPanel',
      parent: child,
    })
    host.unmountEntity(parent)
    host.unmountEntity(child)
    host.unmountProvider()
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('reruns identity and graph checks after Strict Mode-style cleanup/setup', () => {
    const nexus = makeNexus()
    const host = createDeclarativeIntegrationHost(nexus)
    const first = createDeclarativeEntityToken()
    host.mountEntity({ token: first, nexus: nexus.scope('strict'), kind: 'dashList' })
    host.mountProvider()
    host.unmountProvider()

    const second = createDeclarativeEntityToken()
    host.mountEntity({ token: second, nexus: nexus.scope('strict'), kind: 'dashList' })
    host.mountProvider()
    host.unmountProvider()
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rolls back duplicate entities and removes the failed active declaration', () => {
    const nexus = makeNexus()
    const host = createDeclarativeIntegrationHost(nexus)
    const first = createDeclarativeEntityToken()
    const duplicate = createDeclarativeEntityToken()
    host.mountProvider()
    host.mountEntity({ token: first, nexus: nexus.scope('same'), kind: 'dashList' })
    expect(() =>
      host.mountEntity({ token: duplicate, nexus: nexus.scope('same'), kind: 'dashList' }),
    ).toThrowError(/duplicate-entity/)
    host.unmountProvider()
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rolls back foreign-root activation and releases the Provider lease', () => {
    const first = makeNexus()
    const second = makeNexus()
    const host = createDeclarativeIntegrationHost(first)
    host.mountEntity({
      token: createDeclarativeEntityToken(),
      nexus: second.scope('foreign'),
      kind: 'dashList',
    })
    expectContract(() => host.mountProvider(), 'invalid-integration-handle')
    expect(() => first.destroy()).not.toThrow()
    expect(() => second.destroy()).not.toThrow()
  })

  it('rolls back a relationship-parent conflict without stranding leases', () => {
    const nexus = makeNexus()
    const host = createDeclarativeIntegrationHost(nexus)
    const firstParent = createDeclarativeEntityToken()
    const firstChild = createDeclarativeEntityToken()
    const secondParent = createDeclarativeEntityToken()
    const secondChild = createDeclarativeEntityToken()
    host.mountProvider()
    host.mountEntity({ token: firstParent, nexus: nexus.scope('first-parent'), kind: 'dashPanel' })
    host.mountEntity({
      token: firstChild,
      nexus: nexus.scope('child'),
      kind: 'dashList',
      parent: firstParent,
    })
    host.mountEntity({ token: secondParent, nexus: nexus.scope('second-parent'), kind: 'dashList' })
    expect(() =>
      host.mountEntity({
        token: secondChild,
        nexus: nexus.scope('child'),
        kind: 'dashPanel',
        parent: secondParent,
      }),
    ).toThrowError(/relationship-parent-conflict/)
    host.unmountProvider()
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('does not activate parentless entities before the Provider and tolerates idempotent teardown', () => {
    const nexus = makeNexus()
    const host = createDeclarativeIntegrationHost(nexus)
    const token = createDeclarativeEntityToken()
    host.mountEntity({ token, nexus: nexus.scope('queued'), kind: 'dashList' })
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('surfaces Provider conflicts while leaving the failed host retryable', () => {
    const nexus = makeNexus()
    const first = createDeclarativeIntegrationHost(nexus)
    const second = createDeclarativeIntegrationHost(nexus)
    second.mountEntity({
      token: createDeclarativeEntityToken(),
      nexus: nexus.scope('retry'),
      kind: 'dashList',
    })
    first.mountProvider()
    expectContract(() => second.mountProvider(), 'duplicate-provider')
    first.unmountProvider()
    second.mountProvider()
    second.unmountProvider()
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('keeps the primitive integration surface usable after the internal move', () => {
    const nexus = makeNexus()
    const provider = acquireProviderLease(nexus)
    const parent = acquireEntityLease(nexus.scope('parent'), { kind: 'dashPanel', host: provider })
    const child = acquireEntityLease(nexus.scope('child'), { kind: 'dashList', host: parent })
    const relationship = acquireRelationshipLease(parent, child)
    relationship.release()
    child.release()
    parent.release()
    provider.release()
    expect(() => nexus.destroy()).not.toThrow()
  })
})
