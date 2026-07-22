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

test('applies explicit and system-resolved themes to the provider carrier', () => {
  expect(renderProvider('light')).toContain('data-picodash-theme="light"')

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: (query: string) => ({
        matches: query.includes('light'),
      }),
    },
  })

  expect(renderProvider('system')).toContain('data-picodash-theme="light"')
})

function renderProvider(theme: 'dark' | 'light' | 'system') {
  return renderToStaticMarkup(
    createElement(PicodashProvider, {
      children: createElement('span', null, 'Content'),
      theme,
    }),
  )
}
