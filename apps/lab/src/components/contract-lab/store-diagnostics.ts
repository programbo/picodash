'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { PicodashDiagnosticChannel } from '@picodash/store'

export interface ContractLabDiagnosticSource {
  readonly diagnostics: PicodashDiagnosticChannel
}

export function useContractLabDiagnosticCount(stores: readonly ContractLabDiagnosticSource[]) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubscribers = stores.map((store) => store.diagnostics.subscribe(listener))
      return () => {
        for (const unsubscribe of unsubscribers) unsubscribe()
      }
    },
    [stores],
  )
  const getSnapshot = useCallback(
    () => stores.reduce((count, store) => count + store.diagnostics.getSnapshot().length, 0),
    [stores],
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
