import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, test } from 'vite-plus/test'
import { createTweakerStore, TweakerProvider } from '../src/tweaker-provider.tsx'

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
  const store = createTweakerStore({ storageKey: 'custom-panel-layout' })

  store.getState().setPanelLayout('scene', { x: 24, y: 32 })

  expect(storage.getItem('custom-panel-layout')).toBeTruthy()
  expect(storage.getItem('tweaker-panel:provider-layout:v1')).toBeNull()
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

  const store = createTweakerStore({ persistLayout: false })
  store.getState().setPanelLayout('scene', { x: 24, y: 32 })

  expect(store.getState().panelLayouts.scene).toEqual({ x: 24, y: 32 })
  expect(accesses).toBe(0)
})

test('applies explicit and system-resolved themes to the provider carrier', () => {
  expect(renderProvider('light')).toContain('data-tweaker-theme="light"')

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: (query: string) => ({
        matches: query.includes('light'),
      }),
    },
  })

  expect(renderProvider('system')).toContain('data-tweaker-theme="light"')
})

function renderProvider(theme: 'dark' | 'light' | 'system') {
  return renderToStaticMarkup(
    createElement(TweakerProvider, {
      children: createElement('span', null, 'Content'),
      theme,
    }),
  )
}

function installFakeLocalStorage() {
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
