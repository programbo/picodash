'use client'

import { createPicodashStore, type PicodashStore } from '@picodash/store'
import { PicodashItem, PicodashPanel, PicodashSelect, PicodashSwitch } from '@picodash/picodash'
import * as Dashlet from '@picodash/picodash/dashlet'
import { Button } from '@picodash/picodash/ui'

type CompositionValues = {
  fps: number
  frameBudget: number
  quality: 'draft' | 'balanced' | 'final'
  recovered: boolean
  throttled: boolean
}

export function createCompositionStore() {
  return createPicodashStore<CompositionValues>({
    fields: {
      fps: { defaultValue: 59.8 },
      frameBudget: { defaultValue: 16.7 },
      quality: { defaultValue: 'balanced' },
      recovered: { defaultValue: false },
      throttled: { defaultValue: false },
    },
    panelId: 'contract-composition-primary',
  })
}

export function CompositionSpecimen({
  store,
}: {
  readonly store: PicodashStore<CompositionValues>
}) {
  return (
    <PicodashPanel
      close
      collapsible
      data-contract-lab-primary-panel
      defaultPlacement={{
        disposition: { kind: 'snapped', position: 'top-right' },
        mode: 'floating',
      }}
      store={store}
      title="Composition Contract"
      width={350}
    >
      <PicodashItem
        contentLayout="full"
        fields={{
          fps: { field: store.fields.fps, mode: 'display' },
          frameBudget: { field: store.fields.frameBudget, mode: 'display' },
          recovered: store.fields.recovered,
          throttled: store.fields.throttled,
        }}
        id="render-health"
        label="Render health"
      >
        {({ fields, reset }) => (
          <Dashlet.Frame>
            <Dashlet.Header>
              <Dashlet.Heading>Live performance</Dashlet.Heading>
              <Dashlet.Actions>
                <Dashlet.Status tone={fields.recovered.value ? 'success' : 'warning'}>
                  <Dashlet.StatusIndicator tone={fields.recovered.value ? 'success' : 'warning'} />
                  {fields.recovered.value ? 'Recovered' : 'Disconnected'}
                </Dashlet.Status>
              </Dashlet.Actions>
            </Dashlet.Header>
            <Dashlet.Body className="grid grid-cols-2 gap-(--picodash-space-3)">
              <Dashlet.Metric>
                <Dashlet.MetricLabel>Frame rate</Dashlet.MetricLabel>
                <Dashlet.MetricValue>{(fields.fps.value ?? 0).toFixed(1)} FPS</Dashlet.MetricValue>
              </Dashlet.Metric>
              <Dashlet.Metric>
                <Dashlet.MetricLabel>Budget</Dashlet.MetricLabel>
                <Dashlet.MetricValue emphasis="default">
                  {(fields.frameBudget.value ?? 0).toFixed(1)} ms
                </Dashlet.MetricValue>
              </Dashlet.Metric>
            </Dashlet.Body>
            <Dashlet.Footer>
              <Button size="xs" variant="outline" onPress={() => fields.recovered.setInput(true)}>
                Retry connection
              </Button>
              <Button size="xs" variant="ghost" onPress={reset}>
                Reset compound
              </Button>
            </Dashlet.Footer>
          </Dashlet.Frame>
        )}
      </PicodashItem>
      <PicodashSelect
        field={store.fields.quality}
        label="Quality"
        options={['draft', 'balanced', 'final']}
      />
      <PicodashSwitch field={store.fields.throttled} label="Throttle rendering" />
    </PicodashPanel>
  )
}
