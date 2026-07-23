import type { ReactNode } from 'react'
import { StateLabProviderBoundary } from '@/state-lab-provider-boundary'
import { StateLabShell } from '@/state-lab-shell'

export default function StateLabLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <StateLabProviderBoundary>
      <StateLabShell>{children}</StateLabShell>
    </StateLabProviderBoundary>
  )
}
