import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { PanelRuntime, PanelRuntimePanelSnapshot } from './panel-runtime.ts'
import { createPanelRuntime } from './panel-runtime.ts'

const PanelRuntimeContext = createContext<PanelRuntime | undefined>(undefined)

export function DashPanelRuntimeProvider({ children }: { readonly children: ReactNode }) {
  const [runtime] = useState(() => createPanelRuntime())
  return <PanelRuntimeContext.Provider value={runtime}>{children}</PanelRuntimeContext.Provider>
}

export function useDashPanelRuntime(): PanelRuntime {
  const runtime = useContext(PanelRuntimeContext)
  if (!runtime) throw new TypeError('DashPanel runtime requires a DashPanelProvider.')
  return runtime
}

export function useDashPanelRuntimeState(scopeId: string): PanelRuntimePanelSnapshot | undefined {
  const runtime = useDashPanelRuntime()
  return useSyncExternalStore(
    (listener) => runtime.subscribe(listener),
    () => runtime.getSnapshot().panels[scopeId],
    () => runtime.getSnapshot().panels[scopeId],
  )
}
