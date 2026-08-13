'use client'

import { useEffect, useRef } from 'react'
import type { ContractLabPreset } from '@lab/lib/contract-lab'
import { ContractLabSpecimen } from './specimen'

export type ContractLabPrimaryPanelState = 'expanded' | 'collapsed' | 'unavailable'

export interface ContractLabSpecimenHostProps {
  readonly onDiagnosticCountChange: (count: number) => void
  readonly onPrimaryPanelStateChange: (state: ContractLabPrimaryPanelState) => void
  readonly preset: ContractLabPreset
  readonly revision: number
}

export function ContractLabSpecimenHost({
  onDiagnosticCountChange,
  onPrimaryPanelStateChange,
  preset,
  revision,
}: ContractLabSpecimenHostProps) {
  const boundaryRef = useRef<HTMLElement>(null)

  useEffect(() => {
    onPrimaryPanelStateChange('expanded')
  }, [onPrimaryPanelStateChange, preset.id, revision])

  return (
    <section
      ref={boundaryRef}
      aria-labelledby="contract-lab-specimen-title"
      className="border-border/80 bg-card/90 text-card-foreground relative min-h-[32rem] overflow-hidden rounded-xl border shadow-2xl shadow-black/20 data-[preset=composition]:min-h-[70rem] data-[preset=composition]:bg-[#071018]"
      data-contract-lab-specimen
      data-preset={preset.id}
      data-revision={revision}
    >
      <header className="border-border/70 relative z-10 border-b px-4 py-3">
        <p className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.16em] uppercase">
          {preset.id === 'composition' ? 'Style lab' : 'Specimen'}
        </p>
        <h1 id="contract-lab-specimen-title" className="mt-1 text-sm font-semibold">
          {preset.id === 'composition' ? 'Ready-made Dashlets' : 'Primary Panel and List'}
        </h1>
      </header>
      <p className="text-muted-foreground relative z-10 max-w-2xl p-5 text-sm leading-6 sm:p-7">
        {preset.description}
      </p>
      <ContractLabSpecimen
        boundary={boundaryRef}
        onDiagnosticCountChange={onDiagnosticCountChange}
        onCollapsedChange={(collapsed) =>
          onPrimaryPanelStateChange(collapsed ? 'collapsed' : 'expanded')
        }
        preset={preset}
      />
    </section>
  )
}
