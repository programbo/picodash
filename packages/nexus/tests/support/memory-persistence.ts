export type MemoryPersistenceCall = Readonly<{
  readonly kind: 'read' | 'write' | 'remove' | 'subscribe'
  readonly key: string
  readonly payload?: string | null
}>

export type MemoryPersistenceOperation = MemoryPersistenceCall['kind']

export interface MemoryPersistenceBackend {
  readonly identity: object
}

export interface MemoryPersistenceDriver {
  readonly identity: object
  readonly read: (key: string) => string | null
  readonly write: (key: string, payload: string) => void
  readonly remove: (key: string) => void
  readonly subscribe: (key: string, listener: () => void) => () => void
}

export interface MemoryPersistenceHarness extends MemoryPersistenceDriver {
  readonly backend: MemoryPersistenceBackend
  readonly inspect: (key?: string) => string | null | Readonly<Record<string, string>>
  readonly foreignWrite: (key: string, payload: string | null) => void
  readonly failNext: (operation: MemoryPersistenceOperation, error?: Error) => void
  readonly calls: readonly MemoryPersistenceCall[]
  readonly createDriver: () => MemoryPersistenceDriver
}

type InternalBackend = MemoryPersistenceBackend & {
  values: Map<string, string>
  listeners: Map<string, Set<() => void>>
  calls: MemoryPersistenceCall[]
  failures: Map<MemoryPersistenceOperation, Error[]>
}

export function createMemoryPersistenceBackend(
  initial: Readonly<Record<string, string>> = {},
): MemoryPersistenceBackend {
  const backend: InternalBackend = {
    identity: Object.freeze({}),
    values: new Map(Object.entries(initial)),
    listeners: new Map(),
    calls: [],
    failures: new Map(),
  }
  return backend
}

export function createMemoryPersistenceDriver(
  backend: MemoryPersistenceBackend,
): MemoryPersistenceDriver {
  return createDriver(backend as InternalBackend)
}

export function createMemoryPersistence(
  initial: Readonly<Record<string, string>> = {},
): MemoryPersistenceHarness {
  const backend = createMemoryPersistenceBackend(initial)
  const internal = backend as InternalBackend
  const driver = createDriver(internal)
  const harness: MemoryPersistenceHarness = {
    ...driver,
    backend,
    inspect: (key?: string) => {
      if (key !== undefined) return internal.values.get(key) ?? null
      return Object.freeze(Object.fromEntries(internal.values.entries()))
    },
    foreignWrite: (key, payload) => {
      if (payload === null) internal.values.delete(key)
      else internal.values.set(key, payload)
      notify(internal, key)
    },
    failNext: (operation, error = new Error(`memory persistence ${operation} failed`)) => {
      const failures = internal.failures.get(operation) ?? []
      failures.push(error)
      internal.failures.set(operation, failures)
    },
    get calls() {
      return detachedCalls(internal.calls)
    },
    createDriver: () => createDriver(internal),
  }
  return Object.freeze(harness)
}

export const createMemoryPersistenceHarness = createMemoryPersistence

function createDriver(backend: InternalBackend): MemoryPersistenceDriver {
  return Object.freeze({
    identity: backend.identity,
    read(key: string) {
      record(backend, { kind: 'read', key })
      failIfQueued(backend, 'read')
      return backend.values.get(key) ?? null
    },
    write(key: string, payload: string) {
      record(backend, { kind: 'write', key, payload })
      failIfQueued(backend, 'write')
      backend.values.set(key, payload)
      notify(backend, key)
    },
    remove(key: string) {
      record(backend, { kind: 'remove', key })
      failIfQueued(backend, 'remove')
      backend.values.delete(key)
      notify(backend, key)
    },
    subscribe(key: string, listener: () => void) {
      record(backend, { kind: 'subscribe', key })
      failIfQueued(backend, 'subscribe')
      const listeners = backend.listeners.get(key) ?? new Set<() => void>()
      listeners.add(listener)
      backend.listeners.set(key, listeners)
      let active = true
      return () => {
        if (!active) return
        active = false
        listeners.delete(listener)
        if (listeners.size === 0) backend.listeners.delete(key)
      }
    },
  })
}

function record(backend: InternalBackend, call: MemoryPersistenceCall) {
  backend.calls.push(Object.freeze({ ...call }))
}

function failIfQueued(backend: InternalBackend, operation: MemoryPersistenceOperation) {
  const failures = backend.failures.get(operation)
  if (failures === undefined || failures.length === 0) return
  const error = failures.shift()!
  if (failures.length === 0) backend.failures.delete(operation)
  throw error
}

function notify(backend: InternalBackend, key: string) {
  for (const listener of backend.listeners.get(key) ?? []) listener()
}

function detachedCalls(calls: readonly MemoryPersistenceCall[]) {
  return Object.freeze(calls.map((call) => Object.freeze({ ...call })))
}
