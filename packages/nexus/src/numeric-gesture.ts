import { clonePicodashValue, picodashJsonEqual } from './json.js'
import type { CoreTransactionResult, PicodashJsonValue } from './kernel/index.js'

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
export type ValueGestureEnd<Value extends PicodashJsonValue = PicodashJsonValue> = Readonly<{
  outcome: 'committed' | 'cancelled'
  reason: 'commit' | NumericGestureCancelReason
  initialValue: Value
  finalValue: Value | null
  changed: boolean
  rollback: 'unnecessary' | 'applied' | 'rejected' | 'superseded'
}>
export type ValueGestureOptions<Value extends PicodashJsonValue = PicodashJsonValue> = {
  readonly onEnd?: (event: ValueGestureEnd<Value>) => void
}
export interface ValueGesture<
  Value extends PicodashJsonValue = PicodashJsonValue,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  readonly active: boolean
  begin(): boolean
  update(value: Value): Result
  commit(): ValueGestureEnd<Value> | undefined
  cancel(reason?: NumericGestureCancelReason): ValueGestureEnd<Value> | undefined
  release(): void
}
export type NumericGestureEnd = ValueGestureEnd<number>
export type NumericGestureOptions = ValueGestureOptions<number>
export type NumericGesture<Result extends CoreTransactionResult = CoreTransactionResult> =
  ValueGesture<number, Result>

/** Kernel-private port: revisions and privileged teardown writes never escape Nexus. */
export function createValueGestureController<
  Value extends PicodashJsonValue,
  Result extends CoreTransactionResult,
>(
  port: {
    read(): { value: Value; revision: number; input: unknown }
    assertAvailable(): void
    assertInitial(): void
    fail(): never
    write(value: Value): Result
    restore(value: Value, locked: boolean): Result
    clearDraft(): void
    detach(): void
  },
  options: ValueGestureOptions<Value>,
) {
  let state: { initialValue: Value; revision: number; input: unknown; touched: boolean } | undefined
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
    let rollback: ValueGestureEnd<Value>['rollback'] = 'unnecessary'
    const current = port.read()
    if (current.revision !== previous.revision || current.input !== previous.input) {
      reason = 'external-write'
      rollback = 'superseded'
    } else if (reason !== 'commit') {
      if (!picodashJsonEqual(current.value, previous.initialValue)) {
        const result = port.restore(previous.initialValue, locked)
        rollback = result.ok ? 'applied' : 'rejected'
      }
      if (previous.touched) port.clearDraft()
    }
    const finalValue = port.read().value
    const event: ValueGestureEnd<Value> = Object.freeze({
      outcome: reason === 'commit' ? 'committed' : 'cancelled',
      reason,
      initialValue: previous.initialValue,
      finalValue,
      changed: !picodashJsonEqual(finalValue, previous.initialValue),
      rollback,
    })
    // End callbacks run after the transaction lock and subscriber dispatch unwind.
    if (options.onEnd) queueMicrotask(() => options.onEnd?.(event))
    return event
  }
  const gesture: ValueGesture<Value, Result> = Object.freeze({
    get active() {
      return !!state
    },
    begin() {
      available()
      if (state) return false
      port.assertInitial()
      const current = port.read()
      state = {
        initialValue: current.value,
        revision: current.revision,
        input: current.input,
        touched: false,
      }
      return true
    },
    update(value: Value) {
      available()
      if (!state) port.fail()
      clonePicodashValue(value)
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
