'use client'

import { GalleryFrame, GalleryTextToolbar } from '@/gallery-frame'
import { MoreExamples } from '@/more-examples'

export function GalleryMoreExamples() {
  return (
    <GalleryFrame activeTab="more-examples" toolbar={<GalleryTextToolbar />}>
      <MoreExamples />
    </GalleryFrame>
  )
}
