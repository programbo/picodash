import { connection } from 'next/server'
import type { ReactNode } from 'react'
import { GalleryProvider } from '@/gallery-provider'

export default async function GalleryLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection()
  return <GalleryProvider>{children}</GalleryProvider>
}
