import { expect } from 'vite-plus/test'

export function installFakeLocalStorage() {
  const values = new Map<string, string>()
  const storage = {
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null
    },
    get length() {
      return values.size
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  })

  return storage
}

export function readPersistedPanelLayouts(
  storage: ReturnType<typeof installFakeLocalStorage>,
  key: string,
) {
  const raw = storage.getItem(key)
  expect(raw).toBeTruthy()

  return JSON.parse(raw!).state.panelLayouts as unknown
}
