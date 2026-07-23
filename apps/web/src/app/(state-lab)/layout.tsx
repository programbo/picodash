import type { ReactNode } from 'react'
import { StateLabProviderBoundary } from '@/state-lab-provider-boundary'

export default function StateLabLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <StateLabProviderBoundary>{children}</StateLabProviderBoundary>
}
