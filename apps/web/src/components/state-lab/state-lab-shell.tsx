'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { StateLabApp, type StateLabTab } from '@/components/state-lab/state-lab-app'

export function StateLabShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <StateLabApp activeTab={stateLabTabFromPathname(pathname)} />
      {children}
    </>
  )
}

function stateLabTabFromPathname(pathname: string): StateLabTab {
  switch (pathname) {
    case '/lab/state/scene':
      return 'scene'
    case '/lab/state/built-in-items':
      return 'built-in-items'
    case '/lab/state/custom-items':
      return 'custom-items'
    default:
      return 'provider'
  }
}
