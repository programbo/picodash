import { connection } from 'next/server'
import type { ReactNode } from 'react'
import { HomeProvider } from '@/home-provider'

export default async function HomeLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection()
  return <HomeProvider>{children}</HomeProvider>
}
