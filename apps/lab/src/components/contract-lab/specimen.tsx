'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  createPicodashNexus,
  type CoreTransactionResult,
  type DashPanelLayoutRecord,
  type PicodashFieldDefinitions,
  type PicodashDocument,
  type PicodashEnvelopeInput,
  type RootNexus,
} from '@picodash/nexus'
import { createWebStoragePersistenceDriver } from '@picodash/nexus/web-storage'
import { DashGroup, DashList, DashPanel, Dashlet, PicodashProvider } from '@picodash/picodash'
import {
  DashPanelProvider,
  DashPanelLauncher,
  DashPanelTrigger,
  useDashPanel,
} from '@picodash/dashpanel'
import type {
  CompoundDashletRenderContext,
  SingleFieldDashletRenderContext,
} from '@picodash/dashlist'
import { SparklineDashlet, type SparklineSource } from '@picodash/dashlist/charts'
import {
  DashGroup as StandaloneDashGroup,
  DashList as StandaloneDashList,
  Dashlet as StandaloneDashlet,
  useDashListActions,
} from '@picodash/dashlist'
import {
  CheckboxDashlet,
  ColorDashlet,
  DateDashlet,
  MeterDashlet,
  MultiSelectDashlet,
  NumberDashlet,
  ProgressDashlet,
  RangeDashlet,
  SelectDashlet,
  SliderDashlet,
  StatusDashlet,
  TextDashlet,
} from '@picodash/dashlist'
import {
  ActionMenu,
  ActionMenuItem,
  ActionSubmenu,
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
import { useContractLabDiagnosticCount } from './nexus-diagnostics'
import { DashletStyleLab } from './style-lab'

export interface ContractLabSpecimenProps {
  readonly boundary: RefObject<HTMLElement | null>
  readonly onCollapsedChange: (collapsed: boolean) => void
  readonly onDiagnosticCountChange: (count: number) => void
  readonly preset: ContractLabPreset
}

type SpecimenValues = {
  specimenMetric: number
  specimenUnit: string
  galleryText: string
  galleryNumber: number
  galleryEnabled: boolean
  galleryChoice: 'light' | 'dark' | 'system'
  gallerySelected: readonly ('controls' | 'readouts' | 'media')[]
  gallerySlider: number
  galleryRange: { start: number; end: number }
  galleryDate: string
  galleryColor: string
  galleryReadout: number
  galleryStatus: 'ready' | 'running' | 'attention'
}

type SpecimenFieldDefinitions = {
  readonly [Key in keyof SpecimenValues]: { readonly defaultValue: SpecimenValues[Key] }
}

type SpecimenNexus = RootNexus<SpecimenFieldDefinitions, CoreTransactionResult, true, true>

const standalonePanelScopeId = 'contract-lab-standalone-panel'
const standaloneListScopeId = 'contract-lab-standalone-list'

const contractLabPersistenceStorageKey = 'picodash-contract-lab-web-storage-probe-v1'
const contractLabPersistenceScopeId = 'contract-lab-persistence-probe'
const contractLabPersistenceLayout: DashPanelLayoutRecord = {
  placement: { mode: 'floating', disposition: { kind: 'free' } },
  preferredPosition: { x: 16, y: 16 },
}

const migratedSpecimenEnvelope = {
  kind: 'picodash-nexus-envelope',
  formatVersion: 1,
  nexusId: 'contract-lab-specimen',
  schemaVersion: 1,
  revision: 1,
  writerId: 'contract-lab-fixture',
  valueOwner: 'nexus',
  values: { legacyMetric: 24, specimenUnit: 'requests/minute' },
  scopes: [
    [
      'contract-lab-specimen-panel',
      {
        dashPanel: {
          placement: { mode: 'floating', disposition: { kind: 'free' } },
          preferredPosition: { x: 24, y: 24 },
        },
      },
    ],
    ['quarantined-panel', { dashPanel: { invalid: true } }],
  ],
} as unknown as PicodashEnvelopeInput<SpecimenValues>

function createContractLabPersistenceProbeNexus() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    nexusId: 'contract-lab-persistence-probe',
    schemaVersion: 1,
    persistence: {
      storageKey: contractLabPersistenceStorageKey,
      driver: createWebStoragePersistenceDriver('local'),
      values: { defaultFieldPolicy: 'omit' },
    },
    fields: { probeValue: { defaultValue: 0 } },
  })
}

type ContractLabPersistenceProbeNexus = ReturnType<typeof createContractLabPersistenceProbeNexus>

function ContractLabPersistenceProbe() {
  const [nexus, setNexus] = useState<ContractLabPersistenceProbeNexus | null>(null)
  const [persistenceStatus, setPersistenceStatus] = useState('loading')
  const [commandStatus, setCommandStatus] = useState('No metadata write requested.')

  useEffect(() => {
    let nextNexus: ContractLabPersistenceProbeNexus
    try {
      nextNexus = createContractLabPersistenceProbeNexus()
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'PicodashInitializationError' &&
        'code' in error &&
        error.code === 'persistence-driver-unavailable'
      ) {
        setPersistenceStatus('unavailable')
        setCommandStatus('Web Storage is unavailable.')
        setNexus(null)
        return
      }
      throw error
    }
    setNexus(nextNexus)
    const updateStatus = () => setPersistenceStatus(nextNexus.persistence.getState().status)
    updateStatus()
    const unsubscribe = nextNexus.persistence.subscribe(updateStatus)
    return () => {
      unsubscribe()
      nextNexus.destroy({ discardUnpersisted: true })
    }
  }, [])

  return (
    <section
      aria-label="Web Storage persistence probe"
      className="grid gap-2 p-4"
      data-contract-lab-persistence-probe
    >
      <h2>Web Storage persistence probe</h2>
      <output aria-live="polite" data-contract-lab-persistence-status>
        Persistence status: {persistenceStatus}
      </output>
      <output data-contract-lab-persistence-command>{commandStatus}</output>
      <button
        type="button"
        disabled={nexus === null}
        onClick={() => {
          if (nexus === null) return
          const result = nexus.setDashPanelLayout(
            contractLabPersistenceScopeId,
            contractLabPersistenceLayout,
          )
          setCommandStatus(result.ok ? 'Metadata write accepted.' : 'Metadata write rejected.')
        }}
      >
        Write metadata probe
      </button>
    </section>
  )
}

function StandalonePanelActions() {
  const panel = useDashPanel()
  const moveToFree = () => {
    panel.setPlacement({ mode: 'floating', disposition: { kind: 'free' } })
  }
  const resetLayout = () => {
    panel.resetLayout()
  }
  return (
    <div className="grid gap-2 p-4" data-contract-lab-standalone-panel-content>
      <p>Standalone Panel content is arbitrary React UI, independent of DashList.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={moveToFree} data-contract-lab-standalone-panel-move>
          Move panel
        </button>
        <button type="button" onClick={resetLayout} data-contract-lab-standalone-panel-reset>
          Reset panel layout
        </button>
      </div>
      <output data-contract-lab-standalone-panel-placement>
        {panel.availability === 'available'
          ? `${panel.placement.mode}-${panel.placement.disposition.kind}`
          : 'unavailable'}
      </output>
    </div>
  )
}

function StandaloneListActions() {
  const actions = useDashListActions(standaloneListScopeId)
  return (
    <button
      type="button"
      disabled={actions.resetList.availability !== 'enabled'}
      onClick={() => void actions.resetList.execute()}
      data-contract-lab-standalone-list-reset
    >
      Reset list
    </button>
  )
}

const gallerySparklineSource: SparklineSource = (emit) => {
  for (const value of [38, 44, 41, 56, 62, 58, 67, 64]) emit(value)
}

function DashletGallery({ nexus }: { readonly nexus: SpecimenNexus }) {
  const compoundFields = {
    number: { field: nexus.fields.galleryNumber },
    enabled: { field: nexus.fields.galleryEnabled },
  } as const

  return (
    <>
      <div className="border-border/70 mt-4 border-y px-4 py-3" data-contract-lab-dashlet-gallery>
        <h2 className="text-sm font-semibold">Dashlet gallery</h2>
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          Ready-made Dashlets bind typed Nexus fields. Deferred specialists are labeled where no
          accepted package contract exists yet.
        </p>
      </div>
      <DashList
        id="contract-lab-gallery-list"
        aria-label="Dashlet gallery"
        data-contract-lab-dashlet-gallery-list
      >
        <DashGroup
          id="gallery-common-inputs"
          label="Common inputs"
          data-contract-lab-gallery-group="common-inputs"
        >
          <TextDashlet id="gallery-text" field={nexus.fields.galleryText} label="Text" />
          <NumberDashlet
            id="gallery-number"
            field={nexus.fields.galleryNumber}
            label="Number"
            min={0}
            max={100}
          />
          <CheckboxDashlet
            id="gallery-enabled"
            field={nexus.fields.galleryEnabled}
            label="Enabled"
          />
          <SelectDashlet<string>
            id="gallery-choice"
            field={nexus.fields.galleryChoice}
            label="Choice"
            options={['light', 'dark', 'system']}
          />
          <DateDashlet id="gallery-date" field={nexus.fields.galleryDate} label="Date" />
          <ColorDashlet id="gallery-color" field={nexus.fields.galleryColor} label="Color" />
          <MultiSelectDashlet<string>
            id="gallery-selected"
            field={nexus.fields.gallerySelected}
            label="Selected features"
            options={['controls', 'readouts', 'media']}
          />
        </DashGroup>

        <DashGroup
          id="gallery-direct-manipulation"
          label="Direct manipulation"
          data-contract-lab-gallery-group="direct-manipulation"
        >
          <SliderDashlet
            id="gallery-slider"
            field={nexus.fields.gallerySlider}
            label="Slider"
            min={0}
            max={100}
            step={1}
          />
          <RangeDashlet
            id="gallery-range"
            field={nexus.fields.galleryRange}
            label="Range"
            min={0}
            max={100}
          />
        </DashGroup>

        <DashGroup
          id="gallery-media-files"
          label="Media and files"
          data-contract-lab-gallery-group="media-files"
        >
          <Dashlet id="gallery-media-deferred" label="Media and files (deferred)">
            <div className="grid gap-1 text-xs" data-contract-lab-gallery-deferred="media">
              <p>
                File and media input Dashlets are deferred until a host transport contract is
                accepted.
              </p>
              <output>No file selected.</output>
            </div>
          </Dashlet>
        </DashGroup>

        <DashGroup id="gallery-charts" label="Charts" data-contract-lab-gallery-group="charts">
          <SparklineDashlet
            id="gallery-sparkline"
            label="Request trend"
            description="Experimental local history; samples are not persisted in Nexus."
            source={gallerySparklineSource}
            maxSamples={24}
            data-contract-lab-gallery-chart="sparkline"
          />
        </DashGroup>

        <DashGroup
          id="gallery-readouts"
          label="Readouts"
          data-contract-lab-gallery-group="readouts"
        >
          <MeterDashlet
            id="gallery-meter"
            field={nexus.fields.galleryReadout}
            label="Meter"
            min={0}
            max={100}
          />
          <ProgressDashlet
            id="gallery-progress"
            field={nexus.fields.galleryReadout}
            label="Progress"
            min={0}
            max={100}
          />
          <StatusDashlet
            id="gallery-status"
            field={nexus.fields.galleryStatus}
            label="Status"
            options={[
              { value: 'ready', label: 'Ready', tone: 'success' },
              { value: 'running', label: 'Running', tone: 'info' },
              { value: 'attention', label: 'Attention', tone: 'warning' },
            ]}
          />
        </DashGroup>

        <DashGroup
          id="gallery-compound-recipes"
          label="Compound recipes"
          data-contract-lab-gallery-group="compound-recipes"
        >
          <Dashlet id="gallery-compound-recipe" label="Number and enabled" fields={compoundFields}>
            {({
              bindings,
            }: CompoundDashletRenderContext<SpecimenValues, typeof compoundFields>) => (
              <div className="flex flex-wrap items-center gap-2" data-contract-lab-gallery-compound>
                <output>{bindings.number.value}</output>
                <span aria-hidden="true">·</span>
                <output>{bindings.enabled.value ? 'Enabled' : 'Disabled'}</output>
                <button type="button" onClick={() => bindings.number.resetValue()}>
                  Reset number
                </button>
              </div>
            )}
          </Dashlet>
        </DashGroup>
      </DashList>
    </>
  )
}

function StandalonePhase2Evidence({
  boundary,
  preset,
  nexus,
}: {
  readonly boundary: RefObject<HTMLElement | null>
  readonly preset: ContractLabPreset
  readonly nexus: RootNexus<PicodashFieldDefinitions>
}) {
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null)
  if (preset.id === 'placement')
    return (
      <>
        <div
          ref={setPortalTarget}
          data-contract-lab-standalone-portal-target
          className="pointer-events-none absolute inset-0 z-10"
        />
        <DashPanelProvider
          nexus={nexus}
          providerId="contract-lab-standalone-panel-provider"
          boundary={boundary}
          portalContainer={portalTarget}
          theme="dark"
        >
          <DashPanel
            id={standalonePanelScopeId}
            title="Standalone Panel"
            className="pointer-events-auto"
            defaultLayout={{
              placement: {
                mode: 'floating',
                disposition: { kind: 'snapped', position: 'top-left' },
              },
              preferredPosition: { x: 24, y: 24 },
            }}
            data-contract-lab-standalone-panel
          >
            <StandalonePanelActions />
          </DashPanel>
        </DashPanelProvider>
      </>
    )

  if (preset.id === 'composition')
    return (
      <section
        aria-label="Standalone List evidence"
        data-contract-lab-standalone-list-region
        className="border-border/70 bg-card/60 mt-4 rounded-xl border"
      >
        <StandaloneDashList
          id={standaloneListScopeId}
          nexus={nexus}
          aria-label="Standalone List"
          reorderable
        >
          <StandaloneDashGroup
            id="standalone-group"
            label="Standalone group"
            collapsible
            data-contract-lab-standalone-group
          >
            <StandaloneDashlet id="standalone-first" label="First item">
              <span>First item</span>
            </StandaloneDashlet>
            <StandaloneDashlet id="standalone-second" label="Second item">
              <span>Second item</span>
            </StandaloneDashlet>
          </StandaloneDashGroup>
          <StandaloneDashlet id="standalone-actions" label="Standalone List actions">
            <StandaloneListActions />
          </StandaloneDashlet>
        </StandaloneDashList>
      </section>
    )

  return null
}

export function ContractLabSpecimen({
  boundary,
  onCollapsedChange,
  onDiagnosticCountChange,
  preset,
}: ContractLabSpecimenProps) {
  const styleLabBoundary = useRef<HTMLElement>(null)
  const [quarantineResolved, setQuarantineResolved] = useState(false)
  const [capturedDocument, setCapturedDocument] = useState<PicodashDocument | null>(null)
  const [documentStatus, setDocumentStatus] = useState('No document captured.')
  const nexus = useMemo(
    () =>
      createPicodashNexus({
        valueOwner: 'nexus',
        nexusId: 'contract-lab-specimen',
        schemaVersion: 2,
        initialEnvelope: migratedSpecimenEnvelope,
        migrations: {
          1: (payload) => {
            const { legacyMetric, ...values } = payload.values
            return {
              schemaVersion: 2,
              values: { ...values, specimenMetric: legacyMetric ?? 24 },
              scopes: payload.scopes,
            }
          },
        },
        export: {
          documents: { defaultFieldPolicy: 'include' },
        },
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
          galleryText: { defaultValue: 'Requests per minute' },
          galleryNumber: { defaultValue: 42 },
          galleryEnabled: { defaultValue: true },
          galleryChoice: { defaultValue: 'system' },
          gallerySelected: { defaultValue: ['controls', 'readouts'] },
          gallerySlider: { defaultValue: 64 },
          galleryRange: { defaultValue: { start: 20, end: 80 } },
          galleryDate: { defaultValue: '2026-08-13' },
          galleryColor: { defaultValue: '#2dd4bf' },
          galleryReadout: { defaultValue: 68 },
          galleryStatus: { defaultValue: 'ready' },
        },
      }),
    [],
  )
  const metricFields = useMemo(
    () =>
      ({
        metric: nexus.fields.specimenMetric,
        unit: { field: nexus.fields.specimenUnit, mode: 'display' as const },
      }) as const,
    [nexus],
  )
  const diagnosticNexuss = useMemo(() => [nexus], [nexus])
  const diagnosticCount = useContractLabDiagnosticCount(diagnosticNexuss)

  useEffect(() => {
    onDiagnosticCountChange(diagnosticCount)
    return () => onDiagnosticCountChange(0)
  }, [diagnosticCount, onDiagnosticCountChange])

  return (
    <>
      <PicodashProvider
        nexus={nexus}
        boundary={boundary}
        theme="dark"
        density={preset.id === 'themes' ? 'compact' : 'regular'}
      >
        <ContractLabDevBridgeConnector nexus={nexus} />
        <ContractLabPersistenceProbe />
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
          id="quarantined-panel"
          title="Quarantined Panel"
          defaultVisible
          collapsible
          showCloseButton={false}
        >
          <div className="grid gap-2 p-4" data-contract-lab-quarantine>
            <p data-contract-lab-migration>
              The v1 envelope migrated <code>legacyMetric</code> to the disclosed metric field.
            </p>
            <p data-contract-lab-quarantine-default>
              Quarantined Panel metadata uses current defaults until you replace it.
            </p>
            <output data-contract-lab-quarantine-state>
              {quarantineResolved ? 'Quarantined metadata replaced.' : 'Metadata quarantined.'}
            </output>
            <button
              type="button"
              disabled={quarantineResolved}
              onClick={() => {
                const result = nexus.metadataRecovery.replaceScope('quarantined-panel', null)
                if (result.ok) setQuarantineResolved(true)
              }}
            >
              Replace quarantined metadata
            </button>
          </div>
        </DashPanel>
        <DashPanel
          id="contract-lab-specimen-panel"
          title="Primary Panel"
          collapsible
          onCollapsedChange={onCollapsedChange}
        >
          <div className="flex flex-wrap items-center gap-2 p-4" data-contract-lab-documents>
            <button
              type="button"
              onClick={() => {
                const plan = nexus.documents.createExportPlan({
                  includeDescendants: false,
                  fields: [nexus.fields.specimenMetric, nexus.fields.specimenUnit],
                })
                const result = nexus.documents.executeExport(plan)
                if (result.ok) {
                  setCapturedDocument(result.document)
                  setDocumentStatus('Document captured for local restore.')
                }
              }}
            >
              Capture document
            </button>
            <button
              type="button"
              disabled={capturedDocument === null}
              onClick={() => {
                if (capturedDocument === null) return
                const analysis = nexus.documents.analyzeImport(capturedDocument)
                if (!analysis.ok) {
                  setDocumentStatus('Document restore analysis failed.')
                  return
                }
                const result = nexus.documents.executeImport(analysis.plan)
                setDocumentStatus(
                  result.ok ? 'Captured document restored.' : 'Document restore failed.',
                )
              }}
            >
              Restore captured document
            </button>
            <output data-contract-lab-document-status>{documentStatus}</output>
          </div>
          {preset.id === 'composition' ? <DashletGallery nexus={nexus} /> : null}
          <DashList aria-label="Primary Panel List">
            <Dashlet
              id="specimen-summary"
              label="Specimen summary"
              layout="full"
              field={nexus.fields.specimenMetric}
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
                      value={
                        typeof bindings.metric.draftValue === 'string' ||
                        typeof bindings.metric.draftValue === 'number'
                          ? bindings.metric.draftValue
                          : bindings.metric.value
                      }
                      data-contract-lab-bound-input
                      data-stale={bindings.metric.stale ? 'true' : 'false'}
                      onChange={(event) => bindings.metric.setInput(event.currentTarget.value)}
                    />
                    <output data-contract-lab-bound-unit>{bindings.unit.value}</output>
                    <button type="button" onClick={() => bindings.metric.resetValue()}>
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
                <ActionMenu label="Open shared ActionMenu">
                  <ActionMenuItem label="Inspect shared action" onAction={() => undefined} />
                  <ActionSubmenu label="More shared actions">
                    <ActionMenuItem label="Nested shared action" onAction={() => undefined} />
                  </ActionSubmenu>
                </ActionMenu>
              </Dashlet>
            </DashGroup>
          </DashList>
        </DashPanel>
      </PicodashProvider>
      {preset.id === 'composition' ? (
        <section
          aria-label="Dashlet style lab"
          className="relative min-h-[70rem] overflow-hidden border-t border-white/10 bg-[#071018]"
          data-contract-lab-style-lab
          ref={styleLabBoundary}
        >
          <div className="px-4 pt-4 sm:px-7">
            <p className="font-mono text-[0.625rem] tracking-[0.16em] text-cyan-200/70 uppercase">
              Neutral ready-made controls
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
              Twenty-two stable Dashlets are grouped across two movable hybrid Panels.
            </p>
          </div>
          <DashletStyleLab boundary={styleLabBoundary} />
        </section>
      ) : null}
      <StandalonePhase2Evidence boundary={boundary} preset={preset} nexus={nexus} />
    </>
  )
}
