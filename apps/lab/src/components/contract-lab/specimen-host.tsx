'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PicodashPanelLauncher, PicodashProvider, usePicodashPanel } from '@picodash/panel'
import type { ContractLabPreset } from '@lab/lib/contract-lab'
import { createContractLabSpecimenBundle } from './specimens'
import { useContractLabDiagnosticCount } from './store-diagnostics'

export interface ContractLabSpecimenHostProps {
  readonly preset: ContractLabPreset
  readonly revision: number
  readonly onDiagnosticCountChange: (count: number) => void
  readonly onPrimaryVisibilityChange: (visible: boolean) => void
}

export function ContractLabSpecimenHost({
  onDiagnosticCountChange,
  onPrimaryVisibilityChange,
  preset,
  revision,
}: ContractLabSpecimenHostProps) {
  const boundaryRef = useRef<HTMLElement>(null)
  const [launcherMount, setLauncherMount] = useState<HTMLDivElement | null>(null)
  const [remountRevision, setRemountRevision] = useState(0)
  const [primaryDeregistered, setPrimaryDeregistered] = useState(false)
  const bundle = useMemo(
    () => createContractLabSpecimenBundle(preset.id),
    [preset.id, remountRevision, revision],
  )
  const stores = useMemo(
    () => [bundle.primaryStore, ...(bundle.peerStore ? [bundle.peerStore] : [])],
    [bundle],
  )
  const diagnosticCount = useContractLabDiagnosticCount(stores)

  useEffect(() => {
    onDiagnosticCountChange(diagnosticCount)
  }, [diagnosticCount, onDiagnosticCountChange])

  return (
    <section
      ref={boundaryRef}
      aria-labelledby="contract-lab-specimen-title"
      className="border-border/80 bg-card/90 text-card-foreground relative min-h-[46rem] overflow-hidden rounded-xl border shadow-2xl shadow-black/20"
      data-contract-lab-specimen
      data-preset={preset.id}
      data-revision={revision}
    >
      <header className="border-border/70 flex items-start justify-between gap-4 border-b px-4 py-3">
        <div>
          <p className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.16em] uppercase">
            Specimen provider
          </p>
          <h1 id="contract-lab-specimen-title" className="mt-1 text-sm font-semibold">
            Primary Specimen Panel
          </h1>
        </div>
        <div
          ref={setLauncherMount}
          className="flex flex-wrap justify-end gap-2"
          data-contract-lab-host-actions
        >
          {primaryDeregistered ? (
            <button
              className="border-border bg-background hover:bg-accent focus-visible:ring-ring min-h-10 rounded-md border px-3 text-xs font-medium outline-none focus-visible:ring-2"
              type="button"
              onClick={() => {
                setPrimaryDeregistered(false)
                setRemountRevision((current) => current + 1)
              }}
            >
              Remount primary panel
            </button>
          ) : null}
        </div>
      </header>
      <div className="text-muted-foreground max-w-lg p-5 text-sm leading-6 sm:p-7">
        {preset.description}
      </div>
      <PicodashProvider
        key={`${preset.id}:${revision}:${remountRevision}`}
        panelBoundary={boundaryRef}
        persistLayout={preset.id === 'placement'}
        storageKey={`picodash:contract-lab:${preset.id}`}
        theme="dark"
      >
        {launcherMount
          ? createPortal(
              <div data-contract-lab-launcher>
                <PicodashPanelLauncher
                  items={[
                    { label: 'Primary panel', store: bundle.primaryStore },
                    ...(bundle.peerStore
                      ? [{ label: 'Isolation peer', store: bundle.peerStore }]
                      : []),
                  ]}
                  label="Specimen panels"
                />
              </div>,
              launcherMount,
            )
          : null}
        <PrimaryVisibilityBridge
          panelId={bundle.primaryStore.getState().panelId}
          onVisibilityChange={onPrimaryVisibilityChange}
        />
        {bundle.render({
          onDeregister: () => setPrimaryDeregistered(true),
        })}
      </PicodashProvider>
    </section>
  )
}

function PrimaryVisibilityBridge({
  onVisibilityChange,
  panelId,
}: {
  readonly onVisibilityChange: (visible: boolean) => void
  readonly panelId: string
}) {
  const panel = usePicodashPanel(panelId)

  useEffect(() => {
    onVisibilityChange(panel?.visible ?? false)
  }, [onVisibilityChange, panel?.visible])

  return <span hidden data-contract-lab-primary-visible={panel?.visible ? 'true' : 'false'} />
}
