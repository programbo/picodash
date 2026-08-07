import { createContext, useContext, type ReactNode } from 'react'
import type { DashPanelBoundary, DashPanelBoundaryInset } from '../geometry/boundary.ts'
import { resolveDashPanelBoundary } from '../geometry/boundary.ts'
import {
  resolveDashPanelBoundaryInset,
  type ResolvedDashPanelBoundaryInset,
} from '../geometry/inset.ts'
import { resolvePanelDockPositions } from '../placement/dock-policy.ts'
import type { DashPanelDockPosition } from '../placement/placement.ts'
import { useDashPanelProviderPolicy } from './provider-policy-context.tsx'

export interface DashPanelPolicy {
  readonly getBoundary: () => Element | null
  readonly boundaryInset: ResolvedDashPanelBoundaryInset
  readonly dockPositions: readonly DashPanelDockPosition[]
}

export interface DashPanelPolicyProviderProps {
  readonly children: ReactNode
  readonly boundary?: DashPanelBoundary | null
  readonly boundaryInset?: DashPanelBoundaryInset
  readonly dockPositions?: readonly DashPanelDockPosition[]
}

const DashPanelPolicyContext = createContext<DashPanelPolicy | undefined>(undefined)

export function DashPanelPolicyProvider({
  children,
  boundary,
  boundaryInset,
  dockPositions,
}: DashPanelPolicyProviderProps) {
  const providerPolicy = useDashPanelProviderPolicy()
  const getBoundary = () => resolveDashPanelBoundary(boundary, providerPolicy.boundary)

  // Validate the current ref during render without retaining the resolved Element. The closure
  // stays live so callers observe later ref changes without a React rerender.
  getBoundary()

  const resolvedBoundaryInset =
    boundaryInset === undefined
      ? providerPolicy.boundaryInset
      : resolveDashPanelBoundaryInset(boundaryInset)
  const resolvedDockPositions =
    dockPositions === undefined
      ? providerPolicy.dockPositions
      : resolvePanelDockPositions(providerPolicy.dockPositions, dockPositions)
  const policy = Object.freeze({
    getBoundary,
    boundaryInset: resolvedBoundaryInset,
    dockPositions: resolvedDockPositions,
  })

  return (
    <DashPanelPolicyContext.Provider value={policy}>{children}</DashPanelPolicyContext.Provider>
  )
}

export function DashPanelPolicyBoundary({ children }: { readonly children: ReactNode }) {
  return (
    <DashPanelPolicyContext.Provider value={undefined}>{children}</DashPanelPolicyContext.Provider>
  )
}

export function useDashPanelPolicy(): DashPanelPolicy {
  const policy = useContext(DashPanelPolicyContext)
  if (policy === undefined) throw new TypeError('DashPanel policy requires an active DashPanel.')
  return policy
}
