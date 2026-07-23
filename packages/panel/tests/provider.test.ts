import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, test } from 'vite-plus/test'
import {
  createValidatedPanelPersistStorage,
  legacyPanelLayoutStorageKey,
  panelLayoutStorageKey,
} from '../src/panel-persistence.ts'
import { createPicodashStore, PicodashProvider } from '../src/picodash-provider.tsx'
import { installFakeLocalStorage } from './helpers.ts'

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'window')
  }
})

test('supports a custom provider layout storage key', () => {
  const storage = installFakeLocalStorage()
  const store = createPicodashStore({ storageKey: 'custom-panel-layout' })

  store.getState().setPanelLayout('scene', { x: 24, y: 32 })

  expect(storage.getItem('custom-panel-layout')).toBeTruthy()
  expect(storage.getItem('picodash-panel:provider-layout:v1')).toBeNull()
})

test('migrates provider layouts from the retired storage key', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(
    legacyPanelLayoutStorageKey,
    JSON.stringify({
      state: { panelLayouts: { scene: { x: 24, y: 32 } } },
      version: 0,
    }),
  )

  const store = createPicodashStore()

  expect(store.getState().panelLayouts.scene).toEqual({ dock: null, x: 24, y: 32 })
  expect(storage.getItem(panelLayoutStorageKey)).toBeTruthy()
})

test('falls back when the new layout key contains malformed JSON', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(panelLayoutStorageKey, '{malformed')
  storage.setItem(
    legacyPanelLayoutStorageKey,
    JSON.stringify({
      state: { panelLayouts: { scene: { x: 36, y: 48 } } },
      version: 0,
    }),
  )

  const persistStorage = createValidatedPanelPersistStorage()

  expect(persistStorage.getItem(panelLayoutStorageKey)).toEqual({
    state: { panelLayouts: { scene: { dock: null, x: 36, y: 48 } } },
    version: 0,
  })
})

test('removes both current and retired layout keys', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(panelLayoutStorageKey, 'current')
  storage.setItem(legacyPanelLayoutStorageKey, 'retired')

  createValidatedPanelPersistStorage().removeItem(panelLayoutStorageKey)

  expect(storage.getItem(panelLayoutStorageKey)).toBeNull()
  expect(storage.getItem(legacyPanelLayoutStorageKey)).toBeNull()
})

test('migrates custom demo layouts from the retired storage key', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(
    'tweaker-demo:panel-layout:v1',
    JSON.stringify({
      state: { panelLayouts: { scene: { x: 48, y: 64 } } },
      version: 0,
    }),
  )

  const store = createPicodashStore({ storageKey: 'picodash-demo:panel-layout:v1' })

  expect(store.getState().panelLayouts.scene).toEqual({ dock: null, x: 48, y: 64 })
  expect(storage.getItem('picodash-demo:panel-layout:v1')).toBeTruthy()
})

test('hydrates legacy layouts when the migration write fails', () => {
  const raw = JSON.stringify({
    state: { panelLayouts: { scene: { x: 72, y: 96 } } },
    version: 0,
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => (key === legacyPanelLayoutStorageKey ? raw : null),
        setItem: () => {
          throw new DOMException('Storage is full.', 'QuotaExceededError')
        },
      },
    },
  })

  const storage = createValidatedPanelPersistStorage()

  expect(storage.getItem(panelLayoutStorageKey)).toEqual({
    state: { panelLayouts: { scene: { dock: null, x: 72, y: 96 } } },
    version: 0,
  })
})

test('can disable provider layout persistence without accessing local storage', () => {
  let accesses = 0
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      get localStorage() {
        accesses += 1
        throw new Error('localStorage should not be accessed')
      },
    },
  })

  const store = createPicodashStore({ persistLayout: false })
  store.getState().setPanelLayout('scene', { x: 24, y: 32 })

  expect(store.getState().panelLayouts.scene).toEqual({ x: 24, y: 32 })
  expect(accesses).toBe(0)
})

test('keeps provider state usable when layout persistence writes fail', () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => null,
        removeItem: () => {
          throw new DOMException('Storage is disabled.', 'SecurityError')
        },
        setItem: () => {
          throw new DOMException('Storage is full.', 'QuotaExceededError')
        },
      },
    },
  })

  const store = createPicodashStore()
  const storage = createValidatedPanelPersistStorage()

  expect(() => store.getState().setPanelLayout('scene', { x: 24, y: 32 })).not.toThrow()
  expect(() =>
    storage.setItem('layout', {
      state: { panelLayouts: { scene: { dock: null, x: 24, y: 32 } } },
      version: 1,
    }),
  ).not.toThrow()
  expect(() => storage.removeItem?.('layout')).not.toThrow()
  expect(store.getState().panelLayouts.scene).toEqual({ x: 24, y: 32 })
})

test('applies explicit and server-resolved themes to the provider carrier', () => {
  expect(renderProvider('dark')).toContain('data-picodash-theme="dark"')
  expect(renderProvider('light')).toContain('data-picodash-theme="light"')
  expect(renderProvider('system')).toContain('data-picodash-theme="dark"')
})

function renderProvider(theme: 'dark' | 'light' | 'system') {
  return renderToStaticMarkup(
    createElement(PicodashProvider, {
      children: createElement('span', null, 'Content'),
      theme,
    }),
  )
}
