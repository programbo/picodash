import type { Metadata } from 'next'
import { StateLabApp } from '@/state-lab-app'

export const metadata: Metadata = {
  title: 'Provider state',
}

export default function ProviderStatePage() {
  return <StateLabApp activeTab="provider" />
}
