import type { Metadata } from 'next'
import { GalleryThemes } from '@/gallery-themes'

export const metadata: Metadata = {
  title: 'Themes',
}

export default function ThemesPage() {
  return <GalleryThemes />
}
