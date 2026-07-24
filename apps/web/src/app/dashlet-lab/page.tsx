import type { Metadata } from 'next'
import { DashletLab } from '@/dashlet-lab'

export const metadata: Metadata = {
  title: 'Dashlet lab',
}

export default function DashletLabPage() {
  return <DashletLab />
}
