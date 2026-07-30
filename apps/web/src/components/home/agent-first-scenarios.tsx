'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPicodashStore, type PicodashJsonValue, type PicodashParser } from '@picodash/store'
import {
  ActionMenuItem,
  ActionMenuSeparator,
  type PicodashPanelCloseDetails,
  PicodashGroup,
  PicodashItem,
  PicodashPanel,
  PicodashPanelTrigger,
  PicodashSlider,
  PicodashSwitch,
  usePicodashPanel,
} from '@picodash/panel'
import { Button } from '@picodash/panel/ui'
import { usePicodashStateAdapter, usePicodashStoreSelector } from '@picodash/store/react'
import * as Dashlet from '@picodash/panel/dashlet'

const qualityModes = ['draft', 'balanced', 'final'] as const
const sceneModes = ['cinematic', 'editorial', 'social'] as const
const rolloutModes = ['safe', 'staged', 'forced'] as const

type QualityMode = (typeof qualityModes)[number]
type SceneMode = (typeof sceneModes)[number]
type RolloutMode = (typeof rolloutModes)[number]

type DebugValues = {
  debugMode: RolloutMode
  errorBudget: number
  incidentWindow: number
  lastAction: string
  logSampling: boolean
  rolloutPercent: number
}

type Trend = 'healthy' | 'recovering' | 'degraded'

function parserFor<TValue extends PicodashJsonValue>(
  accepts: (value: unknown) => value is TValue,
  message: string,
): PicodashParser<TValue> {
  return ((value) =>
    accepts(value)
      ? { output: { value }, success: true }
      : { errors: [message], success: false }) as PicodashParser<TValue>
}

const finiteNumber = parserFor<number>(
  (value): value is number => typeof value === 'number' && Number.isFinite(value),
  'Value must be a finite number.',
)

const normalizeNumber = (value: number | undefined, fallback = 0): number =>
  typeof value === 'number' ? value : fallback

const creativeStore = createPicodashStore({
  panelId: 'agent-creative-surface',
  fields: {
    bloom: { defaultValue: 0.28, parse: finiteNumber },
    contrast: { defaultValue: 1.12, parse: finiteNumber },
    exposure: { defaultValue: 1.2, parse: finiteNumber },
    mode: {
      defaultValue: 'cinematic' as const,
      parse: parserFor<SceneMode>(
        (value): value is SceneMode => sceneModes.includes(value as SceneMode),
        'Mode must be cinematic, editorial, or social.',
      ),
    },
    quality: {
      defaultValue: 'balanced' as const,
      parse: parserFor<QualityMode>(
        (value): value is QualityMode => qualityModes.includes(value as QualityMode),
        'Quality must be draft, balanced, or final.',
      ),
    },
  },
})

const monitorStore = createPicodashStore({
  panelId: 'agent-monitoring-surface',
  fields: {
    droppedFrames: { defaultValue: 0, parse: finiteNumber },
    droppedBurst: { defaultValue: 2, parse: finiteNumber },
    fps: { defaultValue: 60, parse: finiteNumber },
    inFlight: { defaultValue: 3, parse: finiteNumber },
    isSampling: {
      defaultValue: true,
      parse: parserFor<boolean>(
        (value): value is boolean => typeof value === 'boolean',
        'Value must be boolean.',
      ),
    },
    latencyMs: { defaultValue: 8, parse: finiteNumber },
    sampleMs: { defaultValue: 780, parse: finiteNumber },
    steadyTarget: { defaultValue: 85, parse: finiteNumber },
  },
})

const debugDefaults: DebugValues = {
  debugMode: 'safe',
  errorBudget: 96,
  incidentWindow: 120,
  lastAction: 'idle',
  logSampling: true,
  rolloutPercent: 12,
}

export function AgentFirstScenarios() {
  return (
    <div className="grid gap-14">
      <ScenarioSection
        eyebrow="Scenario 1"
        title="Creative controls"
        summary="Host-owned render settings feed a compound Dashlet so panel state can be consumed by non-panel UI."
      >
        <CreativeScenario />
      </ScenarioSection>

      <ScenarioSection
        eyebrow="Scenario 2"
        title="Application monitoring"
        summary="Atomic store writes keep telemetry consistent while derived charts and readouts render in the same frame."
      >
        <MonitoringScenario />
      </ScenarioSection>

      <ScenarioSection
        eyebrow="Scenario 3"
        title="Debug and rollout controls"
        summary="Native Store contract handles panel-native values, while `usePicodashStateAdapter` bridges existing host state."
      >
        <DebugScenario />
      </ScenarioSection>
    </div>
  )
}

function ScenarioSection({
  eyebrow,
  children,
  summary,
  title,
}: {
  children: React.ReactNode
  eyebrow: string
  summary: string
  title: string
}) {
  return (
    <section className="grid gap-5">
      <header>
        <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-medium text-zinc-100">{title}</h2>
        <p className="mt-1.5 max-w-4xl text-sm text-zinc-400">{summary}</p>
      </header>
      {children}
    </section>
  )
}

function CreativeScenario() {
  const boundaryRef = useRef<HTMLDivElement>(null)
  const values = usePicodashStoreSelector(creativeStore, (state) => state.values)

  const sceneTone = useMemo(() => {
    if (values.mode === 'cinematic') return 'Warm'
    if (values.mode === 'editorial') return 'Neutral'
    return 'Vivid'
  }, [values.mode])

  const scenePreview = `${sceneTone} · exposure ${values.exposure.toFixed(2)} · contrast ${values.contrast.toFixed(2)} · bloom ${values.bloom.toFixed(2)}`

  return (
    <div ref={boundaryRef} className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
      <article className="border border-white/10 bg-white/3 p-4">
        <PicodashPanel
          boundary={boundaryRef}
          close
          defaultPlacement={{
            disposition: { kind: 'snapped', position: 'top-right' },
            mode: 'floating',
          }}
          store={creativeStore}
          title="Creative controls"
          width={344}
        >
          <PicodashItem
            id="creative-profile"
            contentLayout="full"
            fields={{
              bloom: creativeStore.fields.bloom,
              contrast: creativeStore.fields.contrast,
              exposure: creativeStore.fields.exposure,
              mode: creativeStore.fields.mode,
              quality: creativeStore.fields.quality,
            }}
            label="Creative profile"
            description="One compound Dashlet owns the full render-profile contract."
          >
            {({ fields, reset }) => {
              const exposure = normalizeNumber(fields.exposure.value)
              const contrast = normalizeNumber(fields.contrast.value)
              const bloom = normalizeNumber(fields.bloom.value)

              return (
                <Dashlet.Frame>
                  <Dashlet.Header>
                    <Dashlet.Heading>Creative profile</Dashlet.Heading>
                    <Dashlet.Description>
                      One registered item coordinates five writable Store fields.
                    </Dashlet.Description>
                  </Dashlet.Header>
                  <Dashlet.Body>
                    <Dashlet.Toolbar aria-label="Creative mode">
                      {sceneModes.map((mode) => (
                        <Button
                          key={mode}
                          size="xs"
                          variant={fields.mode.value === mode ? 'secondary' : 'outline'}
                          onPress={() => fields.mode.setInput(mode)}
                        >
                          {mode}
                        </Button>
                      ))}
                    </Dashlet.Toolbar>
                    <Dashlet.DataList density="compact">
                      <Dashlet.DataRow>
                        <Dashlet.DataLabel>Mode</Dashlet.DataLabel>
                        <Dashlet.DataValue>{fields.mode.value}</Dashlet.DataValue>
                      </Dashlet.DataRow>
                      <Dashlet.DataRow>
                        <Dashlet.DataLabel>Tone</Dashlet.DataLabel>
                        <Dashlet.DataValue>{sceneTone}</Dashlet.DataValue>
                      </Dashlet.DataRow>
                      <Dashlet.DataRow>
                        <Dashlet.DataLabel>Exposure</Dashlet.DataLabel>
                        <Dashlet.DataValue>{exposure.toFixed(2)}</Dashlet.DataValue>
                      </Dashlet.DataRow>
                      <Dashlet.DataRow>
                        <Dashlet.DataLabel>Contrast</Dashlet.DataLabel>
                        <Dashlet.DataValue>{contrast.toFixed(2)}</Dashlet.DataValue>
                      </Dashlet.DataRow>
                      <Dashlet.DataRow>
                        <Dashlet.DataLabel>Bloom</Dashlet.DataLabel>
                        <Dashlet.DataValue>{bloom.toFixed(2)}</Dashlet.DataValue>
                      </Dashlet.DataRow>
                      <Dashlet.DataRow>
                        <Dashlet.DataLabel>Quality</Dashlet.DataLabel>
                        <Dashlet.DataValue>{fields.quality.value}</Dashlet.DataValue>
                      </Dashlet.DataRow>
                    </Dashlet.DataList>
                  </Dashlet.Body>
                  <Dashlet.Footer>
                    <Dashlet.Toolbar aria-label="Creative adjustments">
                      <Button
                        size="xs"
                        variant="outline"
                        onPress={() => fields.exposure.setInput(Math.min(2.4, exposure + 0.1))}
                      >
                        Exposure +
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onPress={() => fields.contrast.setInput(Math.min(2.2, contrast + 0.1))}
                      >
                        Contrast +
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onPress={() => fields.bloom.setInput(Math.min(1.8, bloom + 0.1))}
                      >
                        Bloom +
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onPress={() => {
                          const currentQuality = qualityModes.includes(
                            fields.quality.value as QualityMode,
                          )
                            ? (fields.quality.value as QualityMode)
                            : 'balanced'
                          const index = qualityModes.indexOf(currentQuality)
                          fields.quality.setInput(qualityModes[(index + 1) % qualityModes.length]!)
                        }}
                      >
                        Cycle quality
                      </Button>
                      <Button size="xs" variant="ghost" onPress={reset}>
                        Reset profile
                      </Button>
                    </Dashlet.Toolbar>
                  </Dashlet.Footer>
                </Dashlet.Frame>
              )
            }}
          </PicodashItem>
        </PicodashPanel>
      </article>

      <article className="border border-white/10 bg-white/3 px-5 py-4">
        <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Host preview state</p>
        <h3 className="mt-2 text-lg font-medium text-zinc-100">React-owned scene summary</h3>
        <p className="mt-2 text-sm text-zinc-400">
          The host renders this summary from store values as plain text, while controls remain in
          the panel.
        </p>
        <p className="mt-3 rounded-sm border border-white/10 bg-black/35 px-3 py-2 font-mono text-sm text-zinc-100">
          {scenePreview}
        </p>
        <PicodashPanelTrigger
          action="activate"
          className="mt-4"
          size="sm"
          store={creativeStore}
          variant="outline"
        >
          Reopen creative controls
        </PicodashPanelTrigger>
      </article>
    </div>
  )
}

function MonitoringScenario() {
  const boundaryRef = useRef<HTMLDivElement>(null)
  const values = usePicodashStoreSelector(monitorStore, (state) => state.values)
  const [history, setHistory] = useState<number[]>([values.fps])

  const trend: Trend = useMemo(() => {
    if (values.fps >= values.steadyTarget) return 'healthy'
    if (values.fps >= values.steadyTarget - 6) return 'recovering'
    return 'degraded'
  }, [values.fps, values.steadyTarget])

  const trendTone = trend === 'healthy' ? 'success' : trend === 'recovering' ? 'warning' : 'danger'
  const metricTrendTone =
    trend === 'healthy' ? 'positive' : trend === 'degraded' ? 'negative' : 'neutral'

  useEffect(() => {
    if (!values.isSampling) return

    const interval = window.setInterval(() => {
      const current = monitorStore.getState().values
      const noise =
        (Math.sin((Date.now() / current.sampleMs) * 0.9) + Math.cos(Date.now() / 1300)) * 2
      const jitter = (Math.random() - 0.5) * 3
      const nextFps = Math.max(12, Math.min(120, Math.round(current.fps + noise + jitter)))
      const nextDropped = Math.max(0, current.droppedFrames + (noise < -1.1 ? 1 : 0))
      const nextLatency = Math.max(
        2,
        Math.round(current.latencyMs + Math.sin(Date.now() / 750) * 8),
      )
      const nextInFlight = Math.max(
        0,
        Math.round(current.inFlight + Math.sin(Date.now() / 900) * 2.1),
      )
      const nextBurst = Math.max(0, Math.round(current.droppedBurst + (noise < -1.1 ? 1 : 0)))

      monitorStore.getState().setFieldValues({
        droppedFrames: nextDropped,
        droppedBurst: nextBurst,
        fps: nextFps,
        latencyMs: nextLatency,
        inFlight: nextInFlight,
      })

      setHistory((entries) => [...entries.slice(-16), nextFps])
    }, values.sampleMs)

    return () => clearInterval(interval)
  }, [values.sampleMs, values.isSampling])

  const path = useMemo(() => {
    const width = 320
    const height = 58
    const max = Math.max(...history, 1)
    const min = Math.min(...history, 120)
    const span = Math.max(max - min, 1)

    return history
      .map((entry, index) => {
        const x = (index / Math.max(1, history.length - 1)) * width
        const y = height - ((entry - min) / span) * height
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ')
  }, [history])

  return (
    <div ref={boundaryRef} className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
      <article className="border border-white/10 bg-white/3 p-4">
        <PicodashPanel
          boundary={boundaryRef}
          close
          defaultPlacement={{
            disposition: { kind: 'docked', position: 'full-right' },
            mode: 'fixed',
          }}
          store={monitorStore}
          title="Monitoring controls"
          width={352}
        >
          <PicodashGroup id="monitoring" label="Application telemetry" reorderable={false}>
            <PicodashSwitch field={monitorStore.fields.isSampling} label="Live sampling" />
            <PicodashSlider
              field={monitorStore.fields.sampleMs}
              label="Sample interval"
              min={450}
              max={1900}
              step={50}
            />
            <PicodashSlider
              field={monitorStore.fields.steadyTarget}
              label="Target fps"
              min={35}
              max={110}
              step={1}
            />

            <PicodashItem
              id="monitoring-compound"
              contentLayout="full"
              fields={{
                fps: { field: monitorStore.fields.fps, mode: 'display' },
                latencyMs: { field: monitorStore.fields.latencyMs, mode: 'display' },
                droppedFrames: { field: monitorStore.fields.droppedFrames, mode: 'display' },
                inFlight: { field: monitorStore.fields.inFlight, mode: 'display' },
                droppedBurst: { field: monitorStore.fields.droppedBurst, mode: 'display' },
              }}
              label="Runtime telemetry"
              description="Single atomic `setFieldValues` call per sample keeps host state consistent."
            >
              {({ fields }) => (
                <Dashlet.Frame>
                  <Dashlet.Header>
                    <Dashlet.Heading>Runtime telemetry</Dashlet.Heading>
                    <Dashlet.Description>
                      Atomic updates flow through one store namespace.
                    </Dashlet.Description>
                    <Dashlet.Actions>
                      <Dashlet.Status tone={trendTone}>
                        <Dashlet.StatusIndicator tone={trendTone} />
                        {trend === 'healthy'
                          ? 'Stable'
                          : trend === 'recovering'
                            ? 'Recovering'
                            : 'Degraded'}
                      </Dashlet.Status>
                    </Dashlet.Actions>
                  </Dashlet.Header>
                  <Dashlet.Body>
                    <Dashlet.Metric>
                      <Dashlet.MetricLabel>FPS</Dashlet.MetricLabel>
                      <Dashlet.MetricValue>{fields.fps.value}</Dashlet.MetricValue>
                      <Dashlet.MetricTrend tone={metricTrendTone}>
                        target {values.steadyTarget}
                      </Dashlet.MetricTrend>
                    </Dashlet.Metric>
                    <Dashlet.Metric>
                      <Dashlet.MetricLabel>Latency</Dashlet.MetricLabel>
                      <Dashlet.MetricValue>{fields.latencyMs.value} ms</Dashlet.MetricValue>
                    </Dashlet.Metric>
                    <Dashlet.Surface className="mt-3 overflow-hidden" size="field">
                      <svg
                        className="size-full"
                        viewBox="0 0 320 58"
                        role="img"
                        aria-label="FPS stream"
                      >
                        <path
                          d="M 0 29 H 320"
                          stroke="var(--picodash-color-border)"
                          strokeDasharray="3 5"
                        />
                        <path
                          d={path}
                          fill="none"
                          stroke="var(--picodash-color-data-1)"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </Dashlet.Surface>
                    <Dashlet.DataList density="compact" className="mt-3">
                      <Dashlet.DataRow>
                        <Dashlet.DataLabel>Dropped total</Dashlet.DataLabel>
                        <Dashlet.DataValue>{fields.droppedFrames.value}</Dashlet.DataValue>
                      </Dashlet.DataRow>
                      <Dashlet.DataRow>
                        <Dashlet.DataLabel>Burst</Dashlet.DataLabel>
                        <Dashlet.DataValue>{fields.droppedBurst.value}</Dashlet.DataValue>
                      </Dashlet.DataRow>
                      <Dashlet.DataRow>
                        <Dashlet.DataLabel>In-flight</Dashlet.DataLabel>
                        <Dashlet.DataValue>{fields.inFlight.value}</Dashlet.DataValue>
                      </Dashlet.DataRow>
                    </Dashlet.DataList>
                  </Dashlet.Body>
                </Dashlet.Frame>
              )}
            </PicodashItem>
          </PicodashGroup>
        </PicodashPanel>
      </article>

      <article className="border border-white/10 bg-white/3 px-5 py-4">
        <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Streaming proof</p>
        <p className="mt-2 text-sm text-zinc-400">
          State writes are batched into one `setFieldValues` call per tick.
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-zinc-300">
          <li>Store ID: `agent-monitoring-surface`</li>
          <li>Current fps: {values.fps}</li>
          <li>Current sample interval: {Math.round(values.sampleMs)} ms</li>
          <li>Sampling enabled: {values.isSampling ? 'on' : 'off'}</li>
        </ul>
        <PicodashPanelTrigger
          action="activate"
          className="mt-4"
          size="sm"
          store={monitorStore}
          variant="outline"
        >
          Reopen monitoring controls
        </PicodashPanelTrigger>
      </article>
    </div>
  )
}

function DebugScenario() {
  const boundaryRef = useRef<HTMLDivElement>(null)
  const controlPanel = usePicodashPanel('agent-debug-controls')
  const [policyAllowed, setPolicyAllowed] = useState(true)
  const [launchCount, setLaunchCount] = useState(0)
  const [hostValues, setHostValues] = useState<DebugValues>(debugDefaults)
  const adapter = usePicodashStateAdapter(hostValues, setHostValues, {
    id: 'agent-home-debug-adapter',
  })
  const debugStore = useMemo(
    () =>
      createPicodashStore<DebugValues>({
        panelId: 'agent-debug-controls',
        adapter,
        fields: {
          debugMode: {
            defaultValue: debugDefaults.debugMode,
            parse: parserFor<RolloutMode>(
              (value): value is RolloutMode => rolloutModes.includes(value as RolloutMode),
              'Value must be safe, staged, or forced.',
            ),
          },
          errorBudget: { defaultValue: debugDefaults.errorBudget, parse: finiteNumber },
          incidentWindow: { defaultValue: debugDefaults.incidentWindow, parse: finiteNumber },
          lastAction: {
            defaultValue: debugDefaults.lastAction,
            parse: parserFor<string>(
              (value): value is string => typeof value === 'string',
              'Value must be a string.',
            ),
          },
          logSampling: {
            defaultValue: debugDefaults.logSampling,
            parse: parserFor<boolean>(
              (value): value is boolean => typeof value === 'boolean',
              'Value must be boolean.',
            ),
          },
          rolloutPercent: { defaultValue: debugDefaults.rolloutPercent, parse: finiteNumber },
        },
      }),
    [adapter],
  )
  const values = usePicodashStoreSelector(debugStore, (state) => state.values)

  useEffect(() => {
    if (!policyAllowed) {
      controlPanel?.hide()
    }
  }, [policyAllowed, controlPanel])

  const logAction = (label: string) => {
    setHostValues((current) => ({
      ...current,
      lastAction: label,
      incidentWindow: Math.max(0, current.incidentWindow - 1),
    }))
    setLaunchCount((current) => current + 1)
  }

  const onClose = (_details: PicodashPanelCloseDetails) => {
    setLaunchCount((current) => Math.max(0, current - 1))
  }

  return (
    <div ref={boundaryRef} className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
      <article className="border border-white/10 bg-white/3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Launcher</p>
            <p className="text-sm text-zinc-400">
              Policy gate decides whether the debug panel is exposed.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-200">
            <input
              checked={policyAllowed}
              className="size-4 accent-emerald-300"
              type="checkbox"
              onChange={(event) => setPolicyAllowed(event.currentTarget.checked)}
            />
            Expose debug panel
          </label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <PicodashPanelTrigger
            action="activate"
            className="rounded-sm border border-emerald-300/35 bg-emerald-300/10 px-3 py-2.5 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!policyAllowed || controlPanel?.visible}
            store={debugStore}
          >
            Launch debug panel
          </PicodashPanelTrigger>
          <button
            className="rounded-sm border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!controlPanel?.visible}
            type="button"
            onClick={() => {
              controlPanel?.hide()
              logAction('Dismiss panel')
            }}
          >
            Hide panel
          </button>
          <button
            className="rounded-sm border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/12"
            type="button"
            onClick={() => {
              logAction('Refresh adapter state')
              setHostValues({ ...debugDefaults })
            }}
          >
            Reset host state
          </button>
          <button
            className="rounded-sm border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/12"
            type="button"
            onClick={() => logAction('Manual audit marker')}
          >
            Log audit marker
          </button>
        </div>

        <div className="mt-4 text-sm text-zinc-300">
          <p>Current mode: {values.debugMode}</p>
          <p>Rollout: {values.rolloutPercent}%</p>
          <p>Error budget: {values.errorBudget}</p>
          <p>Policy touches: {launchCount}</p>
          <p>Last action: {values.lastAction}</p>
        </div>
      </article>

      <article className="border border-white/10 bg-white/3 p-4">
        <PicodashPanel
          actionMenu={[
            <ActionMenuItem
              key="snapshot"
              label="Capture snapshot"
              onAction={() => logAction(`snapshot-${Date.now()}`)}
            />,
            <ActionMenuSeparator key="separator" />,
            <ActionMenuItem
              key="host"
              label="Reset host"
              onAction={() => {
                setHostValues({
                  ...debugDefaults,
                  lastAction: 'panel-reset',
                })
                setLaunchCount((current) => current + 1)
              }}
            />,
          ]}
          boundary={boundaryRef}
          close
          defaultPlacement={{ disposition: { kind: 'free' }, mode: 'hybrid' }}
          defaultVisible={false}
          onClose={onClose}
          store={debugStore}
          title="Debug feature controls"
          width={350}
        >
          <PicodashItem
            id="debug-adapter-controls"
            contentLayout="full"
            fields={{
              debugMode: debugStore.fields.debugMode,
              errorBudget: debugStore.fields.errorBudget,
              incidentWindow: debugStore.fields.incidentWindow,
              lastAction: { field: debugStore.fields.lastAction, mode: 'display' },
              logSampling: debugStore.fields.logSampling,
              rolloutPercent: debugStore.fields.rolloutPercent,
            }}
            label="Adapter controls"
            description="One compound Dashlet writes through the adapter while the host stays authoritative."
          >
            {({ fields, reset }) => {
              const rollout = normalizeNumber(fields.rolloutPercent.value)
              const budget = normalizeNumber(fields.errorBudget.value)
              const window = normalizeNumber(fields.incidentWindow.value)

              return (
                <Dashlet.Frame>
                  <Dashlet.Header>
                    <Dashlet.Heading>Adapter controls</Dashlet.Heading>
                    <Dashlet.Description>
                      Host state remains authoritative while the compound item owns the UI contract.
                    </Dashlet.Description>
                  </Dashlet.Header>
                  <Dashlet.Body>
                    <Dashlet.Toolbar aria-label="Debug mode">
                      {rolloutModes.map((mode) => (
                        <Button
                          key={mode}
                          size="xs"
                          variant={fields.debugMode.value === mode ? 'secondary' : 'outline'}
                          onPress={() => fields.debugMode.setInput(mode)}
                        >
                          {mode}
                        </Button>
                      ))}
                    </Dashlet.Toolbar>
                    <Dashlet.Metric>
                      <Dashlet.MetricLabel>Debug mode</Dashlet.MetricLabel>
                      <Dashlet.MetricValue>{fields.debugMode.value}</Dashlet.MetricValue>
                    </Dashlet.Metric>
                    <Dashlet.Metric>
                      <Dashlet.MetricLabel>Rollout</Dashlet.MetricLabel>
                      <Dashlet.MetricValue>{fields.rolloutPercent.value}%</Dashlet.MetricValue>
                    </Dashlet.Metric>
                    <Dashlet.Metric>
                      <Dashlet.MetricLabel>Budget</Dashlet.MetricLabel>
                      <Dashlet.MetricValue>{fields.errorBudget.value}</Dashlet.MetricValue>
                    </Dashlet.Metric>
                    <Dashlet.DataList density="compact" className="mt-2">
                      <Dashlet.DataRow>
                        <Dashlet.DataLabel>Policy window</Dashlet.DataLabel>
                        <Dashlet.DataValue>{fields.incidentWindow.value}</Dashlet.DataValue>
                      </Dashlet.DataRow>
                      <Dashlet.DataRow>
                        <Dashlet.DataLabel>Last action</Dashlet.DataLabel>
                        <Dashlet.DataValue>{fields.lastAction.value}</Dashlet.DataValue>
                      </Dashlet.DataRow>
                      <Dashlet.DataRow>
                        <Dashlet.DataLabel>Log sampling</Dashlet.DataLabel>
                        <Dashlet.DataValue>
                          {fields.logSampling.value ? 'Enabled' : 'Disabled'}
                        </Dashlet.DataValue>
                      </Dashlet.DataRow>
                    </Dashlet.DataList>
                  </Dashlet.Body>
                  <Dashlet.Footer>
                    <Dashlet.Toolbar aria-label="Adapter adjustments">
                      <Button
                        size="xs"
                        variant="outline"
                        onPress={() => fields.rolloutPercent.setInput(Math.min(100, rollout + 10))}
                      >
                        Rollout +10
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onPress={() => fields.errorBudget.setInput(Math.max(0, budget - 5))}
                      >
                        Spend budget
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onPress={() => fields.incidentWindow.setInput(Math.max(20, window - 10))}
                      >
                        Shorten window
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onPress={() => fields.logSampling.setInput(!fields.logSampling.value)}
                      >
                        Toggle logs
                      </Button>
                      <Button size="xs" variant="ghost" onPress={reset}>
                        Reset adapter
                      </Button>
                    </Dashlet.Toolbar>
                  </Dashlet.Footer>
                </Dashlet.Frame>
              )
            }}
          </PicodashItem>
        </PicodashPanel>
      </article>
    </div>
  )
}
