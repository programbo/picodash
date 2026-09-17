import type { Metadata } from 'next'
import { DashletLab } from '@lab/components/contract-lab/dashlet-gallery'

export const metadata: Metadata = {
  title: 'Dashlet Lab',
}

export default function DashletLabPage() {
  return <DashletLab />
}
