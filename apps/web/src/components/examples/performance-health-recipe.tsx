'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { PicodashItem, PicodashPanel } from '@picodash/panel'
import * as Dashlet from '@picodash/panel/dashlet'
import { Button, Meter, MeterFill, MeterTrack } from '@picodash/panel/ui'
import { usePicodashStoreSelector } from '@picodash/store/react'

import { performanceHealthStore } from './example-stores'
import { RecipeShell } from './recipe-shell'

const initialSamples = [58.7, 59.4, 59.8, 60, 59.6, 59.9, 58.9, 59.8]

export function PerformanceHealthRecipe() {
  const boundaryRef = useRef<HTMLDivElement>(null)
  const [samples, setSamples] = useState(initialSamples)
  const sampling = usePicodashStoreSelector(
    performanceHealthStore,
    (state) => state.values.sampling,
  )

  useEffect(() => {
    if (!sampling) return

    const interval = window.setInterval(() => {
      const phase = performance.now() / 930
      const nextFrameRate = 59.4 + Math.sin(phase) * 0.7 + Math.cos(phase * 0.41) * 0.35
      performanceHealthStore.getState().setFieldValues({
        frameRate: Number(nextFrameRate.toFixed(1)),
        longFrames: Math.max(0, Math.round(2 + Math.sin(phase * 0.7) * 2)),
      })
      setSamples((current) => [...current.slice(-17), nextFrameRate])
    }, 900)

    return () => window.clearInterval(interval)
  }, [sampling])

  const sparklinePath = useMemo(() => {
    const low = Math.min(...samples) - 0.4
    const high = Math.max(...samples) + 0.4
    const range = Math.max(1, high - low)

    return samples
      .map((sample, index) => {
        const x = (index / Math.max(1, samples.length - 1)) * 300
        const y = 62 - ((sample - low) / range) * 54
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }, [samples])

  return (
    <RecipeShell
      boundaryRef={boundaryRef}
      description="Metrics, trend, status, meter, and a streaming sparkline whose history stays in component memory."
      eyebrow="Observe"
      store={performanceHealthStore}
      title="Performance health"
    >
      <PicodashPanel
        boundary={boundaryRef}
        close
        collapsible
        defaultPlacement={{
          disposition: { kind: 'snapped', position: 'top-right' },
          mode: 'floating',
        }}
        store={performanceHealthStore}
        title="Performance health"
        width={350}
      >
        <PicodashItem
          contentLayout="full"
          fields={{
            frameBudget: {
              field: performanceHealthStore.fields.frameBudgetMs,
              mode: 'display',
            },
            frameRate: { field: performanceHealthStore.fields.frameRate, mode: 'display' },
            longFrames: { field: performanceHealthStore.fields.longFrames, mode: 'display' },
            sampling: performanceHealthStore.fields.sampling,
          }}
          id="performance-health"
          label="Performance health"
        >
          {({ fields, reset }) => {
            const frameBudget = fields.frameBudget.value ?? 16.7
            const frameRate = fields.frameRate.value ?? 0
            const longFrames = fields.longFrames.value ?? 0
            const samplingEnabled = fields.sampling.value ?? false
            const healthy = frameRate >= 58

            return (
              <Dashlet.Frame>
                <Dashlet.Header>
                  <Dashlet.Heading>Render loop</Dashlet.Heading>
                  <Dashlet.Description>
                    Live frame delivery over the last 18 samples.
                  </Dashlet.Description>
                  <Dashlet.Actions>
                    <Dashlet.Status tone={healthy ? 'success' : 'warning'}>
                      <Dashlet.StatusIndicator tone={healthy ? 'success' : 'warning'} />
                      {healthy ? 'Healthy' : 'Watch'}
                    </Dashlet.Status>
                  </Dashlet.Actions>
                </Dashlet.Header>

                <Dashlet.Body className="grid grid-cols-2 gap-(--picodash-space-3)">
                  <Dashlet.Metric>
                    <Dashlet.MetricLabel>Frame rate</Dashlet.MetricLabel>
                    <Dashlet.MetricValue>{frameRate.toFixed(1)}</Dashlet.MetricValue>
                    <Dashlet.MetricTrend tone={healthy ? 'positive' : 'negative'}>
                      FPS · target 60
                    </Dashlet.MetricTrend>
                  </Dashlet.Metric>
                  <Dashlet.Metric align="end">
                    <Dashlet.MetricLabel>Long frames</Dashlet.MetricLabel>
                    <Dashlet.MetricValue emphasis="default">{longFrames}</Dashlet.MetricValue>
                    <Dashlet.MetricTrend>last minute</Dashlet.MetricTrend>
                  </Dashlet.Metric>

                  <Dashlet.Surface className="col-span-2 h-20" size="field">
                    <svg
                      aria-label="Recent frame rate samples"
                      className="size-full"
                      preserveAspectRatio="none"
                      role="img"
                      viewBox="0 0 300 70"
                    >
                      <path
                        d="M 0 35 H 300"
                        stroke="var(--picodash-color-border)"
                        strokeDasharray="3 5"
                      />
                      <path
                        d={sparklinePath}
                        fill="none"
                        stroke="var(--picodash-color-data-1)"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  </Dashlet.Surface>

                  <Meter
                    aria-label="Frame budget used"
                    className="col-span-2"
                    maxValue={20}
                    value={frameBudget}
                  >
                    <div className="flex justify-between text-(length:--picodash-font-size-md)">
                      <span>Frame budget</span>
                      <span>{frameBudget.toFixed(1)} ms / 20 ms</span>
                    </div>
                    <MeterTrack>
                      <MeterFill />
                    </MeterTrack>
                  </Meter>
                </Dashlet.Body>

                <Dashlet.Footer>
                  <Dashlet.Toolbar aria-label="Performance sampling actions">
                    <Button
                      size="xs"
                      variant="outline"
                      onPress={() => fields.sampling.setInput(!samplingEnabled)}
                    >
                      {samplingEnabled ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                      {samplingEnabled ? 'Pause samples' : 'Resume samples'}
                    </Button>
                    <Button size="xs" variant="ghost" onPress={reset}>
                      <RotateCcw aria-hidden="true" />
                      Reset
                    </Button>
                  </Dashlet.Toolbar>
                </Dashlet.Footer>
              </Dashlet.Frame>
            )
          }}
        </PicodashItem>
      </PicodashPanel>
    </RecipeShell>
  )
}
