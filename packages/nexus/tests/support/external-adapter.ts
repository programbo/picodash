import { clonePicodashValue } from '../../src/json.js'
import type { PicodashJsonValue } from '../../src/index.js'

export type ExternalAdapterWriteMode =
  | 'commit'
  | 'throw-before-mutation'
  | 'async-write'
  | 'defer-visibility'
  | 'commit-mismatch'

export type ExternalAdapterReadMode = 'normal' | 'throw' | 'async' | 'invalid'

export interface ExternalAdapterWriteRecord {
  readonly payload: unknown
  readonly context?: unknown
  readonly mode: ExternalAdapterWriteMode
  readonly visible: boolean
}

export interface ExternalAdapterHarness {
  readonly getSnapshot: () => unknown
  readonly setValues: (nextValues: unknown, context?: unknown) => unknown
  readonly subscribe: (listener: () => void) => () => void
  readonly replaceSnapshot: (snapshot: unknown) => void
  readonly failReads: (count?: number) => void
  readonly nextRead: (mode: ExternalAdapterReadMode) => void
  readonly nextReadAfterSubscribe: (mode: ExternalAdapterReadMode) => void
  readonly nextSubscribe: (mode: 'throw' | 'invalid-teardown') => void
  readonly emit: () => void
  readonly emitOnSubscribe: () => void
  readonly invalidTeardownOnSubscribe: () => void
  readonly releaseCalls: () => number
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
  let readMode: ExternalAdapterReadMode = 'normal'
  let readModeAfterSubscribe: ExternalAdapterReadMode | undefined
  let subscribeMode: 'throw' | 'invalid-teardown' | undefined
  let emitDuringSubscribe = false
  let invalidTeardown = false
  let releaseCount = 0
  let pendingMode: PendingWrite = { mode: 'commit', mismatchProvided: false }
  let deferred: { readonly value: unknown } | undefined
  const listeners = new Set<() => void>()
  const writeRecords: ExternalAdapterWriteRecord[] = []

  const harness: ExternalAdapterHarness = {
    getSnapshot() {
      const mode = readMode
      readMode = 'normal'
      if (mode === 'throw') throw new Error('external adapter read failed')
      if (mode === 'async') return Promise.resolve(snapshot)
      if (mode === 'invalid') return { invalid: true }
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
      if (operation.mode === 'async-write') {
        writeRecords.push(
          Object.freeze({
            payload,
            context: detachedContext,
            mode: operation.mode,
            visible: false,
          }),
        )
        return Promise.resolve()
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
      if (readModeAfterSubscribe !== undefined) {
        readMode = readModeAfterSubscribe
        readModeAfterSubscribe = undefined
      }
      if (subscribeMode === 'throw') {
        subscribeMode = undefined
        throw new Error('external adapter subscribe failed')
      }
      if (subscribeMode === 'invalid-teardown') {
        subscribeMode = undefined
        return undefined as never
      }
      listeners.add(listener)
      if (invalidTeardown) {
        invalidTeardown = false
        return undefined as never
      }
      if (emitDuringSubscribe) {
        emitDuringSubscribe = false
        listener()
      }
      let active = true
      return () => {
        if (!active) return
        active = false
        releaseCount += 1
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
    nextRead(mode) {
      readMode = mode
    },
    nextReadAfterSubscribe(mode) {
      readModeAfterSubscribe = mode
    },
    nextSubscribe(mode) {
      subscribeMode = mode
    },
    emit() {
      notify()
    },
    emitOnSubscribe() {
      emitDuringSubscribe = true
    },
    invalidTeardownOnSubscribe() {
      invalidTeardown = true
    },
    releaseCalls() {
      return releaseCount
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
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const copy = { ...(value as Record<string, unknown>) }
    const key = Object.keys(copy)[0]
    if (key !== undefined) copy[key] = mismatchSnapshot(copy[key])
    return copy
  }
  if (typeof value === 'number') return value + 1
  if (typeof value === 'string') return `${value}:mismatch`
  if (typeof value === 'boolean') return !value
  return { mismatch: true }
}
