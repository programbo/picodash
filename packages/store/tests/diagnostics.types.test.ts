import { describe, expectTypeOf, it } from 'vite-plus/test'
import {
  createPicodashStore,
  type PicodashDiagnostic,
  type PicodashDiagnostics,
  type PicodashDiagnosticsState,
  type SubscriberExceptionDiagnostic,
  type SubscriberExceptionIdentity,
} from '../src/index.ts'

describe('Store diagnostics types', () => {
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

  it('exposes one root-wide diagnostics facade to root and scoped Stores', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const scoped = store.scope('scope')
    expectTypeOf(store.diagnostics).toEqualTypeOf<PicodashDiagnostics>()
    expectTypeOf(scoped.diagnostics).toEqualTypeOf<PicodashDiagnostics>()
    expectTypeOf(store.diagnostics.getState()).toEqualTypeOf<PicodashDiagnosticsState>()

    const typeOnly = () => false
    if (typeOnly()) {
      // @ts-expect-error Diagnostics do not expose mutable map methods.
      store.diagnostics.clear()
      // @ts-expect-error Diagnostics do not expose a legacy snapshot method.
      store.diagnostics.getSnapshot()
      // @ts-expect-error Diagnostics do not expose runtime inspection.
      store.diagnostics.inspectRuntime()
    }
  })
})
