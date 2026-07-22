import type { ReactNode } from 'react'
import {
  PicodashSparkline,
  type PicodashSparklineProps,
  type PicodashSparklineSource,
} from '@picodash/panel'
import { decayPointerVelocity } from './pointer-velocity-sampling'

export const velocitySeries = [
  {
    dataKey: 'x',
    label: 'X velocity',
    stroke: 'var(--picodash-color-accent)',
  },
  {
    dataKey: 'y',
    label: 'Y velocity',
    stroke: 'var(--picodash-color-warning)',
  },
] as const

export const mouseVelocityStream: PicodashSparklineSource = {
  subscribe(emit, options) {
    let previous: { time: number; x: number; y: number } | undefined
    let velocityX = 0
    let velocityY = 0
    let frameTime = performance.now()
    let frame: number | null = null
    let continuous = options.continuous

    const scheduleSample = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(sample)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const now = performance.now()
      if (previous) {
        const elapsedSeconds = Math.max(1, now - previous.time) / 1000
        velocityX = (event.clientX - previous.x) / elapsedSeconds
        velocityY = (event.clientY - previous.y) / elapsedSeconds
      }
      previous = { time: now, x: event.clientX, y: event.clientY }
      scheduleSample()
    }

    const reset = () => {
      previous = undefined
      velocityX = 0
      velocityY = 0
      scheduleSample()
    }

    function sample(now: number) {
      frame = null
      const elapsed = Math.min(100, Math.max(0, now - frameTime))
      frameTime = now
      emit({ x: velocityX, y: velocityY })
      velocityX = decayPointerVelocity(velocityX, elapsed)
      velocityY = decayPointerVelocity(velocityY, elapsed)
      if (continuous || velocityX !== 0 || velocityY !== 0) scheduleSample()
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('blur', reset)
    document.addEventListener('pointerleave', reset)
    const unsubscribeContinuous = options.onContinuousChange((nextContinuous) => {
      continuous = nextContinuous
      if (continuous) scheduleSample()
    })
    scheduleSample()

    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      unsubscribeContinuous()
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('blur', reset)
      document.removeEventListener('pointerleave', reset)
    }
  },
}

export function StreamingSparklineItem({
  autoscale = false,
  continuous,
  help,
  maxValue = 1800,
  maxPoints = 56,
  minValue = -1800,
  showBaseline,
  ...itemProps
}: Pick<
  PicodashSparklineProps,
  | 'contentLayout'
  | 'description'
  | 'disabled'
  | 'readOnly'
  | 'reorderable'
  | 'showBaseline'
  | 'visible'
> & {
  autoscale?: boolean
  continuous?: boolean
  help?: ReactNode
  maxValue?: number
  maxPoints?: number
  minValue?: number
}) {
  const scaleProps = autoscale
    ? ({ autoscale: true } as const)
    : ({ autoscale: false, maxValue, minValue } as const)

  return (
    <PicodashSparkline
      {...itemProps}
      {...scaleProps}
      id="sparkline"
      ariaLabel="Streaming horizontal and vertical pointer velocity"
      continuous={continuous}
      data={mouseVelocityStream}
      help={help}
      label="Sparkline"
      maxPoints={maxPoints}
      series={velocitySeries}
      showBaseline={showBaseline}
    />
  )
}
