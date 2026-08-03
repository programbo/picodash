import type { CSSProperties } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  PicodashCartesianChartProps,
  PicodashChartImplementationProps,
  PicodashChartTooltipProps,
} from '../chart.js'

const defaultTooltipContentStyle = {
  backgroundColor: 'var(--picodash-color-surface-raised)',
  border: '1px solid var(--picodash-color-border)',
  borderRadius: 'var(--picodash-radius-control)',
  color: 'var(--picodash-color-text)',
} satisfies CSSProperties
const defaultTooltipLabelStyle = {
  color: 'var(--picodash-color-text-strong)',
} satisfies CSSProperties

export default function PicodashChartImplementation({
  accessibilityLayer,
  data,
  initialDimension,
  legendProps,
  props,
  tooltipProps,
}: PicodashChartImplementationProps) {
  return (
    <ResponsiveContainer initialDimension={initialDimension}>
      {renderChart({ accessibilityLayer, data, legendProps, props, tooltipProps })}
    </ResponsiveContainer>
  )
}

function renderChart({
  accessibilityLayer,
  data,
  legendProps,
  props,
  tooltipProps,
}: Omit<PicodashChartImplementationProps, 'initialDimension'>) {
  const shared = (
    <>
      {tooltipProps === false ? null : <ThemedChartTooltip tooltipProps={tooltipProps} />}
      {legendProps === false || legendProps === undefined ? null : <Legend {...legendProps} />}
    </>
  )

  if (props.type === 'area') {
    return (
      <AreaChart accessibilityLayer={accessibilityLayer} data={[...data]} {...props.areaChartProps}>
        <CartesianParts {...props} />
        {shared}
        {props.series.map(({ dataKey, ...seriesProps }) => (
          <Area key={dataKey} dataKey={dataKey} {...seriesProps} />
        ))}
      </AreaChart>
    )
  }

  if (props.type === 'bar') {
    return (
      <BarChart accessibilityLayer={accessibilityLayer} data={[...data]} {...props.barChartProps}>
        <CartesianParts {...props} />
        {shared}
        {props.series.map(({ dataKey, ...seriesProps }) => (
          <Bar key={dataKey} dataKey={dataKey} {...seriesProps} />
        ))}
      </BarChart>
    )
  }

  if (props.type === 'line') {
    return (
      <LineChart accessibilityLayer={accessibilityLayer} data={[...data]} {...props.lineChartProps}>
        <CartesianParts {...props} />
        {shared}
        {props.series.map(({ dataKey, ...seriesProps }) => (
          <Line key={dataKey} dataKey={dataKey} {...seriesProps} />
        ))}
      </LineChart>
    )
  }

  if (props.type === 'pie') {
    return (
      <PieChart accessibilityLayer={accessibilityLayer} {...props.pieChartProps}>
        {shared}
        <Pie data={[...data]} {...props.pieProps} />
      </PieChart>
    )
  }

  const polarParts = (
    <>
      {props.polarGridProps === false ? null : <PolarGrid {...props.polarGridProps} />}
      {props.polarAngleAxisProps === false ? null : (
        <PolarAngleAxis {...props.polarAngleAxisProps} />
      )}
      {props.polarRadiusAxisProps === false ? null : (
        <PolarRadiusAxis {...props.polarRadiusAxisProps} />
      )}
    </>
  )

  if (props.type === 'radar') {
    return (
      <RadarChart
        accessibilityLayer={accessibilityLayer}
        data={[...data]}
        {...props.radarChartProps}
      >
        {polarParts}
        {shared}
        {props.series.map(({ dataKey, ...seriesProps }) => (
          <Radar key={dataKey} dataKey={dataKey} {...seriesProps} />
        ))}
      </RadarChart>
    )
  }

  return (
    <RadialBarChart
      accessibilityLayer={accessibilityLayer}
      data={[...data]}
      {...props.radialBarChartProps}
    >
      {polarParts}
      {shared}
      {props.series.map(({ dataKey, ...seriesProps }) => (
        <RadialBar key={dataKey} dataKey={dataKey} {...seriesProps} />
      ))}
    </RadialBarChart>
  )
}

function ThemedChartTooltip({
  tooltipProps,
}: {
  tooltipProps: PicodashChartTooltipProps | undefined
}) {
  const { contentStyle, labelStyle, ...remainingTooltipProps } = tooltipProps ?? {}

  return (
    <ChartTooltip
      {...remainingTooltipProps}
      contentStyle={{ ...defaultTooltipContentStyle, ...contentStyle }}
      labelStyle={{ ...defaultTooltipLabelStyle, ...labelStyle }}
    />
  )
}

function CartesianParts({
  cartesianGridProps,
  xAxisProps,
  yAxisProps,
}: PicodashCartesianChartProps) {
  return (
    <>
      {cartesianGridProps === false ? null : <CartesianGrid {...cartesianGridProps} />}
      {xAxisProps === false ? null : <XAxis {...xAxisProps} />}
      {yAxisProps === false ? null : <YAxis {...yAxisProps} />}
    </>
  )
}
