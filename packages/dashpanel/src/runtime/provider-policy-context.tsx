import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { DashPanelBoundary, DashPanelBoundaryInset } from '../geometry/boundary.ts'
import { resolveDashPanelBoundary } from '../geometry/boundary.ts'
import {
  resolveDashPanelBoundaryInset,
  type ResolvedDashPanelBoundaryInset,
} from '../geometry/inset.ts'
import { resolveProviderDockPositions } from '../placement/dock-policy.ts'
import type { DashPanelDockPosition } from '../placement/placement.ts'

export interface DashPanelProviderPolicy {
  readonly boundary: DashPanelBoundary | null
  readonly boundaryInset: ResolvedDashPanelBoundaryInset
  readonly dockPositions: readonly DashPanelDockPosition[]
}

export interface DashPanelProviderPolicyProviderProps {
  readonly children: ReactNode
  readonly boundary?: DashPanelBoundary | null
  readonly boundaryInset?: DashPanelBoundaryInset
  readonly dockPositions?: readonly DashPanelDockPosition[]
}

const DashPanelProviderPolicyContext = createContext<DashPanelProviderPolicy | undefined>(undefined)

export function DashPanelProviderPolicyProvider({
  children,
  boundary,
  boundaryInset,
  dockPositions,
}: DashPanelProviderPolicyProviderProps) {
  const resolvedBoundary = resolveDashPanelBoundary(boundary)
  const policy = useMemo(() => {
    const resolvedInset = resolveDashPanelBoundaryInset(undefined, boundaryInset)
    const resolvedDockPositions = resolveProviderDockPositions(dockPositions)
    return Object.freeze({
      boundary: boundary ?? null,
      boundaryInset: resolvedInset,
      dockPositions: resolvedDockPositions,
    })
  }, [boundary, boundaryInset, dockPositions, resolvedBoundary])

  return (
    <DashPanelProviderPolicyContext.Provider value={policy}>
      {children}
    </DashPanelProviderPolicyContext.Provider>
  )
}

export function useDashPanelProviderPolicy(): DashPanelProviderPolicy {
  const policy = useContext(DashPanelProviderPolicyContext)
  if (policy === undefined)
    throw new TypeError('DashPanel provider policy requires a DashPanelProvider.')
  return policy
}
