'use client'

import { useEffect, useRef } from 'react'
import { Check, RotateCcw, ShieldAlert } from 'lucide-react'
import { PicodashItem, PicodashPanel } from '@picodash/panel'
import * as Dashlet from '@picodash/panel/dashlet'
import { Button, ProgressBar, ProgressFill, ProgressTrack } from '@picodash/panel/ui'
import { usePicodashStoreSelector } from '@picodash/store/react'

import { deploymentStatusStore } from './example-stores'
import { RecipeShell } from './recipe-shell'

export function DeploymentStatusRecipe() {
  const boundaryRef = useRef<HTMLDivElement>(null)
  const status = usePicodashStoreSelector(deploymentStatusStore, (state) => state.values.status)

  useEffect(() => {
    if (status !== 'recovering') return

    const recovery = window.setTimeout(() => {
      deploymentStatusStore.getState().setFieldValues({
        completedSteps: 5,
        failedStep: '',
        status: 'ready',
      })
    }, 1800)

    return () => window.clearTimeout(recovery)
  }, [status])

  return (
    <RecipeShell
      boundaryRef={boundaryRef}
      description="Structured deployment facts, determinate progress, a concrete failure state, and a recovery action with live status."
      eyebrow="Recover"
      store={deploymentStatusStore}
      title="Deployment status"
    >
      <PicodashPanel
        boundary={boundaryRef}
        close
        collapsible
        defaultPlacement={{
          disposition: { kind: 'snapped', position: 'top-right' },
          mode: 'floating',
        }}
        store={deploymentStatusStore}
        title="Deployment status"
        width={350}
      >
        <PicodashItem
          contentLayout="full"
          fields={{
            completedSteps: deploymentStatusStore.fields.completedSteps,
            failedStep: deploymentStatusStore.fields.failedStep,
            region: { field: deploymentStatusStore.fields.region, mode: 'display' },
            status: deploymentStatusStore.fields.status,
            totalSteps: { field: deploymentStatusStore.fields.totalSteps, mode: 'display' },
          }}
          id="deployment-status"
          label="Deployment status"
        >
          {({ fields, reset }) => {
            const completedSteps = fields.completedSteps.value ?? 0
            const failedStep = fields.failedStep.value ?? 'Health check'
            const region = fields.region.value ?? 'syd1'
            const statusValue = fields.status.value ?? 'failed'
            const totalSteps = fields.totalSteps.value ?? 5
            const tone =
              statusValue === 'ready'
                ? 'success'
                : statusValue === 'recovering'
                  ? 'warning'
                  : 'danger'

            return (
              <Dashlet.Frame>
                <Dashlet.Header>
                  <Dashlet.Heading>Production deploy</Dashlet.Heading>
                  <Dashlet.Description>Release 2026.07.30-2</Dashlet.Description>
                  <Dashlet.Actions>
                    <Dashlet.Status tone={tone}>
                      <Dashlet.StatusIndicator tone={tone} />
                      {deploymentLabel(statusValue)}
                    </Dashlet.Status>
                  </Dashlet.Actions>
                </Dashlet.Header>

                <Dashlet.Body className="grid gap-(--picodash-space-3)">
                  <Dashlet.DataList density="compact">
                    <Dashlet.DataRow>
                      <Dashlet.DataLabel>Region</Dashlet.DataLabel>
                      <Dashlet.DataValue>{region}</Dashlet.DataValue>
                    </Dashlet.DataRow>
                    <Dashlet.DataRow>
                      <Dashlet.DataLabel>Artifact</Dashlet.DataLabel>
                      <Dashlet.DataValue>web-9f31c2a</Dashlet.DataValue>
                    </Dashlet.DataRow>
                    <Dashlet.DataRow>
                      <Dashlet.DataLabel>Steps</Dashlet.DataLabel>
                      <Dashlet.DataValue>
                        {completedSteps} / {totalSteps}
                      </Dashlet.DataValue>
                    </Dashlet.DataRow>
                  </Dashlet.DataList>

                  <ProgressBar
                    aria-label="Deployment progress"
                    isIndeterminate={statusValue === 'recovering'}
                    maxValue={totalSteps}
                    value={completedSteps}
                  >
                    <ProgressTrack>
                      <ProgressFill />
                    </ProgressTrack>
                  </ProgressBar>

                  {statusValue === 'failed' ? (
                    <Dashlet.ErrorState>
                      <ShieldAlert aria-hidden="true" />
                      <strong>{failedStep} failed</strong>
                      <span>New instances did not become healthy before the timeout.</span>
                    </Dashlet.ErrorState>
                  ) : statusValue === 'recovering' ? (
                    <Dashlet.LoadingState>Repeating the failed health check…</Dashlet.LoadingState>
                  ) : (
                    <Dashlet.EmptyState
                      icon={<Check aria-hidden="true" />}
                      title="Deployment ready"
                      description="All production checks completed."
                    />
                  )}
                </Dashlet.Body>

                <Dashlet.Footer>
                  {statusValue === 'failed' ? (
                    <Button
                      size="xs"
                      onPress={() => {
                        fields.status.setInput('recovering')
                        fields.completedSteps.setInput(4)
                      }}
                    >
                      Retry health check
                    </Button>
                  ) : null}
                  <Button size="xs" variant="ghost" onPress={reset}>
                    <RotateCcw aria-hidden="true" />
                    Reset example
                  </Button>
                </Dashlet.Footer>
              </Dashlet.Frame>
            )
          }}
        </PicodashItem>
      </PicodashPanel>
    </RecipeShell>
  )
}

function deploymentLabel(status: 'failed' | 'recovering' | 'ready') {
  if (status === 'ready') return 'Ready'
  if (status === 'recovering') return 'Recovering'
  return 'Failed'
}
