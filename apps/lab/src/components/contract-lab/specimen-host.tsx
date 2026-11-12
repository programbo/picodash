'use client'

import { useEffect, useRef, useState } from 'react'
import type { ContractLabPreset } from '@lab/lib/contract-lab'
import { ContractLabSpecimen } from './specimen'
import { ValueBindingLab } from './value-binding-lab'
import { ResizeLab } from './resize-lab'

export type ContractLabPrimaryPanelState = 'expanded' | 'collapsed' | 'unavailable'

export interface ContractLabSpecimenHostProps {
  readonly onDiagnosticCountChange: (count: number) => void
  readonly onPrimaryPanelStateChange: (state: ContractLabPrimaryPanelState) => void
  readonly onReady: () => void
  readonly preset: ContractLabPreset
  readonly revision: number
}

export function ContractLabSpecimenHost({
  onDiagnosticCountChange,
  onPrimaryPanelStateChange,
  onReady,
  preset,
  revision,
}: ContractLabSpecimenHostProps) {
  const boundaryRef = useRef<HTMLElement>(null)
  const [placementScenario, setPlacementScenario] = useState<'placement' | 'resize'>('placement')

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('picodash:contract-lab:placement-scenario') === 'resize')
        setPlacementScenario('resize')
    } catch {
      /* The visible selector still works without session storage. */
    }
  }, [])

  useEffect(() => {
    onPrimaryPanelStateChange(preset.id === 'interaction' ? 'unavailable' : 'expanded')
  }, [onPrimaryPanelStateChange, preset.id, revision])

  useEffect(() => {
    if (preset.id !== 'placement' && preset.id !== 'interaction') onReady()
  }, [onReady, preset.id])

  return (
    <section
      ref={boundaryRef}
      aria-labelledby="contract-lab-specimen-title"
      className="border-border/80 bg-card/90 text-card-foreground relative min-h-[calc(100svh-4rem)] overflow-hidden rounded-xl border shadow-2xl shadow-black/20 data-[preset=composition]:min-h-[70rem] data-[preset=composition]:bg-[#071018]"
      data-contract-lab-specimen
      data-preset={preset.id}
      data-revision={revision}
    >
      <header className="border-border/70 relative z-10 border-b px-4 py-3">
        <p className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.16em] uppercase">
          {preset.id === 'composition' ? 'Style lab' : 'Specimen'}
        </p>
        <h1 id="contract-lab-specimen-title" className="mt-1 text-sm font-semibold">
          {preset.id === 'composition'
            ? 'Ready-made Dashlets'
            : preset.id === 'interaction'
              ? 'Standalone DashList binding'
              : preset.id === 'placement'
                ? 'DashPanel placement'
                : 'Primary Panel and List'}
        </h1>
      </header>
      <p className="text-muted-foreground relative z-10 max-w-2xl p-5 text-sm leading-6 sm:p-7">
        {preset.description}
      </p>
      {preset.id === 'placement' ? (
        <div
          role="group"
          aria-label="Placement scenario"
          className="relative z-10 mx-5 mb-4 flex flex-wrap gap-2"
        >
          {(['placement', 'resize'] as const).map((scenario) => (
            <button
              key={scenario}
              type="button"
              aria-pressed={placementScenario === scenario}
              className="border-border bg-background hover:bg-accent focus-visible:ring-ring aria-pressed:bg-accent min-h-11 rounded-md border px-4 py-2 text-sm font-medium outline-none focus-visible:ring-2"
              onClick={() => {
                setPlacementScenario(scenario)
                try {
                  window.sessionStorage.setItem(
                    'picodash:contract-lab:placement-scenario',
                    scenario,
                  )
                } catch {
                  /* Session selection remains local. */
                }
              }}
            >
              {scenario === 'resize' ? 'Resize lab' : 'Placement'}
            </button>
          ))}
        </div>
      ) : null}
      {preset.id === 'interaction' ? (
        <ValueBindingLab onReady={onReady} onDiagnosticCountChange={onDiagnosticCountChange} />
      ) : preset.id === 'placement' && placementScenario === 'resize' ? (
        <ResizeLab
          onReady={onReady}
          onDiagnosticCountChange={onDiagnosticCountChange}
          onCollapsedChange={(collapsed) =>
            onPrimaryPanelStateChange(collapsed ? 'collapsed' : 'expanded')
          }
        />
      ) : (
        <ContractLabSpecimen
          onReady={onReady}
          boundary={boundaryRef}
          onDiagnosticCountChange={onDiagnosticCountChange}
          onCollapsedChange={(collapsed) =>
            onPrimaryPanelStateChange(collapsed ? 'collapsed' : 'expanded')
          }
          preset={preset}
        />
      )}
    </section>
  )
}
