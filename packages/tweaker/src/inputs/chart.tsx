import type { ComponentProps, CSSProperties } from 'react'
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
import { TweakerItem, type TweakerDisplayItemProps } from '../tweaker-control.js'
import type { TweakerValue } from '../tweaker-panel.js'
import type { DistributiveOmit } from './built-in-validation.js'

export type TweakerChartDataRow = Record<string, unknown>
export type TweakerChartTooltipProps = ComponentProps<typeof ChartTooltip>
export type TweakerChartXAxisProps = ComponentProps<typeof XAxis>
export type TweakerChartYAxisProps = ComponentProps<typeof YAxis>
export type TweakerChartCartesianGridProps = ComponentProps<typeof CartesianGrid>
export type TweakerChartPolarGridProps = ComponentProps<typeof PolarGrid>
export type TweakerChartPolarAngleAxisProps = ComponentProps<typeof PolarAngleAxis>
export type TweakerChartPolarRadiusAxisProps = ComponentProps<typeof PolarRadiusAxis>
export type TweakerChartLegendProps = ComponentProps<typeof Legend>

type TweakerChartItemProps = DistributiveOmit<
  TweakerDisplayItemProps<TweakerValue>,
  'children' | 'defaultValue' | 'onValueChange' | 'parse' | 'validate' | 'valueMode'
>

type TweakerChartBaseProps = TweakerChartItemProps & {
  accessibilityLayer?: boolean
  chartClassName?: string
  data: readonly TweakerChartDataRow[]
  height?: number | string
  initialDimension?: { height: number; width: number }
  legendProps?: false | TweakerChartLegendProps
  tooltipProps?: false | TweakerChartTooltipProps
}

type TweakerCartesianChartProps = {
  cartesianGridProps?: false | TweakerChartCartesianGridProps
  xAxisProps?: false | TweakerChartXAxisProps
  yAxisProps?: false | TweakerChartYAxisProps
}

export type TweakerAreaChartSeries = { dataKey: string } & Omit<
  ComponentProps<typeof Area>,
  'dataKey'
>
export type TweakerBarChartSeries = { dataKey: string } & Omit<
  ComponentProps<typeof Bar>,
  'dataKey'
>
export type TweakerLineChartSeries = { dataKey: string } & Omit<
  ComponentProps<typeof Line>,
  'dataKey'
>
export type TweakerRadarChartSeries = { dataKey: string } & Omit<
  ComponentProps<typeof Radar>,
  'dataKey'
>
export type TweakerRadialChartSeries = { dataKey: string } & Omit<
  ComponentProps<typeof RadialBar>,
  'dataKey'
>

export type TweakerAreaChartProps = TweakerChartBaseProps &
  TweakerCartesianChartProps & {
    areaChartProps?: Omit<ComponentProps<typeof AreaChart>, 'children' | 'data'>
    series: readonly TweakerAreaChartSeries[]
    type: 'area'
  }

export type TweakerBarChartProps = TweakerChartBaseProps &
  TweakerCartesianChartProps & {
    barChartProps?: Omit<ComponentProps<typeof BarChart>, 'children' | 'data'>
    series: readonly TweakerBarChartSeries[]
    type: 'bar'
  }

export type TweakerLineChartProps = TweakerChartBaseProps &
  TweakerCartesianChartProps & {
    lineChartProps?: Omit<ComponentProps<typeof LineChart>, 'children' | 'data'>
    series: readonly TweakerLineChartSeries[]
    type: 'line'
  }

export type TweakerPieChartProps = TweakerChartBaseProps & {
  pieChartProps?: Omit<ComponentProps<typeof PieChart>, 'children'>
  pieProps: Omit<ComponentProps<typeof Pie>, 'data'> & { dataKey: string }
  type: 'pie'
}

export type TweakerRadarChartProps = TweakerChartBaseProps & {
  polarAngleAxisProps?: false | TweakerChartPolarAngleAxisProps
  polarGridProps?: false | TweakerChartPolarGridProps
  polarRadiusAxisProps?: false | TweakerChartPolarRadiusAxisProps
  radarChartProps?: Omit<ComponentProps<typeof RadarChart>, 'children' | 'data'>
  series: readonly TweakerRadarChartSeries[]
  type: 'radar'
}

export type TweakerRadialChartProps = TweakerChartBaseProps & {
  polarAngleAxisProps?: false | TweakerChartPolarAngleAxisProps
  polarGridProps?: false | TweakerChartPolarGridProps
  polarRadiusAxisProps?: false | TweakerChartPolarRadiusAxisProps
  radialBarChartProps?: Omit<ComponentProps<typeof RadialBarChart>, 'children' | 'data'>
  series: readonly TweakerRadialChartSeries[]
  type: 'radial'
}

export type TweakerChartProps =
  | TweakerAreaChartProps
  | TweakerBarChartProps
  | TweakerLineChartProps
  | TweakerPieChartProps
  | TweakerRadarChartProps
  | TweakerRadialChartProps

const defaultInitialDimension = { height: 144, width: 320 }
const defaultTooltipContentStyle = {
  backgroundColor: 'var(--tweaker-color-surface-raised)',
  border: '1px solid var(--tweaker-color-border)',
  borderRadius: 'var(--tweaker-radius-control)',
  color: 'var(--tweaker-color-text)',
} satisfies CSSProperties
const defaultTooltipLabelStyle = {
  color: 'var(--tweaker-color-text-strong)',
} satisfies CSSProperties

export function TweakerChart({
  accessibilityLayer = true,
  chartClassName,
  contentLayout = 'block',
  data,
  height = 144,
  initialDimension = defaultInitialDimension,
  legendProps,
  tooltipProps,
  ...props
}: TweakerChartProps) {
  const itemProps = chartItemProps(props)
  const surfaceStyle = { height } satisfies CSSProperties

  return (
    <TweakerItem {...itemProps} contentLayout={contentLayout} readOnly valueMode="display">
      <div
        className={`border-tweaker-control rounded-tweaker-control col-span-full min-h-(--tweaker-field-surface-min-height) overflow-hidden border bg-(--_tweaker-color-well) text-(length:--tweaker-font-size-md) ${chartClassName ?? ''}`}
        data-tweaker-chart={props.type}
        style={surfaceStyle}
      >
        <ResponsiveContainer initialDimension={initialDimension}>
          {renderChart({
            accessibilityLayer,
            data,
            legendProps,
            props,
            tooltipProps,
          })}
        </ResponsiveContainer>
      </div>
    </TweakerItem>
  )
}

function renderChart({
  accessibilityLayer,
  data,
  legendProps,
  props,
  tooltipProps,
}: {
  accessibilityLayer: boolean
  data: readonly TweakerChartDataRow[]
  legendProps: false | TweakerChartLegendProps | undefined
  props: ChartSpecificProps
  tooltipProps: false | TweakerChartTooltipProps | undefined
}) {
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
  tooltipProps: TweakerChartTooltipProps | undefined
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

type ChartSpecificProps = DistributiveOmit<
  TweakerChartProps,
  keyof TweakerChartBaseProps | keyof TweakerChartItemProps
>

function CartesianParts({
  cartesianGridProps,
  xAxisProps,
  yAxisProps,
}: TweakerCartesianChartProps) {
  return (
    <>
      {cartesianGridProps === false ? null : <CartesianGrid {...cartesianGridProps} />}
      {xAxisProps === false ? null : <XAxis {...xAxisProps} />}
      {yAxisProps === false ? null : <YAxis {...yAxisProps} />}
    </>
  )
}

function chartItemProps(props: ChartSpecificProps): TweakerChartItemProps {
  const {
    areaChartProps: _areaChartProps,
    barChartProps: _barChartProps,
    cartesianGridProps: _cartesianGridProps,
    lineChartProps: _lineChartProps,
    pieChartProps: _pieChartProps,
    pieProps: _pieProps,
    polarAngleAxisProps: _polarAngleAxisProps,
    polarGridProps: _polarGridProps,
    polarRadiusAxisProps: _polarRadiusAxisProps,
    radarChartProps: _radarChartProps,
    radialBarChartProps: _radialBarChartProps,
    series: _series,
    type: _type,
    xAxisProps: _xAxisProps,
    yAxisProps: _yAxisProps,
    ...itemProps
  } = props as ChartSpecificProps & Record<string, unknown>
  return itemProps as TweakerChartItemProps
}
