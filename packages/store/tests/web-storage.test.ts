import { afterEach, describe, expect, it } from 'vite-plus/test'
import { createWebStoragePersistenceDriver, type PicodashWebStorage } from '../src/web-storage.ts'

type StorageListener = (event: unknown) => void

const originalDescriptors = new Map(
  ['localStorage', 'sessionStorage', 'addEventListener', 'removeEventListener'].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]),
)

afterEach(() => {
  for (const [key, descriptor] of originalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})

function createStorage(initial: Readonly<Record<string, string>> = {}) {
  const values = new Map(Object.entries(initial))
  const calls: { readonly kind: 'get' | 'set' | 'remove'; readonly args: readonly string[] }[] = []
  const storage: PicodashWebStorage = {
    getItem(key) {
      calls.push({ kind: 'get', args: [key] })
      return values.get(key) ?? null
    },
    setItem(key, value) {
      calls.push({ kind: 'set', args: [key, value] })
      values.set(key, value)
    },
    removeItem(key) {
      calls.push({ kind: 'remove', args: [key] })
      values.delete(key)
    },
  }
  return { storage, calls, values }
}

function installBrowserStorage(local: PicodashWebStorage, session = createStorage().storage) {
  const listeners = new Set<StorageListener>()
  let removeCalls = 0
  Object.defineProperties(globalThis, {
    localStorage: { configurable: true, value: local },
    sessionStorage: { configurable: true, value: session },
    addEventListener: {
      configurable: true,
      value: (type: string, listener: StorageListener) => {
        if (type === 'storage') listeners.add(listener)
      },
    },
    removeEventListener: {
      configurable: true,
      value: (type: string, listener: StorageListener) => {
        if (type === 'storage') {
          removeCalls += 1
          listeners.delete(listener)
        }
      },
    },
  })
  return {
    emit: (event: unknown) => {
      for (const listener of listeners) listener(event)
    },
    listenerCount: () => listeners.size,
    removeCalls: () => removeCalls,
  }
}

describe('Web Storage persistence driver', () => {
  it('does not touch supplied storage during creation and forwards exact strings', () => {
    const backend = createStorage({ state: 'stored' })
    const first = createWebStoragePersistenceDriver(backend.storage)
    const second = createWebStoragePersistenceDriver(backend.storage)

    expect(backend.calls).toEqual([])
    expect(first.identity).toBe(second.identity)
    expect('subscribe' in first).toBe(false)
    expect(first.read('state')).toBe('stored')
    first.write('state', '{"exact":true}')
    first.remove('state')
    expect(backend.calls).toEqual([
      { kind: 'get', args: ['state'] },
      { kind: 'set', args: ['state', '{"exact":true}'] },
      { kind: 'remove', args: ['state'] },
    ])
  })

  it('resolves named storage only on read and hides unavailable causes', () => {
    let resolutions = 0
    Object.defineProperties(globalThis, {
      addEventListener: { configurable: true, value: () => undefined },
      removeEventListener: { configurable: true, value: () => undefined },
      localStorage: {
        configurable: true,
        get() {
          resolutions += 1
          throw new Error('secret browser cause')
        },
      },
    })
    const driver = createWebStoragePersistenceDriver('local')
    expect(resolutions).toBe(0)
    expect(() => driver.read('state')).toThrowError('Web Storage is unavailable.')
    expect(resolutions).toBe(1)
    try {
      driver.read('state')
    } catch (error) {
      expect(error).not.toHaveProperty('cause')
      expect(String(error)).not.toContain('secret browser cause')
    }
  })

  it('shares named and supplied identity and filters native storage events', () => {
    const local = createStorage()
    const other = createStorage()
    const browser = installBrowserStorage(local.storage)
    const named = createWebStoragePersistenceDriver('local')
    const supplied = createWebStoragePersistenceDriver(local.storage)
    const unrelated = createWebStoragePersistenceDriver(other.storage)

    expect(named.identity).toBe(supplied.identity)
    expect(named.identity).not.toBe(unrelated.identity)
    expect(named.read('state')).toBeNull()
    let notifications = 0
    const unsubscribe = named.subscribe?.('state', () => {
      notifications += 1
    })
    expect(browser.listenerCount()).toBe(1)

    browser.emit({ key: 'other', storageArea: local.storage })
    browser.emit({ key: 'state', storageArea: other.storage })
    browser.emit({ key: 'state', storageArea: local.storage })
    browser.emit({ key: null, storageArea: local.storage })
    expect(notifications).toBe(2)

    named.write('state', 'same-document')
    expect(notifications).toBe(2)
    unsubscribe?.()
    unsubscribe?.()
    expect(browser.listenerCount()).toBe(0)
    expect(browser.removeCalls()).toBe(1)
  })

  it('keeps local and session identities distinct', () => {
    const local = createStorage()
    const session = createStorage()
    installBrowserStorage(local.storage, session.storage)
    const localDriver = createWebStoragePersistenceDriver('local')
    const sessionDriver = createWebStoragePersistenceDriver('session')
    expect(localDriver.identity).not.toBe(sessionDriver.identity)
    expect(localDriver.read('state')).toBeNull()
    expect(sessionDriver.read('state')).toBeNull()
  })
})
