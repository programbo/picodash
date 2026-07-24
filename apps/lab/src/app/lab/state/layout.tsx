import type { ReactNode } from 'react'
import { StateLabProviderBoundary } from '@/components/providers/state-lab-provider-boundary'
import { StateLabShell } from '@/components/state-lab/state-lab-shell'

export default function StateLabLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <StateLabProviderBoundary>
      <StateLabShell>{children}</StateLabShell>
    </StateLabProviderBoundary>
  )
}
