import type { Metadata } from 'next'
import { GalleryThemes } from '@/components/home/gallery-themes'

export const metadata: Metadata = {
  title: 'Themes',
}

export default function ThemesPage() {
  return <GalleryThemes />
}
