import type { Metadata } from 'next'
import { HomeCode } from '@/components/home/home-code'

export const metadata: Metadata = {
  title: 'Code',
}

export default function CodePage() {
  return <HomeCode />
}
