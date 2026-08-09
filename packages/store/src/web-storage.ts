import type { PicodashPersistenceDriver } from './persistence.js'

export interface PicodashWebStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type PicodashWebStorageSource = 'local' | 'session' | PicodashWebStorage

type NamedSource = Extract<PicodashWebStorageSource, string>

type StorageEventTarget = {
  addEventListener(type: 'storage', listener: (event: unknown) => void): void
  removeEventListener(type: 'storage', listener: (event: unknown) => void): void
}

const localIdentity = Object.freeze({})
const sessionIdentity = Object.freeze({})
const suppliedIdentities = new WeakMap<object, object>()

const unavailable = (): Error => new Error('Web Storage is unavailable.')

const storageProperty = (source: NamedSource): 'localStorage' | 'sessionStorage' =>
  source === 'local' ? 'localStorage' : 'sessionStorage'

const isStorage = (value: unknown): value is PicodashWebStorage => {
  if (!value || typeof value !== 'object') return false
  try {
    return (
      typeof Reflect.get(value, 'getItem', value) === 'function' &&
      typeof Reflect.get(value, 'setItem', value) === 'function' &&
      typeof Reflect.get(value, 'removeItem', value) === 'function'
    )
  } catch {
    return false
  }
}

const currentNamedStorage = (source: NamedSource): PicodashWebStorage | undefined => {
  if (!currentStorageEventTarget()) return undefined
  try {
    const storage = Reflect.get(globalThis, storageProperty(source), globalThis)
    return isStorage(storage) ? storage : undefined
  } catch {
    return undefined
  }
}

const currentStorageEventTarget = (): StorageEventTarget | undefined => {
  try {
    const addEventListener = Reflect.get(globalThis, 'addEventListener', globalThis)
    const removeEventListener = Reflect.get(globalThis, 'removeEventListener', globalThis)
    if (typeof addEventListener !== 'function' || typeof removeEventListener !== 'function')
      return undefined
    return {
      addEventListener: (type, listener) =>
        Reflect.apply(addEventListener, globalThis, [type, listener]),
      removeEventListener: (type, listener) =>
        Reflect.apply(removeEventListener, globalThis, [type, listener]),
    }
  } catch {
    return undefined
  }
}

const namedIdentity = (source: NamedSource): object =>
  source === 'local' ? localIdentity : sessionIdentity

const suppliedIdentity = (storage: PicodashWebStorage): object => {
  if (currentNamedStorage('local') === storage) return localIdentity
  if (currentNamedStorage('session') === storage) return sessionIdentity
  const object = storage as object
  const existing = suppliedIdentities.get(object)
  if (existing) return existing
  const identity = Object.freeze({})
  suppliedIdentities.set(object, identity)
  return identity
}

const suppliedNamedAlias = (storage: PicodashWebStorage): NamedSource | undefined => {
  if (currentNamedStorage('local') === storage) return 'local'
  if (currentNamedStorage('session') === storage) return 'session'
  return undefined
}

const storageMethod = <Method extends (...args: never[]) => unknown>(
  storage: PicodashWebStorage,
  key: 'getItem' | 'setItem' | 'removeItem',
): Method => {
  const method = Reflect.get(storage, key, storage)
  if (typeof method !== 'function') throw unavailable()
  return method as Method
}

export function createWebStoragePersistenceDriver(
  source: PicodashWebStorageSource,
): PicodashPersistenceDriver {
  if (source !== 'local' && source !== 'session' && !isStorage(source))
    throw new TypeError('Invalid Web Storage source.')

  const named = typeof source === 'string' ? source : suppliedNamedAlias(source)
  const identity =
    typeof source === 'string'
      ? namedIdentity(source)
      : suppliedIdentity(source as PicodashWebStorage)
  let resolved = typeof source === 'string' ? undefined : source

  const resolveForOperation = (): PicodashWebStorage => {
    if (resolved) return resolved
    resolved = currentNamedStorage(source as NamedSource)
    if (!resolved) throw unavailable()
    return resolved
  }

  const driver: PicodashPersistenceDriver = {
    identity,
    read(storageKey) {
      const storage = resolveForOperation()
      try {
        return Reflect.apply(
          storageMethod<(key: string) => string | null>(storage, 'getItem'),
          storage,
          [storageKey],
        )
      } catch (error) {
        if (typeof source === 'string') throw unavailable()
        throw error
      }
    },
    write(storageKey, envelope) {
      const storage = resolveForOperation()
      Reflect.apply(
        storageMethod<(key: string, value: string) => void>(storage, 'setItem'),
        storage,
        [storageKey, envelope],
      )
    },
    remove(storageKey) {
      const storage = resolveForOperation()
      Reflect.apply(storageMethod<(key: string) => void>(storage, 'removeItem'), storage, [
        storageKey,
      ])
    },
  }

  if (named !== undefined)
    driver.subscribe = (storageKey, listener) => {
      const eventTarget = currentStorageEventTarget()
      if (!eventTarget) return () => undefined
      let active = true
      const onStorage = (event: unknown) => {
        if (!active || !event || typeof event !== 'object') return
        let storageArea: unknown
        let key: unknown
        try {
          storageArea = Reflect.get(event, 'storageArea', event)
          key = Reflect.get(event, 'key', event)
        } catch {
          return
        }
        if (storageArea === resolved && (key === storageKey || key === null)) listener()
      }
      eventTarget.addEventListener('storage', onStorage)
      return () => {
        if (!active) return
        active = false
        try {
          eventTarget.removeEventListener('storage', onStorage)
        } catch {
          // Native listener cleanup is best effort after the subscription becomes inactive.
        }
      }
    }

  return Object.freeze(driver)
}
