import type { Metadata } from 'next'
import { StateLabApp } from '@/state-lab-app'

export const metadata: Metadata = {
  title: 'Built-in item state',
}

export default function BuiltInItemsStatePage() {
  return <StateLabApp activeTab="built-in-items" />
}
