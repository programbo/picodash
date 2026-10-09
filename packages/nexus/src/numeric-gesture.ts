import type { CoreTransactionResult } from './kernel/index.js'

export type NumericGestureCancelReason =
  | 'escape'
  | 'capture-lost'
  | 'hidden'
  | 'removed'
  | 'scale-changed'
  | 'external-write'
  | 'released'
  | 'destroyed'
  | 'cancelled'
export type NumericGestureEnd = Readonly<{
  outcome: 'committed' | 'cancelled'
  reason: 'commit' | NumericGestureCancelReason
  initialValue: number
  finalValue: number | null
  changed: boolean
  rollback: 'unnecessary' | 'applied' | 'rejected' | 'superseded'
}>
export type NumericGestureOptions = { readonly onEnd?: (event: NumericGestureEnd) => void }
export interface NumericGesture<Result extends CoreTransactionResult = CoreTransactionResult> {
  readonly active: boolean
  begin(): boolean
  update(value: number): Result
  commit(): NumericGestureEnd | undefined
  cancel(reason?: NumericGestureCancelReason): NumericGestureEnd | undefined
  release(): void
}

/** Kernel-private port: revisions and privileged teardown writes never escape Nexus. */
export function createNumericGestureController<Result extends CoreTransactionResult>(
  port: {
    read(): { value: number | null; revision: number; input: unknown }
    assertAvailable(): void
    fail(): never
    write(value: number): Result
    restore(value: number, locked: boolean): Result
    clearDraft(): void
    detach(): void
  },
  options: NumericGestureOptions,
) {
  let state:
    | { initialValue: number; revision: number; input: unknown; touched: boolean }
    | undefined
  let updating = false
  let released = false
  function available() {
    port.assertAvailable()
    if (released) port.fail()
  }
  function finish(reason: 'commit' | NumericGestureCancelReason, locked = false) {
    if (!state) return undefined
    const previous = state
    state = undefined
    let rollback: NumericGestureEnd['rollback'] = 'unnecessary'
    const current = port.read()
    if (current.revision !== previous.revision || current.input !== previous.input) {
      reason = 'external-write'
      rollback = 'superseded'
    } else if (reason !== 'commit') {
      if (current.value !== previous.initialValue) {
        const result = port.restore(previous.initialValue, locked)
        rollback = result.ok ? 'applied' : 'rejected'
      }
      if (previous.touched) port.clearDraft()
    }
    const finalValue = port.read().value
    const event: NumericGestureEnd = Object.freeze({
      outcome: reason === 'commit' ? 'committed' : 'cancelled',
      reason,
      initialValue: previous.initialValue,
      finalValue,
      changed: finalValue !== previous.initialValue,
      rollback,
    })
    // End callbacks run after the transaction lock and subscriber dispatch unwind.
    if (options.onEnd) queueMicrotask(() => options.onEnd?.(event))
    return event
  }
  const gesture: NumericGesture<Result> = Object.freeze({
    get active() {
      return !!state
    },
    begin() {
      available()
      if (state) return false
      const current = port.read()
      if (current.value === null) port.fail()
      state = {
        initialValue: current.value,
        revision: current.revision,
        input: current.input,
        touched: false,
      }
      return true
    },
    update(value: number) {
      available()
      if (!state) port.fail()
      if (!Number.isFinite(value)) port.fail()
      updating = true
      try {
        const result = port.write(value)
        if (state) {
          const current = port.read()
          state.revision = current.revision
          state.input = current.input
          state.touched = true
        }
        return result
      } finally {
        updating = false
      }
    },
    commit() {
      available()
      return finish('commit')
    },
    cancel(reason: NumericGestureCancelReason = 'cancelled') {
      available()
      return finish(reason)
    },
    release() {
      if (released) return
      available()
      finish('released')
      released = true
      port.detach()
    },
  })
  return {
    gesture,
    changed() {
      if (!state || updating) return
      const current = port.read()
      if (current.revision !== state.revision || current.input !== state.input)
        finish('external-write')
    },
    teardown(reason: NumericGestureCancelReason) {
      finish(reason, true)
      released = true
      port.detach()
    },
  }
}
