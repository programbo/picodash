import type { Metadata } from 'next'
import { PlanetaryLab } from '@lab/components/contract-lab/planetary-lab'

export const metadata: Metadata = { title: 'Planetary Lab' }
export default function PlanetaryLabPage() {
  return <PlanetaryLab />
}
