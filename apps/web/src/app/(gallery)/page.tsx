import type { Metadata } from 'next'
import { GalleryCode } from '@/gallery-code'

export const metadata: Metadata = {
  title: 'Code',
}

export default function CodePage() {
  return <GalleryCode />
}
