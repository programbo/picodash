'use client'

import { useEffect, useMemo, useState, type RefObject } from 'react'
import {
  createPicodashStore,
  type DashPanelLayoutRecord,
  type PicodashDocument,
  type PicodashEnvelopeInput,
} from '@picodash/store'
import { createWebStoragePersistenceDriver } from '@picodash/store/web-storage'
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
import { useContractLabDiagnosticCount } from './store-diagnostics'

export interface ContractLabSpecimenProps {
  readonly boundary: RefObject<HTMLElement | null>
  readonly onCollapsedChange: (collapsed: boolean) => void
  readonly onDiagnosticCountChange: (count: number) => void
  readonly preset: ContractLabPreset
}

type SpecimenValues = { specimenMetric: number; specimenUnit: string }

const contractLabPersistenceStorageKey = 'picodash-contract-lab-web-storage-probe-v1'
const contractLabPersistenceScopeId = 'contract-lab-persistence-probe'
const contractLabPersistenceLayout: DashPanelLayoutRecord = {
  placement: { mode: 'floating', disposition: { kind: 'free' } },
  preferredPosition: { x: 16, y: 16 },
}

const migratedSpecimenEnvelope = {
  kind: 'picodash-store-envelope',
  formatVersion: 1,
  storeId: 'contract-lab-specimen',
  schemaVersion: 1,
  revision: 1,
  writerId: 'contract-lab-fixture',
  valueOwner: 'store',
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

function createContractLabPersistenceProbeStore() {
  return createPicodashStore({
    valueOwner: 'store',
    storeId: 'contract-lab-persistence-probe',
    schemaVersion: 1,
    persistence: {
      storageKey: contractLabPersistenceStorageKey,
      driver: createWebStoragePersistenceDriver('local'),
      values: { defaultFieldPolicy: 'omit' },
    },
    fields: { probeValue: { defaultValue: 0 } },
  })
}

type ContractLabPersistenceProbeStore = ReturnType<typeof createContractLabPersistenceProbeStore>

function ContractLabPersistenceProbe() {
  const [store, setStore] = useState<ContractLabPersistenceProbeStore | null>(null)
  const [persistenceStatus, setPersistenceStatus] = useState('loading')
  const [commandStatus, setCommandStatus] = useState('No metadata write requested.')

  useEffect(() => {
    let nextStore: ContractLabPersistenceProbeStore
    try {
      nextStore = createContractLabPersistenceProbeStore()
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'PicodashInitializationError' &&
        'code' in error &&
        error.code === 'persistence-driver-unavailable'
      ) {
        setPersistenceStatus('unavailable')
        setCommandStatus('Web Storage is unavailable.')
        setStore(null)
        return
      }
      throw error
    }
    setStore(nextStore)
    const updateStatus = () => setPersistenceStatus(nextStore.persistence.getState().status)
    updateStatus()
    const unsubscribe = nextStore.persistence.subscribe(updateStatus)
    return () => {
      unsubscribe()
      nextStore.destroy({ discardUnpersisted: true })
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
        disabled={store === null}
        onClick={() => {
          if (store === null) return
          const result = store.setDashPanelLayout(
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

export function ContractLabSpecimen({
  boundary,
  onCollapsedChange,
  onDiagnosticCountChange,
  preset,
}: ContractLabSpecimenProps) {
  const [quarantineResolved, setQuarantineResolved] = useState(false)
  const [capturedDocument, setCapturedDocument] = useState<PicodashDocument | null>(null)
  const [documentStatus, setDocumentStatus] = useState('No document captured.')
  const store = useMemo(
    () =>
      createPicodashStore({
        valueOwner: 'store',
        storeId: 'contract-lab-specimen',
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
  const diagnosticStores = useMemo(() => [store], [store])
  const diagnosticCount = useContractLabDiagnosticCount(diagnosticStores)

  useEffect(() => {
    onDiagnosticCountChange(diagnosticCount)
    return () => onDiagnosticCountChange(0)
  }, [diagnosticCount, onDiagnosticCountChange])

  return (
    <PicodashProvider
      store={store}
      boundary={boundary}
      theme="dark"
      density={preset.id === 'themes' ? 'compact' : 'regular'}
    >
      <ContractLabDevBridgeConnector store={store} />
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
              const result = store.metadataRecovery.replaceScope('quarantined-panel', null)
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
              const plan = store.documents.createExportPlan({
                includeDescendants: false,
                fields: [store.fields.specimenMetric, store.fields.specimenUnit],
              })
              const result = store.documents.executeExport(plan)
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
              const analysis = store.documents.analyzeImport(capturedDocument)
              if (!analysis.ok) {
                setDocumentStatus('Document restore analysis failed.')
                return
              }
              const result = store.documents.executeImport(analysis.plan)
              setDocumentStatus(
                result.ok ? 'Captured document restored.' : 'Document restore failed.',
              )
            }}
          >
            Restore captured document
          </button>
          <output data-contract-lab-document-status>{documentStatus}</output>
        </div>
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
