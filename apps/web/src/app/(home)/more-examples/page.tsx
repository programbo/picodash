import type { Metadata } from 'next'
import { HomeMoreExamples } from '@/components/home/home-more-examples'

export const metadata: Metadata = {
  title: 'More examples',
}

export default function MoreExamplesPage() {
  return <HomeMoreExamples />
}
