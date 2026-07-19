import { useReducedMotion, useSpring } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { TweakerItem, type TweakerDisplayItemProps } from '../tweaker-control.js'
import type { TweakerValue } from '../tweaker-panel.js'
import type { DistributiveOmit } from './built-in-validation.js'

export type TweakerSparklineDatum = number | Readonly<Record<string, number>>

export type TweakerSparklineEmission = TweakerSparklineDatum | readonly TweakerSparklineDatum[]

export interface TweakerSparklineSubscriptionOptions {
  readonly continuous: boolean
  onContinuousChange: (listener: (continuous: boolean) => void) => () => void
}

export interface TweakerSparklineSource {
  subscribe: (
    emit: (sample: TweakerSparklineEmission) => void,
    options: TweakerSparklineSubscriptionOptions,
  ) => undefined | void | (() => void)
}

export type TweakerSparklineData =
  | readonly TweakerSparklineDatum[]
  | AsyncIterable<TweakerSparklineEmission>
  | TweakerSparklineSource

export interface TweakerSparklineSeries {
  dataKey: string
  label?: string
  stroke?: string
  strokeWidth?: number
}

type TweakerSparklineBaseProps = DistributiveOmit<
  TweakerDisplayItemProps<TweakerValue>,
  'children' | 'defaultValue' | 'onValueChange' | 'parse' | 'validate' | 'valueMode'
> & {
  ariaLabel?: string
  continuous?: boolean
  data: TweakerSparklineData
  height?: number | string
  maxPoints?: number
  series?: readonly TweakerSparklineSeries[]
  showBaseline?: boolean
  stroke?: string
  strokeWidth?: number
}

export type TweakerSparklineProps = TweakerSparklineBaseProps &
  (
    | {
        autoscale: true
        maxValue?: never
        minValue?: never
      }
    | {
        autoscale?: false
        maxValue?: number
        minValue?: number
      }
  )

const sparklineWidth = 320
const sparklineHeight = 88

export function shouldJumpTweakerSparklineRange(
  currentRange: number,
  targetRange: number,
  prefersReducedMotion: boolean,
) {
  return prefersReducedMotion || targetRange >= currentRange
}

export function TweakerSparkline({
  ariaLabel = 'Sparkline',
  autoscale = false,
  contentLayout = 'block',
  continuous = false,
  data,
  height = 96,
  maxPoints = 60,
  maxValue,
  minValue,
  series,
  showBaseline = true,
  stroke = 'var(--tweaker-color-accent)',
  strokeWidth = 1.75,
  ...itemProps
}: TweakerSparklineProps) {
  const [surface, setSurface] = useState<HTMLDivElement | null>(null)
  const prefersReducedMotion = useReducedMotion() === true
  const baselineRef = useRef<SVGPathElement>(null)
  const pathRefs = useRef(new Map<string, SVGPathElement>())
  const samplesRef = useRef<Readonly<Record<string, number>>[]>([])
  const frameRef = useRef<number | null>(null)
  const continuousRef = useRef(continuous)
  const continuousListenersRef = useRef(new Set<(continuous: boolean) => void>())
  const scheduleDrawRef = useRef<() => void>(() => undefined)
  const autoscaleRange = useSpring(1, {
    damping: 32,
    stiffness: 260,
  })
  const autoscaleTargetRef = useRef(1)
  const pointLimit = normalizePointLimit(maxPoints)
  const renderedSeries = useMemo<readonly TweakerSparklineSeries[]>(
    () =>
      series?.length
        ? series
        : [
            {
              dataKey: 'value',
              stroke,
              strokeWidth,
            },
          ],
    [series, stroke, strokeWidth],
  )
  const renderConfigRef = useRef({
    autoscale,
    autoscaleRange,
    maxValue,
    minValue,
    pointLimit,
    prefersReducedMotion,
    renderedSeries,
  })
  continuousRef.current = continuous
  renderConfigRef.current = {
    autoscale,
    autoscaleRange,
    maxValue,
    minValue,
    pointLimit,
    prefersReducedMotion,
    renderedSeries,
  }

  useEffect(() => {
    let active = true

    const draw = () => {
      frameRef.current = null
      const {
        autoscale: currentAutoscale,
        autoscaleRange: currentAutoscaleRange,
        maxValue: currentMaxValue,
        minValue: currentMinValue,
        pointLimit: currentPointLimit,
        prefersReducedMotion: currentPrefersReducedMotion,
        renderedSeries: currentSeries,
      } = renderConfigRef.current
      const visibleSamples = samplesRef.current.slice(-currentPointLimit)
      const targetBounds = currentAutoscale
        ? resolveTweakerSparklineBounds(visibleSamples, currentSeries)
        : undefined
      if (targetBounds && targetBounds.maxValue !== autoscaleTargetRef.current) {
        const targetRange = targetBounds.maxValue
        autoscaleTargetRef.current = targetRange
        if (
          shouldJumpTweakerSparklineRange(
            currentAutoscaleRange.get(),
            targetRange,
            currentPrefersReducedMotion,
          )
        ) {
          currentAutoscaleRange.jump(targetRange)
        } else currentAutoscaleRange.set(targetRange)
      }
      const bounds = currentAutoscale
        ? {
            maxValue: currentAutoscaleRange.get(),
            minValue: -currentAutoscaleRange.get(),
          }
        : resolveTweakerSparklineProjectionBounds(
            visibleSamples,
            currentSeries,
            currentMinValue,
            currentMaxValue,
          )
      const baselinePath = projectTweakerSparklineBaseline(bounds?.minValue, bounds?.maxValue)
      if (baselineRef.current) {
        baselineRef.current.setAttribute('d', baselinePath)
        baselineRef.current.setAttribute(
          'visibility',
          baselinePath.length === 0 ? 'hidden' : 'visible',
        )
      }
      for (const item of currentSeries) {
        const samples = visibleSamples.map((sample) => sample[item.dataKey])
        const path = projectTweakerSparklinePath(samples, {
          height: sparklineHeight,
          maxValue: bounds?.maxValue,
          minValue: bounds?.minValue,
          width: sparklineWidth,
        })
        pathRefs.current.get(item.dataKey)?.setAttribute('d', path)
      }
    }

    const scheduleDraw = () => {
      if (frameRef.current !== null) return
      frameRef.current = requestAnimationFrame(draw)
    }
    const cancelDraw = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    scheduleDrawRef.current = scheduleDraw

    const append = (emission: TweakerSparklineEmission) => {
      if (!active) return
      samplesRef.current = appendTweakerSparklineData(
        samplesRef.current,
        emission,
        renderConfigRef.current.pointLimit,
      )
      scheduleDraw()
    }

    samplesRef.current = []
    scheduleDraw()

    if (!surface) {
      return () => {
        active = false
        scheduleDrawRef.current = () => undefined
        cancelDraw()
      }
    }

    if (Array.isArray(data)) {
      append(data)
      return () => {
        active = false
        scheduleDrawRef.current = () => undefined
        cancelDraw()
      }
    }

    if (isTweakerSparklineSource(data)) {
      let unsubscribe: undefined | void | (() => void)
      let subscribed = false

      const subscribe = () => {
        if (subscribed || !active) return
        subscribed = true
        unsubscribe = data.subscribe(append, {
          get continuous() {
            return continuousRef.current
          },
          onContinuousChange(listener) {
            continuousListenersRef.current.add(listener)
            return () => continuousListenersRef.current.delete(listener)
          },
        })
      }

      const unsubscribeSource = () => {
        if (!subscribed) return
        subscribed = false
        unsubscribe?.()
        unsubscribe = undefined
        continuousListenersRef.current.clear()
      }

      const observer =
        typeof IntersectionObserver !== 'undefined'
          ? new IntersectionObserver(([entry]) => {
              if (entry?.isIntersecting) subscribe()
              else unsubscribeSource()
            })
          : undefined

      if (observer) observer.observe(surface)
      else subscribe()

      return () => {
        active = false
        observer?.disconnect()
        unsubscribeSource()
        scheduleDrawRef.current = () => undefined
        cancelDraw()
      }
    }

    let iterator: AsyncIterator<TweakerSparklineEmission> | undefined
    const asyncData = data as AsyncIterable<TweakerSparklineEmission>
    let consuming = false
    let finished = false
    let isVisible = false
    let pendingEmission: TweakerSparklineEmission | undefined

    const consume = async () => {
      if (consuming || finished || !active || !isVisible) return
      consuming = true
      iterator ??= asyncData[Symbol.asyncIterator]()

      try {
        if (pendingEmission !== undefined) {
          append(pendingEmission)
          pendingEmission = undefined
        }

        while (active && isVisible && !finished) {
          const next = await iterator.next()
          if (!active) break
          if (next.done) {
            finished = true
            break
          }
          if (!isVisible) {
            pendingEmission = next.value
            break
          }
          append(next.value)
        }
      } finally {
        consuming = false
      }
    }

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            isVisible = entry?.isIntersecting === true
            if (isVisible) void consume().catch(() => undefined)
          })
        : undefined

    if (observer) observer.observe(surface)
    else {
      isVisible = true
      void consume().catch(() => undefined)
    }

    return () => {
      active = false
      isVisible = false
      observer?.disconnect()
      pendingEmission = undefined
      if (iterator?.return) void iterator.return().catch(() => undefined)
      iterator = undefined
      scheduleDrawRef.current = () => undefined
      cancelDraw()
    }
  }, [data, surface])

  useEffect(() => {
    samplesRef.current = samplesRef.current.slice(-pointLimit)
    scheduleDrawRef.current()
  }, [
    autoscale,
    maxValue,
    minValue,
    pointLimit,
    prefersReducedMotion,
    renderedSeries,
    showBaseline,
  ])

  useEffect(() => {
    for (const listener of continuousListenersRef.current) listener(continuous)
  }, [continuous])

  useEffect(() => autoscaleRange.on('change', () => scheduleDrawRef.current()), [autoscaleRange])

  const surfaceStyle = { height } satisfies CSSProperties
  const initialSampleRecords = Array.isArray(data)
    ? normalizeSparklineData(data).slice(-pointLimit)
    : []
  const initialBounds = autoscale
    ? resolveTweakerSparklineBounds(initialSampleRecords, renderedSeries)
    : resolveTweakerSparklineProjectionBounds(
        initialSampleRecords,
        renderedSeries,
        minValue,
        maxValue,
      )
  const initialBaselinePath = projectTweakerSparklineBaseline(
    initialBounds?.minValue,
    initialBounds?.maxValue,
  )

  return (
    <TweakerItem {...itemProps} contentLayout={contentLayout} readOnly valueMode="display">
      <div
        ref={setSurface}
        className="border-tweaker-control rounded-tweaker-control col-span-full min-h-(--tweaker-field-surface-min-height) overflow-hidden border bg-(--_tweaker-color-well)"
        data-autoscale={autoscale ? 'true' : 'false'}
        data-continuous={continuous ? 'true' : 'false'}
        data-max-points={pointLimit}
        data-tweaker-sparkline
        style={surfaceStyle}
      >
        <svg
          aria-label={ariaLabel}
          className="size-full"
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${sparklineWidth} ${sparklineHeight}`}
        >
          {showBaseline ? (
            <path
              ref={baselineRef}
              data-sparkline-baseline
              d={initialBaselinePath}
              fill="none"
              stroke="var(--tweaker-color-border)"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
              visibility={initialBaselinePath.length === 0 ? 'hidden' : 'visible'}
            />
          ) : null}
          {renderedSeries.map((item) => {
            const initialSamples = initialSampleRecords.map((sample) => sample[item.dataKey])
            const initialPath = projectTweakerSparklinePath(initialSamples, {
              height: sparklineHeight,
              maxValue: initialBounds?.maxValue,
              minValue: initialBounds?.minValue,
              width: sparklineWidth,
            })
            const sharedProps = {
              'aria-label': item.label,
              'data-sparkline-series': item.dataKey,
              fill: 'none',
              stroke: item.stroke ?? stroke,
              strokeWidth: item.strokeWidth ?? strokeWidth,
              vectorEffect: 'non-scaling-stroke' as const,
            }

            return (
              <path
                key={item.dataKey}
                ref={(path) => {
                  if (path) pathRefs.current.set(item.dataKey, path)
                  else pathRefs.current.delete(item.dataKey)
                }}
                d={initialPath}
                {...sharedProps}
              />
            )
          })}
        </svg>
      </div>
    </TweakerItem>
  )
}

function appendTweakerSparklineData(
  current: readonly Readonly<Record<string, number>>[],
  emission: TweakerSparklineEmission,
  maxPoints: number,
) {
  return [...current, ...normalizeSparklineData(emission)].slice(-normalizePointLimit(maxPoints))
}

function normalizeSparklineData(emission: TweakerSparklineEmission) {
  const data = Array.isArray(emission) ? emission : [emission]
  return data.flatMap((sample): Readonly<Record<string, number>>[] => {
    if (typeof sample === 'number') return Number.isFinite(sample) ? [{ value: sample }] : []
    const entries = Object.entries(sample).filter((entry) => Number.isFinite(entry[1]))
    return entries.length > 0
      ? [Object.fromEntries(entries) as Readonly<Record<string, number>>]
      : []
  })
}

export function appendTweakerSparklineSamples(
  current: readonly number[],
  emission: TweakerSparklineEmission,
  maxPoints: number,
) {
  const appended = (Array.isArray(emission) ? emission : [emission]).filter(Number.isFinite)
  return [...current, ...appended].slice(-normalizePointLimit(maxPoints))
}

export function projectTweakerSparklinePath(
  samples: readonly number[],
  {
    height = sparklineHeight,
    maxValue,
    minValue,
    width = sparklineWidth,
  }: {
    height?: number
    maxValue?: number
    minValue?: number
    width?: number
  } = {},
) {
  if (samples.length === 0) return ''
  const finiteSamples = samples.filter(Number.isFinite)
  if (finiteSamples.length === 0) return ''

  const requestedLow = Number.isFinite(minValue) ? (minValue as number) : Math.min(...finiteSamples)
  const requestedHigh = Number.isFinite(maxValue)
    ? (maxValue as number)
    : Math.max(...finiteSamples)
  const low = Math.min(requestedLow, requestedHigh)
  const high = Math.max(requestedLow, requestedHigh)
  const span = high - low || 1
  const denominator = Math.max(1, finiteSamples.length - 1)

  const points = finiteSamples.map((sample, index) => {
    const x = (index / denominator) * width
    const y = Math.min(height, Math.max(0, height - ((sample - low) / span) * height))
    return { x, y }
  })
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${formatCoordinate(point.x)} ${formatCoordinate(point.y)}`,
    )
    .join(' ')
}

export function projectTweakerSparklineBaseline(
  minValue: number | undefined,
  maxValue: number | undefined,
  {
    height = sparklineHeight,
    width = sparklineWidth,
  }: {
    height?: number
    width?: number
  } = {},
) {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return ''

  const low = Math.min(minValue as number, maxValue as number)
  const high = Math.max(minValue as number, maxValue as number)
  if (low > 0 || high < 0) return ''

  const span = high - low || 1
  const y = Math.min(height, Math.max(0, height - ((0 - low) / span) * height))
  return `M 0 ${formatCoordinate(y)} H ${formatCoordinate(width)}`
}

export function resolveTweakerSparklineBounds(
  samples: readonly Readonly<Record<string, number>>[],
  series: readonly Pick<TweakerSparklineSeries, 'dataKey'>[],
) {
  const values = samples.flatMap((sample) =>
    series.flatMap(({ dataKey }) => {
      const value = sample[dataKey]
      return Number.isFinite(value) ? [value] : []
    }),
  )
  if (values.length === 0) return undefined

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const extent = Math.max(1, Math.abs(minimum), Math.abs(maximum)) * 1.08

  return {
    maxValue: extent,
    minValue: -extent,
  }
}

function resolveTweakerSparklineProjectionBounds(
  samples: readonly Readonly<Record<string, number>>[],
  series: readonly Pick<TweakerSparklineSeries, 'dataKey'>[],
  minValue: number | undefined,
  maxValue: number | undefined,
) {
  const values = samples.flatMap((sample) =>
    series.flatMap(({ dataKey }) => {
      const value = sample[dataKey]
      return Number.isFinite(value) ? [value] : []
    }),
  )
  const requestedLow = Number.isFinite(minValue)
    ? (minValue as number)
    : values.length > 0
      ? Math.min(...values)
      : undefined
  const requestedHigh = Number.isFinite(maxValue)
    ? (maxValue as number)
    : values.length > 0
      ? Math.max(...values)
      : undefined
  if (requestedLow === undefined || requestedHigh === undefined) return undefined

  return {
    maxValue: Math.max(requestedLow, requestedHigh),
    minValue: Math.min(requestedLow, requestedHigh),
  }
}

function isTweakerSparklineSource(data: TweakerSparklineData): data is TweakerSparklineSource {
  return typeof data === 'object' && data !== null && 'subscribe' in data
}

function normalizePointLimit(value: number) {
  return Math.max(2, Math.floor(Number.isFinite(value) ? value : 60))
}

function formatCoordinate(value: number) {
  return Number(value.toFixed(3))
}
