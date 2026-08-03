import { createContext, useContext, type ReactNode } from 'react'
import type { PicodashStore } from '@picodash/store'

const PicodashListScopeContext = createContext<string | null>(null)

export function PicodashListScopeProvider<TValues extends object>({
  children,
  store,
}: {
  children: ReactNode
  store: PicodashStore<TValues>
}) {
  const state = store.getState()
  const scopeId = state.scopeId ?? state.panelId ?? state.storeId
  return (
    <PicodashListScopeContext.Provider value={scopeId}>
      {children}
    </PicodashListScopeContext.Provider>
  )
}

export function usePicodashListScope() {
  return useContext(PicodashListScopeContext)
}
