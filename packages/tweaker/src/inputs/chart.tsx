import { lazy, Suspense, type ComponentProps, type CSSProperties } from 'react'
import type {
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

export type TweakerCartesianChartProps = {
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
const LazyTweakerChartImplementation = lazy(() => import('./chart-implementation.js'))

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
        <Suspense fallback={<TweakerChartFallback />}>
          <LazyTweakerChartImplementation
            accessibilityLayer={accessibilityLayer}
            data={data}
            initialDimension={initialDimension}
            legendProps={legendProps}
            props={props}
            tooltipProps={tooltipProps}
          />
        </Suspense>
      </div>
    </TweakerItem>
  )
}

function TweakerChartFallback() {
  return (
    <div
      aria-label="Loading chart"
      className="text-tweaker-muted flex size-full min-h-(--tweaker-field-surface-min-height) items-center justify-center"
      role="status"
    >
      <span className="sr-only">Loading chart</span>
    </div>
  )
}

export type TweakerChartImplementationProps = {
  accessibilityLayer: boolean
  data: readonly TweakerChartDataRow[]
  initialDimension: { height: number; width: number }
  legendProps: false | TweakerChartLegendProps | undefined
  props: ChartSpecificProps
  tooltipProps: false | TweakerChartTooltipProps | undefined
}

export type ChartSpecificProps = DistributiveOmit<
  TweakerChartProps,
  keyof TweakerChartBaseProps | keyof TweakerChartItemProps
>

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
