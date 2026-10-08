import { describe, expectTypeOf, it } from 'vite-plus/test'
import type {
  AcquireDashStackNodeOptions,
  DashStackNodeLease,
  DashStackPruneReview,
  InvalidDashStackNodeOptionsReason,
  InvalidPruneOptionsReason,
  PicodashDashStackPrunePlan,
  RootDashStackPruneOptions,
} from '../src/integration.ts'
import { acquireDashStackNodeLease } from '../src/integration.ts'
import { createPicodashNexus } from '../src/index.ts'

describe('DashStack node/prune Nexus types', () => {
  it('keeps node leases and prune plans nominal with literal overloads', () => {
    expectTypeOf<InvalidDashStackNodeOptionsReason>().toEqualTypeOf<
      'not-object' | 'unknown-key' | 'accessor-property' | 'invalid-node-id'
    >()
    expectTypeOf<AcquireDashStackNodeOptions>().toEqualTypeOf<{ readonly nodeId: string }>()
    expectTypeOf<DashStackNodeLease>().toHaveProperty('release').toBeFunction()
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
    expectTypeOf<RootDashStackPruneOptions>().toHaveProperty('scopeId').toBeString()

    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { value: { defaultValue: 1 } },
    })
    const scoped = nexus.scope('scope')
    const node = acquireDashStackNodeLease(scoped, { nodeId: 'node' })
    expectTypeOf(node).toEqualTypeOf<DashStackNodeLease>()
    const review = scoped.createPrunePlan({ mode: 'review' })
    expectTypeOf(review).toEqualTypeOf<DashStackPruneReview>()
    const plan = scoped.createPrunePlan({ mode: 'inventory', knownNodeIds: ['node'] })
    expectTypeOf(plan).toEqualTypeOf<PicodashDashStackPrunePlan>()
    expectTypeOf(
      nexus.createPrunePlan({ scopeId: 'scope', mode: 'review' }),
    ).toEqualTypeOf<DashStackPruneReview>()
    expectTypeOf(
      nexus.createPrunePlan({
        scopeId: 'scope',
        mode: 'explicit',
        removeNodeIds: [],
        keepNodeIds: [],
      }),
    ).toEqualTypeOf<PicodashDashStackPrunePlan>()
    node.release()
  })
})
