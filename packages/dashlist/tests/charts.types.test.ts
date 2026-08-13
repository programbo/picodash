import { createElement } from 'react'
import {
  ChartDashlet,
  SparklineDashlet,
  type ChartDashletProps,
  type SparklineDashletProps,
} from '../src/charts.tsx'
import { defineChart, lineY } from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'

const definition = defineChart({
  marks: [lineY([{ x: 0, y: 1 }], { x: 'x', y: 'y' })],
  x: { scale: scaleLinear },
  y: { scale: scaleLinear },
})

const chartProps: ChartDashletProps = {
  id: 'chart',
  label: 'Chart',
  definition,
  chartProps: { height: 120, className: 'chart' },
}
void createElement(ChartDashlet, chartProps)

const sparklineProps: SparklineDashletProps = {
  id: 'sparkline',
  label: 'Sparkline',
  source: (emit) => {
    emit(1)
    return () => undefined
  },
  maxSamples: 20,
}
void createElement(SparklineDashlet, sparklineProps)

// @ts-expect-error charts are unbound shells and do not accept Nexus fields.
void createElement(ChartDashlet, { ...chartProps, field: {} })
// @ts-expect-error Sparkline owns local history and does not accept a series DSL.
void createElement(SparklineDashlet, { ...sparklineProps, series: [] })
