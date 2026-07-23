import type { Metadata } from 'next'
import { GalleryUsage } from '@/gallery-usage'

export const metadata: Metadata = {
  title: 'Usage',
}

export default function UsagePage() {
  return <GalleryUsage />
}
