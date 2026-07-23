import type { Metadata } from 'next'
import { GalleryMoreExamples } from '@/gallery-more-examples'

export const metadata: Metadata = {
  title: 'More examples',
}

export default function MoreExamplesPage() {
  return <GalleryMoreExamples />
}
