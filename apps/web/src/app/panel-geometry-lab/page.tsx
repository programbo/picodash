import type { Metadata } from 'next'
import { PanelGeometryLab } from '@/panel-geometry-lab'

export const metadata: Metadata = {
  title: 'Panel geometry lab',
}

export default async function PanelGeometryLabPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string | string[] }>
}) {
  const fixtureParam = (await searchParams).fixture
  const fixture = Array.isArray(fixtureParam) ? fixtureParam[0] : fixtureParam

  return <PanelGeometryLab fixture={fixture} />
}
