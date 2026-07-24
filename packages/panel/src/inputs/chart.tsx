import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
} from 'react'
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
import { PicodashItem, type PicodashDisplayItemProps } from '../components/panel/PicodashItem.js'
import type { PicodashValue } from '../components/panel/PicodashPanel.js'
import type { DistributiveOmit } from './internal/built-in-validation.js'

export type PicodashChartDataRow = Record<string, unknown>
export type PicodashChartTooltipProps = ComponentProps<typeof ChartTooltip>
export type PicodashChartXAxisProps = ComponentProps<typeof XAxis>
export type PicodashChartYAxisProps = ComponentProps<typeof YAxis>
export type PicodashChartCartesianGridProps = ComponentProps<typeof CartesianGrid>
export type PicodashChartPolarGridProps = ComponentProps<typeof PolarGrid>
export type PicodashChartPolarAngleAxisProps = ComponentProps<typeof PolarAngleAxis>
export type PicodashChartPolarRadiusAxisProps = ComponentProps<typeof PolarRadiusAxis>
export type PicodashChartLegendProps = ComponentProps<typeof Legend>

type PicodashChartItemProps = DistributiveOmit<
  PicodashDisplayItemProps<PicodashValue>,
  'children' | 'defaultValue' | 'onValueChange' | 'parse' | 'validate' | 'valueMode'
>

type PicodashChartBaseProps = PicodashChartItemProps & {
  accessibilityLayer?: boolean
  chartClassName?: string
  data: readonly PicodashChartDataRow[]
  height?: number | string
  initialDimension?: { height: number; width: number }
  legendProps?: false | PicodashChartLegendProps
  tooltipProps?: false | PicodashChartTooltipProps
}

export type PicodashCartesianChartProps = {
  cartesianGridProps?: false | PicodashChartCartesianGridProps
  xAxisProps?: false | PicodashChartXAxisProps
  yAxisProps?: false | PicodashChartYAxisProps
}

export type PicodashAreaChartSeries = { dataKey: string } & Omit<
  ComponentProps<typeof Area>,
  'dataKey'
>
export type PicodashBarChartSeries = { dataKey: string } & Omit<
  ComponentProps<typeof Bar>,
  'dataKey'
>
export type PicodashLineChartSeries = { dataKey: string } & Omit<
  ComponentProps<typeof Line>,
  'dataKey'
>
export type PicodashRadarChartSeries = { dataKey: string } & Omit<
  ComponentProps<typeof Radar>,
  'dataKey'
>
export type PicodashRadialChartSeries = { dataKey: string } & Omit<
  ComponentProps<typeof RadialBar>,
  'dataKey'
>

export type PicodashAreaChartProps = PicodashChartBaseProps &
  PicodashCartesianChartProps & {
    areaChartProps?: Omit<ComponentProps<typeof AreaChart>, 'children' | 'data'>
    series: readonly PicodashAreaChartSeries[]
    type: 'area'
  }

export type PicodashBarChartProps = PicodashChartBaseProps &
  PicodashCartesianChartProps & {
    barChartProps?: Omit<ComponentProps<typeof BarChart>, 'children' | 'data'>
    series: readonly PicodashBarChartSeries[]
    type: 'bar'
  }

export type PicodashLineChartProps = PicodashChartBaseProps &
  PicodashCartesianChartProps & {
    lineChartProps?: Omit<ComponentProps<typeof LineChart>, 'children' | 'data'>
    series: readonly PicodashLineChartSeries[]
    type: 'line'
  }

export type PicodashPieChartProps = PicodashChartBaseProps & {
  pieChartProps?: Omit<ComponentProps<typeof PieChart>, 'children'>
  pieProps: Omit<ComponentProps<typeof Pie>, 'data'> & { dataKey: string }
  type: 'pie'
}

export type PicodashRadarChartProps = PicodashChartBaseProps & {
  polarAngleAxisProps?: false | PicodashChartPolarAngleAxisProps
  polarGridProps?: false | PicodashChartPolarGridProps
  polarRadiusAxisProps?: false | PicodashChartPolarRadiusAxisProps
  radarChartProps?: Omit<ComponentProps<typeof RadarChart>, 'children' | 'data'>
  series: readonly PicodashRadarChartSeries[]
  type: 'radar'
}

export type PicodashRadialChartProps = PicodashChartBaseProps & {
  polarAngleAxisProps?: false | PicodashChartPolarAngleAxisProps
  polarGridProps?: false | PicodashChartPolarGridProps
  polarRadiusAxisProps?: false | PicodashChartPolarRadiusAxisProps
  radialBarChartProps?: Omit<ComponentProps<typeof RadialBarChart>, 'children' | 'data'>
  series: readonly PicodashRadialChartSeries[]
  type: 'radial'
}

export type PicodashChartProps =
  | PicodashAreaChartProps
  | PicodashBarChartProps
  | PicodashLineChartProps
  | PicodashPieChartProps
  | PicodashRadarChartProps
  | PicodashRadialChartProps

const defaultInitialDimension = { height: 144, width: 320 }
const LazyPicodashChartImplementation = lazy(() => import('./internal/chart-implementation.js'))

export function PicodashChart({
  accessibilityLayer = true,
  chartClassName,
  contentLayout = 'block',
  data,
  height = 144,
  initialDimension = defaultInitialDimension,
  legendProps,
  tooltipProps,
  ...props
}: PicodashChartProps) {
  const itemProps = chartItemProps(props)
  const surfaceStyle = { height } satisfies CSSProperties
  const chartSurfaceRef = useRef<HTMLDivElement>(null)
  const [shouldRenderChart, setShouldRenderChart] = useState(false)

  useEffect(() => {
    const chartSurface = chartSurfaceRef.current
    if (!chartSurface) return

    if (typeof IntersectionObserver === 'undefined') {
      setShouldRenderChart(true)
      return
    }

    const scrollRoot = chartSurface.closest<HTMLElement>('[data-picodash-scrollport]')
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return

        setShouldRenderChart(true)
        observer.disconnect()
      },
      { root: scrollRoot },
    )
    const fallbackTimer = window.setTimeout(() => {
      setShouldRenderChart(true)
      observer.disconnect()
    }, 1000)
    observer.observe(chartSurface)

    return () => {
      window.clearTimeout(fallbackTimer)
      observer.disconnect()
    }
  }, [])

  return (
    <PicodashItem {...itemProps} contentLayout={contentLayout} readOnly valueMode="display">
      <div
        ref={chartSurfaceRef}
        className={`border-picodash-control rounded-picodash-control col-span-full min-h-(--picodash-field-surface-min-height) overflow-hidden border bg-(--_picodash-color-well) text-(length:--picodash-font-size-md) ${chartClassName ?? ''}`}
        data-picodash-chart={props.type}
        style={surfaceStyle}
      >
        {shouldRenderChart ? (
          <Suspense fallback={<PicodashChartFallback />}>
            <LazyPicodashChartImplementation
              accessibilityLayer={accessibilityLayer}
              data={data}
              initialDimension={initialDimension}
              legendProps={legendProps}
              props={props}
              tooltipProps={tooltipProps}
            />
          </Suspense>
        ) : (
          <PicodashChartFallback />
        )}
      </div>
    </PicodashItem>
  )
}

function PicodashChartFallback() {
  return (
    <div
      aria-label="Loading chart"
      className="text-picodash-muted flex size-full min-h-(--picodash-field-surface-min-height) items-center justify-center"
      role="status"
    >
      <span className="sr-only">Loading chart</span>
    </div>
  )
}

export type PicodashChartImplementationProps = {
  accessibilityLayer: boolean
  data: readonly PicodashChartDataRow[]
  initialDimension: { height: number; width: number }
  legendProps: false | PicodashChartLegendProps | undefined
  props: ChartSpecificProps
  tooltipProps: false | PicodashChartTooltipProps | undefined
}

export type ChartSpecificProps = DistributiveOmit<
  PicodashChartProps,
  keyof PicodashChartBaseProps | keyof PicodashChartItemProps
>

function chartItemProps(props: ChartSpecificProps): PicodashChartItemProps {
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
  return itemProps as PicodashChartItemProps
}
