'use client'

import { GalleryFrame, GalleryTextToolbar } from '@/gallery-frame'
import { UsageGuide } from '@/usage-guide'

export function GalleryUsage() {
  return (
    <GalleryFrame activeTab="usage" toolbar={<GalleryTextToolbar />}>
      <UsageGuide />
    </GalleryFrame>
  )
}
