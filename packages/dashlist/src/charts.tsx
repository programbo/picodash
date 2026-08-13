'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react'
import { Chart, type ChartCommonProps, type ChartDefinition } from '@tanstack/charts/react'
import {
  defineChart,
  lineY,
  type ChartMark,
  type ChartSpec,
  type ResponsiveChartConfig,
} from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { Dashlet } from './index.js'

type DashletNativeProps = Omit<
  ComponentPropsWithRef<'div'>,
  | 'aria-describedby'
  | 'aria-errormessage'
  | 'aria-invalid'
  | 'aria-label'
  | 'aria-labelledby'
  | 'children'
  | 'id'
  | 'role'
  | 'tabIndex'
  | 'title'
>

export type ChartDashletProps = DashletNativeProps & {
  readonly id: string
  readonly label: ReactNode
  readonly 'aria-label'?: string
  readonly description?: ReactNode
  readonly definition: ChartDefinition
  readonly chartProps?: Omit<ChartCommonProps, 'ariaLabel'>
}

function chartAriaLabel(label: ReactNode, ariaLabel: string | undefined, id: string): string {
  if (typeof ariaLabel === 'string' && ariaLabel.trim()) return ariaLabel
  if (typeof label === 'string' && label.trim()) return label
  if (typeof label === 'number') return String(label)
  return id
}

export function ChartDashlet({
  id,
  label,
  'aria-label': ariaLabel,
  description,
  definition,
  chartProps,
  ...nativeProps
}: ChartDashletProps) {
  const resolvedAriaLabel = chartAriaLabel(label, ariaLabel, id)
  return (
    <Dashlet
      {...nativeProps}
      id={id}
      label={label}
      aria-label={ariaLabel}
      description={description}
      layout="full"
    >
      <Chart {...chartProps} ariaLabel={resolvedAriaLabel} definition={definition} />
    </Dashlet>
  )
}

export type SparklineSource = (emit: (value: number) => void) => void | (() => void)

export type SparklineDashletProps = DashletNativeProps & {
  readonly id: string
  readonly label: ReactNode
  readonly 'aria-label'?: string
  readonly description?: ReactNode
  readonly source: SparklineSource
  readonly maxSamples?: number
  readonly chartProps?: Omit<ChartCommonProps, 'ariaLabel'>
}

type VisibilityState = {
  readonly documentVisible: boolean
  readonly intersectionKnown: boolean
  readonly intersecting: boolean
}

function useSparklineHistory(
  source: SparklineSource,
  maxSamples: number,
  targetRef: React.MutableRefObject<HTMLElement | null>,
): readonly number[] {
  const [history, setHistory] = useState<readonly number[]>([])
  const [visibility, setVisibility] = useState<VisibilityState>(() => ({
    documentVisible: typeof document === 'undefined' || !document.hidden,
    intersectionKnown: false,
    intersecting: false,
  }))
  const active =
    visibility.documentVisible && visibility.intersectionKnown && visibility.intersecting

  useEffect(() => {
    setHistory((current) =>
      current.length > maxSamples ? current.slice(current.length - maxSamples) : current,
    )
  }, [maxSamples])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const handleVisibility = () =>
      setVisibility((current) => ({ ...current, documentVisible: !document.hidden }))
    document.addEventListener('visibilitychange', handleVisibility)

    let observer: IntersectionObserver | undefined
    const target = targetRef.current
    if (target && 'IntersectionObserver' in globalThis) {
      observer = new IntersectionObserver(([entry]) => {
        setVisibility((current) => ({
          ...current,
          intersectionKnown: true,
          intersecting: entry?.isIntersecting ?? true,
        }))
      })
      observer.observe(target)
    } else {
      setVisibility((current) => ({ ...current, intersectionKnown: true, intersecting: true }))
    }
    handleVisibility()
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      observer?.disconnect()
    }
  }, [targetRef])

  useEffect(() => {
    if (!active) return
    let disposed = false
    const emit = (value: number) => {
      if (disposed || !Number.isFinite(value)) return
      setHistory((current) => {
        const next =
          current.length >= maxSamples ? current.slice(current.length - maxSamples + 1) : current
        return [...next, value]
      })
    }
    const disposer = source(emit)
    return () => {
      disposed = true
      if (typeof disposer === 'function') disposer()
    }
  }, [active, maxSamples, source])

  return history
}

export function SparklineDashlet({
  id,
  label,
  description,
  source,
  maxSamples = 120,
  chartProps,
  ...nativeProps
}: SparklineDashletProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const boundedMaxSamples = Number.isFinite(maxSamples) ? Math.max(1, Math.floor(maxSamples)) : 120
  const history = useSparklineHistory(source, boundedMaxSamples, shellRef)
  const definition = useMemo<ChartDefinition>(() => {
    const config: ResponsiveChartConfig<ChartSpec, 'dom'> = {
      svgAnimation: false,
      chart: () => ({
        marks: [
          lineY(
            history.map((value, index) => ({ index, value })),
            { x: 'index', y: 'value' },
          ) as ChartMark<unknown, any, any>,
        ],
        x: { scale: scaleLinear, axis: false },
        y: { scale: scaleLinear, axis: false },
      }),
    }
    return defineChart(config)
  }, [history])

  return (
    <ChartDashlet
      {...nativeProps}
      ref={shellRef}
      id={id}
      label={label}
      description={description}
      definition={definition}
      chartProps={chartProps}
      data-picodash-sparkline-samples={history.length}
    />
  )
}
