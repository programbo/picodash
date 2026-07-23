import type { Metadata } from 'next'
import { GalleryStore } from '@/gallery-store'

export const metadata: Metadata = {
  title: 'Store',
}

export default function StorePage() {
  return <GalleryStore />
}
