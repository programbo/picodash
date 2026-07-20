import { motion, useMotionValue, useReducedMotion, type MotionValue } from 'motion/react'
import { ToggleGroup } from 'radix-ui'
import { useEffect } from 'react'
import { TweakerItem } from 'tweaker'

type SignalMode = 'spectrum' | 'waveform'

const width = 320
const height = 96

export function WaveformSpectrumItem() {
  const path = useMotionValue(waveformPath(0))
  const prefersReducedMotion = useReducedMotion()

  return (
    <TweakerItem<SignalMode>
      id="signal-visualizer"
      contentLayout="block"
      defaultValue="waveform"
      description="A deterministic synthetic signal rendered straight into an SVG path MotionValue."
      field="signalMode"
      label="Signal view"
      reorderable={false}
    >
      {(item) => {
        const mode: SignalMode = item.value === 'spectrum' ? 'spectrum' : 'waveform'

        return (
          <SignalSurface
            mode={mode}
            path={path}
            prefersReducedMotion={prefersReducedMotion ?? false}
            unavailable={item.disabled || item.readOnly}
            onModeChange={item.setInput}
          />
        )
      }}
    </TweakerItem>
  )
}

function SignalSurface({
  mode,
  onModeChange,
  path,
  prefersReducedMotion,
  unavailable,
}: {
  mode: SignalMode
  onModeChange: (mode: SignalMode) => void
  path: MotionValue<string>
  prefersReducedMotion: boolean
  unavailable: boolean
}) {
  useEffect(() => {
    const setPath = (phase: number) => {
      path.set(mode === 'waveform' ? waveformPath(phase) : spectrumPath(phase))
    }

    if (prefersReducedMotion) {
      setPath(0.7)
      return
    }

    let frameId = 0
    const startedAt = performance.now()
    const render = (now: number) => {
      setPath((now - startedAt) / 850)
      frameId = requestAnimationFrame(render)
    }
    frameId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frameId)
  }, [mode, path, prefersReducedMotion])

  return (
    <div className="col-span-full grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground font-mono text-[9px] tracking-widest uppercase">
          deterministic oscillator
        </p>
        <ToggleGroup.Root
          aria-label="Signal visualization mode"
          className="bg-muted/35 border-input inline-flex overflow-hidden rounded-md border p-0.5"
          disabled={unavailable}
          type="single"
          value={mode}
          onValueChange={(value) => {
            if (value === 'waveform' || value === 'spectrum') onModeChange(value)
          }}
        >
          {(['waveform', 'spectrum'] as const).map((value) => (
            <ToggleGroup.Item
              key={value}
              aria-label={`Show ${value}`}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-6 px-2 text-[10px] font-medium capitalize outline-none focus-visible:ring-2 disabled:opacity-50"
              value={value}
            >
              {value}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </div>
      <div className="bg-muted/25 border-input h-28 overflow-hidden rounded-md border">
        <svg
          aria-label={`Synthetic signal ${mode}`}
          className="size-full"
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          <path
            className="stroke-border"
            d={`M 0 ${height / 2} H ${width}`}
            strokeDasharray="3 5"
            vectorEffect="non-scaling-stroke"
          />
          <motion.path
            className="stroke-chart-2"
            d={path}
            fill={mode === 'spectrum' ? 'var(--chart-2)' : 'none'}
            fillOpacity={mode === 'spectrum' ? 0.18 : 0}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  )
}

function waveformPath(phase: number) {
  const pointCount = 96
  return Array.from({ length: pointCount }, (_, index) => {
    const progress = index / (pointCount - 1)
    const carrier = Math.sin(progress * Math.PI * 6 + phase * 2.1)
    const harmonic = Math.sin(progress * Math.PI * 18 - phase * 1.3) * 0.28
    const envelope = 0.7 + Math.sin(progress * Math.PI * 2 - 0.8) * 0.18
    const x = progress * width
    const y = height / 2 - (carrier + harmonic) * envelope * 28
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

function spectrumPath(phase: number) {
  const barCount = 28
  const gap = 3
  const barWidth = (width - gap * (barCount + 1)) / barCount
  return Array.from({ length: barCount }, (_, index) => {
    const progress = index / (barCount - 1)
    const rolloff = Math.pow(1 - progress, 0.7)
    const modulation = 0.56 + Math.sin(index * 1.87 + phase * 2.4) * 0.22
    const barHeight = Math.max(3, rolloff * modulation * (height - 14))
    const x = gap + index * (barWidth + gap)
    const y = height - 6 - barHeight
    return `M ${x.toFixed(2)} ${height - 6} V ${y.toFixed(2)} H ${(x + barWidth).toFixed(2)} V ${height - 6} Z`
  }).join(' ')
}
