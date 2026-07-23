import type { Metadata } from 'next'
import { HomeStore } from '@/home-store'

export const metadata: Metadata = {
  title: 'Store',
}

export default function StorePage() {
  return <HomeStore />
}
