import { createElement, StrictMode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { expect, expectTypeOf, test, vi } from 'vite-plus/test'

import { createPicodashStore } from '../src/index.ts'
import { usePicodashStoreSelector } from '../src/react.ts'

test('updates selected values without rerendering for stable unrelated selections', () => {
  const store = createPicodashStore({
    fields: {
      count: { defaultValue: 1 },
      label: { defaultValue: 'One' },
    },
    panelId: 'selector',
  })
  const selectedValues: number[] = []
  let renders = 0
  let renderer: ReactTestRenderer | undefined

  function Count() {
    const count = usePicodashStoreSelector(store, (state) => state.values.count)
    renders += 1
    selectedValues.push(count)
    return createElement('output', null, count)
  }

  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  const originalConsoleError = console.error
  const consoleError = vi.spyOn(console, 'error').mockImplementation((message, ...arguments_) => {
    if (
      message ===
      'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer'
    ) {
      return
    }
    originalConsoleError(message, ...arguments_)
  })

  try {
    act(() => {
      renderer = create(createElement(StrictMode, null, createElement(Count)))
    })
    const initialRenders = renders

    act(() => {
      store.getState().setFieldValue(store.fields.label, 'Two')
    })
    expect(renders).toBe(initialRenders)

    act(() => {
      store.getState().setFieldValue(store.fields.count, 2)
    })
    expect(renders).toBeGreaterThan(initialRenders)
    expect(selectedValues.at(-1)).toBe(2)
    expect(renderer?.toJSON()).toMatchObject({ children: ['2'], type: 'output' })

    act(() => {
      renderer?.unmount()
    })
  } finally {
    consoleError.mockRestore()
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
  }
})

test('reads the complete initial Store snapshot during server rendering', () => {
  const store = createPicodashStore({
    fields: {
      count: { defaultValue: 1 },
    },
    initialValues: { count: 2 },
    panelId: 'server-selector',
  })

  store.getState().setFieldValue(store.fields.count, 3)

  function Count() {
    return createElement(
      'output',
      null,
      usePicodashStoreSelector(store, (state) => state.values.count),
    )
  }

  expect(renderToStaticMarkup(createElement(Count))).toBe('<output>2</output>')
})

test('preserves the selector result type', () => {
  const store = createPicodashStore({
    fields: {
      enabled: { defaultValue: true },
    },
    panelId: 'selector-types',
  })

  function Enabled() {
    const enabled = usePicodashStoreSelector(store, (state) => state.values.enabled)
    expectTypeOf(enabled).toEqualTypeOf<boolean>()
    return null
  }

  expect(renderToStaticMarkup(createElement(Enabled))).toBe('')
})
