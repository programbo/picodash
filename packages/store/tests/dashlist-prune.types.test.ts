import { describe, expectTypeOf, it } from 'vite-plus/test'
import type {
  AcquireDashListNodeOptions,
  DashListNodeLease,
  DashListPruneReview,
  InvalidDashListNodeOptionsReason,
  InvalidPruneOptionsReason,
  PicodashDashListPrunePlan,
  RootDashListPruneOptions,
} from '../src/integration.ts'
import { acquireDashListNodeLease } from '../src/integration.ts'
import { createPicodashStore } from '../src/index.ts'

describe('DashList node/prune Store types', () => {
  it('keeps node leases and prune plans nominal with literal overloads', () => {
    expectTypeOf<InvalidDashListNodeOptionsReason>().toEqualTypeOf<
      'not-object' | 'unknown-key' | 'accessor-property' | 'invalid-node-id'
    >()
    expectTypeOf<AcquireDashListNodeOptions>().toEqualTypeOf<{ readonly nodeId: string }>()
    expectTypeOf<DashListNodeLease>().toHaveProperty('release').toBeFunction()
    expectTypeOf<InvalidPruneOptionsReason>().toEqualTypeOf<
      | 'not-object'
      | 'unknown-key'
      | 'accessor-property'
      | 'invalid-mode'
      | 'invalid-node-ids'
      | 'duplicate-node-id'
      | 'overlapping-node-id'
      | 'unknown-candidate'
      | 'incomplete-candidate-partition'
      | 'missing-active-node'
    >()
    expectTypeOf<RootDashListPruneOptions>().toHaveProperty('scopeId').toBeString()

    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const scoped = store.scope('scope')
    const node = acquireDashListNodeLease(scoped, { nodeId: 'node' })
    expectTypeOf(node).toEqualTypeOf<DashListNodeLease>()
    const review = scoped.createPrunePlan({ mode: 'review' })
    expectTypeOf(review).toEqualTypeOf<DashListPruneReview>()
    const plan = scoped.createPrunePlan({ mode: 'inventory', knownNodeIds: ['node'] })
    expectTypeOf(plan).toEqualTypeOf<PicodashDashListPrunePlan>()
    expectTypeOf(
      store.createPrunePlan({ scopeId: 'scope', mode: 'review' }),
    ).toEqualTypeOf<DashListPruneReview>()
    expectTypeOf(
      store.createPrunePlan({
        scopeId: 'scope',
        mode: 'explicit',
        removeNodeIds: [],
        keepNodeIds: [],
      }),
    ).toEqualTypeOf<PicodashDashListPrunePlan>()
    node.release()
  })
})
