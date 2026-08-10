export type PicodashDiagnostic<
  Code extends string = string,
  Identity extends object = object,
  Severity extends 'error' | 'warning' = 'error' | 'warning',
> = Readonly<{
  readonly code: Code
  readonly severity: Severity
  readonly message: string
  readonly identity: Identity
  readonly count: number
  readonly lastOccurrence: number
}>

export type PicodashDiagnosticsState = Readonly<{
  readonly current: ReadonlyMap<string, PicodashDiagnostic>
}>

export type SubscriberExceptionIdentity = Readonly<{
  readonly kind: 'subscriber'
  readonly surface: 'root' | 'scope' | 'diagnostics' | 'capability'
  readonly scopeId?: string
  readonly capability?: string
}>

export type SubscriberExceptionDiagnostic = PicodashDiagnostic<
  'subscriber_exception',
  SubscriberExceptionIdentity,
  'error'
>

export interface PicodashDiagnostics {
  getState(): PicodashDiagnosticsState
  subscribe(listener: () => void): () => void
}

type RuntimeResource = {
  readonly phase: 'capability' | 'kernel'
  readonly teardown: (context: { readonly discardUnpersisted: boolean }) => void
}

type DispatchSurface = SubscriberExceptionIdentity['surface']

type DispatchRecord = {
  readonly surface: DispatchSurface
  readonly scopeId?: string
  readonly capability?: string
  readonly listeners: Iterable<() => void>
}

type DiagnosticsOptions = {
  readonly assertActive: () => void
  readonly invalidListener: () => never
}

type DiagnosticCondition = {
  readonly fingerprint: string
  readonly code: string
  readonly severity: 'error' | 'warning'
  readonly message: string
  readonly identity: object
  readonly details?: Readonly<Record<string, string | number>>
}

type DiagnosticsRuntime = {
  readonly facade: PicodashDiagnostics
  readonly dispatch: (records: readonly DispatchRecord[]) => void
  readonly recordCondition: (condition: DiagnosticCondition) => PicodashDiagnostic
  readonly recoverCondition: (fingerprint: string) => void
  readonly publish: () => void
  readonly attachResource: (register: (resource: RuntimeResource) => () => void) => void
}

const MAX_SAFE = Number.MAX_SAFE_INTEGER
const MESSAGE = 'A Store subscriber threw.'

function immutableMap<K, V>(entries: readonly (readonly [K, V])[]): ReadonlyMap<K, V> {
  const source = new Map(entries)
  const facade: ReadonlyMap<K, V> = {
    get size() {
      return source.size
    },
    get(key) {
      return source.get(key)
    },
    has(key) {
      return source.has(key)
    },
    entries() {
      return source.entries()
    },
    keys() {
      return source.keys()
    },
    values() {
      return source.values()
    },
    forEach(callbackfn, thisArg) {
      source.forEach((value, key) => callbackfn.call(thisArg, value, key, facade))
    },
    [Symbol.iterator]() {
      return source[Symbol.iterator]()
    },
  }
  return Object.freeze(facade)
}

export function createDiagnosticsRuntime(options: DiagnosticsOptions): DiagnosticsRuntime {
  const listeners = new Set<() => void>()
  const current = new Map<string, PicodashDiagnostic>()
  const opaqueKeys = new Map<string, string>()
  let state: PicodashDiagnosticsState = Object.freeze({
    current: immutableMap<string, PicodashDiagnostic>([]),
  })
  let occurrence = 0
  let nextOpaqueKey = 0
  let pendingChange = false
  let alive = true
  let resourceRelease: (() => void) | undefined

  const assertAlive = () => options.assertActive()

  const identityFingerprint = (identity: SubscriberExceptionIdentity): string =>
    JSON.stringify([identity.surface, identity.scopeId ?? null, identity.capability ?? null])

  const opaqueKeyFor = (fingerprint: string): string => {
    const existing = opaqueKeys.get(fingerprint)
    if (existing !== undefined) return existing
    nextOpaqueKey += 1
    const key = `d${nextOpaqueKey.toString(36)}`
    opaqueKeys.set(fingerprint, key)
    return key
  }

  const existingOpaqueKeyFor = (fingerprint: string): string | undefined =>
    opaqueKeys.get(fingerprint)

  const rebuildState = () => {
    state = Object.freeze({ current: immutableMap([...current.entries()]) })
  }

  const advanceOccurrence = () => {
    occurrence = occurrence >= MAX_SAFE ? MAX_SAFE : occurrence + 1
    return occurrence
  }

  const recordCondition = (condition: DiagnosticCondition): PicodashDiagnostic => {
    const key = opaqueKeyFor(condition.fingerprint)
    const previous = current.get(key)
    const nextCount = previous ? (previous.count >= MAX_SAFE ? MAX_SAFE : previous.count + 1) : 1
    const nextIdentity = previous?.identity ?? Object.freeze({ ...condition.identity })
    const diagnostic = Object.freeze({
      code: condition.code,
      severity: condition.severity,
      message: condition.message,
      identity: nextIdentity,
      count: nextCount,
      lastOccurrence: advanceOccurrence(),
      ...condition.details,
    })
    current.set(key, diagnostic)
    pendingChange = true
    return diagnostic
  }

  const recoverCondition = (fingerprint: string) => {
    const key = existingOpaqueKeyFor(fingerprint)
    if (key !== undefined && current.delete(key)) pendingChange = true
  }

  const recordFailure = (identity: SubscriberExceptionIdentity) =>
    recordCondition({
      fingerprint: identityFingerprint(identity),
      code: 'subscriber_exception',
      severity: 'error',
      message: MESSAGE,
      identity,
    })

  const dispatchCallbacks = (
    surface: DispatchSurface,
    callbackListeners: Iterable<() => void>,
    scopeId?: string,
    capability?: string,
  ) => {
    const identity = {
      kind: 'subscriber' as const,
      surface,
      ...(scopeId === undefined ? {} : { scopeId }),
      ...(capability === undefined ? {} : { capability }),
    } satisfies SubscriberExceptionIdentity
    let threw = false
    for (const listener of Array.from(callbackListeners)) {
      try {
        listener()
      } catch {
        threw = true
        recordFailure(identity)
      }
    }
    if (!threw) recoverCondition(identityFingerprint(identity))
  }

  const notifyDiagnostics = () => {
    let threw = false
    for (const listener of Array.from(listeners)) {
      try {
        listener()
      } catch {
        threw = true
        recordFailure({ kind: 'subscriber', surface: 'diagnostics' })
      }
    }
    if (!threw)
      recoverCondition(identityFingerprint({ kind: 'subscriber', surface: 'diagnostics' }))
  }

  const publish = () => {
    if (!pendingChange) return
    pendingChange = false
    rebuildState()
    notifyDiagnostics()
    rebuildState()
  }

  const dispatch = (records: readonly DispatchRecord[]) => {
    assertAlive()
    let changed = false
    const before = [...current.entries()]
    for (const record of records)
      dispatchCallbacks(record.surface, record.listeners, record.scopeId, record.capability)
    const after = [...current.entries()]
    if (before.length !== after.length) changed = true
    else
      for (let index = 0; index < before.length; index += 1) {
        const [beforeKey, beforeValue] = before[index]!
        const [afterKey, afterValue] = after[index]!
        if (beforeKey !== afterKey || beforeValue !== afterValue) {
          changed = true
          break
        }
      }
    if (!changed) return
    publish()
  }

  const teardown = () => {
    if (!alive) return
    alive = false
    listeners.clear()
    current.clear()
    opaqueKeys.clear()
    state = Object.freeze({ current: immutableMap<string, PicodashDiagnostic>([]) })
    occurrence = 0
    nextOpaqueKey = 0
    pendingChange = false
    resourceRelease?.()
    resourceRelease = undefined
  }

  const implementation: PicodashDiagnostics = {
    getState() {
      assertAlive()
      return state
    },
    subscribe(listener: () => void) {
      assertAlive()
      if (typeof listener !== 'function') return options.invalidListener()
      listeners.add(listener)
      let active = true
      return () => {
        if (!active) return
        active = false
        listeners.delete(listener)
      }
    },
  }

  const methods = new Map<PropertyKey, (...args: never[]) => unknown>()
  const facadeTarget = {} as PicodashDiagnostics
  const guardedMethod = (property: PropertyKey, value: (...args: never[]) => unknown) => {
    const cached = methods.get(property)
    if (cached) return cached
    const method = (...args: never[]) => {
      assertAlive()
      return Reflect.apply(value, implementation, args)
    }
    methods.set(property, method)
    return method
  }
  for (const property of Reflect.ownKeys(implementation))
    Object.defineProperty(facadeTarget, property, {
      enumerable: true,
      configurable: true,
      get: () => {
        assertAlive()
        const value = Reflect.get(implementation, property, implementation)
        return typeof value === 'function'
          ? guardedMethod(property, value as (...args: never[]) => unknown)
          : value
      },
    })
  Object.freeze(facadeTarget)
  const facade: PicodashDiagnostics = new Proxy(facadeTarget, {
    get(source, property, receiver) {
      assertAlive()
      return Reflect.get(source, property, receiver)
    },
    has(source, property) {
      assertAlive()
      return Reflect.has(source, property)
    },
    ownKeys(source) {
      assertAlive()
      return Reflect.ownKeys(source)
    },
    getOwnPropertyDescriptor(source, property) {
      assertAlive()
      return Reflect.getOwnPropertyDescriptor(source, property)
    },
    getPrototypeOf(source) {
      assertAlive()
      return Reflect.getPrototypeOf(source)
    },
    set(source, property, value, receiver) {
      assertAlive()
      return Reflect.set(source, property, value, receiver)
    },
    defineProperty(source, property, descriptor) {
      assertAlive()
      return Reflect.defineProperty(source, property, descriptor)
    },
    deleteProperty(source, property) {
      assertAlive()
      return Reflect.deleteProperty(source, property)
    },
    setPrototypeOf(source, prototype) {
      assertAlive()
      return Reflect.setPrototypeOf(source, prototype)
    },
    preventExtensions(source) {
      assertAlive()
      return Reflect.preventExtensions(source)
    },
    isExtensible(source) {
      assertAlive()
      return Reflect.isExtensible(source)
    },
  })

  return {
    facade,
    dispatch,
    recordCondition,
    recoverCondition,
    publish,
    attachResource(register) {
      resourceRelease = register({ phase: 'kernel', teardown })
    },
  }
}
