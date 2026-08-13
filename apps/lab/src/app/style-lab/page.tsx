import type { Metadata } from 'next'
import { DashletStyleLabPage } from '@lab/components/contract-lab/style-lab-page'

export const metadata: Metadata = {
  title: 'Dashlet Style Lab',
}

export default function StyleLabPage() {
  return <DashletStyleLabPage />
}
