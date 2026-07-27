import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, test } from 'vite-plus/test'
import {
  createValidatedPanelPersistStorage,
  panelLayoutStorageKey,
} from '../src/state/persistence/panel-persistence.ts'
import { createPicodashStore, PicodashProvider } from '../src/state/provider/picodash-provider.tsx'
import { installFakeLocalStorage } from './helpers.ts'

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
const freeFloatingPlacement = {
  disposition: { kind: 'free' as const },
  mode: 'floating' as const,
}

function freeLayout(x: number, y: number) {
  return {
    placement: freeFloatingPlacement,
    preferredCoordinates: { x, y },
  }
}

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

  store.getState().setPanelLayout('scene', freeLayout(24, 32))

  expect(storage.getItem('custom-panel-layout')).toBeTruthy()
  expect(storage.getItem(panelLayoutStorageKey)).toBeNull()
})

test('persists and hydrates free hybrid placement', () => {
  const storage = installFakeLocalStorage()
  const store = createPicodashStore()

  store.getState().setPanelLayout('scene', {
    placement: { disposition: { kind: 'free' }, mode: 'hybrid' },
    preferredCoordinates: { x: 24, y: 32 },
  })

  expect(JSON.parse(storage.getItem(panelLayoutStorageKey) ?? '{}')).toMatchObject({
    state: {
      panelLayouts: {
        scene: {
          placement: { disposition: { kind: 'free' }, mode: 'hybrid' },
          preferredCoordinates: { x: 24, y: 32 },
        },
      },
    },
  })

  expect(createPicodashStore().getState().panelLayouts.scene).toEqual({
    placement: { disposition: { kind: 'free' }, mode: 'hybrid' },
    preferredCoordinates: { x: 24, y: 32 },
  })
})

test('ignores retired provider layout storage keys', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(
    'retired-panel:provider-layout:v1',
    JSON.stringify({
      state: { panelLayouts: { scene: { x: 24, y: 32 } } },
      version: 0,
    }),
  )

  const store = createPicodashStore()

  expect(store.getState().panelLayouts).toEqual({})
  expect(storage.getItem(panelLayoutStorageKey)).toBeNull()
})

test('does not fall back to retired storage when the current layout is malformed', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(panelLayoutStorageKey, '{malformed')
  storage.setItem(
    'retired-panel:provider-layout:v1',
    JSON.stringify({
      state: { panelLayouts: { scene: { x: 36, y: 48 } } },
      version: 0,
    }),
  )

  const persistStorage = createValidatedPanelPersistStorage()

  expect(persistStorage.getItem(panelLayoutStorageKey)).toBeNull()
  expect(storage.getItem(panelLayoutStorageKey)).toBeNull()
})

test('removes only the requested current layout key', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(panelLayoutStorageKey, 'current')
  storage.setItem('retired-panel:provider-layout:v1', 'retired')

  createValidatedPanelPersistStorage().removeItem(panelLayoutStorageKey)

  expect(storage.getItem(panelLayoutStorageKey)).toBeNull()
  expect(storage.getItem('retired-panel:provider-layout:v1')).toBe('retired')
})

test('rejects obsolete placement payloads stored under the current key', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(
    panelLayoutStorageKey,
    JSON.stringify({
      state: {
        panelLayouts: {
          scene: {
            dock: { horizontal: 'left', vertical: 'top' },
            placement: { mode: 'obsolete', position: 'top-left' },
            x: 48,
            y: 64,
          },
        },
      },
      version: 0,
    }),
  )

  expect(createPicodashStore().getState().panelLayouts).toEqual({})
  expect(storage.getItem(panelLayoutStorageKey)).toBeNull()
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
  store.getState().setPanelLayout('scene', freeLayout(24, 32))

  expect(store.getState().panelLayouts.scene).toEqual(freeLayout(24, 32))
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

  expect(() => store.getState().setPanelLayout('scene', freeLayout(24, 32))).not.toThrow()
  expect(() =>
    storage.setItem('layout', {
      state: { panelLayouts: { scene: freeLayout(24, 32) } },
      version: 1,
    }),
  ).not.toThrow()
  expect(() => storage.removeItem?.('layout')).not.toThrow()
  expect(store.getState().panelLayouts.scene).toEqual(freeLayout(24, 32))
})

test('accepts an initial layout write when no current layout exists', () => {
  const store = createPicodashStore({ persistLayout: false })

  expect(() => store.getState().setPanelLayout('scene', freeLayout(24, 32))).not.toThrow()
  expect(store.getState().panelLayouts.scene).toEqual(freeLayout(24, 32))
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
