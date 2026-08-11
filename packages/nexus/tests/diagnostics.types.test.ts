import { describe, expectTypeOf, it } from 'vite-plus/test'
import {
  createPicodashNexus,
  type PicodashDiagnostic,
  type PicodashDiagnostics,
  type PicodashDiagnosticsState,
  type SubscriberExceptionDiagnostic,
  type SubscriberExceptionIdentity,
} from '../src/index.ts'

describe('Nexus diagnostics types', () => {
  it('publishes the immutable generic diagnostics contract', () => {
    expectTypeOf<PicodashDiagnostic>().toEqualTypeOf<{
      readonly code: string
      readonly severity: 'error' | 'warning'
      readonly message: string
      readonly identity: object
      readonly count: number
      readonly lastOccurrence: number
    }>()
    expectTypeOf<SubscriberExceptionIdentity>().toEqualTypeOf<{
      readonly kind: 'subscriber'
      readonly surface: 'root' | 'scope' | 'diagnostics' | 'capability'
      readonly scopeId?: string
      readonly capability?: string
    }>()
    expectTypeOf<SubscriberExceptionDiagnostic>().toEqualTypeOf<{
      readonly code: 'subscriber_exception'
      readonly severity: 'error'
      readonly message: string
      readonly identity: SubscriberExceptionIdentity
      readonly count: number
      readonly lastOccurrence: number
    }>()
    expectTypeOf<PicodashDiagnosticsState>().toEqualTypeOf<{
      readonly current: ReadonlyMap<string, PicodashDiagnostic>
    }>()
    expectTypeOf<PicodashDiagnostics>().toEqualTypeOf<{
      getState: () => PicodashDiagnosticsState
      subscribe: (listener: () => void) => () => void
    }>()
  })

  it('exposes one root-wide diagnostics facade to root and scoped Nexuses', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { value: { defaultValue: 1 } },
    })
    const scoped = nexus.scope('scope')
    expectTypeOf(nexus.diagnostics).toEqualTypeOf<PicodashDiagnostics>()
    expectTypeOf(scoped.diagnostics).toEqualTypeOf<PicodashDiagnostics>()
    expectTypeOf(nexus.diagnostics.getState()).toEqualTypeOf<PicodashDiagnosticsState>()

    const typeOnly = () => false
    if (typeOnly()) {
      // @ts-expect-error Diagnostics do not expose mutable map methods.
      nexus.diagnostics.clear()
      // @ts-expect-error Diagnostics do not expose a legacy snapshot method.
      nexus.diagnostics.getSnapshot()
      // @ts-expect-error Diagnostics do not expose runtime inspection.
      nexus.diagnostics.inspectRuntime()
    }
  })
})
