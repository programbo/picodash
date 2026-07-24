import type { Metadata } from 'next'
import { PanelInteractionLab } from '@/panel-interaction-lab'

export const metadata: Metadata = {
  title: 'Panel interaction lab',
}

export default async function PanelInteractionLabPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string | string[] }>
}) {
  const fixtureParam = (await searchParams).fixture
  const fixture = Array.isArray(fixtureParam) ? fixtureParam[0] : fixtureParam

  return <PanelInteractionLab fixture={fixture} />
}
