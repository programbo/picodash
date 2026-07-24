import type { ReactNode } from 'react'
import { HomeProvider } from '@/components/providers/home-provider'

export default function HomeLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <HomeProvider>{children}</HomeProvider>
}
