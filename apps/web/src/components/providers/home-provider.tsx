import type { ReactNode } from 'react'
import { DemoProvider } from '@/components/providers/demo-provider'

export function HomeProvider({ children }: Readonly<{ children: ReactNode }>) {
  return <DemoProvider>{children}</DemoProvider>
}
