import { motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect, useRef, type RefObject } from 'react'
import { TweakerItem } from 'panel'
import { advanceSparklineSamplingClock, decayPointerVelocity } from './pointer-velocity-sampling'

const sampleCount = 56
const activeSampleInterval = 1000 / 60
const reducedMotionSampleInterval = 160
const fpsReportInterval = 500
const viewBoxWidth = 320
const viewBoxHeight = 88
const baseline = viewBoxHeight / 2
const velocityCeiling = 1400

export type PointerVelocityTarget =
  | EventTarget
  | null
  | RefObject<EventTarget | null>
  | (() => EventTarget | null)

export interface MouseVelocitySparklineItemProps {
  target?: PointerVelocityTarget
  targetLabel?: string
}

export function MouseVelocitySparklineItem({
  target = viewportPointerTarget,
  targetLabel = 'the full viewport',
}: MouseVelocitySparklineItemProps) {
  const velocityX = useMotionValue(0)
  const velocityY = useMotionValue(0)
  const pathX = useMotionValue(emptySparklinePath())
  const pathY = useMotionValue(emptySparklinePath())
  const fpsLabel = useMotionValue('0 FPS')
  const velocityXRef = useRef(0)
  const velocityYRef = useRef(0)
  const samplesXRef = useRef<number[]>(Array.from({ length: sampleCount }, () => 0))
  const samplesYRef = useRef<number[]>(Array.from({ length: sampleCount }, () => 0))
  const previousPointerRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const displayRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const eventTarget = resolvePointerVelocityTarget(target)
    const display = displayRef.current
    if (!eventTarget || !display) return

    const sampleInterval = prefersReducedMotion ? reducedMotionSampleInterval : activeSampleInterval
    let accumulatedTime = 0
    let elapsedSinceCommit = 0
    let commitsSinceReport = 0
    let fpsWindowStartedAt = 0
    let frameId: number | null = null
    let lastFrameAt: number | null = null
    let lastPointerActivityAt = 0
    let isOnScreen = true

    const setVelocity = (x: number, y: number) => {
      velocityXRef.current = x
      velocityYRef.current = y
      velocityX.set(x)
      velocityY.set(y)
    }

    const cancelSampling = () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      frameId = null
      lastFrameAt = null
      accumulatedTime = 0
      elapsedSinceCommit = 0
      commitsSinceReport = 0
      fpsWindowStartedAt = 0
      fpsLabel.set('0 FPS')
    }

    const scheduleSample = () => {
      if (frameId !== null || !isOnScreen || document.visibilityState !== 'visible') {
        return
      }
      frameId = requestAnimationFrame(sample)
    }

    const hasUnsettledSignal = () =>
      hasSignal(samplesXRef.current) ||
      hasSignal(samplesYRef.current) ||
      velocityXRef.current !== 0 ||
      velocityYRef.current !== 0

    const resetPointer = () => {
      previousPointerRef.current = null
      setVelocity(0, 0)
      scheduleSample()
    }

    const updatePointer = (event: Event) => {
      if (!isPointerPositionEvent(event)) return
      const now = performance.now()
      const previous = previousPointerRef.current
      if (previous && isOnScreen && document.visibilityState === 'visible') {
        const elapsedSeconds = Math.max(1, now - previous.time) / 1000
        setVelocity(
          (event.clientX - previous.x) / elapsedSeconds,
          (event.clientY - previous.y) / elapsedSeconds,
        )
      }
      previousPointerRef.current = { time: now, x: event.clientX, y: event.clientY }
      lastPointerActivityAt = now
      scheduleSample()
    }

    const resetWhenLeavingViewport = (event: Event) => {
      if (!('relatedTarget' in event) || event.relatedTarget === null) resetPointer()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        previousPointerRef.current = null
        setVelocity(0, 0)
        cancelSampling()
      } else if (hasUnsettledSignal()) {
        scheduleSample()
      }
    }

    function sample(now: number) {
      frameId = null
      if (!isOnScreen || document.visibilityState !== 'visible') {
        cancelSampling()
        return
      }

      if (lastFrameAt === null) {
        lastFrameAt = now
        fpsWindowStartedAt = now
        scheduleSample()
        return
      }

      const elapsed = Math.max(0, now - lastFrameAt)
      lastFrameAt = now
      const samplingClock = advanceSparklineSamplingClock(
        accumulatedTime,
        elapsedSinceCommit,
        elapsed,
        sampleInterval,
      )
      accumulatedTime = samplingClock.accumulatedTime
      elapsedSinceCommit = samplingClock.elapsedSinceCommit

      if (samplingClock.shouldCommit) {
        pushSample(samplesXRef.current, velocityXRef.current)
        pushSample(samplesYRef.current, velocityYRef.current)

        pathX.set(sparklinePath(samplesXRef.current))
        pathY.set(sparklinePath(samplesYRef.current))
        setVelocity(
          decayPointerVelocity(velocityXRef.current, samplingClock.decayElapsed),
          decayPointerVelocity(velocityYRef.current, samplingClock.decayElapsed),
        )
        commitsSinceReport += 1

        const fpsElapsed = now - fpsWindowStartedAt
        if (fpsElapsed >= fpsReportInterval) {
          fpsLabel.set(`${Math.round((commitsSinceReport * 1000) / fpsElapsed)} FPS`)
          commitsSinceReport = 0
          fpsWindowStartedAt = now
        }
      }

      const isRecentlyActive = now - lastPointerActivityAt < sampleInterval * 2
      if (isRecentlyActive || hasUnsettledSignal()) {
        scheduleSample()
      } else {
        cancelSampling()
      }
    }

    eventTarget.addEventListener('pointermove', updatePointer, { passive: true })
    eventTarget.addEventListener('pointercancel', resetPointer)
    eventTarget.addEventListener('pointerleave', resetPointer)
    eventTarget.addEventListener('pointerout', resetWhenLeavingViewport)
    window.addEventListener('blur', resetPointer)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const intersectionObserver =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            isOnScreen = entry?.isIntersecting === true
            if (!isOnScreen) {
              previousPointerRef.current = null
              setVelocity(0, 0)
              cancelSampling()
            } else if (hasUnsettledSignal()) {
              scheduleSample()
            }
          })
    intersectionObserver?.observe(display)

    return () => {
      eventTarget.removeEventListener('pointermove', updatePointer)
      eventTarget.removeEventListener('pointercancel', resetPointer)
      eventTarget.removeEventListener('pointerleave', resetPointer)
      eventTarget.removeEventListener('pointerout', resetWhenLeavingViewport)
      window.removeEventListener('blur', resetPointer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      intersectionObserver?.disconnect()
      previousPointerRef.current = null
      setVelocity(0, 0)
      cancelSampling()
    }
  }, [fpsLabel, pathX, pathY, prefersReducedMotion, target, velocityX, velocityY])

  return (
    <TweakerItem
      id="mouse-velocity"
      contentLayout="block"
      description={`Move anywhere in ${targetLabel}. MotionValues sample velocity without updating React or the panel store.`}
      label="Sparkline"
      reorderable={false}
    >
      <div className="col-span-full grid gap-1.5">
        <div
          className="bg-muted/25 border-input pointer-events-none relative h-24 overflow-hidden rounded-md border"
          data-pointer-velocity-display
          ref={displayRef}
        >
          <svg
            aria-label="Recent horizontal and vertical pointer velocity"
            className="size-full"
            preserveAspectRatio="none"
            role="img"
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          >
            <path
              className="stroke-border"
              d={`M 0 ${baseline} H ${viewBoxWidth}`}
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
            <motion.path
              className="stroke-chart-1"
              d={pathX}
              fill="none"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
            <motion.path
              className="stroke-chart-3"
              d={pathY}
              fill="none"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span className="text-muted-foreground pointer-events-none absolute top-1.5 left-2 font-mono text-[9px] tracking-widest uppercase">
            px / sec
          </span>
          <motion.span
            className="text-muted-foreground pointer-events-none absolute right-2 bottom-1.5 font-mono text-[9px] tabular-nums"
            data-pointer-velocity-fps
          >
            {fpsLabel}
          </motion.span>
        </div>
        <div className="text-muted-foreground flex gap-3 font-mono text-[9px] tracking-wider uppercase">
          <span className="flex items-center gap-1.5">
            <span className="bg-chart-1 h-px w-3" aria-hidden="true" /> X velocity
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-chart-3 h-px w-3" aria-hidden="true" /> Y velocity
          </span>
        </div>
      </div>
    </TweakerItem>
  )
}

export function viewportPointerTarget() {
  return typeof document === 'undefined' ? null : document.documentElement
}

function resolvePointerVelocityTarget(target: PointerVelocityTarget) {
  if (typeof target === 'function') return target()
  if (target && typeof target === 'object' && 'current' in target) return target.current
  return target
}

function isPointerPositionEvent(
  event: Event,
): event is Event & { clientX: number; clientY: number } {
  return (
    'clientX' in event &&
    typeof event.clientX === 'number' &&
    'clientY' in event &&
    typeof event.clientY === 'number'
  )
}

function pushSample(samples: number[], value: number) {
  samples.push(Math.min(velocityCeiling, Math.max(-velocityCeiling, value)))
  if (samples.length > sampleCount) samples.shift()
}

function hasSignal(samples: readonly number[]) {
  return samples.some((sample) => sample !== 0)
}

function emptySparklinePath() {
  return sparklinePath(Array.from({ length: sampleCount }, () => 0))
}

function sparklinePath(samples: readonly number[]) {
  const denominator = Math.max(1, samples.length - 1)
  return samples
    .map((sample, index) => {
      const x = (index / denominator) * viewBoxWidth
      const y = baseline - (sample / velocityCeiling) * (baseline - 4)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}
