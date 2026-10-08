'use client'

import { defineChart, lineY } from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { DashStack } from '@picodash/dashstack'
import type { RootNexus, PicodashFieldDefinitions } from '@picodash/nexus'
import { ChartDashlet, SparklineDashlet, type SparklineSource } from '@picodash/dashstack/charts'

const samples = [24, 32, 29, 46, 39, 58, 52, 64, 60, 74, 68, 82]
const definition = defineChart({
  svgAnimation: false,
  marks: [lineY(samples)],
  x: { scale: scaleLinear, axis: false },
  y: { scale: scaleLinear, axis: false },
})
const source: SparklineSource = (emit) => {
  for (const value of samples) emit(value)
}

export function GalleryCharts<Fields extends PicodashFieldDefinitions>({
  nexus,
}: {
  readonly nexus: RootNexus<Fields>
}) {
  return (
    <section aria-label="Experimental charts" className="min-w-0 py-5">
      <h2 className="mb-3 font-mono text-sm font-medium">Charts</h2>
      <p className="mb-3 text-sm text-(--picodash-color-text-muted)">Experimental · sample data</p>
      <DashStack
        nexus={nexus}
        id="gallery-charts"
        aria-label="Chart variations"
        reorderable={false}
      >
        <ChartDashlet id="chart" label="ChartDashlet" definition={definition} />
        <SparklineDashlet id="sparkline" label="SparklineDashlet" source={source} maxSamples={24} />
      </DashStack>
    </section>
  )
}
