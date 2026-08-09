'use client'

import { useMemo, type RefObject } from 'react'
import { createPicodashStore } from '@picodash/store'
import { DashGroup, DashList, DashPanel, Dashlet, PicodashProvider } from '@picodash/picodash'
import { DashPanelLauncher, DashPanelTrigger } from '@picodash/dashpanel'
import type {
  CompoundDashletRenderContext,
  SingleFieldDashletRenderContext,
} from '@picodash/dashlist'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@picodash/picodash/ui'
import type { ContractLabPreset } from '@lab/lib/contract-lab'
import { ContractLabDevBridgeConnector } from './dev-bridge-connector'

export interface ContractLabSpecimenProps {
  readonly boundary: RefObject<HTMLElement | null>
  readonly onCollapsedChange: (collapsed: boolean) => void
  readonly preset: ContractLabPreset
}

type SpecimenValues = { specimenMetric: number; specimenUnit: string }

export function ContractLabSpecimen({
  boundary,
  onCollapsedChange,
  preset,
}: ContractLabSpecimenProps) {
  const store = useMemo(
    () =>
      createPicodashStore({
        valueOwner: 'store',
        fields: {
          specimenMetric: {
            defaultValue: 24,
            parse: (input: unknown) => {
              const candidate =
                typeof input === 'number'
                  ? input
                  : typeof input === 'string' && input.trim() !== ''
                    ? Number(input)
                    : Number.NaN
              return Number.isFinite(candidate)
                ? { ok: true as const, candidate }
                : {
                    ok: false as const,
                    issues: [{ message: 'Metric must be a finite number.' }],
                  }
            },
          },
          specimenUnit: { defaultValue: 'requests/minute' },
        },
      }),
    [],
  )
  const metricFields = useMemo(
    () =>
      ({
        metric: store.fields.specimenMetric,
        unit: { field: store.fields.specimenUnit, mode: 'display' as const },
      }) as const,
    [store],
  )

  return (
    <PicodashProvider store={store} boundary={boundary} theme="dark">
      <ContractLabDevBridgeConnector store={store} />
      <div className="flex flex-wrap items-center gap-2" data-contract-lab-panel-controls>
        <DashPanelTrigger panelId="contract-lab-specimen-panel">
          Show primary panel
        </DashPanelTrigger>
        <DashPanelLauncher
          label="Contract Lab panels"
          items={[
            { panelId: 'contract-lab-specimen-panel', label: 'Open primary panel' },
            { panelId: 'unmounted-panel', label: 'Unavailable panel' },
          ]}
        />
      </div>
      <DashPanel
        id="contract-lab-specimen-panel"
        title="Primary Panel"
        collapsible
        onCollapsedChange={onCollapsedChange}
      >
        <DashList aria-label="Primary Panel List">
          <Dashlet
            id="specimen-summary"
            label="Specimen summary"
            layout="full"
            field={store.fields.specimenMetric}
            mode="display"
          >
            {({ binding }: SingleFieldDashletRenderContext<number, 'display'>) => (
              <p className="text-muted-foreground text-sm leading-6">
                The current preset is <strong className="text-foreground">{preset.label}</strong>.
                The disclosed metric is{' '}
                <strong className="text-foreground" data-contract-lab-bound-display>
                  {binding.value}
                </strong>
                .
              </p>
            )}
          </Dashlet>
          <DashGroup id="specimen-group" label="Static DashGroup">
            <Dashlet id="specimen-metric" label="Editable metric" fields={metricFields}>
              {({
                bindings,
              }: CompoundDashletRenderContext<SpecimenValues, typeof metricFields>) => (
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={bindings.metric.controlId}>Metric value</label>
                  <input
                    id={bindings.metric.controlId}
                    className="border-input bg-background rounded border px-2 py-1"
                    aria-invalid={bindings.metric.invalid || undefined}
                    aria-errormessage={bindings.metric.issuesId}
                    value={String(bindings.metric.draftValue ?? bindings.metric.value)}
                    data-contract-lab-bound-input
                    data-stale={bindings.metric.stale ? 'true' : 'false'}
                    onChange={(event) => bindings.metric.setInput(event.currentTarget.value)}
                  />
                  <output data-contract-lab-bound-unit>{bindings.unit.value}</output>
                  {bindings.metric.dirty ? (
                    <button type="button" onClick={bindings.metric.discardInput}>
                      Discard changes
                    </button>
                  ) : null}
                  <button type="button" onClick={bindings.metric.resetValue}>
                    Reset value
                  </button>
                </div>
              )}
            </Dashlet>
            <Dashlet id="specimen-alert" label="Shared AlertDialog">
              <AlertDialog>
                <AlertDialogTrigger aria-label="Open shared AlertDialog">
                  Open shared AlertDialog
                </AlertDialogTrigger>
                <AlertDialogOverlay>
                  <AlertDialogContent aria-label="Contract Lab confirmation">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Shared AlertDialog</AlertDialogTitle>
                      <AlertDialogDescription>
                        This is the shared UI confirmation primitive.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialogOverlay>
              </AlertDialog>
            </Dashlet>
          </DashGroup>
        </DashList>
      </DashPanel>
    </PicodashProvider>
  )
}
