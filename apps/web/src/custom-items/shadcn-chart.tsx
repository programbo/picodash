import type { ReactNode } from 'react'
import { PicodashChart } from '@picodash/panel'

export const shadcnChartTypes = ['area', 'bar', 'line', 'pie', 'radar', 'radial'] as const
export type ShadcnChartType = (typeof shadcnChartTypes)[number]

const frameData = [
  { frame: '01', gpu: 8.9, target: 16.7 },
  { frame: '02', gpu: 11.4, target: 16.7 },
  { frame: '03', gpu: 10.2, target: 16.7 },
  { frame: '04', gpu: 13.8, target: 16.7 },
  { frame: '05', gpu: 15.2, target: 16.7 },
  { frame: '06', gpu: 12.7, target: 16.7 },
  { frame: '07', gpu: 14.1, target: 16.7 },
  { frame: '08', gpu: 11.6, target: 16.7 },
]

const areaSeries = [
  {
    dataKey: 'gpu',
    fill: 'var(--chart-1)',
    fillOpacity: 0.28,
    stroke: 'var(--chart-1)',
    strokeWidth: 2,
    type: 'monotone',
  },
] as const

const barSeries = [
  {
    dataKey: 'gpu',
    fill: 'var(--chart-1)',
    radius: [3, 3, 0, 0] as [number, number, number, number],
  },
] as const

const frameSeries = [
  {
    dataKey: 'target',
    dot: false,
    stroke: 'var(--chart-4)',
    strokeDasharray: '4 4',
    strokeWidth: 1,
    type: 'linear',
  },
  {
    activeDot: { r: 3 },
    dataKey: 'gpu',
    dot: false,
    stroke: 'var(--chart-1)',
    strokeWidth: 2,
    type: 'monotone',
  },
] as const

const radarSeries = [
  {
    dataKey: 'gpu',
    fill: 'var(--chart-1)',
    fillOpacity: 0.28,
    stroke: 'var(--chart-1)',
  },
] as const

const radialSeries = [
  {
    dataKey: 'gpu',
    fill: 'var(--chart-1)',
  },
] as const

type ShadcnChartItemProps = {
  accessibilityLayer?: boolean
  contentLayout?: 'block' | 'full' | 'inline'
  description?: ReactNode
  disabled?: boolean
  help?: ReactNode
  readOnly?: boolean
  reorderable?: boolean
  type?: ShadcnChartType
  visible?: boolean
}

export function ShadcnChartItem({
  accessibilityLayer,
  contentLayout,
  description,
  disabled,
  help,
  readOnly,
  reorderable,
  type = 'line',
  visible,
}: ShadcnChartItemProps) {
  const itemProps = {
    accessibilityLayer,
    contentLayout,
    data: frameData,
    description,
    disabled,
    help,
    id: 'shadcn-frame-chart',
    label: 'Chart',
    readOnly,
    reorderable,
    tooltipProps: { cursor: false },
    visible,
  } as const

  if (type === 'area') {
    return (
      <PicodashChart
        {...itemProps}
        areaChartProps={{ margin: { left: 12, right: 8, top: 8 } }}
        cartesianGridProps={{ strokeDasharray: '2 4', vertical: false }}
        series={areaSeries}
        type="area"
        xAxisProps={{ axisLine: false, dataKey: 'frame', tickLine: false, tickMargin: 8 }}
        yAxisProps={cartesianYAxisProps}
      />
    )
  }

  if (type === 'bar') {
    return (
      <PicodashChart
        {...itemProps}
        barChartProps={{ margin: { left: 12, right: 8, top: 8 } }}
        cartesianGridProps={{ strokeDasharray: '2 4', vertical: false }}
        series={barSeries}
        type="bar"
        xAxisProps={{ axisLine: false, dataKey: 'frame', tickLine: false, tickMargin: 8 }}
        yAxisProps={cartesianYAxisProps}
      />
    )
  }

  if (type === 'pie') {
    return (
      <PicodashChart
        {...itemProps}
        pieChartProps={{ margin: { bottom: 4, top: 4 } }}
        pieProps={{
          dataKey: 'gpu',
          fill: 'var(--chart-1)',
          innerRadius: 28,
          nameKey: 'frame',
          outerRadius: 55,
          paddingAngle: 2,
        }}
        type="pie"
      />
    )
  }

  if (type === 'radar') {
    return (
      <PicodashChart
        {...itemProps}
        polarAngleAxisProps={{ dataKey: 'frame', tick: { fontSize: 9 } }}
        polarGridProps={{ gridType: 'polygon' }}
        polarRadiusAxisProps={{ domain: [0, 20], tick: false }}
        radarChartProps={{ margin: { bottom: 4, left: 12, right: 12, top: 4 } }}
        series={radarSeries}
        type="radar"
      />
    )
  }

  if (type === 'radial') {
    return (
      <PicodashChart
        {...itemProps}
        polarAngleAxisProps={{ domain: [0, 20], tick: false, type: 'number' }}
        polarGridProps={{ gridType: 'circle' }}
        radialBarChartProps={{
          cx: '50%',
          cy: '50%',
          endAngle: 0,
          innerRadius: '24%',
          outerRadius: '92%',
          startAngle: 180,
        }}
        series={radialSeries}
        type="radial"
      />
    )
  }

  return (
    <PicodashChart
      {...itemProps}
      cartesianGridProps={{ strokeDasharray: '2 4', vertical: false }}
      lineChartProps={{ margin: { left: 12, right: 8, top: 8 } }}
      series={frameSeries}
      type="line"
      xAxisProps={{ axisLine: false, dataKey: 'frame', tickLine: false, tickMargin: 8 }}
      yAxisProps={cartesianYAxisProps}
    />
  )
}

const cartesianYAxisProps = {
  allowDecimals: false,
  axisLine: false,
  domain: [0, 20] as [number, number],
  tickLine: false,
  tickMargin: 6,
  ticks: [0, 5, 10, 15, 20],
  width: 36,
}
