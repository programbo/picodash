import type { Metadata } from 'next'
import { ComponentsGuide } from '@/components/docs/components-guide'

export const metadata: Metadata = {
  title: 'Components',
}

export default function ComponentsPage() {
  return <ComponentsGuide />
}
