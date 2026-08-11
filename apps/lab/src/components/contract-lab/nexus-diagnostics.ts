'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { PicodashDiagnostics } from '@picodash/nexus'

export interface ContractLabDiagnosticSource {
  readonly diagnostics: PicodashDiagnostics
}

export function useContractLabDiagnosticCount(stores: readonly ContractLabDiagnosticSource[]) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubscribers = stores.map((nexus) => nexus.diagnostics.subscribe(listener))
      return () => {
        for (const unsubscribe of unsubscribers) unsubscribe()
      }
    },
    [stores],
  )
  const getSnapshot = useCallback(
    () => stores.reduce((count, nexus) => count + nexus.diagnostics.getState().current.size, 0),
    [stores],
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
