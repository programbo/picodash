import type { Metadata } from 'next'
import { StateLabApp } from '@/state-lab-app'

export const metadata: Metadata = {
  title: 'Scene state',
}

export default function SceneStatePage() {
  return <StateLabApp activeTab="scene" />
}
