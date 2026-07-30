import type { Metadata } from 'next'
import { AgentFirstHomePage } from '@/components/home/agent-first-home-page'

export const metadata: Metadata = {
  title: 'Code',
}

export default function CodePage() {
  return <AgentFirstHomePage />
}
