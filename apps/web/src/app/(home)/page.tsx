import type { Metadata } from 'next'
import { HomeCode } from '@/home-code'

export const metadata: Metadata = {
  title: 'Code',
}

export default function CodePage() {
  return <HomeCode />
}
