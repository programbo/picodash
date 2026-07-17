import { motion, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { TweakerControl } from 'panel'

const sampleCount = 56
const viewBoxWidth = 320
const viewBoxHeight = 88
const baseline = viewBoxHeight / 2
const velocityCeiling = 1400

export function MouseVelocitySparklineItem() {
  const velocityX = useMotionValue(0)
  const velocityY = useMotionValue(0)
  const pathX = useMotionValue(emptySparklinePath())
  const pathY = useMotionValue(emptySparklinePath())
  const velocityXRef = useRef(0)
  const velocityYRef = useRef(0)
  const samplesXRef = useRef<number[]>(Array.from({ length: sampleCount }, () => 0))
  const samplesYRef = useRef<number[]>(Array.from({ length: sampleCount }, () => 0))
  const previousPointerRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const prefersReducedMotion = useReducedMotion()

  useMotionValueEvent(velocityX, 'change', (latest) => {
    velocityXRef.current = latest
  })
  useMotionValueEvent(velocityY, 'change', (latest) => {
    velocityYRef.current = latest
  })

  useEffect(() => {
    let frameId = 0
    let lastSampleAt = 0
    const sampleInterval = prefersReducedMotion ? 160 : 42

    const sample = (now: number) => {
      if (now - lastSampleAt >= sampleInterval) {
        pushSample(samplesXRef.current, velocityXRef.current)
        pushSample(samplesYRef.current, velocityYRef.current)
        pathX.set(sparklinePath(samplesXRef.current))
        pathY.set(sparklinePath(samplesYRef.current))
        velocityX.set(decayVelocity(velocityXRef.current))
        velocityY.set(decayVelocity(velocityYRef.current))
        lastSampleAt = now
      }
      frameId = requestAnimationFrame(sample)
    }

    frameId = requestAnimationFrame(sample)
    return () => cancelAnimationFrame(frameId)
  }, [pathX, pathY, prefersReducedMotion])

  const updatePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const now = performance.now()
    const previous = previousPointerRef.current
    if (previous) {
      const elapsedSeconds = Math.max(1, now - previous.time) / 1000
      velocityX.set((event.clientX - previous.x) / elapsedSeconds)
      velocityY.set((event.clientY - previous.y) / elapsedSeconds)
    }
    previousPointerRef.current = { time: now, x: event.clientX, y: event.clientY }
  }

  return (
    <TweakerControl
      id="mouse-velocity"
      contentLayout="block"
      description="Move across the plot. MotionValues sample velocity without updating React or the panel store."
      label="Pointer velocity"
      reorderable={false}
    >
      <div className="col-span-full grid gap-1.5">
        <div
          aria-label="Pointer velocity sampling surface"
          className="bg-muted/25 focus-visible:ring-ring border-input relative h-24 touch-none overflow-hidden rounded-md border outline-none focus-visible:ring-2"
          role="region"
          tabIndex={0}
          onPointerEnter={updatePointer}
          onPointerLeave={() => {
            previousPointerRef.current = null
          }}
          onPointerMove={updatePointer}
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
    </TweakerControl>
  )
}

function pushSample(samples: number[], value: number) {
  samples.push(Math.min(velocityCeiling, Math.max(-velocityCeiling, value)))
  if (samples.length > sampleCount) samples.shift()
}

function decayVelocity(value: number) {
  const decayed = value * 0.72
  return Math.abs(decayed) < 1 ? 0 : decayed
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
