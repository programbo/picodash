import type { ReactNode } from 'react'
import { DemoProvider } from '@/demo-provider'

export default function GalleryLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <DemoProvider>{children}</DemoProvider>
}
