import type { Metadata } from 'next'
import { HomeStore } from '@/components/home/home-store'

export const metadata: Metadata = {
  title: 'Store',
}

export default function StorePage() {
  return <HomeStore />
}
