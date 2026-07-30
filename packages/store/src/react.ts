import {
  useCallback,
  useDebugValue,
  useEffect,
  useRef,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from 'react'

import type { PicodashAdapterWriteContext, PicodashValueAdapter } from './adapter.js'
import type { PicodashStore, PicodashStoreState } from './types.js'

export interface PicodashReactAdapterOptions {
  readonly id?: string
}

export function usePicodashStoreSelector<TValues extends object, TSelection>(
  store: PicodashStore<TValues>,
  selector: (state: PicodashStoreState<TValues>) => TSelection,
): TSelection {
  const selection = useSyncExternalStore(
    store.subscribe,
    useCallback(() => selector(store.getState()), [selector, store]),
    useCallback(() => selector(store.getInitialState()), [selector, store]),
  )
  useDebugValue(selection)
  return selection
}

export function usePicodashStateAdapter<TValues extends object>(
  values: TValues,
  setValues: Dispatch<SetStateAction<TValues>>,
  options: PicodashReactAdapterOptions = {},
): PicodashValueAdapter<TValues> {
  const binding = useRef(setValues)
  binding.current = setValues
  return usePicodashControlledAdapter(
    values,
    (nextValues) => {
      binding.current(nextValues)
    },
    options,
  )
}

export function usePicodashReducerAdapter<TValues extends object, TAction>(
  values: TValues,
  dispatch: Dispatch<TAction>,
  createAction: (values: TValues, context: PicodashAdapterWriteContext<TValues>) => TAction,
  options: PicodashReactAdapterOptions = {},
): PicodashValueAdapter<TValues> {
  const binding = useRef({ createAction, dispatch })
  binding.current = { createAction, dispatch }

  return usePicodashControlledAdapter(
    values,
    (nextValues, context) => {
      const current = binding.current
      current.dispatch(current.createAction(nextValues, context))
    },
    options,
  )
}

function usePicodashControlledAdapter<TValues extends object>(
  values: TValues,
  writeValues: (
    values: TValues,
    context: PicodashAdapterWriteContext<TValues>,
  ) => boolean | undefined | void,
  options: PicodashReactAdapterOptions,
): PicodashValueAdapter<TValues> {
  const current = useRef<{
    adapter: PicodashValueAdapter<TValues>
    listeners: Set<() => void>
    options: PicodashReactAdapterOptions
    notifiedSnapshot: TValues
    snapshot: TValues
    writeValues: (
      values: TValues,
      context: PicodashAdapterWriteContext<TValues>,
    ) => boolean | undefined | void
  } | null>(null)

  if (current.current === null) {
    const binding = {
      adapter: undefined as unknown as PicodashValueAdapter<TValues>,
      listeners: new Set<() => void>(),
      options,
      notifiedSnapshot: values,
      snapshot: values,
      writeValues,
    }
    binding.adapter = Object.freeze({
      get id() {
        return binding.options.id
      },
      getSnapshot() {
        return binding.snapshot
      },
      setValues(nextValues: TValues, context: PicodashAdapterWriteContext<TValues>) {
        const previousValues = binding.snapshot
        binding.snapshot = nextValues
        let accepted: boolean | undefined | void
        try {
          accepted = binding.writeValues(nextValues, context)
        } catch (error) {
          binding.snapshot = previousValues
          throw error
        }
        if (accepted === false || isPromiseLike(accepted)) {
          binding.snapshot = previousValues
          return accepted
        }
        binding.notifiedSnapshot = nextValues
        for (const listener of binding.listeners) listener()
        return accepted
      },
      subscribe(listener: () => void) {
        binding.listeners.add(listener)
        return () => {
          binding.listeners.delete(listener)
        }
      },
    })
    current.current = binding
  }

  current.current.options = options
  current.current.snapshot = values
  current.current.writeValues = writeValues
  useEffect(() => {
    const binding = current.current
    if (binding === null || Object.is(binding.notifiedSnapshot, values)) return
    binding.notifiedSnapshot = values
    for (const listener of binding.listeners) listener()
  }, [values])
  return current.current.adapter
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof (value as { readonly then?: unknown }).then === 'function'
  )
}
