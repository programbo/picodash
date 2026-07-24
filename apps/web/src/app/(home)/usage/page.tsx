import type { Metadata } from 'next'
import { HomeUsage } from '@/components/home/home-usage'

export const metadata: Metadata = {
  title: 'Usage',
}

export default function UsagePage() {
  return <HomeUsage />
}
