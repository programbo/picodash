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
  ) => () => void
}

export type TweakerSparklineAsyncSource = () => AsyncIterable<TweakerSparklineEmission>

export type TweakerSparklineData =
  | readonly TweakerSparklineDatum[]
  | TweakerSparklineAsyncSource
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

export function shouldUpdateTweakerSparklineRange(
  currentRange: number,
  targetRange: number,
  previousTargetRange: number,
  prefersReducedMotion: boolean,
) {
  return (
    targetRange !== previousTargetRange ||
    (prefersReducedMotion && currentRange !== previousTargetRange)
  )
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
      if (
        targetBounds &&
        shouldUpdateTweakerSparklineRange(
          currentAutoscaleRange.get(),
          targetBounds.maxValue,
          autoscaleTargetRef.current,
          currentPrefersReducedMotion,
        )
      ) {
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
      let unsubscribe: undefined | (() => void)
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

    const createAsyncData = data as TweakerSparklineAsyncSource
    let iterator: AsyncIterator<TweakerSparklineEmission> | undefined
    let consuming = false
    let isVisible = false
    let iteration = 0

    const consume = async () => {
      if (consuming || !active || !isVisible) return
      consuming = true
      const currentIteration = ++iteration
      const currentIterator = createAsyncData()[Symbol.asyncIterator]()
      iterator = currentIterator

      try {
        while (active && isVisible && currentIteration === iteration) {
          const next = await currentIterator.next()
          if (!active || !isVisible || currentIteration !== iteration || next.done) break
          append(next.value)
        }
      } finally {
        if (currentIteration === iteration) {
          consuming = false
          iterator = undefined
        }
      }
    }

    const stopIteration = () => {
      isVisible = false
      consuming = false
      iteration += 1
      const currentIterator = iterator
      iterator = undefined
      if (currentIterator?.return) void currentIterator.return().catch(() => undefined)
    }

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            isVisible = entry?.isIntersecting === true
            if (isVisible) void consume().catch(() => undefined)
            else stopIteration()
          })
        : undefined

    if (observer) observer.observe(surface)
    else {
      isVisible = true
      void consume().catch(() => undefined)
    }

    return () => {
      active = false
      observer?.disconnect()
      stopIteration()
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
  emission: number | readonly number[],
  maxPoints: number,
): number[] {
  const candidates: readonly number[] = Array.isArray(emission) ? emission : [emission]
  const appended = candidates.filter(Number.isFinite)
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
  let implicitLow = Number.POSITIVE_INFINITY
  let implicitHigh = Number.NEGATIVE_INFINITY
  for (const sample of samples) {
    if (!Number.isFinite(sample)) continue
    implicitLow = Math.min(implicitLow, sample)
    implicitHigh = Math.max(implicitHigh, sample)
  }
  if (!Number.isFinite(implicitLow) || !Number.isFinite(implicitHigh)) return ''

  const requestedLow = Number.isFinite(minValue) ? (minValue as number) : implicitLow
  const requestedHigh = Number.isFinite(maxValue) ? (maxValue as number) : implicitHigh
  const low = Math.min(requestedLow, requestedHigh)
  const high = Math.max(requestedLow, requestedHigh)
  const span = high - low || 1
  const denominator = Math.max(1, samples.length - 1)

  let startsSegment = true
  return samples
    .map((sample, index) => {
      if (!Number.isFinite(sample)) {
        startsSegment = true
        return ''
      }
      const x = (index / denominator) * width
      const y = Math.min(height, Math.max(0, height - ((sample - low) / span) * height))
      const command = startsSegment ? 'M' : 'L'
      startsSegment = false
      return `${command} ${formatCoordinate(x)} ${formatCoordinate(y)}`
    })
    .filter(Boolean)
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
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  for (const sample of samples) {
    for (const { dataKey } of series) {
      const value = sample[dataKey]
      if (!Number.isFinite(value)) continue
      minimum = Math.min(minimum, value)
      maximum = Math.max(maximum, value)
    }
  }
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return undefined

  const magnitude = Math.max(Math.abs(minimum), Math.abs(maximum))
  const extent = (magnitude || 1) * 1.08

  return {
    maxValue: extent,
    minValue: -extent,
  }
}

export function resolveTweakerSparklineProjectionBounds(
  samples: readonly Readonly<Record<string, number>>[],
  series: readonly Pick<TweakerSparklineSeries, 'dataKey'>[],
  minValue: number | undefined,
  maxValue: number | undefined,
) {
  let implicitLow = Number.POSITIVE_INFINITY
  let implicitHigh = Number.NEGATIVE_INFINITY
  for (const sample of samples) {
    for (const { dataKey } of series) {
      const value = sample[dataKey]
      if (!Number.isFinite(value)) continue
      implicitLow = Math.min(implicitLow, value)
      implicitHigh = Math.max(implicitHigh, value)
    }
  }
  const requestedLow = Number.isFinite(minValue) ? (minValue as number) : implicitLow
  const requestedHigh = Number.isFinite(maxValue) ? (maxValue as number) : implicitHigh
  if (!Number.isFinite(requestedLow) || !Number.isFinite(requestedHigh)) return undefined

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
