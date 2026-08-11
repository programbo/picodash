import type { TransactionIssue } from './kernel/index.js'
import type { PicodashDiagnostic } from './diagnostics.js'
import type {
  HydrationSourceConflictReason,
  InvalidPersistenceEnvelopeReason,
  PersistenceDriverUnavailableReason,
} from './persistence.js'
import type { SchemaMigrationFailureReason } from './migration.js'

export type OperationSource = 'programmatic' | 'interactive' | 'repair' | 'reset' | 'import'

export type AdapterWriteContext = Readonly<{
  source: OperationSource
  originScopeId?: string
  targetScopeIds: readonly string[]
  changedFields: readonly string[]
}>

export interface PicodashValueAdapter<Values extends object> {
  getSnapshot(): Readonly<Values>
  subscribe(listener: () => void): () => void
  setValues(completeValues: Readonly<Values>, context: AdapterWriteContext): void
}

export type AdapterWriteFailureReason =
  | 'write_threw'
  | 'async_write'
  | 'not_visible'
  | 'invalid_snapshot'
  | 'mismatched_snapshot'

export type AdapterHealthReason =
  | 'read_threw'
  | 'async_snapshot'
  | 'invalid_snapshot'
  | AdapterWriteFailureReason

export type AdapterInitializationFailureReason =
  | 'read_threw'
  | 'async_snapshot'
  | 'invalid_snapshot'
  | 'subscribe_threw'
  | 'invalid_teardown'

export type PicodashInitializationErrorReasonByCode = Readonly<{
  readonly 'adapter-initialization-failed': AdapterInitializationFailureReason
  readonly 'persistence-driver-unavailable': PersistenceDriverUnavailableReason
  readonly 'invalid-persistence-envelope': InvalidPersistenceEnvelopeReason
  readonly 'hydration-source-conflict': HydrationSourceConflictReason
  readonly 'schema-migration-failed': SchemaMigrationFailureReason
}>

export type PicodashInitializationErrorCode = keyof PicodashInitializationErrorReasonByCode

export type PicodashInitializationErrorShape = Error & {
  readonly name: 'PicodashInitializationError'
  readonly code: PicodashInitializationErrorCode
  readonly reason: PicodashInitializationErrorReasonByCode[PicodashInitializationErrorCode]
  readonly issues: readonly [
    TransactionIssue & {
      readonly code:
        | 'adapter_initialization_failed'
        | 'persistence_driver_unavailable'
        | 'invalid_persistence_envelope'
        | 'hydration_source_conflict'
        | 'schema_migration_failed'
      readonly reason: string
      readonly path: readonly []
    },
  ]
}

export type AdapterUnhealthyIssue = TransactionIssue & {
  readonly code: 'adapter_unhealthy'
  readonly reason: 'blocked'
  readonly path: readonly []
  readonly scopeId?: string
}

export type AdapterWriteFailedIssue = TransactionIssue & {
  readonly code: 'adapter_write_failed'
  readonly reason: AdapterWriteFailureReason
  readonly path: readonly []
  readonly scopeId?: string
}

export type AdapterHealthDiagnostic = PicodashDiagnostic<
  'adapter_unhealthy',
  Readonly<{ readonly kind: 'adapter' }>,
  'error'
> & { readonly reason: AdapterHealthReason }

export class PicodashInitializationError extends Error {
  readonly name = 'PicodashInitializationError' as const
  readonly code: PicodashInitializationErrorCode
  readonly reason: PicodashInitializationErrorReasonByCode[PicodashInitializationErrorCode]
  readonly issues: readonly [
    TransactionIssue & {
      readonly code:
        | 'adapter_initialization_failed'
        | 'persistence_driver_unavailable'
        | 'invalid_persistence_envelope'
        | 'hydration_source_conflict'
        | 'schema_migration_failed'
      readonly reason: string
      readonly path: readonly []
    },
  ]

  constructor(
    reason:
      | AdapterInitializationFailureReason
      | PersistenceDriverUnavailableReason
      | InvalidPersistenceEnvelopeReason
      | HydrationSourceConflictReason
      | SchemaMigrationFailureReason,
    code: PicodashInitializationErrorCode = 'adapter-initialization-failed',
  ) {
    super('Nexus initialization failed.')
    this.code = code
    this.reason = reason
    const issue = Object.freeze({
      code: code.replaceAll('-', '_') as
        | 'adapter_initialization_failed'
        | 'persistence_driver_unavailable'
        | 'invalid_persistence_envelope'
        | 'hydration_source_conflict'
        | 'schema_migration_failed',
      path: Object.freeze([]) as readonly [],
      message: 'Nexus initialization failed.',
      reason,
    })
    this.issues = Object.freeze([issue]) as typeof this.issues
    Object.freeze(this)
  }
}

export type SnapshotValidation<Values extends object> =
  | { readonly ok: true; readonly values: Readonly<Values> }
  | { readonly ok: false }

export type ExternalAdapterRuntime<Values extends object> = {
  readonly initialValues: Readonly<Values>
  readonly isUnhealthy: () => boolean
  readonly writeValues: (
    values: Readonly<Values>,
    context: AdapterWriteContext,
  ) => AdapterWriteFailureReason | undefined
  readonly destroy: () => void
}

type ExternalAdapterRuntimeOptions<Values extends object> = {
  readonly adapter: PicodashValueAdapter<Values>
  readonly validateSnapshot: (snapshot: unknown) => SnapshotValidation<Values>
  readonly equal: (left: Readonly<Values>, right: Readonly<Values>) => boolean
  readonly onExternalValues: (values: Readonly<Values>) => void
  readonly onHealthFailure: (reason: AdapterHealthReason) => void
  readonly onHealthRecovery: () => void
  readonly withNotification: <Result>(run: () => Result) => Result
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  try {
    return (
      !!value &&
      (typeof value === 'object' || typeof value === 'function') &&
      typeof (value as { then?: unknown }).then === 'function'
    )
  } catch {
    // A hostile then getter is treated as async so it cannot cross the sync boundary.
    return true
  }
}

const adapterMethod = <T extends (...args: never[]) => unknown>(
  adapter: object,
  key: string,
): T => {
  let value: unknown
  try {
    value = Reflect.get(adapter, key, adapter)
  } catch {
    throw new Error('invalid adapter method')
  }
  if (typeof value !== 'function') throw new Error('invalid adapter method')
  return value as T
}

export function createExternalAdapterRuntime<Values extends object>(
  options: ExternalAdapterRuntimeOptions<Values>,
): ExternalAdapterRuntime<Values> {
  const adapter = options.adapter as object
  if (!adapter || (typeof adapter !== 'object' && typeof adapter !== 'function'))
    throw new Error('invalid adapter object')
  const getSnapshot = adapterMethod<() => unknown>(adapter, 'getSnapshot')
  const subscribe = adapterMethod<(listener: () => void) => unknown>(adapter, 'subscribe')
  const setValues = adapterMethod<
    (values: Readonly<Values>, context: AdapterWriteContext) => unknown
  >(adapter, 'setValues')

  let release: (() => void) | undefined
  let active = false
  let initializing = true
  let writing = false
  let unhealthy = false
  let teardownDone = false

  const readOnce = (): SnapshotValidation<Values> | AdapterHealthReason => {
    let snapshot: unknown
    try {
      snapshot = Reflect.apply(getSnapshot, adapter, [])
    } catch {
      return 'read_threw'
    }
    if (isPromiseLike(snapshot)) return 'async_snapshot'
    const result = options.validateSnapshot(snapshot)
    return result.ok === true ? result : 'invalid_snapshot'
  }

  const reportFailure = (reason: AdapterHealthReason) => {
    unhealthy = true
    options.onHealthFailure(reason)
  }

  const onNotification = () => {
    if (!active || initializing || writing) return
    options.withNotification(() => {
      const result = readOnce()
      if (typeof result === 'string') {
        reportFailure(result)
        return
      }
      unhealthy = false
      options.onHealthRecovery()
      if (result.ok === true) {
        verifiedValues = result.values
        options.onExternalValues(result.values)
      }
    })
  }

  const teardown = () => {
    if (teardownDone) return
    teardownDone = true
    active = false
    initializing = false
    const currentRelease = release
    release = undefined
    if (currentRelease) {
      try {
        currentRelease()
      } catch {
        // Adapter teardown is best effort and never leaks host exceptions.
      }
    }
  }

  const first = readOnce()
  if (typeof first === 'string')
    throw new PicodashInitializationError(first as AdapterInitializationFailureReason)
  if (first.ok !== true) throw new PicodashInitializationError('invalid_snapshot')

  let subscribed: unknown
  try {
    subscribed = Reflect.apply(subscribe, adapter, [onNotification])
  } catch {
    throw new PicodashInitializationError('subscribe_threw')
  }
  if (typeof subscribed !== 'function') {
    throw new PicodashInitializationError('invalid_teardown')
  }
  release = subscribed as () => void

  const second = readOnce()
  if (typeof second === 'string') {
    teardown()
    throw new PicodashInitializationError(second as AdapterInitializationFailureReason)
  }
  if (second.ok !== true) {
    teardown()
    throw new PicodashInitializationError('invalid_snapshot')
  }
  initializing = false
  active = true
  let verifiedValues = second.values

  const runtime: ExternalAdapterRuntime<Values> = {
    initialValues: second.values,
    isUnhealthy: () => unhealthy,
    writeValues(values, context) {
      if (!active) return 'write_threw'
      writing = true
      try {
        let result: unknown
        try {
          result = Reflect.apply(setValues, adapter, [values, context])
        } catch {
          reportFailure('write_threw')
          return 'write_threw'
        }
        if (isPromiseLike(result)) {
          reportFailure('async_write')
          return 'async_write'
        }
        const verification = readOnce()
        if (typeof verification === 'string' || verification.ok !== true) {
          const issueReason: AdapterWriteFailureReason =
            verification === 'read_threw' || verification === 'async_snapshot'
              ? 'not_visible'
              : 'invalid_snapshot'
          reportFailure(typeof verification === 'string' ? verification : 'invalid_snapshot')
          return issueReason
        }
        if (options.equal(verification.values, verifiedValues)) {
          reportFailure('not_visible')
          return 'not_visible'
        }
        if (!options.equal(verification.values, values)) {
          reportFailure('mismatched_snapshot')
          return 'mismatched_snapshot'
        }
        unhealthy = false
        verifiedValues = verification.values
        options.onHealthRecovery()
        return undefined
      } finally {
        writing = false
      }
    },
    destroy: teardown,
  }
  return runtime
}
