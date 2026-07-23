import { connection } from 'next/server'
import type { ReactNode } from 'react'
import { StateLabProvider } from '@/state-lab-provider'

export async function StateLabProviderBoundary({ children }: { children: ReactNode }) {
  await connection()
  return <StateLabProvider>{children}</StateLabProvider>
}
