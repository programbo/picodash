import type { Metadata } from 'next'
import { HomeUsage } from '@/home-usage'

export const metadata: Metadata = {
  title: 'Usage',
}

export default function UsagePage() {
  return <HomeUsage />
}
