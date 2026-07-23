import type { Metadata } from 'next'
import { StateLabApp } from '@/state-lab-app'

export const metadata: Metadata = {
  title: 'Custom item state',
}

export default function CustomItemsStatePage() {
  return <StateLabApp activeTab="custom-items" />
}
