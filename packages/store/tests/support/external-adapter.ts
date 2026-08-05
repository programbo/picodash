import { clonePicodashValue } from '../../src/json.js'
import type { PicodashJsonValue } from '../../src/types.js'

export type ExternalAdapterWriteMode =
  | 'commit'
  | 'throw-before-mutation'
  | 'defer-visibility'
  | 'commit-mismatch'

export interface ExternalAdapterWriteRecord {
  readonly payload: unknown
  readonly context?: unknown
  readonly mode: ExternalAdapterWriteMode
  readonly visible: boolean
}

export interface ExternalAdapterHarness {
  readonly getSnapshot: () => unknown
  readonly setValues: (nextValues: unknown, context?: unknown) => void
  readonly subscribe: (listener: () => void) => () => void
  readonly replaceSnapshot: (snapshot: unknown) => void
  readonly failReads: (count?: number) => void
  readonly nextWrite: (mode: ExternalAdapterWriteMode, mismatchSnapshot?: unknown) => void
  readonly revealDeferredWrite: () => void
  readonly writes: readonly ExternalAdapterWriteRecord[]
}

interface PendingWrite {
  readonly mode: ExternalAdapterWriteMode
  readonly mismatchProvided: boolean
  readonly mismatchSnapshot?: unknown
}

export function createExternalAdapter(initialSnapshot: unknown): ExternalAdapterHarness {
  let snapshot = capture(initialSnapshot)
  let readFailures = 0
  let pendingMode: PendingWrite = { mode: 'commit', mismatchProvided: false }
  let deferred: { readonly value: unknown } | undefined
  const listeners = new Set<() => void>()
  const writeRecords: ExternalAdapterWriteRecord[] = []

  const harness: ExternalAdapterHarness = {
    getSnapshot() {
      if (readFailures > 0) {
        readFailures -= 1
        throw new Error('external adapter read failed')
      }
      return snapshot
    },
    setValues(nextValues, context) {
      const operation = pendingMode
      pendingMode = { mode: 'commit', mismatchProvided: false }
      const payload = capture(nextValues)
      const detachedContext = context === undefined ? undefined : capture(context)
      if (operation.mode === 'throw-before-mutation') {
        writeRecords.push(
          Object.freeze({
            payload,
            context: detachedContext,
            mode: operation.mode,
            visible: false,
          }),
        )
        throw new Error('external adapter write failed before mutation')
      }
      if (operation.mode === 'defer-visibility') {
        deferred = { value: payload }
        writeRecords.push(
          Object.freeze({
            payload,
            context: detachedContext,
            mode: operation.mode,
            visible: false,
          }),
        )
        return
      }
      const committed =
        operation.mode === 'commit-mismatch'
          ? capture(
              operation.mismatchProvided ? operation.mismatchSnapshot : mismatchSnapshot(payload),
            )
          : payload
      snapshot = committed
      writeRecords.push(
        Object.freeze({ payload, context: detachedContext, mode: operation.mode, visible: true }),
      )
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      let active = true
      return () => {
        if (!active) return
        active = false
        listeners.delete(listener)
      }
    },
    replaceSnapshot(nextSnapshot) {
      snapshot = capture(nextSnapshot)
      notify()
    },
    failReads(count = 1) {
      if (!Number.isInteger(count) || count < 0)
        throw new RangeError('read failure count must be non-negative')
      readFailures += count
    },
    nextWrite(mode, mismatchSnapshot) {
      pendingMode = {
        mode,
        mismatchProvided: arguments.length >= 2,
        mismatchSnapshot,
      }
    },
    revealDeferredWrite() {
      if (deferred === undefined) return
      snapshot = deferred.value
      deferred = undefined
      notify()
    },
    get writes() {
      return Object.freeze(writeRecords.map((write) => Object.freeze({ ...write })))
    },
  }
  return Object.freeze(harness)

  function notify() {
    for (const listener of listeners) listener()
  }
}

export const createExternalAdapterHarness = createExternalAdapter

function capture(value: unknown): unknown {
  try {
    return clonePicodashValue(value as PicodashJsonValue)
  } catch {
    return Object.freeze({ kind: 'opaque-test-reference', ref: value })
  }
}

function mismatchSnapshot(value: unknown): unknown {
  if (value && typeof value === 'object') return { mismatch: value }
  if (typeof value === 'number') return value + 1
  if (typeof value === 'string') return `${value}:mismatch`
  if (typeof value === 'boolean') return !value
  return { mismatch: true }
}
