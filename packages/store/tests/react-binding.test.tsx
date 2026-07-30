import {
  createElement,
  StrictMode,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { expect, test, vi } from 'vite-plus/test'
import { createPicodashStore, type PicodashStore } from '../src/index.ts'
import {
  usePicodashReducerAdapter,
  usePicodashStateAdapter,
  usePicodashStoreSelector,
} from '../src/react.ts'

type Values = { count: number; title: string }

test('binds a complete useState record through Strict Mode without mirroring effects', () => {
  let store: PicodashStore<Values> | undefined
  let renderer: ReactTestRenderer | undefined

  function Fixture() {
    const [values, setValues] = useState<Values>({ count: 1, title: 'State' })
    const adapter = usePicodashStateAdapter(values, setValues, { id: 'react-state' })
    const storeRef = useRef<PicodashStore<Values> | null>(null)
    storeRef.current ??= createBoundStore(adapter)
    store = storeRef.current
    const selected = usePicodashStoreSelector(storeRef.current, (state) => state.values)
    return createElement('output', null, `${selected.count}:${selected.title}`)
  }

  withReactTestEnvironment(() => {
    act(() => {
      renderer = create(createElement(StrictMode, null, createElement(Fixture)))
    })
    expect(renderer?.toJSON()).toMatchObject({ children: ['1:State'] })

    act(() => {
      expect(store?.getState().setFieldValues({ count: 2, title: 'Picodash' })).toEqual({
        success: true,
      })
    })
    expect(renderer?.toJSON()).toMatchObject({ children: ['2:Picodash'] })

    act(() => renderer?.unmount())
  })
})

test('synchronizes host-owned useState updates into the Store', () => {
  let setHostValues: Dispatch<SetStateAction<Values>> | undefined
  let store: PicodashStore<Values> | undefined
  let renderer: ReactTestRenderer | undefined

  function Fixture() {
    const [values, setValues] = useState<Values>({ count: 1, title: 'Host' })
    setHostValues = setValues
    const adapter = usePicodashStateAdapter(values, setValues)
    const storeRef = useRef<PicodashStore<Values> | null>(null)
    storeRef.current ??= createBoundStore(adapter)
    store = storeRef.current
    const selected = usePicodashStoreSelector(storeRef.current, (state) => state.values)
    return createElement('output', null, `${selected.count}:${selected.title}`)
  }

  withReactTestEnvironment(() => {
    act(() => {
      renderer = create(createElement(StrictMode, null, createElement(Fixture)))
    })
    act(() => {
      setHostValues?.({ count: 8, title: 'Outside' })
    })

    expect(store?.getState().values).toEqual({ count: 8, title: 'Outside' })
    expect(renderer?.toJSON()).toMatchObject({ children: ['8:Outside'] })
    act(() => renderer?.unmount())
  })
})

test('binds complete reducer actions and preserves adapter write context', () => {
  type Action = {
    context?: { panelId: string; source: string }
    type: 'replace'
    values: Values
  }
  let store: PicodashStore<Values> | undefined
  const actions: Action[] = []
  let renderer: ReactTestRenderer | undefined

  function Fixture() {
    const [values, dispatch] = useReducer(
      (_: Values, action: Action) => {
        actions.push(action)
        return action.values
      },
      { count: 1, title: 'Reducer' },
    )
    const adapter = usePicodashReducerAdapter(
      values,
      dispatch,
      (nextValues, context): Action => ({
        context: { panelId: context.panelId, source: context.source },
        type: 'replace',
        values: nextValues,
      }),
      { id: 'react-reducer' },
    )
    const storeRef = useRef<PicodashStore<Values> | null>(null)
    storeRef.current ??= createBoundStore(adapter)
    store = storeRef.current
    const count = usePicodashStoreSelector(storeRef.current, (state) => state.values.count)
    return createElement('output', null, count)
  }

  withReactTestEnvironment(() => {
    act(() => {
      renderer = create(createElement(StrictMode, null, createElement(Fixture)))
    })
    act(() => {
      expect(store?.getState().setFieldValue(store.fields.count, 4)).toEqual({ success: true })
    })

    expect(actions).toContainEqual({
      context: { panelId: 'react-binding', source: 'programmatic' },
      type: 'replace',
      values: { count: 4, title: 'Reducer' },
    })
    expect(renderer?.toJSON()).toMatchObject({ children: ['4'] })
    act(() => renderer?.unmount())
  })
})

test('uses the controlled record as the server snapshot', () => {
  function Fixture() {
    const [values, setValues] = useState<Values>({ count: 6, title: 'Server' })
    const adapter = usePicodashStateAdapter(values, setValues)
    const storeRef = useRef<PicodashStore<Values> | null>(null)
    storeRef.current ??= createBoundStore(adapter)
    const selected = usePicodashStoreSelector(storeRef.current, (state) => state.values)
    return createElement('output', null, `${selected.count}:${selected.title}`)
  }

  expect(renderToStaticMarkup(createElement(Fixture))).toBe('<output>6:Server</output>')
})

function createBoundStore(
  adapter: ReturnType<typeof usePicodashStateAdapter<Values>>,
): PicodashStore<Values> {
  return createPicodashStore<Values>({
    adapter,
    fields: {
      count: { defaultValue: 0 },
      title: { defaultValue: 'Default' },
    },
    panelId: 'react-binding',
  })
}

function withReactTestEnvironment(run: () => void): void {
  const environment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const previous = environment.IS_REACT_ACT_ENVIRONMENT
  environment.IS_REACT_ACT_ENVIRONMENT = true
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
    run()
  } finally {
    consoleError.mockRestore()
    environment.IS_REACT_ACT_ENVIRONMENT = previous
  }
}
