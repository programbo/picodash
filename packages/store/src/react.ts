import { useCallback, useDebugValue, useSyncExternalStore } from 'react'

import type { PicodashStore, PicodashStoreState } from './types.js'

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
